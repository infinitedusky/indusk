// clause: a-plan-says-how-long-it-took/test-runs-are-recorded
// clause: a-plan-says-how-long-it-took/a-record-never-blocks
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { briefText, implText } from "../../__tests__/helpers/plan-fixture.js";
import { parsePhaseRef } from "../impl-headings.js";
import { plansTestsOutcome } from "../plans/plan-tests.js";
import type { Runner } from "../tests/run-files.js";
import { readTimings, timingLogPath } from "./log.js";
import { recordTestRun } from "./test-run.js";

const PLAN = "seats-v2";
const ROW_TEST = "apps/a/src/row.test.ts";
const dirs: string[] = [];
afterEach(() => {
	for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});
const tmp = (prefix = "test-run-") => {
	const d = mkdtempSync(join(tmpdir(), prefix));
	dirs.push(d);
	return d;
};
const write = (root: string, path: string, text: string) => {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
};
const git = (root: string, ...args: string[]) => execFileSync("git", args, { cwd: root, stdio: "pipe" });

function project(): string {
	const root = tmp("test-run-project-");
	git(root, "init", "-q", "-b", "main");
	git(root, "config", "user.email", "t@t.invalid");
	git(root, "config", "user.name", "T");
	write(root, ".indusk/config.json", JSON.stringify({ verify: { testCommand: "npx vitest run" } }));
	write(root, `.indusk/planning/${PLAN}/brief.md`, briefText(PLAN));
	write(
		root,
		`.indusk/planning/${PLAN}/impl.md`,
		implText(PLAN, { columns: ["Test"], rows: [{ cells: { Test: ROW_TEST } }] }),
	);
	write(root, "apps/a/vitest.config.ts", "export default {};\n");
	write(root, ROW_TEST, "");
	git(root, "add", "-A");
	git(root, "commit", "-qm", "base");
	return root;
}

const passing: Runner = async () => ({ code: 0, output: "" });
const failing: Runner = async () => ({ code: 1, output: "FAIL" });
const phase = parsePhaseRef("Build Phase 1");
if (!phase) throw new Error("phase");

/** A monotonic clock that moves 1500 ms between its first and second reading. */
const steppedClock = () => {
	const readings = [1000, 2500];
	let i = 0;
	return () => readings[Math.min(i++, readings.length - 1)];
};
const timing = (home: string, warnings: string[] = []) => ({
	home,
	now: () => Date.parse("2026-05-05T12:00:00.000Z"),
	clock: steppedClock(),
	warn: (m: string) => warnings.push(m),
});
const read = (root: string, home: string) => readTimings(timingLogPath(root, PLAN, home));

it("A7 a phase's run records the plan, the phase, the counts per reason, the duration and that it passed", async () => {
	const root = project();
	const home = tmp("home-");
	await plansTestsOutcome(root, { plan: PLAN, scope: { phase }, run: passing, timing: timing(home) });
	expect(await read(root, home)).toEqual([
		{
			v: 1,
			kind: "test-run",
			plan: PLAN,
			at: "2026-05-05T12:00:00.000Z",
			scope: { phase: "Build Phase 1" },
			files: { own: 1, reached: 0, mustNotBreak: 0 },
			startedAt: "2026-05-05T12:00:00.000Z",
			durationMs: 1500,
			passed: true,
		},
	]);
});

it("A7 counts files by the reason each is in the set", async () => {
	const root = tmp();
	const home = tmp("home-");
	await recordTestRun(root, {
		plan: PLAN,
		scope: { phase },
		set: {
			files: [
				{ path: "a.test.ts", reason: "row A1" },
				{ path: "b.test.ts", reason: "row A2" },
				{ path: "k.test.ts", reason: "must not break: kept" },
			],
			withoutTests: [],
			manual: [],
		},
		startedAt: "2026-05-05T12:00:00.000Z",
		durationMs: 10,
		passed: true,
		home,
	});
	const [record] = await read(root, home);
	expect(record).toMatchObject({ files: { own: 2, reached: 0, mustNotBreak: 1 } });
});

it("A8 a landing run records landing in place of a phase; a failing file records that it did not pass", async () => {
	const root = project();
	const home = tmp("home-");
	const outcome = await plansTestsOutcome(root, {
		plan: PLAN,
		scope: { landing: true },
		run: failing,
		timing: timing(home),
	});
	expect(outcome.exitCode).toBe(1);
	expect(await read(root, home)).toMatchObject([{ kind: "test-run", scope: "landing", passed: false }]);
});

it("A9 two runs record two lines, in order", async () => {
	const root = project();
	const home = tmp("home-");
	await plansTestsOutcome(root, { plan: PLAN, scope: { phase }, run: failing, timing: timing(home) });
	await plansTestsOutcome(root, { plan: PLAN, scope: { phase }, run: passing, timing: timing(home) });
	const records = await read(root, home);
	expect(records.map((r) => r.kind === "test-run" && r.passed)).toEqual([false, true]);
});

it("A9 --list runs nothing and records nothing", async () => {
	const root = project();
	const home = tmp("home-");
	await plansTestsOutcome(root, { plan: PLAN, scope: { phase }, list: true, timing: timing(home) });
	expect(await read(root, home)).toEqual([]);
});

it("A16 with the log unwritable, the outcome is exactly the unrecorded run's", async () => {
	const root = project();
	const unrecorded = await plansTestsOutcome(root, {
		plan: PLAN,
		scope: { phase },
		run: failing,
		timing: timing(tmp("home-")),
	});
	const home = join(tmp(), "afile");
	writeFileSync(home, "not a folder");
	const warnings: string[] = [];
	const recorded = await plansTestsOutcome(root, {
		plan: PLAN,
		scope: { phase },
		run: failing,
		timing: timing(home, warnings),
	});
	expect(recorded).toEqual(unrecorded);
	expect(warnings.join()).toMatch(/timing: could not record/);
});
