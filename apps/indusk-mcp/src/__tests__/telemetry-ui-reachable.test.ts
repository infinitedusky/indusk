import { spawn } from "node:child_process";
import { mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * T2 — Jaeger UI is reachable on the daemon's UI port when the telemetry
 * daemon is running.
 *
 * Phase 2 shape: the Jaeger binary is resolved from the platform-specific npm
 * package via `require.resolve(...)`, spawned with a config file that points
 * its UI / OTLP ports at auto-picked free ports, then the test fetches the UI
 * endpoint and asserts the response contains "Jaeger" in the body.
 *
 * This test is platform-gated: it only runs on a platform where
 * `@infinitedusky/telemetry-binaries-{platform}` is installed in node_modules
 * (which in dev = only the current platform's package; others are SKIPPED by
 * npm's os/cpu filter). On unsupported platforms the test `.skip()`s at the
 * guard below.
 *
 * Slow: spawning Jaeger + waiting for it to bind takes ~2s. This test is
 * excluded from the fast-path vitest run via `SKIP_SLOW_TESTS=1`.
 */

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1";

function currentPlatformTag(): string {
	const os = process.platform; // "darwin" | "linux" | ...
	const arch = process.arch === "x64" ? "x64" : process.arch; // "arm64" | "x64"
	return `${os}-${arch}`;
}

function resolveJaegerBinary(): string | null {
	const require = createRequire(import.meta.url);
	try {
		return require.resolve(`@infinitedusky/telemetry-binaries-${currentPlatformTag()}/bin/jaeger`);
	} catch {
		return null;
	}
}

/**
 * Allocate N free ports simultaneously. Opens N listeners, collects their
 * OS-assigned ports, then closes them all at once. This avoids the sequential-
 * pickFreePort race where two back-to-back calls can return the same port
 * because the OS hasn't rotated its ephemeral pool yet.
 */
function pickFreePorts(n: number): Promise<number[]> {
	return new Promise((resolve, reject) => {
		const servers: Server[] = [];
		const ports: number[] = [];
		let remaining = n;
		for (let i = 0; i < n; i++) {
			const s = createServer();
			servers.push(s);
			s.once("error", reject);
			s.listen(0, () => {
				const addr = s.address();
				if (typeof addr === "object" && addr !== null) {
					ports.push(addr.port);
				}
				remaining -= 1;
				if (remaining === 0) {
					let closed = 0;
					for (const srv of servers) {
						srv.close(() => {
							closed += 1;
							if (closed === servers.length) resolve(ports);
						});
					}
				}
			});
		}
	});
}

async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.status === 200) return;
		} catch {
			// connection refused — not ready yet
		}
		await new Promise((r) => setTimeout(r, 100));
	}
	throw new Error(`timed out waiting for ${url}`);
}

let workDir: string;
let childPid: number | null = null;

describe("T2 — Jaeger UI reachable at the daemon's UI port", () => {
	beforeEach(() => {
		workDir = mkdtempSync(join(tmpdir(), "telemetry-t2-"));
	});

	afterEach(() => {
		if (childPid) {
			try {
				process.kill(childPid, "SIGTERM");
			} catch {
				// already gone
			}
			childPid = null;
		}
		rmSync(workDir, { recursive: true, force: true });
	});

	it.skipIf(SHOULD_SKIP || resolveJaegerBinary() === null)(
		"GET /api/services on the UI port returns 200 when Jaeger is running",
		async () => {
			const jaegerBin = resolveJaegerBinary();
			expect(jaegerBin, "platform package should be installed").not.toBeNull();
			if (!jaegerBin) return;

			const [otlpHttpPort, otlpGrpcPort, uiPort, uiGrpcPort, healthPort] = await pickFreePorts(5);

			// Write a minimal config keyed to the auto-picked ports. Shape
			// matches packages/telemetry-binaries-shared/jaeger-config.yaml but
			// with ports templated.
			const configPath = join(workDir, "jaeger-config.yaml");
			writeFileSync(
				configPath,
				`service:
  extensions: [jaeger_storage, jaeger_query, healthcheckv2]
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [jaeger_storage_exporter]
  telemetry:
    resource:
      service.name: jaeger
    metrics:
      level: none

extensions:
  healthcheckv2:
    use_v2: true
    http:
      endpoint: 0.0.0.0:${healthPort}
  jaeger_storage:
    backends:
      some_storage:
        memory:
          max_traces: 1000
  jaeger_query:
    storage:
      traces: some_storage
    http:
      endpoint: 0.0.0.0:${uiPort}
    grpc:
      endpoint: 0.0.0.0:${uiGrpcPort}

receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:${otlpGrpcPort}
      http:
        endpoint: 0.0.0.0:${otlpHttpPort}

processors:
  batch: {}

exporters:
  jaeger_storage_exporter:
    trace_storage: some_storage
`,
			);

			const logPath = join(workDir, "jaeger.log");
			const logFd = openSync(logPath, "a");
			const child = spawn(jaegerBin, [`--config=file:${configPath}`], {
				detached: false,
				stdio: ["ignore", logFd, logFd],
			});
			childPid = child.pid ?? null;
			expect(childPid).not.toBeNull();

			try {
				await waitForReady(`http://localhost:${healthPort}/status`, 15_000);
			} catch (err) {
				// Surface Jaeger's own log when readiness times out — otherwise the
				// failure is opaque (port collision? config typo? exec permission?).
				const tail = readFileSync(logPath, "utf-8").slice(-2000);
				throw new Error(
					`Jaeger did not become ready at :${healthPort} within 15s. Jaeger log tail:\n${tail}\n\nOriginal error: ${(err as Error).message}`,
				);
			}

			const res = await fetch(`http://localhost:${uiPort}/api/services`);
			expect(res.status).toBe(200);
			const body = await res.text();
			// /api/services returns JSON like {"data":[...],"total":0,"limit":0,"offset":0,"errors":null}
			expect(body).toContain('"data":');
		},
		30_000,
	);
});
