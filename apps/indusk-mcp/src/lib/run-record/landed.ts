import { execFileSync } from "node:child_process";
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
	const run = (...args: string[]): string =>
		execFileSync("git", args, {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
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

/**
 * Whether `plan` is on the project's trunk now, read from the trunk checkout at `root`: the
 * checkout's own branch is where `plans land` merges, so that is the history asked.
 */
export function planLandedOnMain(root: string, plan: string): boolean {
	try {
		const branch = execFileSync("git", ["branch", "--show-current"], {
			cwd: root,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
		return landedOnMain(branch || "HEAD", plan, realGitReads(root));
	} catch {
		return false;
	}
}
