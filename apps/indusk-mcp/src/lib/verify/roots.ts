import { join } from "node:path";
import { isWorkbench, readWorkbenchRepos } from "../worktree/repos.js";

/**
 * Where the plan lives, and where its code lives.
 *
 * These were one value for as long as every project kept both in the same
 * repository. A workbench separates them: `impl.md` sits in the workbench's
 * `.indusk/planning/`, while the code it describes sits across a trunk symlink
 * in a wrapped repo with its own history.
 *
 * Until versioned-workbench a workbench root was not a git repo, so
 * `assertGitRepo` refused and no detector ever ran there. That refusal was
 * correct and it was FREE — it held because of a property nobody maintained.
 * Making the root a git repo removes it by accident, and what is left is a
 * repository whose diff *structurally cannot contain* the code being judged:
 * phantom detection fires when nothing outside `impl.md` changed, which in a
 * workbench is always. Every honest checkoff would be reported as phantom, and
 * a detector that cries wolf gets switched off — taking its real catches with
 * it.
 *
 * So the refusal is now maintained on purpose, here.
 */
export interface VerifyRoots {
	/** Repository holding `impl.md`, the ledger, and the plan's documents. */
	planRoot: string;
	/** Repository holding the code those documents describe. */
	codeRoot: string;
	/** True when the two differ — a workbench. */
	split: boolean;
}

export interface VerifyRootsRefusal {
	error: string;
}

/**
 * Resolve both roots, or refuse.
 *
 * **Never falls back to the plan root.** A diff of plan documents is not
 * evidence about code, and reporting it as such is precisely the "could not
 * check" reported as "checked" failure this module exists to prevent.
 */
export function resolveVerifyRoots(planRoot: string): VerifyRoots | VerifyRootsRefusal {
	// Normal-mode project: `.indusk/` ships inside the code repo, so the two
	// roots genuinely are the same directory. Unchanged from every release
	// before this one — dusk itself takes this path.
	if (!isWorkbench(planRoot)) {
		return { planRoot, codeRoot: planRoot, split: false };
	}

	const repos = readWorkbenchRepos(planRoot);
	const declared = repos.map((r) => r.name).join(", ");

	// EVERY workbench refuses, and the reason differs by shape.
	//
	// This is the floor the ADR scopes to this plan, not the finished feature.
	// Even with a single declared repo, verify cannot honestly judge a phase
	// here: the baseline sha comes from the plan repo's ledger and does not
	// exist in the code repo's history, so there is nothing to diff the code
	// against. Producing a verdict anyway would mean judging code by a diff
	// that cannot contain it.
	//
	// Refusing costs nothing that worked before — a workbench root was not a
	// git repo, so `assertGitRepo` already refused every run. What changes is
	// that the refusal is now maintained deliberately and says why, instead of
	// holding by an accident this plan removes.
	if (repos.length === 0) {
		return {
			error:
				`${planRoot} is workbench-shaped but declares no repos, so there is no code root to verify against. ` +
				"Refusing rather than judging a phase against the plan documents alone.",
		};
	}

	if (repos.length > 1) {
		return {
			error:
				`${planRoot} is a workbench wrapping ${repos.length} repos (${declared}), and nothing in the plan says which holds its code. ` +
				"Refusing rather than picking one — a verdict against the wrong repository is indistinguishable from a correct one. " +
				"Run verify inside the repo the phase's code lives in.",
		};
	}

	return {
		error:
			`${planRoot} is a workbench: its plan documents and its code (${declared}) live in different repositories, ` +
			"and the verify ledger records a baseline from the plan repo that has no meaning in the code repo. " +
			"Refusing rather than judging code against a diff that cannot contain it. " +
			`Run verify inside ${join(planRoot, declared)} instead; cross-repo verification is a named follow-on.`,
	};
}

export function isRefusal(r: VerifyRoots | VerifyRootsRefusal): r is VerifyRootsRefusal {
	return "error" in r;
}
