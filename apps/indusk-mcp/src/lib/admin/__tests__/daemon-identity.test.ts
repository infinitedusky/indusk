import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { daemonStatus, daemonStop } from "../daemon.js";

/**
 * T22 — `daemonStatus()` returns `running: false` when the recorded PID is a
 *       live process NOT listening on the recorded port (PID-reuse
 *       simulation). Bare `isAlive(pid)` alone is insufficient: after a
 *       crash, the OS may recycle the daemon's PID to an unrelated process
 *       (bash, postgres, another vitest), and `uiStart`'s double-start guard
 *       would then refuse to spawn, blaming the stranger.
 *
 * T23 — `daemonStop()` does NOT signal a process whose identity can't be
 *       confirmed. A spawned noop child sitting at the recorded PID must
 *       survive `daemonStop()` — the stop path treats PID-alive-but-port-not-
 *       listening as stale and cleans up without SIGTERM.
 *
 * Both hypotheses share the same setup (fake pidfile+meta pointing at a live
 * process that isn't listening on the recorded port). The fix — a combined
 * `isAlive(pid)` + `isPortListening(port)` identity check — flips both tests
 * green at once.
 */

let testHome: string;

function pickUnusedPort(): number {
	// 65001–65009 are reserved/ephemeral and almost never bound by anything
	// local during a vitest run. We don't listen on it — the test's invariant
	// is precisely "nothing should be listening here."
	return 65001;
}

describe("daemon identity — PID-reuse hardening", () => {
	beforeEach(() => {
		testHome = mkdtempSync(join(tmpdir(), "indusk-home-"));
		mkdirSync(testHome, { recursive: true });
		process.env.INDUSK_HOME = testHome;
	});

	afterEach(() => {
		delete process.env.INDUSK_HOME;
		if (existsSync(testHome)) rmSync(testHome, { recursive: true, force: true });
	});

	describe("T22 — daemonStatus false-positives on PID reuse", () => {
		it("returns running:false when recorded PID is alive but port is not listening", async () => {
			// Simulate: a previous daemon crashed, its PID got reused by an
			// unrelated process (here, the test process itself). The PID is
			// alive, but nothing is listening on the recorded port.
			const stalePid = process.pid;
			const unusedPort = pickUnusedPort();

			writeFileSync(join(testHome, "admin-ui.pid"), String(stalePid));
			writeFileSync(
				join(testHome, "admin-ui.json"),
				JSON.stringify({
					pid: stalePid,
					port: unusedPort,
					startedAt: new Date().toISOString(),
					adminDir: "/nonexistent/admin",
				}),
			);

			const status = await daemonStatus();
			expect(status).toEqual({ running: false });
		});
	});

	describe("T23 — daemonStop does not signal unidentified processes", () => {
		it("leaves a spawned noop child alive when port is not listening", async () => {
			// Spawn a detached noop child. Point the pidfile at it with a
			// recorded port that nothing is listening on. `daemonStop()`
			// should recognize the identity mismatch and NOT SIGTERM.
			const child = spawn("node", ["-e", "setInterval(() => {}, 60000)"], {
				detached: true,
				stdio: "ignore",
			});
			child.unref();

			// Give the child a beat to actually be scheduled and show up as alive
			await new Promise((r) => setTimeout(r, 50));

			const childPid = child.pid;
			if (typeof childPid !== "number") {
				throw new Error("spawned child did not produce a PID");
			}

			const unusedPort = pickUnusedPort();
			writeFileSync(join(testHome, "admin-ui.pid"), String(childPid));
			writeFileSync(
				join(testHome, "admin-ui.json"),
				JSON.stringify({
					pid: childPid,
					port: unusedPort,
					startedAt: new Date().toISOString(),
					adminDir: "/nonexistent/admin",
				}),
			);

			try {
				await daemonStop();
				// Give any stray SIGTERM a chance to land before we probe
				await new Promise((r) => setTimeout(r, 200));

				// `process.kill(pid, 0)` throws if the process is gone
				let stillAlive = false;
				try {
					process.kill(childPid, 0);
					stillAlive = true;
				} catch {
					stillAlive = false;
				}
				expect(stillAlive).toBe(true);
			} finally {
				// Cleanup: actually kill our child so the test process exits clean
				try {
					process.kill(childPid, "SIGKILL");
				} catch {
					// Already gone — nothing to do
				}
			}
		});
	});
});
