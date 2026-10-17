// clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
// promise: the-daemon-readers-follow-is-the-one-running
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A22 — with two daemons in one temporary home and the record naming one,
 * `reap` stops the other and the recorded one still receives traces.
 *
 * The second daemon is what a lost record leaves behind: a start that did not
 * know the first was running. Both are started by the built CLI in one
 * temporary INDUSK_HOME, so both carry a config file that exists, which is
 * why the orphan test (config gone) never matches the stray.
 *
 * System tier: it starts two real Jaegers and two collectors.
 */

const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_BIN = join(REPO_ROOT, "apps/indusk-mcp/dist/bin/cli.js");
const SHOULD_SKIP = process.env.SKIP_SLOW_TESTS === "1" || !existsSync(CLI_BIN);

interface Meta {
	jaegerPid: number;
	otelcolPid: number;
	otlpPort: number;
	uiPort: number;
}

let home: string;
const everyPid: number[] = [];

function cli(args: string[]): { code: number; stdout: string; stderr: string } {
	const r = spawnSync("node", [CLI_BIN, ...args], {
		env: { ...process.env, INDUSK_HOME: home },
		encoding: "utf-8",
	});
	return { code: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function readMeta(): Meta {
	return JSON.parse(readFileSync(join(home, "telemetry.json"), "utf-8")) as Meta;
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

beforeAll(() => {
	if (!SHOULD_SKIP) home = mkdtempSync(join(tmpdir(), "reap-strays-"));
});

afterAll(() => {
	if (SHOULD_SKIP) return;
	for (const pid of everyPid) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// already gone
		}
	}
	rmSync(home, { recursive: true, force: true });
});

describe("reap stops the stray beside the recorded daemon", () => {
	it.skipIf(SHOULD_SKIP)(
		"the other daemon is gone and the recorded one still receives traces",
		async () => {
			const first = cli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(first.code, first.stderr || first.stdout).toBe(0);
			const recorded = readMeta();
			everyPid.push(recorded.jaegerPid, recorded.otelcolPid);

			// Lose the record, as a read once did, and start another beside it.
			const keep = { json: join(home, "keep.json"), pid: join(home, "keep.pid") };
			copyFileSync(join(home, "telemetry.json"), keep.json);
			copyFileSync(join(home, "telemetry.pid"), keep.pid);
			rmSync(join(home, "telemetry.json"));
			rmSync(join(home, "telemetry.pid"));
			const second = cli(["telemetry", "start", "--otlp-port", "0", "--ui-port", "0"]);
			expect(second.code, second.stderr || second.stdout).toBe(0);
			const stray = readMeta();
			everyPid.push(stray.jaegerPid, stray.otelcolPid);
			expect(stray.jaegerPid).not.toBe(recorded.jaegerPid);

			// The record names the first daemon again.
			copyFileSync(keep.json, join(home, "telemetry.json"));
			copyFileSync(keep.pid, join(home, "telemetry.pid"));

			cli(["telemetry", "reap"]);

			expect(alive(stray.jaegerPid), "the stray Jaeger is stopped").toBe(false);
			expect(alive(stray.otelcolPid), "the stray collector is stopped").toBe(false);
			expect(alive(recorded.jaegerPid), "the recorded Jaeger keeps running").toBe(true);

			const now = BigInt(Date.now()) * 1_000_000n;
			const res = await fetch(`http://127.0.0.1:${recorded.otlpPort}/v1/traces`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					resourceSpans: [
						{
							resource: {
								attributes: [{ key: "service.name", value: { stringValue: "reap-strays-a22" } }],
							},
							scopeSpans: [
								{
									spans: [
										{
											traceId: "5b8efff798038103d269b633813fc60d",
											spanId: "eee19b7ec3c1b175",
											name: "after-reap",
											kind: 1,
											startTimeUnixNano: String(now),
											endTimeUnixNano: String(now + 1_000_000n),
										},
									],
								},
							],
						},
					],
				}),
			});
			expect(res.status).toBe(200);
			let seen = false;
			for (let i = 0; i < 60 && !seen; i++) {
				const services = (await (
					await fetch(`http://127.0.0.1:${recorded.uiPort}/api/services`)
				).json()) as { data?: string[] };
				seen = services.data?.includes("reap-strays-a22") ?? false;
				if (!seen) await new Promise((r) => setTimeout(r, 250));
			}
			expect(seen, "the trace appears in the recorded daemon's interface").toBe(true);
		},
		90_000,
	);
});
