/**
 * Facts about a workbench's on-disk layout, defined once.
 *
 * Three things every workbench command needs: which root directories are not
 * worktrees, which declared repo owns a worktree, and how a trunk symlink is
 * made. Each of them lived in two places before this module — `worktree.ts`
 * and `workbench.ts` — because the second command group re-authored what the
 * first already knew.
 *
 * They are here, rather than in either command, for the standing reason a
 * primitive kept inside a domain folder gets COPIED by the next domain instead
 * of imported: it is how `git()` and the phase-block scan each ended up with
 * two definitions, and it is exactly what happened here. Every divergence in
 * this file's subject matter is silent — a missing reserved name renders a
 * machine directory as a worktree, a drifted attribution reads like a correct
 * one, and a trunk link that was not made reports as one that was.
 */

import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	readdirSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
} from "node:fs";
import { join, relative } from "node:path";

/**
 * Root entries that are never worktrees.
 *
 * `docs` is D7's reserved workbench-root internal-docs directory. Absent from
 * this set it renders as a worktree, which is how the POC's `docs/` looked
 * before anyone noticed — the reason it is listed, kept with the listing.
 */
export const RESERVED_ROOT_DIRS: ReadonlySet<string> = new Set([
	".indusk",
	".claude",
	".git",
	".vscode",
	".cursor",
	"node_modules",
	"dist",
	"build",
	".next",
	"scripts",
	"env",
	"docs",
]);

/**
 * Root entries that could be worktrees — directories and symlinks, sorted.
 *
 * Symlinks are included because a trunk is one, and callers filter the trunks
 * out by their DECLARED paths; excluding symlinks here would hide a trunk from
 * the collision checks that need to see it.
 */
export function listWorkbenchSubdirs(root: string): string[] {
	const entries: string[] = [];
	for (const name of readdirSync(root)) {
		if (RESERVED_ROOT_DIRS.has(name)) continue;
		try {
			const st = lstatSync(join(root, name));
			if (st.isDirectory() || st.isSymbolicLink()) entries.push(name);
		} catch {
			// Unreadable entry — skip rather than fail the whole listing.
		}
	}
	return entries.sort();
}

/**
 * Which declared repo does this worktree belong to?
 *
 * Asked of git rather than inferred from the slug: `--git-common-dir` resolves
 * to the OWNING repo's `.git`, so the answer survives any naming convention a
 * developer invents. A name-prefix heuristic would attribute `alpha-feature`
 * to `alpha` by luck and `experiment` to nothing at all — and a wrong
 * attribution reads exactly like a right one.
 *
 * Null means "could not tell", which renders as unattributed rather than being
 * quietly assigned to the first repo.
 */
export function worktreeOwner(worktreePath: string, repoPaths: Map<string, string>): string | null {
	const r = spawnSync(
		"git",
		["-C", worktreePath, "rev-parse", "--path-format=absolute", "--git-common-dir"],
		{ encoding: "utf-8" },
	);
	if (r.status !== 0 || !r.stdout) return null;
	const commonDir = r.stdout.trim();
	for (const [name, repoPath] of repoPaths) {
		try {
			if (realpathSync(commonDir).startsWith(realpathSync(repoPath))) return name;
		} catch {
			// unresolvable path — treat as no match rather than guessing
		}
	}
	return null;
}

/** Whether `p` is a symlink, dangling or not. Private: `linkTrunk` is the surface. */
function isSymlink(p: string): boolean {
	try {
		return lstatSync(p).isSymbolicLink();
	} catch {
		return false;
	}
}

/**
 * A symlink whose target no longer exists.
 *
 * `existsSync` follows the link and so reports FALSE for these — which is why
 * a naive "create it if it does not exist" throws EEXIST on a workbench whose
 * sibling parent moved.
 */
function isDanglingLink(p: string): boolean {
	return isSymlink(p) && !existsSync(p);
}

/**
 * Point `<workbenchRoot>/<name>` at `target`, and say whether it did.
 *
 * Relative target, so the workbench stays portable. Returns false in exactly
 * one case: a real directory occupies the path. That is not ours to remove,
 * and reporting it as linked would be a claim about something that never
 * happened — the falsification A30 fixed in `restore`, and the reason `init`
 * routes through here rather than keeping its own subset.
 */
export function linkTrunk(workbenchRoot: string, name: string, target: string): boolean {
	const link = join(workbenchRoot, name);
	const rel = relative(workbenchRoot, target);
	if (existsSync(link) || isDanglingLink(link)) {
		// A correct link needs nothing doing — report it as linked.
		if (isSymlink(link) && readlinkSync(link) === rel) return true;
		// Repair a link that points somewhere else, dangling included.
		if (isSymlink(link)) rmSync(link);
		else return false;
	}
	symlinkSync(rel, link);
	return true;
}
