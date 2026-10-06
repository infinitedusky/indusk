import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionManager } from "../lib/session/manager.js";

/**
 * promise: a-session-can-be-stopped — admin-plan-authoring A22, a contract with the OS.
 *
 * No session the admin started is left running when the admin stops, or when
 * it starts again after a crash. The sessions here are real processes — a
 * stand-in `claude` that waits on its input and never answers — because the
 * question is about processes outliving their owner, which a fake cannot
 * show. System tier: it starts processes that would outlive a failed test.
 */

const dirs: string[] = [];
const pids: number[] = [];
afterEach(() => {
	for (const pid of pids.splice(0)) {
		try {
			process.kill(pid, "SIGKILL");
		} catch {
			// already gone, which is what the test wanted
		}
	}
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function setup() {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "admin-sessions-")));
	dirs.push(dir);
	// A `claude` that reads its input and ignores it — it stops only when killed.
	const bin = join(dir, "claude-standin");
	writeFileSync(
		bin,
		"#!/usr/bin/env node\nprocess.stdin.resume();\nsetInterval(() => {}, 1000);\n",
	);
	chmodSync(bin, 0o755);
	return { dir, bin, record: join(dir, "admin-sessions.json") };
}

const alive = (pid: number) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

const until = async (check: () => boolean, ms = 10_000) => {
	const end = Date.now() + ms;
	while (!check() && Date.now() < end) await new Promise((r) => setTimeout(r, 50));
	return check();
};

describe("A22 — no session outlives the admin", () => {
	it("stopAll, as `indusk ui stop` runs it, ends a session that will not stop on its own", async () => {
		const { dir, bin, record } = setup();
		const m = new SessionManager({ recordPath: record });
		const { session } = m.start({
			cwd: dir,
			kind: "planning",
			prompt: "hi",
			claudeBin: bin,
			onEvent: () => {},
			project: "p",
			plan: "x",
		});
		pids.push(session.pid);
		expect(alive(session.pid)).toBe(true);
		await m.stopAll(500);
		expect(await until(() => !alive(session.pid))).toBe(true);
	}, 30_000);

	it("a daemon starting after a crash ends the session its predecessor recorded", async () => {
		const { dir, bin, record } = setup();
		const crashed = new SessionManager({ recordPath: record });
		const { session } = crashed.start({
			cwd: dir,
			kind: "build",
			prompt: "hi",
			claudeBin: bin,
			onEvent: () => {},
			project: "p",
			plan: "x",
		});
		pids.push(session.pid);
		// The daemon dies without stopping anything: its manager is simply dropped.
		const next = new SessionManager({ recordPath: record });
		const reaped = await next.reapRecorded();
		expect(reaped).toEqual([session.pid]);
		expect(await until(() => !alive(session.pid))).toBe(true);
		expect(JSON.parse(readFileSync(record, "utf-8")).sessions).toEqual([]);
	}, 30_000);

	it("a recorded pid now held by some other program is left alone", async () => {
		const { dir, record } = setup();
		const sleeper = spawn("sleep", ["30"], {
			stdio: "ignore",
		});
		pids.push(sleeper.pid as number);
		writeFileSync(
			record,
			JSON.stringify({
				version: 1,
				sessions: [
					{
						id: "s1",
						pid: sleeper.pid,
						bin: join(dir, "claude-standin"),
						cwd: dir,
						project: "p",
						plan: "x",
						kind: "build",
						startedAt: "2026-10-06T00:00:00Z",
					},
				],
			}),
		);
		const reaped = await new SessionManager({ recordPath: record }).reapRecorded();
		expect(reaped).toEqual([]);
		expect(alive(sleeper.pid as number)).toBe(true);
	}, 30_000);
});
