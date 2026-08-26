import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The two files that make a workbench root safe to share.
 *
 * Derived from the POC's hand-written pair, which had already survived
 * months of real use — including two rules nobody would invent from first
 * principles (see the comments in the generated file). Productizing a working
 * artifact beats authoring a fresh one and discovering its gaps in a client
 * repo.
 *
 * Both are scaffolded ONLY when absent. A workbench that has tuned its own
 * ignore rules must never have them overwritten by an update — the whole point
 * of the whitelist is that a human decided what may travel.
 */

/**
 * Root-level DIRECTORY whitelist, not a blacklist.
 *
 * Worktree directories appear at the workbench root with names invented at
 * runtime (`indusk worktree create <slug>`), so a deny-list is always one
 * command behind: the next worktree is a whole checkout of someone else's repo
 * committed into your context remote. Deny-by-default is the only shape that
 * is correct for a name nobody has thought of yet.
 */
const GITIGNORE_HEADER = `# InDusk workbench context repo.
#
# ROOT DIRECTORY whitelist. Every root DIRECTORY is ignored unless opted in
# below — worktree directories are created at runtime by \`indusk worktree
# create <slug>\`, so a deny-list is always one command behind, and what it
# misses is a whole checkout of another repo committed into the context repo.
#
# Root FILES are deliberately NOT denied. An earlier version used \`/*\` to
# also catch trunk symlinks (git stores those as blobs, so \`/*/\` misses them)
# and thereby untracked every root file a real workbench had — .mcp.json,
# biome.json, instrumentation.ts. Those are shared context. Symlinks are named
# explicitly instead, in the generated block below.
/*/
!/.indusk/
!/.claude/
!/env/
!/scripts/
!/docs/

# Secrets — transferred out-of-band, never committed.
# NOTE the trailing glob: extensions also emit .env.local / .env.production
# carrying live keys. A bare \`.env\` pattern does not match those.
.indusk/extensions/*/.env*
!.indusk/extensions/*/.env.example
env/*.env
.env
.env.*
!.env.example

# Machine-local state — real content, but true only for this machine.
.indusk/eval/
.indusk/current.md.lock
.claude/settings.local.json
node_modules/

# Docs build artifacts
docs/src/.vitepress/cache/
docs/src/.vitepress/dist/
`;

/** Marker for the generated trunk-symlink block, so it can be extended later. */
const TRUNK_BLOCK_MARKER = "# --- InDusk trunk symlinks (generated) ---";

/**
 * The trunk symlinks, named one per declared repo.
 *
 * Git stores a symlink as a blob, so the directory-only rule above (slash-star-slash)
 * cannot see them. Naming them is more precise than broadening the rule — and precision
 * is what keeps real root files tracked.
 */
function trunkBlock(repoNames: readonly string[]): string {
	if (repoNames.length === 0) return "";
	return [TRUNK_BLOCK_MARKER, ...repoNames.map((n) => `/${n}`), ""].join("\n");
}

/**
 * `merge=union` on the append-shaped coordination files.
 *
 * These are logs, not documents: two machines appending different lines both
 * mean it, and a conflict marker in the middle of `current.md` blocks every
 * agent on both sides. Union keeps both. It is deliberately NOT applied to
 * plan documents, where a blind union would interleave prose.
 */
const GITATTRIBUTES = `# InDusk workbench context repo.
#
# Append-shaped coordination files: two machines appending different lines both
# mean it, so keep both rather than raising a conflict nobody can resolve
# usefully. Deliberately NOT applied to plan documents — a blind union there
# would interleave prose.
.indusk/current.md merge=union
.indusk/highlights.jsonl merge=union
.indusk/highlights-processed.jsonl merge=union
`;

export interface ScaffoldResult {
	created: string[];
	kept: string[];
}

/**
 * Ensure a workbench root carries the files that make it shareable.
 *
 * Idempotent and non-destructive: an existing file is reported as kept, never
 * rewritten.
 */
export function ensureShareableScaffolding(
	workbenchRoot: string,
	repoNames: readonly string[] = [],
): ScaffoldResult {
	const created: string[] = [];
	const kept: string[] = [];

	const ignorePath = join(workbenchRoot, ".gitignore");
	if (!existsSync(ignorePath)) {
		writeFileSync(ignorePath, `${GITIGNORE_HEADER}\n${trunkBlock(repoNames)}`);
		created.push(".gitignore");
	} else {
		// TOP UP rather than rewrite. An existing ignore file is a decision
		// somebody made; a repo declared later still needs its symlink named, so
		// only the missing lines are appended.
		const body = readFileSync(ignorePath, "utf-8");
		const missing = repoNames.filter((n) => !new RegExp(`^/${n}$`, "m").test(body));
		if (missing.length > 0) {
			const block = body.includes(TRUNK_BLOCK_MARKER)
				? `${missing.map((n) => `/${n}`).join("\n")}\n`
				: `\n${trunkBlock(missing)}`;
			appendFileSync(ignorePath, block);
			kept.push(`.gitignore (+${missing.length} trunk rule${missing.length === 1 ? "" : "s"})`);
		} else {
			kept.push(".gitignore");
		}
	}

	const attrPath = join(workbenchRoot, ".gitattributes");
	if (existsSync(attrPath)) {
		kept.push(".gitattributes");
	} else {
		writeFileSync(attrPath, GITATTRIBUTES);
		created.push(".gitattributes");
	}

	return { created, kept };
}

/**
 * Does this workbench's ignore file actually cover the machine-specific set?
 *
 * Used by the nudge path rather than to rewrite anything — a workbench with a
 * hand-tuned `.gitignore` is the normal case, and silently replacing it would
 * destroy a decision somebody made.
 */
export function missingIgnoreRules(workbenchRoot: string): string[] {
	const path = join(workbenchRoot, ".gitignore");
	if (!existsSync(path)) return [".gitignore is absent entirely"];
	const body = readFileSync(path, "utf-8");
	// These must match what GITIGNORE above actually emits. They drifted once
	// already — the check looked for `/*/` after the rule became `/*`, and
	// reported a correct workbench as broken.
	const required: Array<[string, string]> = [
		[
			"\n/*\n",
			"the root is not deny-by-default, so the next worktree or trunk symlink gets committed",
		],
		[".indusk/extensions/*/.env", "extension secrets are not ignored"],
	];
	return required.filter(([rule]) => !body.includes(rule)).map(([rule, why]) => `${rule} — ${why}`);
}

/**
 * Drop from the index anything the ignore rules now cover.
 *
 * Scaffolding `.gitignore` into an EXISTING repo does not untrack what is
 * already tracked — git ignores only untracked paths. A workbench that was
 * git-initialized before these rules existed therefore keeps publishing its
 * trunk symlinks and secrets to the shared remote while the ignore file sits
 * there looking correct. That gap is invisible: `git status` is clean.
 *
 * `--cached` touches the INDEX only. Every file stays on disk, and the change
 * is a commit away from being reverted.
 */
export function untrackNowIgnored(workbenchRoot: string): string[] {
	const listed = spawnSync("git", ["ls-files", "-i", "-c", "--exclude-standard"], {
		cwd: workbenchRoot,
		encoding: "utf-8",
	});
	if (listed.status !== 0) return [];
	const paths = (listed.stdout ?? "").trim().split("\n").filter(Boolean);
	if (paths.length === 0) return [];

	const removed = spawnSync("git", ["rm", "-r", "--cached", "--quiet", "--", ...paths], {
		cwd: workbenchRoot,
		encoding: "utf-8",
	});
	return removed.status === 0 ? paths : [];
}
