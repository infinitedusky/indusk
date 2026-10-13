import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runCli } from "./cli.js";
import { type PlanLifecycleProject, planLifecycleProject } from "./plan-lifecycle-fixture.js";
import { git } from "./test-git.js";
import { makeVersionedWorkbench, type VersionedWorkbench } from "./versioned-workbench.js";

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

export interface BriefWorkbench {
	wb: VersionedWorkbench;
	/** The workbench root: the plan's documents and the app's mockups live here. */
	root: string;
	/** The plan's code worktree in the repo, on `plan/seat-holds`. */
	code: string;
	/** Write the plan's brief and impl at the workbench root. */
	writePlan(docs: { brief: BriefShape | string; impl?: ImplShape | string }): void;
	cleanup(): void;
}

/**
 * The `brief-app` fixture in a workbench: the app's mockups at the workbench
 * root (where the Looks page reads them), its `src/` in the wrapped repo `alpha`
 * (where the plan's code is built), and the plan started with
 * `indusk plans start`, so it has a record of its code worktree.
 */
export function briefWorkbench(): BriefWorkbench {
	const wb = makeVersionedWorkbench({
		repos: [{ name: "alpha" }],
		layout: "nested",
		shape: "workbench",
	});
	const repo = wb.repos[0];
	const configPath = join(wb.root, ".indusk", "config.json");
	const config = JSON.parse(readFileSync(configPath, "utf-8"));
	config.promises = { domains: ["seating"] };
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
	mkdirSync(join(wb.root, ".indusk", "worktree-configs"), { recursive: true });
	writeFileSync(
		join(wb.root, ".indusk", "worktree-configs", `${repo.name}.json`),
		`${JSON.stringify({ trunk_branch: "main", base_branch: "main", copy_files: [], append_files: [], apply_commits: [] }, null, 2)}\n`,
	);
	cpSync(join(FIXTURE, "app", ".indusk"), join(wb.root, ".indusk"), { recursive: true });
	cpSync(join(FIXTURE, "app", "src"), join(repo.dir, "src"), { recursive: true });
	git(repo.dir, ["add", "-A"]);
	git(repo.dir, ["commit", "-q", "-m", "the brief-app fixture's source"]);
	git(wb.root, ["add", "-A"]);
	git(wb.root, ["commit", "-q", "-m", "the brief-app fixture's mockups"]);

	const started = runCli(wb.root, ["plans", "start", "feature", PLAN]);
	if (started.code !== 0) throw new Error(`plans start failed: ${started.stdout}${started.stderr}`);
	const planDir = join(wb.root, PLAN_DIR);
	const codeFile = JSON.parse(readFileSync(join(planDir, "code.json"), "utf-8")) as {
		worktree: string;
	};
	return {
		wb,
		root: wb.root,
		code: resolve(wb.root, codeFile.worktree),
		writePlan({ brief, impl = "internal" }) {
			const briefText = isShape(brief, ["looks-listed", "none", "legacy"])
				? briefOf(brief as BriefShape)
				: brief;
			const implText = isShape(impl, ["interface", "internal"]) ? implOf(impl as ImplShape) : impl;
			writeFileSync(join(planDir, "brief.md"), briefText);
			writeFileSync(join(planDir, "impl.md"), implText);
			git(wb.root, ["add", "-A"]);
			git(wb.root, ["commit", "-q", "-m", "plan documents"]);
		},
		cleanup: () => wb.cleanup(),
	};
}
