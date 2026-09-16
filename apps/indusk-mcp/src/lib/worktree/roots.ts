import { join } from "node:path";
import { isWorkbench, readWorkbenchRepos, repoDir, resolveReposRoot } from "./repos.js";

/**
 * Where the plan lives, and where its code lives — the one answer for run,
 * verify and the cleanup scan.
 *
 * These were one value for as long as every project kept both in the same
 * repository. A workbench separates them: `impl.md` sits in the workbench's
 * `.indusk/planning/`, while the code it describes sits in a declared repo
 * with its own history. Three surfaces each read the declaration and built
 * the same refusal (workbench-trust-fixes F1–F3); three copies of one answer
 * drift silently, so the answer now lives here and the surfaces import it
 * (dawn-workbench-execution A14 pins that there is exactly one).
 *
 * A one-repo workbench RESOLVES: `codeRoot` is the declared checkout and
 * `split` is true. Every consumer decides for itself what a split means —
 * verify judges the code root, run executes there, the cleanup scan still
 * refuses (its cross-repo pass is a named follow-on) — but none of them
 * decides where the code is.
 *
 * Zero or several declared repos REFUSE, by name. Nothing here falls back to
 * the plan root: a diff of plan documents is not evidence about code, and
 * reporting it as such is the "could not check" reported as "checked" failure
 * this module exists to prevent.
 */
export interface ExecutionRoots {
	/** Repository holding `impl.md`, the ledger, the eval queue, the plan's documents. */
	planRoot: string;
	/** Repository holding the code those documents describe. */
	codeRoot: string;
	/** True when the two differ — a one-repo workbench. */
	split: boolean;
}

export interface ExecutionRootsRefusal {
	error: string;
}

export function resolveExecutionRoots(planRoot: string): ExecutionRoots | ExecutionRootsRefusal {
	// Normal-mode project: `.indusk/` ships inside the code repo, so the two
	// roots genuinely are the same directory — dusk itself takes this path.
	if (!isWorkbench(planRoot)) {
		return { planRoot, codeRoot: planRoot, split: false };
	}

	const repos = readWorkbenchRepos(planRoot);
	const declared = repos.map((r) => r.name).join(", ");

	if (repos.length === 0) {
		return {
			error:
				`${planRoot} is workbench-shaped but declares no repos, so there is no code root to work against. ` +
				"Refusing rather than judging or editing the plan documents as if they were code.",
		};
	}

	if (repos.length > 1) {
		return {
			error:
				`${planRoot} is a workbench wrapping ${repos.length} repos (${declared}), and nothing in the plan says which holds its code. ` +
				"Refusing rather than picking one — a verdict or an edit against the wrong repository is indistinguishable from a correct one. " +
				"Run inside the repo the plan's code lives in.",
		};
	}

	// The checkout's real location — `repos_root` + declared `path` — not
	// `<planRoot>/<name>`, which exists only on the flat legacy layout
	// (workbench-trust-fixes, A13).
	return {
		planRoot,
		codeRoot: join(resolveReposRoot(planRoot), repoDir(repos[0])),
		split: true,
	};
}

export function isRootsRefusal(
	r: ExecutionRoots | ExecutionRootsRefusal,
): r is ExecutionRootsRefusal {
	return "error" in r;
}
