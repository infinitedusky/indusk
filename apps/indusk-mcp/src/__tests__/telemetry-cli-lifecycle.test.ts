import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
// promise: the-daemon-readers-follow-is-the-one-running
/**
 * T1 — `indusk telemetry start` brings up the daemon in <10s and prints
 *      every port it was given (traces, logs, interface, MCP). A daemon in a
 *      temporary home binds exactly the ports the test hands it (A2): a trace
 *      sent to the traces port appears in the interface, a log record sent to
 *      the logs port is accepted and written to the logs file.
 * T3 — `indusk telemetry status` after a successful start reports "running",
 *      all four ports, and registered-project count.
 * T4 — `indusk telemetry stop` shuts the daemon down within 3s; subsequent
 *      `status` reports "not running".
 * T5 — `indusk telemetry restart` stops + starts fresh processes — Jaeger +
 *      otelcol PIDs after restart differ from before.
 *
 * Each test spawns the real CLI subprocess against a temp INDUSK_HOME so its
 * PID/port files don't collide with the user's real `~/.indusk/`.
 *
 * SLOW TESTS — each spawns both binaries (Jaeger + otelcol) which takes
 * a few seconds to warm up. Skipped when SKIP_SLOW_TESTS=1.
 *
 * Prerequisite: `pnpm build` in apps/indusk-mcp/ has run so that
 * `dist/bin/cli.js` exists. The test asserts on this at setup.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");

const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

let testHome: string;

/** Four free ports, picked together so no two are the same. */
async function pickFourPorts(): Promise<{ traces: number; ui: number; logs: number; mcp: number }> {
	const servers = await Promise.all(
		[0, 1, 2, 3].map(
			() =>
				new Promise<ReturnType<typeof createServer>>((res, rej) => {
					const s = createServer();
					s.once("error", rej);
					s.listen(0, () => res(s));
				}),
		),
	);
	const ports = servers.map((s) => (s.address() as { port: number }).port);
	await Promise.all(servers.map((s) => new Promise((r) => s.close(() => r(null)))));
	return { traces: ports[0], ui: ports[1], logs: ports[2], mcp: ports[3] };
}

function givenPortArgs(p: { traces: number; ui: number; logs: number; mcp: number }): string[] {
	return [
		"--otlp-port",
		String(p.traces),
		"--ui-port",
		String(p.ui),
		"--logs-port",
		String(p.logs),
		"--mcp-port",
		String(p.mcp),
	];
}

function expectAllFourPrinted(
	out: string,
	p: { traces: number; ui: number; logs: number; mcp: number },
): void {
	for (const port of [p.traces, p.ui, p.logs, p.mcp]) {
		expect(out, `port ${port} is printed`).toMatch(new RegExp(`:${port}\\b`));
	}
}

async function postJson(url: string, body: unknown): Promise<number> {
	const res = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
	return res.status;
}

function traceBody(service: string): unknown {
	const now = BigInt(Date.now()) * 1_000_000n;
	return {
		resourceSpans: [
			{
				resource: { attributes: [{ key: "service.name", value: { stringValue: service } }] },
				scopeSpans: [
					{
						spans: [
							{
								traceId: "5b8efff798038103d269b633813fc60c",
								spanId: "eee19b7ec3c1b174",
								name: "lifecycle-probe",
								kind: 1,
								startTimeUnixNano: String(now),
								endTimeUnixNano: String(now + 1_000_000n),
							},
						],
					},
				],
			},
		],
	};
}

function logBody(marker: string): unknown {
	return {
		resourceLogs: [
			{
				resource: { attributes: [{ key: "service.name", value: { stringValue: "lifecycle" } }] },
				scopeLogs: [
					{
						logRecords: [
							{
								timeUnixNano: String(BigInt(Date.now()) * 1_000_000n),
								severityText: "INFO",
								body: { stringValue: marker },
							},
						],
					},
				],
			},
		],
	};
}

async function until<T>(read: () => Promise<T | null> | T | null, ms: number): Promise<T | null> {
	const deadline = Date.now() + ms;
	while (Date.now() < deadline) {
		const v = await read();
		if (v !== null) return v;
		await new Promise((r) => setTimeout(r, 250));
	}
	return null;
}

beforeEach(() => {
	testHome = mkdtempSync(join(tmpdir(), "telemetry-home-"));
});

afterEach(() => {
	if (existsSync(join(testHome, "telemetry.pid"))) {
		runCli(["telemetry", "stop"]);
	}
	if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
});

function runCli(args: string[]): {
	code: number;
	stdout: string;
	stderr: string;
} {
	const result = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: testHome },
		encoding: "utf-8",
	});
	return {
		code: result.status ?? -1,
		stdout: result.stdout,
		stderr: result.stderr,
	};
}

function readPidsFromStatus(): {
	jaegerPid: number | null;
	otelcolPid: number | null;
} {
	const pidFile = join(testHome, "telemetry.json");
	if (!existsSync(pidFile)) return { jaegerPid: null, otelcolPid: null };
	const meta = JSON.parse(require("node:fs").readFileSync(pidFile, "utf-8")) as {
		jaegerPid?: number;
		otelcolPid?: number;
	};
	return {
		jaegerPid: meta.jaegerPid ?? null,
		otelcolPid: meta.otelcolPid ?? null,
	};
}

describe("T1 — `indusk telemetry start` brings up the daemon", () => {
	it.skipIf(SHOULD_SKIP)(
		"start exits 0 and prints all four given ports; a trace and a log record both arrive",
		async () => {
			const ports = await pickFourPorts();
			const result = runCli(["telemetry", "start", ...givenPortArgs(ports)]);
			expect(result.code, `stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(0);
			expectAllFourPrinted(result.stdout, ports);

			// A2: a trace sent to the traces port shows in the interface.
			expect(
				await postJson(`http://127.0.0.1:${ports.traces}/v1/traces`, traceBody("lifecycle-a2")),
			).toBe(200);
			const seen = await until(async () => {
				const res = await fetch(`http://127.0.0.1:${ports.ui}/api/services`);
				const body = (await res.json()) as { data?: string[] };
				return body.data?.includes("lifecycle-a2") ? true : null;
			}, 15_000);
			expect(seen, "the trace appears in the interface").toBe(true);

			// A2: a log record sent to the logs port is accepted and written to the logs file.
			const marker = `lifecycle-log-${Date.now()}`;
			const status = await postJson(`http://127.0.0.1:${ports.logs}/v1/logs`, logBody(marker));
			expect(status).toBeGreaterThanOrEqual(200);
			expect(status).toBeLessThan(300);
			const logsFile = join(testHome, "telemetry", "logs.jsonl");
			const written = await until(
				() =>
					existsSync(logsFile) && readFileSync(logsFile, "utf-8").includes(marker) ? true : null,
				15_000,
			);
			expect(written, "the log record is in the logs file").toBe(true);
		},
		60_000,
	);
});

describe("T3 — `indusk telemetry status` after start", () => {
	it.skipIf(SHOULD_SKIP)(
		"reports running + all four ports + project count",
		async () => {
			const ports = await pickFourPorts();
			runCli(["telemetry", "start", ...givenPortArgs(ports)]);
			const status = runCli(["telemetry", "status"]);
			expect(status.code).toBe(0);
			expect(status.stdout.toLowerCase()).toContain("running");
			expectAllFourPrinted(status.stdout, ports);
			// Registered projects count line (0 for fresh test home)
			expect(status.stdout).toMatch(/project/i);
		},
		30_000,
	);
});

/** Every running process whose command line names this test's home: what `check-test-daemons` looks for. */
function processesFromHome(): string[] {
	const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf-8" });
	return ps.stdout.split("\n").filter((l) => l.includes(testHome));
}

describe("T4 — `indusk telemetry stop` shuts down in <3s", () => {
	it.skipIf(SHOULD_SKIP)(
		"stop exits 0 and status after reports not running",
		async () => {
			// A failed start names its reason here (the 1.64.0 release hid it).
			const start = runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(start.code, start.stderr || start.stdout).toBe(0);
			const stop = runCli(["telemetry", "stop"]);
			expect(stop.code).toBe(0);
			const status = runCli(["telemetry", "status"]);
			expect(status.stdout.toLowerCase()).toContain("not running");
		},
		30_000,
	);

	// promise: indusk-stops-only-its-own-daemons — telemetry-stop A4. The
	// 1.65.0 release left nine processes from temporary homes, each with its
	// record deleted: stop had reported them stopped.
	it.skipIf(SHOULD_SKIP)(
		"after stop, no Jaeger or otelcol is left running from the home",
		async () => {
			const start = runCli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(start.code, start.stderr || start.stdout).toBe(0);
			expect(processesFromHome().length, "the daemon is running from the home").toBeGreaterThan(0);
			expect(runCli(["telemetry", "stop"]).code).toBe(0);
			expect(processesFromHome(), "nothing left running from the home").toEqual([]);
		},
		30_000,
	);
});

describe("T5 — `indusk telemetry restart` respawns both binaries", () => {
	it.skipIf(SHOULD_SKIP)(
		"PIDs after restart differ from PIDs before, on the same four ports",
		async () => {
			const ports = await pickFourPorts();
			const start = runCli(["telemetry", "start", ...givenPortArgs(ports)]);
			expect(start.code, start.stderr || start.stdout).toBe(0);
			const before = readPidsFromStatus();
			expect(before.jaegerPid).not.toBeNull();
			expect(before.otelcolPid).not.toBeNull();

			const restart = runCli(["telemetry", "restart"]);
			expect(restart.code).toBe(0);

			const after = readPidsFromStatus();
			expect(after.jaegerPid).not.toBeNull();
			expect(after.otelcolPid).not.toBeNull();
			expect(after.jaegerPid).not.toBe(before.jaegerPid);
			expect(after.otelcolPid).not.toBe(before.otelcolPid);
			expectAllFourPrinted(runCli(["telemetry", "status"]).stdout, ports);
		},
		45_000,
	);
});
