import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getTrunkBranches } from "../config.js";
import { findPlanFolder } from "../promises/plan-folder.js";
import { pickTrunk } from "../trunk-branch.js";
import { isWorkbench } from "../worktree/repos.js";
import { chooseCodeRepo, codeRepoBase, PLAN_CODE_FILE } from "../worktree/roots.js";
import { PROCESS_GONE } from "./liveness.js";

/**
 * Whether a plan is on the trunk, and what a release reads from it
 * (a-run-can-be-trusted, Decision 6). A plan has landed when the trunk's history
 * holds the merge `plans land` makes, or its archive folder — never because its
 * branch is "contained": `plans land` deletes the branch afterwards, and a branch
 * just made from main is already an ancestor of it.
 *
 * clause: a-run-is-read-from-its-record/released-only-when-landed
 */

/** The two reads of git the check needs; the clock-and-reads rule, so a test hands in its own. */
export interface GitReads {
	/** Subjects of the merge commits on `trunk`. */
	mergeSubjects(trunk: string): string[];
	/** Whether `path` exists in the tree of `trunk`. */
	hasPath(trunk: string, path: string): boolean;
}

/** The subject `plans land` gives a normal plan's landing merge. */
export const landingSubject = (plan: string): string => `Merge plan/${plan}: ${plan} landed`;

/** The landing merge of either mode: a normal plan's exact subject, or a workbench plan's ending. */
function isLandingOf(subject: string, plan: string): boolean {
	return (
		subject === landingSubject(plan) ||
		(subject.startsWith("Merge ") && subject.endsWith(`: ${plan} landed`))
	);
}

/** True only when the trunk shows the plan landed: its landing merge, or its archive folder. */
export function landedOnMain(trunk: string, plan: string, git: GitReads): boolean {
	try {
		if (git.mergeSubjects(trunk).some((s) => isLandingOf(s, plan))) return true;
		return git.hasPath(trunk, `.indusk/planning/archive/${plan}`);
	} catch {
		// git cannot be read: say not landed, never released on a guess
		return false;
	}
}

export type ReleaseOutcome = { state: "released" } | { state: "stopped"; reason: string };

export const NOT_ON_MAIN = "the release ended but the plan is not on main";

/**
 * What a release reads as. `step` is how the release's own session ended: `null` when the
 * process died before it could say. Released needs the plan on main whatever the step
 * said; a step that ended cleanly while `plans land` refused reads stopped, with the
 * refusal's text.
 */
export function releaseOutcome(input: {
	step: { released: boolean; error: string | null } | null;
	landedOnMain: boolean;
	landError?: string | null;
}): ReleaseOutcome {
	if (input.landedOnMain) return { state: "released" };
	if (input.step === null) return { state: "stopped", reason: PROCESS_GONE };
	if (input.landError) return { state: "stopped", reason: input.landError };
	return { state: "stopped", reason: input.step.error ?? NOT_ON_MAIN };
}

/** Real reads of the repository at `root`. */
export function realGitReads(root: string): GitReads {
	const run = gitIn(root);
	return {
		mergeSubjects: (trunk) =>
			run("log", trunk, "--merges", "--format=%s").split("\n").filter(Boolean),
		hasPath(trunk, path) {
			try {
				run("cat-file", "-e", `${trunk}:${path}`);
				return true;
			} catch {
				return false;
			}
		},
	};
}

function gitIn(root: string): (...args: string[]) => string {
	return (...args) =>
		execFileSync("git", args, {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
}

/**
 * The trunk of the repository at `root`, among `allowed`: the checked-out branch when it is a
 * trunk branch, else the first that exists (`pickTrunk`); with none, the checkout's own branch.
 */
function trunkOf(root: string, allowed: readonly string[]): string {
	const run = gitIn(root);
	let current = "";
	try {
		current = run("branch", "--show-current").trim();
	} catch {
		// not a repository: the reads below fail and say not landed
	}
	const exists = (b: string) => {
		try {
			run("rev-parse", "--verify", "--quiet", `refs/heads/${b}`);
			return true;
		} catch {
			return false;
		}
	};
	return pickTrunk(current, allowed, exists) ?? (current || "HEAD");
}

/** The code repository a workbench plan's `code.json` names, with its trunk; null for any other plan. */
function codeRepoOf(root: string, plan: string): { dir: string; trunk: string } | null {
	if (!isWorkbench(root)) return null;
	const folder = findPlanFolder(root, plan);
	if (folder === null) return null;
	const path = join(folder, PLAN_CODE_FILE);
	if (!existsSync(path)) return null;
	let repo: unknown;
	try {
		repo = (JSON.parse(readFileSync(path, "utf-8")) as { repo?: unknown }).repo;
	} catch {
		return null;
	}
	// The worktree `code.json` names is removed at landing, so only the repo is read here.
	const chosen = chooseCodeRepo(root, typeof repo === "string" ? repo : undefined);
	if ("error" in chosen) return null;
	const base = codeRepoBase(root, chosen.name);
	return { dir: chosen.dir, trunk: trunkOf(chosen.dir, base ? [base] : getTrunkBranches(root)) };
}

/**
 * Whether each plan is on the project's trunk now, asked of the trunk branch, never of the
 * branch the root checkout happens to be on (A94), and for a workbench plan of the code
 * repository its landing merged into, its documents' archive folder still read at the root
 * (A95). The trunk's merge subjects are read once per repository, so the nav's many plans cost
 * one log each.
 */
export function landedAsker(root: string): (plan: string) => boolean {
	let rootTrunk: string | null = null;
	const subjects = new Map<string, string[]>();
	const cached = (dir: string): GitReads => {
		const git = realGitReads(dir);
		return {
			mergeSubjects: (t) => {
				const key = `${dir}\0${t}`;
				let got = subjects.get(key);
				if (got === undefined) {
					got = git.mergeSubjects(t);
					subjects.set(key, got);
				}
				return got;
			},
			hasPath: git.hasPath,
		};
	};
	return (plan) => {
		try {
			rootTrunk ??= trunkOf(root, getTrunkBranches(root));
			if (landedOnMain(rootTrunk, plan, cached(root))) return true;
			const code = codeRepoOf(root, plan);
			if (code === null) return false;
			return cached(code.dir)
				.mergeSubjects(code.trunk)
				.some((s) => isLandingOf(s, plan));
		} catch {
			return false;
		}
	};
}

/** Whether `plan` is on the project's trunk now (`landedAsker`, for one plan). */
export function planLandedOnMain(root: string, plan: string): boolean {
	return landedAsker(root)(plan);
}
