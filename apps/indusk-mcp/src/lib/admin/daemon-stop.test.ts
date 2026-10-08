import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

	it("the same binary on another port is not ours", async () => {
		record({ pid: 9 });
		const kills: [number, string][] = [];
		await daemonStop(deps({ 9: `node ${nextBin} start --port 5555 -H 127.0.0.1` }, kills));
		expect(kills).toEqual([]);
	});
});
