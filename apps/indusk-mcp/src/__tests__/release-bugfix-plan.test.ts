import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SHOULD_SKIP } from "./helpers/cli.js";
import {
	GUARD_FILE,
	junitReport,
	ORPHAN_FILE,
	OWNER,
	REPORT_PATH,
	type ReleaseProject,
	routingProject,
} from "./helpers/release-fixture.js";

/**
 * release-records-its-failures, Test Phase 1 — A15–A17: a test still failing
 * after its rerun that no row's promise claims opens one draft bugfix plan for
 * its file, on its own branch, and a later failure of the same file reuses it.
 *
 * promise: an-unclaimed-failure-opens-a-bugfix-plan
 *
 * The plan is `fix-<file stem>` (the file name without `.test.ts`), started
 * the way `indusk plans start bugfix` starts one: `plan/<name>`, a worktree,
 * and the brief there with `status: draft`. Nothing is written on the trunk.
 * The line `indusk release` prints:
 *
 *   recorded: plan <name>
 *
 * A failure that reaches an open plan is appended to that plan's `research.md`
 * (ADR D8), so the record of what failed, in which release, grows in one place.
 */

const SUSPECT = "move the orphan flow behind a flag";

let project: ReleaseProject;
afterEach(() => project?.cleanup());

/** A project with a green run recorded and one covered-code commit since; the slow run fails `file`. */
function failing(file: string, test: string) {
	project = routingProject({
		slow: { exit: 1, reports: { [REPORT_PATH]: junitReport({ [file]: [test] }) } },
	});
	project.recordGreenRun();
	project.commit("src/app.ts", "export const app = 2;\n", SUSPECT);
	return project;
}

const fixPlans = (p: ReleaseProject) => p.branches().filter((b) => b.startsWith("plan/fix-"));

function planDoc(p: ReleaseProject, branch: string, doc: string): string {
	const worktree = p.worktreeOf(branch);
	expect(worktree, `no worktree has ${branch} checked out`).not.toBeNull();
	const path = join(worktree as string, ".indusk", "planning", branch.slice("plan/".length), doc);
	expect(existsSync(path), `${path} is missing`).toBe(true);
	return readFileSync(path, "utf-8");
}

describe.skipIf(SHOULD_SKIP)("indusk release — an unclaimed failure opens a bugfix plan", () => {
	it("A15: a failing file no row names opens one draft plan naming the file, the tests, the release and the commits since the green run", () => {
		const p = failing(ORPHAN_FILE, "abandons a seat");
		const r = p.release();
		expect(fixPlans(p), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual([
			"plan/fix-orphan-flow",
		]);
		const brief = planDoc(p, "plan/fix-orphan-flow", "brief.md");
		expect(brief).toMatch(/^status: draft$/m);
		expect(brief).toContain(ORPHAN_FILE);
		expect(brief).toContain("abandons a seat");
		expect(brief).toContain("1.4.0");
		expect(brief).toContain(SUSPECT);
		expect(r.stdout).toMatch(/^recorded: plan fix-orphan-flow$/m);
		expect(p.records().at(-1)?.failed).toEqual([
			{ file: ORPHAN_FILE, routed: "plan fix-orphan-flow" },
		]);
		expect(p.incidentFiles()).toEqual([]);
		expect(
			existsSync(join(p.planRoot, ".indusk", "planning", "fix-orphan-flow")),
			"the plan was written on the trunk",
		).toBe(false);
	});

	it("A16: a failing file named by a row with no promise opens a plan that also names the plan and row that were testing it", () => {
		const p = failing(GUARD_FILE, "guards");
		const r = p.release();
		expect(fixPlans(p), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual([
			"plan/fix-seat-guard",
		]);
		const brief = planDoc(p, "plan/fix-seat-guard", "brief.md");
		expect(brief).toMatch(/^status: draft$/m);
		expect(brief).toContain(GUARD_FILE);
		expect(brief).toContain(OWNER);
		expect(brief).toMatch(/\bR2\b/);
		expect(r.stdout).toMatch(/^recorded: plan fix-seat-guard$/m);
	});

	it("A17: the same file failing in a later release adds to its open plan rather than opening another", () => {
		const p = failing(ORPHAN_FILE, "abandons a seat");
		p.release();
		p.bump("1.4.1");
		const r = p.release();
		expect(fixPlans(p), `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toEqual([
			"plan/fix-orphan-flow",
		]);
		const research = planDoc(p, "plan/fix-orphan-flow", "research.md");
		expect(research).toContain("1.4.1");
		expect(research).toContain(ORPHAN_FILE);
		expect(r.stdout).toMatch(/^recorded: plan fix-orphan-flow$/m);
	});
});

describe.skipIf(SHOULD_SKIP)("indusk release — a bugfix plan's name never collides", () => {
	it("A26: two unclaimed files with one file name open two plans, each naming only its own file", () => {
		const a = "apps/a/src/__tests__/skip.test.ts";
		const b = "apps/b/src/__tests__/skip.test.ts";
		project = routingProject({
			files: { [a]: "export const a = 1;\n", [b]: "export const b = 1;\n" },
			slow: {
				exit: 1,
				reports: { [REPORT_PATH]: junitReport({ [a]: ["skips a"], [b]: ["skips b"] }) },
			},
		});
		const r = project.release();
		const plans = fixPlans(project);
		expect(plans, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toHaveLength(2);
		const briefs = plans.map((branch) => planDoc(project, branch, "brief.md"));
		expect(briefs.filter((t) => t.includes(a))).toHaveLength(1);
		expect(briefs.filter((t) => t.includes(b))).toHaveLength(1);
		for (const t of briefs) expect(t.includes(a) && t.includes(b)).toBe(false);
		const routed = project.records().at(-1)?.failed ?? [];
		expect(new Set(routed.map((f) => f.routed)).size, "both files routed to one plan").toBe(2);
	});

	it("A27: a file failing again after its fix plan was archived opens a new plan under another name that names the archived one", () => {
		project = routingProject({
			archivedPlans: ["fix-orphan-flow"],
			slow: { exit: 1, reports: { [REPORT_PATH]: junitReport({ [ORPHAN_FILE]: ["abandons"] }) } },
		});
		const r = project.release();
		const plans = fixPlans(project);
		expect(plans, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`).toHaveLength(1);
		expect(plans[0]).not.toBe("plan/fix-orphan-flow");
		expect(plans[0]).toMatch(/^plan\/fix-orphan-flow-/);
		const brief = planDoc(project, plans[0] as string, "brief.md");
		expect(brief).toContain("archive/fix-orphan-flow");
		expect(brief).toContain(ORPHAN_FILE);
	});
});
