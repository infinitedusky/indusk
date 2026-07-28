import { realpathSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

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
