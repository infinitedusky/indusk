import { afterEach, describe, expect, it } from "vitest";
import { SHOULD_SKIP } from "./helpers/cli.js";
import {
	CLAIMED_FILE,
	GUARD_FILE,
	junitReport,
	ORPHAN_FILE,
	REPORT_PATH,
	type ReleaseProject,
	routingProject,
} from "./helpers/release-fixture.js";

/**
 * release-records-its-failures, Test Phase 1 — A6, A7, A9, A10, A22: which
 * tests failed is read from the declared JUnit report; a file that fails and
 * then passes on its one rerun is a flake; a run that failed nearly everywhere
 * is the environment.
 *
 * promise: a-failure-is-read-from-the-report
 * promise: a-flake-opens-nothing
 * promise: a-failing-slow-test-breaks-its-promise
 * promise: an-unclaimed-failure-opens-a-bugfix-plan
 *
 * `routingProject` has the three routing cases ready (a file a promise's row
 * names, a file a row names with no promise, a file no row names), so a run
 * that wrongly named a failure would open an incident or a plan, and the
 * "opens nothing" rows would catch it. Every row also asserts something that
 * exists only when the release ran (a line, the record), so none passes by the
 * command being absent.
 *
 * The lines `indusk release` prints, beyond release-run's, one per line at the
 * start of the line:
 *
 *   failing: <file>            (a file still failing after its rerun, or with no rerun)
 *   flaky: <file>              (a file that failed, then passed on its rerun)
 *   the environment failed: <n> of <total> slow test files failed
 *
 * The rerun contract: `{files}` is the failing files; the rerun may rewrite
 * the declared report, and a file the rerun does not leave failing is a flake.
 * The record carries `failed` ({file, routed}), `flakes` (files) and, for an
 * environment failure, `environment` ({failed, total}).
 */

let project: ReleaseProject;
afterEach(() => project?.cleanup());

const failingLines = (stdout: string) =>
	[...stdout.matchAll(/^failing: (.+)$/gm)].map((m) => m[1]).sort();
const planBranches = (p: ReleaseProject) => p.branches().filter((b) => b.startsWith("plan/"));

describe.skipIf(SHOULD_SKIP)("indusk release — failures are read from the report", () => {
	it("A6: the failing tests are exactly the ones the report(s) mark failed, whatever the command printed, across several report files", () => {
		const mcp = ["src/mcp-a.test.ts", "src/mcp-b.test.ts", "src/mcp-c.test.ts"];
		const admin = ["src/admin-a.test.ts", "src/admin-b.test.ts", "src/admin-c.test.ts"];
		project = routingProject({
			slow: {
				exit: 1,
				report: "apps/*/test-results/system.junit.xml",
				reports: {
					"apps/mcp/test-results/system.junit.xml": junitReport(
						{ [ORPHAN_FILE]: ["abandons"] },
						mcp,
					),
					"apps/admin/test-results/system.junit.xml": junitReport(
						{ [GUARD_FILE]: ["guards"] },
						admin,
					),
				},
			},
		});
		const r = project.release();
		const files = [GUARD_FILE, ORPHAN_FILE].sort();
		expect(failingLines(r.stdout), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual(files);
		expect(r.stdout).toMatch(/^the slow tests failed$/m);
		const record = project.records().at(-1);
		expect(record?.failed.map((f) => f.file).sort()).toEqual(files);
		expect(JSON.stringify(record), "the runner read what the command printed").not.toContain(
			"decoy",
		);
	});

	it("A7: a red run whose report is missing says the slow tests failed, names no test, and opens nothing", () => {
		project = routingProject({ slow: { exit: 1 } });
		const r = project.release();
		expect(r.stdout, `stderr:\n${r.stderr}`).toMatch(/^the slow tests failed$/m);
		expect(failingLines(r.stdout)).toEqual([]);
		expect(project.records().at(-1)).toEqual(
			expect.objectContaining({ slow: "red", failed: [], flakes: [] }),
		);
		expect(project.incidentFiles()).toEqual([]);
		expect(planBranches(project)).toEqual([]);
	});

	it("A7: a red run whose report cannot be read says the same, and opens nothing", () => {
		project = routingProject({
			slow: { exit: 1, reports: { [REPORT_PATH]: "this is not <junit, it is half a sentence" } },
		});
		const r = project.release();
		expect(r.stdout, `stderr:\n${r.stderr}`).toMatch(/^the slow tests failed$/m);
		expect(failingLines(r.stdout)).toEqual([]);
		expect(project.records().at(-1)).toEqual(
			expect.objectContaining({ slow: "red", failed: [], flakes: [] }),
		);
		expect(project.incidentFiles()).toEqual([]);
		expect(planBranches(project)).toEqual([]);
	});
});

describe.skipIf(SHOULD_SKIP)("indusk release — one rerun, by file", () => {
	it("A9: a file that fails and then passes on its rerun is a flake on the record and opens nothing", () => {
		project = routingProject({
			slow: {
				exit: 1,
				reports: { [REPORT_PATH]: junitReport({ [CLAIMED_FILE]: ["holds a seat"] }) },
				rerun: { exit: 0, reports: { [REPORT_PATH]: junitReport({}) } },
			},
		});
		const r = project.release();
		expect(r.stdout, `stderr:\n${r.stderr}`).toMatch(new RegExp(`^flaky: ${CLAIMED_FILE}$`, "m"));
		expect(failingLines(r.stdout)).toEqual([]);
		expect(project.records().at(-1)).toEqual(
			expect.objectContaining({ failed: [], flakes: [CLAIMED_FILE] }),
		);
		expect(project.incidentFiles()).toEqual([]);
		expect(planBranches(project)).toEqual([]);
		expect(r.code).toBe(0);
	});

	it("A10: only the failing files are run again, once; a file still failing after its rerun is recorded as failing", () => {
		project = routingProject({
			slow: {
				exit: 1,
				reports: {
					[REPORT_PATH]: junitReport({
						[CLAIMED_FILE]: ["holds a seat"],
						[GUARD_FILE]: ["guards"],
					}),
				},
				rerun: {
					exit: 1,
					reports: { [REPORT_PATH]: junitReport({ [CLAIMED_FILE]: ["holds a seat"] }) },
				},
			},
		});
		const r = project.release();
		const reruns = project.orderLog().filter((l) => l.startsWith("rerun "));
		expect(reruns, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toHaveLength(1);
		expect(reruns[0]?.slice("rerun ".length).split(/\s+/).sort()).toEqual(
			[CLAIMED_FILE, GUARD_FILE].sort(),
		);
		expect(failingLines(r.stdout)).toEqual([CLAIMED_FILE]);
		expect(r.stdout).toMatch(new RegExp(`^flaky: ${GUARD_FILE}$`, "m"));
		const record = project.records().at(-1);
		expect(record?.failed.map((f) => f.file)).toEqual([CLAIMED_FILE]);
		expect(record?.flakes).toEqual([GUARD_FILE]);
	});
});

describe.skipIf(SHOULD_SKIP)(
	"indusk release — a run that failed nearly everywhere is the environment",
	() => {
		it("A22: more than half the files failing opens no incident and no plan, and says how many failed", () => {
			project = routingProject({
				slow: {
					exit: 1,
					reports: {
						[REPORT_PATH]: junitReport(
							{
								[CLAIMED_FILE]: ["holds a seat"],
								[GUARD_FILE]: ["guards"],
								[ORPHAN_FILE]: ["abandons"],
							},
							["src/ok-one.test.ts"],
						),
					},
				},
			});
			const r = project.release();
			expect(r.stdout, `stderr:\n${r.stderr}`).toMatch(
				/^the environment failed: 3 of 4 slow test files failed$/m,
			);
			expect(project.records().at(-1)?.environment).toEqual({ failed: 3, total: 4 });
			expect(project.incidentFiles()).toEqual([]);
			expect(planBranches(project)).toEqual([]);
		});

		it("A22: exactly half failing is not the environment: the failures are recorded as failing", () => {
			project = routingProject({
				slow: {
					exit: 1,
					reports: {
						[REPORT_PATH]: junitReport(
							{ [CLAIMED_FILE]: ["holds a seat"], [GUARD_FILE]: ["guards"] },
							["src/ok-one.test.ts", "src/ok-two.test.ts"],
						),
					},
				},
			});
			const r = project.release();
			expect(failingLines(r.stdout), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual(
				[CLAIMED_FILE, GUARD_FILE].sort(),
			);
			expect(r.stdout).not.toMatch(/the environment failed/);
			expect(project.records().at(-1)?.environment).toBeUndefined();
		});
	},
);
