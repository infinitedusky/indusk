import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { type AlwaysOnServer, startAlwaysOnServer } from "./helpers/always-on-server.js";
import { SHOULD_SKIP } from "./helpers/cli.js";
import { type SlackCapture, startSlackCapture } from "./helpers/slack-capture.js";

/**
 * watcher-heartbeat — A6, A7: the always-on server proves, on its own clock,
 * that it can still hear (ADR D2).
 *
 * A6 — every pass sends a heartbeat into the server's own intake, so its
 * Jaeger always holds a recent one.
 *
 * A7 — when heartbeats stop landing, Slack hears once; when they land again,
 * once more. The Jaeger is frozen (`SIGSTOP`) rather than the server stopped:
 * the pass runs in the server's process, and stopping it would stop the thing
 * that must notice. A frozen Jaeger answers nothing — the read fails and no
 * beat lands — and `SIGCONT` brings it back with its storage intact. Slack is
 * reached over HTTP, not through Jaeger, so the message arrives anyway.
 *
 * Red today: the server sends no heartbeat and says nothing about its own
 * hearing.
 */

const LESSON =
	"lesson: an-alarm-must-not-travel-the-path-it-reports — Slack over HTTPS, never Jaeger; once on each change of state";
const INTERVAL_MS = 1_000;
const STALE_MS = 3_000;

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** The server's Jaeger child — the one process started with this volume's config. */
function findJaegerPid(volume: string): number | null {
	const ps = spawnSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf-8" });
	const config = `file:${join(volume, "jaeger-server.yaml")}`;
	const line = ps.stdout.split("\n").find((l) => l.includes(config));
	return line ? Number(line.trim().split(/\s+/)[0]) : null;
}

function jaegerPid(volume: string): number {
	const pid = findJaegerPid(volume);
	if (pid === null) throw new Error(`no Jaeger process for ${volume}`);
	return pid;
}

/** Newest `watcher.heartbeat` span's start time in ms, or null when there is none. */
async function newestBeat(server: AlwaysOnServer): Promise<number | null> {
	const res = await server.query(
		"/api/traces?service=indusk-watcher&operation=watcher.heartbeat&limit=50&lookback=1h",
	);
	if (!res.ok) return null;
	const json = (await res.json()) as {
		data?: { spans?: { operationName: string; startTime: number }[] }[];
	} | null;
	const times = (json?.data ?? [])
		.flatMap((t) => t.spans ?? [])
		.filter((s) => s.operationName === "watcher.heartbeat")
		.map((s) => s.startTime / 1_000);
	return times.length ? Math.max(...times) : null;
}

function count(slack: SlackCapture, pattern: RegExp): number {
	return slack.texts().filter((t) => pattern.test(t)).length;
}

async function waitFor(pred: () => boolean | Promise<boolean>, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (!(await pred())) {
		if (Date.now() > deadline) return;
		await sleep(250);
	}
}

describe.skipIf(SHOULD_SKIP)("watcher-heartbeat — the server's heartbeat", () => {
	let server: AlwaysOnServer | undefined;
	let slack: SlackCapture | undefined;
	let frozen: number | undefined;

	afterEach(async () => {
		// A frozen Jaeger queues SIGTERM until it runs again: thaw it first, or
		// the server's stop waits on a process that cannot exit.
		if (frozen) process.kill(frozen, "SIGCONT");
		frozen = undefined;
		await server?.stop();
		// A Jaeger that was frozen can still be shutting down when the server's
		// stop gives up and kills the server; it would outlive the test.
		const orphan = server ? findJaegerPid(server.volume) : null;
		if (orphan) process.kill(orphan, "SIGKILL");
		if (server) rmSync(server.volume, { recursive: true, force: true });
		server = undefined;
		await slack?.close();
		slack = undefined;
	});

	afterAll(() => {
		if (frozen) process.kill(frozen, "SIGCONT");
	});

	it("A6 — every pass leaves a heartbeat no older than one pass interval", async () => {
		server = await startAlwaysOnServer({
			env: { INDUSK_SERVER_PASS_INTERVAL_MS: String(INTERVAL_MS) },
		});
		const s = server;
		await waitFor(async () => (await newestBeat(s)) !== null, 15_000);
		await sleep(3 * INTERVAL_MS);
		const beat = await newestBeat(s);
		expect(beat, "a heartbeat span in the server's own Jaeger").not.toBeNull();
		// One interval, plus the time Jaeger takes to make a span queryable.
		expect(Date.now() - (beat ?? 0)).toBeLessThan(INTERVAL_MS + 1_500);
	}, 60_000);

	it("A7 — one Slack message on going blind, one on recovering, none in between", async () => {
		slack = await startSlackCapture();
		server = await startAlwaysOnServer({
			env: {
				INDUSK_SERVER_PASS_INTERVAL_MS: String(INTERVAL_MS),
				INDUSK_SERVER_WATCHER_STALE_MS: String(STALE_MS),
				INDUSK_SERVER_SLACK_WEBHOOK: slack.url,
			},
		});
		const s = slack;
		const blind = /watcher blind since/i;
		const recovered = /watcher recovered/i;

		// A clean start is listening: nothing to say.
		await sleep(STALE_MS + 2 * INTERVAL_MS);
		expect(s.texts(), "a listening server says nothing").toEqual([]);

		frozen = jaegerPid(server.volume);
		process.kill(frozen, "SIGSTOP");
		await waitFor(() => count(s, blind) > 0, 30_000);
		expect(count(s, blind), `Slack heard that the watcher went blind — ${LESSON}`).toBe(1);
		await sleep(5 * INTERVAL_MS);
		expect(count(s, blind), `and heard it once, not once per pass — ${LESSON}`).toBe(1);

		process.kill(frozen, "SIGCONT");
		frozen = undefined;
		await waitFor(() => count(s, recovered) > 0, 30_000);
		expect(count(s, recovered), "Slack heard that the watcher recovered").toBe(1);
		await sleep(3 * INTERVAL_MS);
		expect(count(s, recovered)).toBe(1);
		expect(count(s, blind)).toBe(1);
	}, 120_000);
});
