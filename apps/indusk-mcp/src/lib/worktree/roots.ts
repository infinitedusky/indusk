import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { declaredRepoDirs, isWorkbench, readWorkbenchRepos } from "./repos.js";

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

export function resolveExecutionRoots(
	planRoot: string,
	plan?: string,
): ExecutionRoots | ExecutionRootsRefusal {
	// Normal-mode project: `.indusk/` ships inside the code repo, so the two
	// roots genuinely are the same directory — dusk itself takes this path.
	if (!isWorkbench(planRoot)) {
		return { planRoot, codeRoot: planRoot, split: false };
	}

	// A workbench plan that names its code (workbench-plan-authoring D2) is
	// answered by its code file, in any number of repos.
	if (plan !== undefined) {
		const code = readPlanCode(planRoot, plan);
		if (code !== null) {
			return code.ok
				? { planRoot, codeRoot: code.code.worktree, split: true }
				: { error: code.problem };
		}
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
		codeRoot: declaredRepoDirs(planRoot)[0].dir,
		split: true,
	};
}

export function isRootsRefusal(
	r: ExecutionRoots | ExecutionRootsRefusal,
): r is ExecutionRootsRefusal {
	return "error" in r;
}

/** The file in a workbench plan's folder that names its code (workbench-plan-authoring D2). */
export const PLAN_CODE_FILE = "code.json";

export interface PlanCode {
	/** The declared repo holding the plan's code. */
	repo: string;
	/** The plan's branch in that repo. */
	branch: string;
	/** The code worktree, absolute. */
	worktree: string;
}

export type ReadPlanCode = { ok: true; code: PlanCode } | { ok: false; problem: string };

/**
 * A workbench plan's code: the repo, branch and worktree its `code.json`
 * names. `null` when the plan has no code file (a normal-mode plan, or one
 * started before this); a problem, by name, when the file cannot be read or
 * names a worktree that is gone. Never a guess by name.
 *
 * promise: a-plan-knows-its-code
 */
export function readPlanCode(planRoot: string, plan: string): ReadPlanCode | null {
	const rel = join(".indusk", "planning", plan, PLAN_CODE_FILE);
	const path = join(planRoot, rel);
	if (!existsSync(path)) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(readFileSync(path, "utf-8"));
	} catch (err) {
		return { ok: false, problem: `${rel} cannot be read: ${(err as Error).message}` };
	}
	const r = raw as Partial<Record<keyof PlanCode, unknown>>;
	for (const key of ["repo", "branch", "worktree"] as const) {
		if (typeof r[key] !== "string" || r[key] === "") {
			return { ok: false, problem: `${rel} has no ${key}` };
		}
	}
	const worktree = resolve(planRoot, r.worktree as string);
	if (!existsSync(worktree)) {
		return {
			ok: false,
			problem: `${rel} names the code worktree ${r.worktree as string}, which no longer exists — recreate it, or start the plan's code again`,
		};
	}
	return { ok: true, code: { repo: r.repo as string, branch: r.branch as string, worktree } };
}

export interface CodeRepo {
	name: string;
	/** The repo's trunk checkout, absolute. */
	dir: string;
	/** Its declared worktrees directory, relative to the workbench root. */
	worktrees?: string;
}

/**
 * Which repo a new workbench plan's code goes in: the one named, or the only
 * one declared. Several declared and none named is refused, listing them; a
 * name not declared is refused too.
 */
export function chooseCodeRepo(planRoot: string, named?: string): CodeRepo | ExecutionRootsRefusal {
	const repos = readWorkbenchRepos(planRoot);
	const dirs = declaredRepoDirs(planRoot);
	const names = repos.map((r) => r.name).join(", ");
	if (repos.length === 0)
		return { error: `${planRoot} declares no repos, so a plan here has nowhere for its code` };
	const pick = named
		? repos.find((r) => r.name === named)
		: repos.length === 1
			? repos[0]
			: undefined;
	if (!pick) {
		return {
			error: named
				? `${named} is not a repo this workbench declares (${names})`
				: `this workbench wraps ${repos.length} repos (${names}): name the one the plan changes with --repo`,
		};
	}
	const dir = dirs.find((d) => d.name === pick.name)?.dir as string;
	return { name: pick.name, dir, ...(pick.worktrees ? { worktrees: pick.worktrees } : {}) };
}
