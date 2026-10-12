import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { type PlanLifecycleProject, planLifecycleProject } from "./plan-lifecycle-fixture.js";
import { git } from "./test-git.js";

/**
 * What the brief-as-the-contract tests share: the `brief-app` fixture made into
 * a real project with a plan worktree, and the plan's documents written into
 * that worktree in the shapes the fixture holds.
 *
 *   fixtures/brief-app/app/    the app: `src/` (the interface its `screens.json`
 *                              declares as `sources`) and `.indusk/mockups/demo/`
 *                              with `home.empty` approved and `home.full` proposed
 *   fixtures/brief-app/plan/   the plan's documents: a brief in each of three
 *                              shapes, and an impl whose `Files Affected` names
 *                              a file under those sources or one outside them
 *
 * The app is committed on the trunk before the worktree is made, so a plan's
 * branch changes only `.indusk/` and `plans approve` takes it.
 */

const FIXTURE = join(__dirname, "..", "fixtures", "brief-app");

export const PLAN = "seat-holds";
export const PLAN_DIR = `.indusk/planning/${PLAN}`;
export const APP = "demo";
export const RECORD = `.indusk/mockups/${APP}/approved.json`;

/** `looks-listed`: a Looks section naming looks; `none`: `None — {reason}`; `legacy`: no Looks section. */
export type BriefShape = "looks-listed" | "none" | "legacy";
/** `interface`: `Files Affected` names `src/Card.jsx`, under the app's sources; `internal`: it names nothing there. */
export type ImplShape = "interface" | "internal";

export const briefOf = (shape: BriefShape): string =>
	readFileSync(join(FIXTURE, "plan", "briefs", `${shape}.md`), "utf-8");

export const implOf = (shape: ImplShape): string =>
	readFileSync(join(FIXTURE, "plan", `impl.${shape}.md`), "utf-8");

export interface BriefAppProject {
	project: PlanLifecycleProject;
	trunk: string;
	/** The plan's worktree, on `plan/seat-holds`. */
	wt: string;
	/** Write the plan's brief and impl into the worktree and commit them there. */
	writePlan(docs: { brief: BriefShape | string; impl?: ImplShape | string }): void;
	cleanup(): void;
}

const isShape = (v: string, shapes: readonly string[]) => shapes.includes(v);

export function briefAppProject(prefix: string): BriefAppProject {
	const project = planLifecycleProject(prefix);
	cpSync(join(FIXTURE, "app"), project.trunk, { recursive: true });
	git(project.trunk, ["add", "-A"]);
	git(project.trunk, ["commit", "-q", "-m", "the brief-app fixture's app"]);
	const wt = project.makeWorktree(PLAN);
	return {
		project,
		trunk: project.trunk,
		wt,
		writePlan({ brief, impl = "internal" }) {
			const briefText = isShape(brief, ["looks-listed", "none", "legacy"])
				? briefOf(brief as BriefShape)
				: brief;
			const implText = isShape(impl, ["interface", "internal"]) ? implOf(impl as ImplShape) : impl;
			for (const [rel, content] of [
				[`${PLAN_DIR}/brief.md`, briefText],
				[`${PLAN_DIR}/impl.md`, implText],
			] as const) {
				mkdirSync(dirname(join(wt, rel)), { recursive: true });
				writeFileSync(join(wt, rel), content);
			}
			git(wt, ["add", "-A"]);
			git(wt, ["commit", "-q", "-m", "plan documents"]);
		},
		cleanup: () => project.cleanup(),
	};
}
