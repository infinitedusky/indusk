import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DURATION_FILE,
	otherTestRuns,
	recordSuiteDuration,
	suiteDurationRecord,
} from "../../scripts/suite-speed.js";

/**
 * promise: everyday-suite-stays-fast — kept in the registry only until
 * tests-never-make-us-wait closes and `promises confirm` retires it; nothing
 * marks it any more.
 *
 * tests-never-make-us-wait: each everyday run's duration is recorded in the
 * project's machine state, and marks no promise (the brief's expectation reads
 * the record). A run that overlapped another is flagged, not judged; a record
 * that cannot be written is said and never throws, so it cannot change the
 * run's result (lesson: a-suites-speed-is-a-promise-not-a-gate).
 */

describe("the everyday suite's duration record", () => {
	it("a run becomes one line: when, how long, whether it passed, whether it overlapped", () => {
		expect(
			suiteDurationRecord({
				durationMs: 31_400.4,
				overlapped: false,
				exitCode: 0,
				at: "2026-10-18T10:00:00Z",
			}),
		).toEqual({ at: "2026-10-18T10:00:00Z", durationMs: 31_400, passed: true, overlapped: false });
		expect(
			suiteDurationRecord({ durationMs: 3_000, overlapped: true, exitCode: 1, at: "t" }),
		).toMatchObject({ passed: false, overlapped: true });
	});

	it("appends each run to the project's home, one JSON line each, and says what it recorded", async () => {
		const home = mkdtempSync(join(tmpdir(), "suite-duration-"));
		try {
			const first = suiteDurationRecord({ durationMs: 30_000, overlapped: false, at: "a" });
			const second = suiteDurationRecord({ durationMs: 95_000, overlapped: true, at: "b" });
			const said = await recordSuiteDuration("/repo", first, { home: () => home });
			const saidOverlap = await recordSuiteDuration("/repo", second, { home: () => home });
			const lines = readFileSync(join(home, DURATION_FILE), "utf-8").trim().split("\n");
			expect(lines.map((l) => JSON.parse(l))).toEqual([first, second]);
			expect(said).toBe("recorded 30 s");
			expect(saidOverlap).toBe("recorded 95 s (overlapped another test run)");
		} finally {
			rmSync(home, { recursive: true, force: true });
		}
	});

	it("a record that cannot be written is said, never thrown", async () => {
		const said = await recordSuiteDuration(
			"/repo",
			suiteDurationRecord({ durationMs: 1, overlapped: false, at: "a" }),
			{
				home: () => {
					throw new Error("the home is read-only");
				},
			},
		);
		expect(said).toBe("not recorded: the home is read-only");
	});

	it("an overlapping run is another vitest process — not a shell that names the word, not this run's own", () => {
		const ps = [
			{ pid: 1, ppid: 0, command: "/sbin/launchd" },
			{
				pid: 10,
				ppid: 1,
				command: "zsh -c while pgrep -f vitest >/dev/null; do sleep 3; done; pnpm test",
			},
			{
				pid: 11,
				ppid: 10,
				command:
					"node apps/indusk-mcp/scripts/with-daemon-guard.js --mark everyday-suite-stays-fast",
			},
			{ pid: 12, ppid: 11, command: "node /repo/node_modules/vitest/vitest.mjs run" },
			{
				pid: 20,
				ppid: 1,
				command: "node /wt/node_modules/.pnpm/vitest@4/node_modules/vitest/vitest.mjs run src/x",
			},
			{ pid: 21, ppid: 20, command: "node /wt/node_modules/vitest/dist/workers/forks.js" },
		];
		expect(
			otherTestRuns(ps, 11).map((p) => p.pid),
			"the evaluator's run and its worker",
		).toEqual([12, 20, 21]);
		expect(otherTestRuns(ps.slice(0, 4), 12), "this run, seen from inside it").toEqual([]);
	});
});
