import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { daemonConfigPath } from "./daemon-process.js";
import { realDaemonReads } from "./daemon-reads.js";
import { daemonState } from "./daemon-state.js";
import { runReap } from "./reap-plan.js";
import { realStopDeps } from "./stop.js";

/**
 * Reap against real processes with real argv rather than a mocked `ps`. A mock
 * would assert that the parser matches the string its author chose, which is
 * the shape of the bug `reap` exists to clean up: a check that passes because
 * it was only ever shown the case its author imagined.
 *
 * Stand-ins for the shipped binaries are `sleep` processes exec'd through a
 * directory laid out like the real package, so the argv `reap` parses is
 * produced by the OS, not by the test. The home is the fixture root: a stray
 * is a process out of that home the record does not name, config file present
 * or gone.
 *
 * System tier: it starts real processes.
 */

const REAL_BIN_SHAPE = "node_modules/@infinitedusky/telemetry-binaries-test-arch/bin";

describe("telemetry reap against real processes", { timeout: 30000 }, () => {
	let root: string;
	let spawned: number[];

	/** A fake jaeger/otelcol out of `home` whose argv looks like the real thing. */
	function fakeDaemon(binary: "jaeger" | "otelcol", home: string, scheme = ""): number {
		const child = spawn(
			join(root, REAL_BIN_SHAPE, binary),
			[`--config=${scheme}${daemonConfigPath(home, binary)}`],
			{
				detached: true,
				stdio: "ignore",
			},
		);
		child.unref();
		if (!child.pid) throw new Error("fake daemon did not start");
		spawned.push(child.pid);
		return child.pid;
	}

	/** A record naming the given pair, so the home's daemon is recorded and the rest are strays. */
	function recordOf(jaegerPid: number, otelcolPid: number): void {
		writeFileSync(
			join(root, "telemetry.json"),
			JSON.stringify({
				jaegerPid,
				otelcolPid,
				otlpPort: 1,
				uiPort: 1,
				mcpPort: 1,
				logsOtlpPort: 1,
				jaegerHealthPort: 1,
				otelcolHealthPort: 1,
				startedAt: new Date().toISOString(),
				jaegerBinary: join(root, REAL_BIN_SHAPE, "jaeger"),
				otelcolBinary: join(root, REAL_BIN_SHAPE, "otelcol"),
				platform: "test-arch",
				logsPath: join(root, "telemetry", "logs.jsonl"),
			}),
		);
	}

	const alive = (pid: number): boolean => {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	};

	const reap = (opts: { dryRun?: boolean } = {}) =>
		runReap(realDaemonReads(root), root, realStopDeps, opts);

	beforeEach(() => {
		// realpath: a stray's home is read from its argv, which the OS prints resolved.
		root = realpathSync(mkdtempSync(join(tmpdir(), "orphan-test-")));
		spawned = [];
		const binDir = join(root, REAL_BIN_SHAPE);
		mkdirSync(binDir, { recursive: true });
		for (const name of ["jaeger", "otelcol"]) {
			writeFileSync(join(binDir, name), "#!/bin/sh\nsleep 60\n", { mode: 0o755 });
		}
	});

	afterEach(() => {
		for (const pid of spawned) {
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// already gone
			}
		}
		rmSync(root, { recursive: true, force: true });
	});

	it("finds a daemon process and reads its config path", () => {
		writeFileSync(daemonConfigPath(root, "otelcol"), "x: 1\n");
		const pid = fakeDaemon("otelcol", root);
		const found = realDaemonReads(root)
			.processes()
			.find((p) => p.pid === pid);
		expect(found?.command, "reap must see a process shaped like the real binary").toContain(
			daemonConfigPath(root, "otelcol"),
		);
	});

	it("strips jaeger's file: scheme before judging the path", () => {
		writeFileSync(daemonConfigPath(root, "jaeger"), "x: 1\n");
		const live = fakeDaemon("otelcol", root);
		writeFileSync(daemonConfigPath(root, "otelcol"), "x: 1\n");
		const pid = fakeDaemon("jaeger", root, "file:");
		recordOf(0, live);
		const state = daemonState(realDaemonReads(root), root);
		expect(state.strays.map((p) => p.pid)).toEqual([pid]);
	});

	it("a stray whose config file is gone, and one whose config file still exists, are both stopped; the recorded one is left alone", async () => {
		writeFileSync(daemonConfigPath(root, "otelcol"), "x: 1\n");
		const recorded = fakeDaemon("otelcol", root);
		const present = fakeDaemon("jaeger", root);
		writeFileSync(daemonConfigPath(root, "jaeger"), "x: 1\n");
		const orphan = fakeDaemon("jaeger", root);
		recordOf(0, recorded);
		rmSync(daemonConfigPath(root, "jaeger")); // exactly what deleting a config underneath it does

		const out = await reap();
		expect(out.stopped.map((p) => p.pid).sort()).toEqual([orphan, present].sort());
		await new Promise((r) => setTimeout(r, 300));
		expect(alive(orphan) || alive(present), "both strays are gone").toBe(false);
		expect(alive(recorded), "the recorded daemon must survive").toBe(true);
	});

	it("another home's daemon is never touched from this home", async () => {
		const other = realpathSync(mkdtempSync(join(tmpdir(), "orphan-other-")));
		try {
			writeFileSync(daemonConfigPath(root, "otelcol"), "x: 1\n");
			const recorded = fakeDaemon("otelcol", root);
			recordOf(0, recorded);
			const strangerHome = fakeDaemon("jaeger", other);
			const out = await reap();
			expect(out.stopped).toEqual([]);
			expect(alive(strangerHome), "another home's daemon must survive").toBe(true);
		} finally {
			rmSync(other, { recursive: true, force: true });
		}
	});

	it("dry-run names the stray without signalling it", async () => {
		writeFileSync(daemonConfigPath(root, "otelcol"), "x: 1\n");
		const recorded = fakeDaemon("otelcol", root);
		const stray = fakeDaemon("jaeger", root);
		recordOf(0, recorded);
		const out = await reap({ dryRun: true });
		expect(out.text).toContain(`Would stop jaeger ${stray}`);
		await new Promise((r) => setTimeout(r, 300));
		expect(alive(stray), "dry-run must not kill anything").toBe(true);
	});
});
