import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, normalize, relative, resolve, sep } from "node:path";

/**
 * Worktree path containment — the boundary the orchestrator's confinement
 * claim rests on.
 *
 * Extracted from `tools.ts` (Phase 7) because it has two consumers (the tool
 * definitions and the gate adapter) and non-obvious semantics that earned
 * their own home: containment is checked textually AND against real paths,
 * with both sides resolved the same way. Getting that symmetry wrong is not
 * hypothetical — an asymmetric first draft treated a not-yet-created root
 * under macOS's `/tmp` → `/private/tmp` symlink as an escape.
 */

/**
 * Resolve `p` inside `root`, throwing if the result escapes the root.
 *
 * Textual containment is checked first, then the REAL path (T12): `resolve()`
 * only normalizes `..` lexically, so a symlink living inside the root but
 * pointing outside it passes a purely textual check while the subsequent
 * read/write lands wherever the link points.
 */
export function resolveInWorktree(root: string, p: string): string {
	const absRoot = resolve(root);
	const abs = resolve(absRoot, p);
	const rel = relative(absRoot, abs);
	if (rel.startsWith("..") || resolve(absRoot, rel) !== abs) {
		throw new Error(
			`Path "${p}" escapes the worktree root — all paths must stay inside ${absRoot}.`,
		);
	}

	// Both sides resolve the same way — realpath-ing only one of them makes a
	// not-yet-created root under a symlinked parent (macOS `/tmp` →
	// `/private/tmp`) look like an escape.
	const realRoot = realpathOfNearestExisting(absRoot);
	const realTarget = realpathOfNearestExisting(abs);
	const realRel = relative(realRoot, realTarget);
	if (realRel.startsWith("..") || resolve(realRoot, realRel) !== realTarget) {
		throw new Error(
			`Path "${p}" escapes the worktree root through a symlink — it resolves to ${realTarget}, outside ${realRoot}.`,
		);
	}

	return abs;
}

/**
 * realpath of `p` if it exists; otherwise realpath of its nearest existing
 * ancestor with the not-yet-created remainder appended — so a write to a new
 * file under a symlinked directory is still checked against the real location.
 */
export function realpathOfNearestExisting(p: string): string {
	let current = p;
	const trailing: string[] = [];
	for (let i = 0; i < 64; i++) {
		try {
			return resolve(realpathSync(current), ...trailing.reverse());
		} catch {
			const parent = dirname(current);
			if (parent === current) return p;
			trailing.push(basename(current));
			current = parent;
		}
	}
	return p;
}

/**
 * The two places a run may touch when the plan and its code are different
 * repositories (dawn-workbench-execution): the CODE root, where relative
 * paths resolve, bash runs and code commits land; and the plan's own folder
 * under the PLAN root, where the impl lives. Nothing else — not the rest of
 * the workbench, not a sibling repo.
 */
export interface ToolRoots {
	/** Where code is edited, bash runs, code commits land. Relative paths resolve here. */
	codeRoot: string;
	/** Where the plan lives — impl, gates, ledger, queue. */
	planRoot: string;
	/** The plan's own folder, relative to `planRoot` (`.indusk/planning/<plan>`). */
	planDir: string;
}

/** A single root (flat project) or the two-root shape. */
export type RootSpec = string | ToolRoots;

/** A flat root becomes the degenerate two-root shape: one directory, no separate plan folder. */
export function normalizeRoots(spec: RootSpec): ToolRoots {
	if (typeof spec === "string") {
		const root = resolve(spec);
		return { codeRoot: root, planRoot: root, planDir: "" };
	}
	return {
		codeRoot: resolve(spec.codeRoot),
		planRoot: resolve(spec.planRoot),
		planDir: normalize(spec.planDir).replace(/[\\/]+$/, ""),
	};
}

/** True when `abs` is `root` or lies under it, textually. */
function within(root: string, abs: string): boolean {
	const rel = relative(root, abs);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/**
 * Resolve `p` inside one of the two roots, throwing when it lands in neither.
 *
 * A flat root is `resolveInWorktree` unchanged. When the roots differ: an
 * absolute path is accepted wherever it lands inside either allowed place; a
 * relative path that begins with the plan folder's own prefix
 * (`.indusk/planning/<plan>/…`) resolves against the plan root, every other
 * relative path against the code root. The refusal names BOTH places, so the
 * model can correct course without guessing which root it missed (A10).
 */
export function resolveInRoots(spec: RootSpec, p: string): string {
	const roots = normalizeRoots(spec);
	if (roots.codeRoot === roots.planRoot) return resolveInWorktree(roots.codeRoot, p);

	const planFolder = resolve(roots.planRoot, roots.planDir);
	const refusal = () =>
		new Error(
			`Path "${p}" is outside both the code root ${roots.codeRoot} and the plan's folder ${planFolder} — ` +
				"those are the only two places this run may touch.",
		);

	if (isAbsolute(p)) {
		const abs = resolve(p);
		if (within(roots.codeRoot, abs)) return resolveInWorktree(roots.codeRoot, abs);
		if (within(planFolder, abs)) return resolveInWorktree(planFolder, abs);
		throw refusal();
	}

	const rel = normalize(p);
	if (rel === roots.planDir || rel.startsWith(roots.planDir + sep)) {
		return resolveInWorktree(planFolder, resolve(roots.planRoot, rel));
	}
	try {
		return resolveInWorktree(roots.codeRoot, rel);
	} catch {
		throw refusal();
	}
}
