import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiStop } from "../../bin/commands/ui.js";
import { type DaemonDeps, type DaemonMeta, daemonStatus, daemonStop } from "./daemon.js";

/**
 * small-fixes — A12: `indusk ui stop` judges its daemon by its command line,
 * never by whether its port answers. The same bug `telemetry stop` had
 * (telemetry-stop-stops-what-it-started): under load a slow port made stop
 * skip its own process and delete the record.
 *
 * promise: indusk-stops-only-its-own-daemons
 */

let home: string;
const previousHome = process.env.INDUSK_HOME;
const adminDir = "/opt/indusk/admin";
const nextBin = "/opt/indusk/node_modules/next/dist/bin/next";

beforeEach(() => {
	home = mkdtempSync(join(tmpdir(), "ui-stop-"));
	process.env.INDUSK_HOME = home;
});
afterEach(() => {
	if (previousHome === undefined) delete process.env.INDUSK_HOME;
	else process.env.INDUSK_HOME = previousHome;
	rmSync(home, { recursive: true, force: true });
});

function record(meta: Partial<DaemonMeta> & { pid: number }): void {
	writeFileSync(join(home, "admin-ui.pid"), String(meta.pid));
	writeFileSync(
		join(home, "admin-ui.json"),
		JSON.stringify({ port: 4321, startedAt: "2026-10-08T00:00:00Z", adminDir, nextBin, ...meta }),
	);
}

/** A process table: pid → command line; the port is never asked. */
function deps(commands: Record<number, string>, kills: [number, string][] = []): DaemonDeps {
	let gone = new Set<number>();
	return {
		alive: (pid) => pid in commands && !gone.has(pid),
		command: (pid) => commands[pid] ?? null,
		kill: (pid, signal) => {
			kills.push([pid, signal]);
			gone = new Set([...gone, pid]);
		},
		sleep: async () => {},
	};
}

describe("A12 — ui stop stops its own daemon by its command line, never by its port", () => {
	it("a port slow to answer does not matter: the recorded process is ours by its command line, and is stopped", async () => {
		record({ pid: 4242 });
		const kills: [number, string][] = [];
		const r = await daemonStop(
			deps({ 4242: `node ${nextBin} start --port 4321 -H 127.0.0.1` }, kills),
		);
		expect(kills).toEqual([[4242, "SIGTERM"]]);
		expect(r).toMatchObject({ stopped: true, signaledPid: 4242 });
	});

	it("a PID recycled to a stranger is never signalled; the stale record is cleaned up", async () => {
		record({ pid: 4242 });
		const kills: [number, string][] = [];
		const r = await daemonStop(deps({ 4242: "postgres -D /var/db" }, kills));
		expect(kills).toEqual([]);
		expect(r.stopped).toBe(true);
		expect((await daemonStatus()).running).toBe(false);
	});

	it("a record from before the binary was written down still matches on `next` and the port flag", async () => {
		record({ pid: 7, nextBin: undefined });
		const kills: [number, string][] = [];
		await daemonStop(deps({ 7: "node /somewhere/next/dist/bin/next start --port 4321" }, kills));
		expect(kills).toEqual([[7, "SIGTERM"]]);
	});

	it("a daemon still running after SIGTERM and SIGKILL is reported, not recorded as stopped", async () => {
		record({ pid: 4242 });
		const kills: [number, string][] = [];
		const table = deps({ 4242: `node ${nextBin} start --port 4321 -H 127.0.0.1` }, kills);
		table.kill = (pid, signal) => {
			kills.push([pid, signal]);
		};
		const r = await daemonStop(table);
		expect(kills).toEqual([
			[4242, "SIGTERM"],
			[4242, "SIGKILL"],
		]);
		expect(r).toEqual({ stopped: false, signaledPid: 4242, usedSigkill: true });
		expect(existsSync(join(home, "admin-ui.pid")), "the record of a live daemon is kept").toBe(
			true,
		);
	});

	it("`indusk ui stop` exits non-zero naming a daemon that would not stop", async () => {
		record({ pid: 4242 });
		const kills: [number, string][] = [];
		const table = deps({ 4242: `node ${nextBin} start --port 4321 -H 127.0.0.1` }, kills);
		table.kill = (pid, signal) => {
			kills.push([pid, signal]);
		};
		const said: string[] = [];
		const error = vi.spyOn(console, "error").mockImplementation((line: unknown) => {
			said.push(String(line));
		});
		const exitCode = process.exitCode;
		try {
			await uiStop(table);
			expect(process.exitCode).toBe(1);
			expect(said.join("\n")).toContain("PID 4242");
			expect(said.join("\n")).toContain("would not stop");
		} finally {
			error.mockRestore();
			process.exitCode = exitCode;
		}
	});

	it("the same binary on another port is not ours", async () => {
		record({ pid: 9 });
		const kills: [number, string][] = [];
		await daemonStop(deps({ 9: `node ${nextBin} start --port 5555 -H 127.0.0.1` }, kills));
		expect(kills).toEqual([]);
	});
});

/**
 * small-fixes A17 (falsification). A12's fixtures composed the command line
 * from the spawn arguments; `next start` rewrites its process title, and `ps`
 * read the live daemon on 2026-10-08 as `next-server (v16.2.4)` — no binary,
 * no port. The working directory moves too: an install renames the old
 * package folder aside. Its start time does not: `ps -o lstart=` gave the
 * record's `startedAt` to the second, and the machine's two other
 * `next-server`s started a day later.
 */
describe("A17 — the daemon as `ps` really reports it", () => {
	const REAL = "next-server (v16.2.4)      ";
	const startedAt = "2026-10-08T00:00:00.639Z";
	const withStart = (table: DaemonDeps, at: Date | null) =>
		Object.assign(table, { startTime: () => at });

	it("is recognised by `next` and its start time, and stopped", async () => {
		record({ pid: 4242, startedAt });
		const kills: [number, string][] = [];
		await daemonStop(withStart(deps({ 4242: REAL }, kills), new Date("2026-10-08T00:00:00Z")));
		expect(kills).toEqual([[4242, "SIGTERM"]]);
	});

	it("another next-server, started at another time, is never signalled", async () => {
		record({ pid: 27316, startedAt });
		const kills: [number, string][] = [];
		const r = await daemonStop(
			withStart(deps({ 27316: REAL }, kills), new Date("2026-10-08T18:38:48Z")),
		);
		expect(kills).toEqual([]);
		expect(r.stopped).toBe(true);
	});

	it("a start time that cannot be read is not ours", async () => {
		record({ pid: 4242, startedAt });
		const kills: [number, string][] = [];
		await daemonStop(withStart(deps({ 4242: REAL }, kills), null));
		expect(kills).toEqual([]);
	});
});
