// clause: a-run-is-read-from-its-record/released-only-when-landed
import { existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { implText } from "../../__tests__/helpers/plan-fixture.js";
import {
	type PlanLifecycleProject,
	planLifecycleProject,
} from "../../__tests__/helpers/plan-lifecycle-fixture.js";
import { git } from "../../__tests__/helpers/test-git.js";
import { acceptPlan } from "../plans/accept.js";
import { landPlan } from "../plans/land.js";
import {
	type GitReads,
	landedOnMain,
	landingSubject,
	NOT_ON_MAIN,
	realGitReads,
	releaseOutcome,
} from "./landed.js";
import { PROCESS_GONE } from "./liveness.js";

/**
 * A18–A21 and A87 (a-run-can-be-trusted, Build Phase 2): a release reads released
 * only when the plan is on main, judged by its landing merge or its archive folder.
 */

const reads = (subjects: string[], paths: string[] = []): GitReads => ({
	mergeSubjects: () => subjects,
	hasPath: (_trunk, path) => paths.includes(path),
});

describe("A18 — a release `plans land` refused reads stopped with the refusal", () => {
	it("A18 a step that ended cleanly while the plan is not on main reads stopped with the refusal's text", () => {
		expect(
			releaseOutcome({
				step: { released: true, error: null },
				landedOnMain: false,
				landError: "p does not land: `pnpm test` failed",
			}),
		).toEqual({ state: "stopped", reason: "p does not land: `pnpm test` failed" });
	});

	it("A18 with no captured refusal it says the plan is not on main", () => {
		expect(releaseOutcome({ step: { released: true, error: null }, landedOnMain: false })).toEqual({
			state: "stopped",
			reason: NOT_ON_MAIN,
		});
	});

	it("A18 a step that failed reads stopped with its own error", () => {
		expect(
			releaseOutcome({ step: { released: false, error: "session failed" }, landedOnMain: false }),
		).toEqual({ state: "stopped", reason: "session failed" });
	});
});

describe("A19 — a release whose plan is on main reads released", () => {
	it("A19 released, run now or found after a restart (no step result to read)", () => {
		expect(releaseOutcome({ step: { released: true, error: null }, landedOnMain: true })).toEqual({
			state: "released",
		});
		expect(releaseOutcome({ step: null, landedOnMain: true })).toEqual({ state: "released" });
	});

	it("A19 the landing merge, a workbench landing and the archive folder each count", () => {
		expect(landedOnMain("main", "p", reads([landingSubject("p")]))).toBe(true);
		expect(landedOnMain("main", "p", reads(["Merge feat/p-code: p landed"]))).toBe(true);
		expect(landedOnMain("main", "p", reads([], [".indusk/planning/archive/p"]))).toBe(true);
	});

	it("A19 another plan's landing, or a plan whose name ends the same, does not count", () => {
		expect(landedOnMain("main", "p", reads([landingSubject("other")]))).toBe(false);
		expect(landedOnMain("main", "foo", reads([landingSubject("bar-foo")]))).toBe(false);
	});

	it("A19 git that cannot be read says not landed, never released", () => {
		const broken: GitReads = {
			mergeSubjects: () => {
				throw new Error("not a repository");
			},
			hasPath: () => false,
		};
		expect(landedOnMain("main", "p", broken)).toBe(false);
	});
});

describe("A20 — a release whose process died before landing reads stopped", () => {
	it("A20 no step result and not on main reads stopped, saying the process is gone", () => {
		expect(releaseOutcome({ step: null, landedOnMain: false })).toEqual({
			state: "stopped",
			reason: PROCESS_GONE,
		});
	});
});

describe("A21 and A87 — against a real repository", () => {
	const PLAN = "seat-holds";
	const planDir = `.indusk/planning/${PLAN}`;
	let p: PlanLifecycleProject;
	let wt: string;
	const buildStep = process.env.INDUSK_BUILD_STEP;
	beforeEach(() => {
		delete process.env.INDUSK_BUILD_STEP;
		p = planLifecycleProject("landed-check");
		wt = p.makeWorktree(PLAN);
	});
	afterEach(() => {
		p.cleanup();
		if (buildStep !== undefined) process.env.INDUSK_BUILD_STEP = buildStep;
	});

	it("A21 a plan landed through the package's landing, its branch deleted, reads released; before landing it does not", async () => {
		p.commit(
			wt,
			{
				[`${planDir}/impl.md`]: implText(PLAN, {
					status: "completed",
					rows: [{ state: "passing" }],
				}),
				"src/seat.ts": "export const seat = 1;\n",
			},
			"the build",
		);
		const real = realGitReads(p.trunk);
		expect(landedOnMain("main", PLAN, real)).toBe(false);
		expect(
			releaseOutcome({ step: { released: true, error: null }, landedOnMain: false }).state,
		).toBe("stopped");

		await acceptPlan(p.trunk, PLAN);
		await landPlan(p.trunk, PLAN, {
			runTests: async (files) => files.map((file) => ({ file, passed: true })),
		});

		expect(existsSync(wt)).toBe(false);
		expect(() => git(p.trunk, ["rev-parse", "--verify", `plan/${PLAN}`])).toThrow();
		expect(landedOnMain("main", PLAN, real)).toBe(true);
		expect(releaseOutcome({ step: { released: true, error: null }, landedOnMain: true })).toEqual({
			state: "released",
		});
	});

	it("A87 a branch just made from main with no commits of its own never reads complete", () => {
		// the branch is an ancestor of main, which is why containment is the wrong question
		const real = realGitReads(p.trunk);
		expect(git(p.trunk, ["merge-base", "--is-ancestor", `plan/${PLAN}`, "main"])).toBe("");
		expect(landedOnMain("main", PLAN, real)).toBe(false);
	});

	it("A87 a branch with commits and no landing merge never reads complete", () => {
		p.commit(wt, { "src/a.ts": "export const a = 1;\n" }, "work");
		expect(landedOnMain("main", PLAN, realGitReads(p.trunk))).toBe(false);
	});
});
