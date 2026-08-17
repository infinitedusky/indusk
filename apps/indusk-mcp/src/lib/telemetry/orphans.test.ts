import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listTelemetryProcesses, reapOrphans } from "./orphans.js";

/**
 * The orphan test is the whole point of the command, so it is exercised against
 * real processes with real argv rather than a mocked `ps`. A mock would assert
 * that the regex matches the string I chose to feed it, which is the shape of
 * the bug this command exists to clean up: a check that passes because it was
 * only ever shown the case its author imagined.
 *
 * Stand-ins for the shipped binaries are `sleep` processes exec'd through a
 * directory laid out like the real package, so the argv the reaper parses is
 * produced by the OS, not by the test.
 */

const REAL_BIN_SHAPE = "node_modules/@infinitedusky/telemetry-binaries-test-arch/bin";

describe("telemetry orphan detection", { timeout: 30000 }, () => {
	let root: string;
	let spawned: number[];

	/** Start a fake jaeger/otelcol whose argv looks like the real thing. */
	function fakeDaemon(binary: "jaeger" | "otelcol", configPath: string, scheme = ""): number {
		const binDir = join(root, REAL_BIN_SHAPE);
		const binPath = join(binDir, binary);
		const child = spawn(binPath, [`--config=${scheme}${configPath}`], {
			detached: true,
			stdio: "ignore",
		});
		child.unref();
		if (!child.pid) throw new Error("fake daemon did not start");
		spawned.push(child.pid);
		return child.pid;
	}

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), "orphan-test-"));
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

	it("finds a telemetry process and reads its config path", () => {
		const config = join(root, "live.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("otelcol", config);

		const found = listTelemetryProcesses().find((p) => p.pid === pid);
		expect(found, "the reaper must see a process shaped like the real binary").toBeDefined();
		expect(found?.binary).toBe("otelcol");
		expect(found?.configPath).toBe(config);
	});

	it("a process whose config still exists is NOT an orphan", () => {
		const config = join(root, "live.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("otelcol", config);

		expect(listTelemetryProcesses().find((p) => p.pid === pid)?.orphaned).toBe(false);
	});

	it("a process whose config was deleted IS an orphan", () => {
		const config = join(root, "doomed.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("otelcol", config);
		rmSync(config); // exactly what deleting a temp INDUSK_HOME does

		expect(listTelemetryProcesses().find((p) => p.pid === pid)?.orphaned).toBe(true);
	});

	it("strips jaeger's file: scheme before testing the path", () => {
		const config = join(root, "jaeger.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("jaeger", config, "file:");

		const found = listTelemetryProcesses().find((p) => p.pid === pid);
		expect(found?.configPath, "file: prefix must not leak into the path test").toBe(config);
		expect(found?.orphaned).toBe(false);
	});

	it("reap kills the orphan and leaves the live one alone", async () => {
		const liveConfig = join(root, "live.yaml");
		writeFileSync(liveConfig, "x: 1\n");
		const livePid = fakeDaemon("otelcol", liveConfig);

		const deadConfig = join(root, "dead.yaml");
		writeFileSync(deadConfig, "x: 1\n");
		const orphanPid = fakeDaemon("otelcol", deadConfig);
		rmSync(deadConfig);

		const result = reapOrphans();
		expect(result.killed).toContain(orphanPid);
		expect(result.killed).not.toContain(livePid);

		await new Promise((r) => setTimeout(r, 500));
		expect(() => process.kill(orphanPid, 0), "orphan should be gone").toThrow();
		expect(() => process.kill(livePid, 0), "live daemon must survive").not.toThrow();
	});

	it("dry-run identifies the orphan without signalling it", async () => {
		const config = join(root, "dead.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("otelcol", config);
		rmSync(config);

		const result = reapOrphans({ dryRun: true });
		expect(result.orphans.map((o) => o.pid)).toContain(pid);
		expect(result.killed).toEqual([]);

		await new Promise((r) => setTimeout(r, 300));
		expect(() => process.kill(pid, 0), "dry-run must not kill anything").not.toThrow();
	});

	it("never signals a PID the registry claims, even if its config is gone", async () => {
		const config = join(root, "dead.yaml");
		writeFileSync(config, "x: 1\n");
		const pid = fakeDaemon("otelcol", config);
		rmSync(config);

		const result = reapOrphans({ protectPids: [pid] });
		expect(result.protectedPids).toContain(pid);
		expect(result.killed).not.toContain(pid);

		await new Promise((r) => setTimeout(r, 300));
		expect(() => process.kill(pid, 0), "protected PID must survive").not.toThrow();
	});
});
