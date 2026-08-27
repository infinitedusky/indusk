import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { repoDir, type WorkbenchRepo } from "./repos.js";

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
 * The two rules a FLAT workbench cannot do without, named once.
 *
 * Both the generated file and the check that looks for them read these — a
 * restated copy is where the generator and its checker drift, which has
 * already happened twice in this plan.
 */
const ROOT_DENY_RULE = "/*/";
const SECRETS_RULE = ".indusk/extensions/*/.env";

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
.indusk/sync-stamp
.claude/settings.local.json
node_modules/

# Docs build artifacts
docs/src/.vitepress/cache/
docs/src/.vitepress/dist/
`;

/**
 * The ignore file for a workbench that DECLARES where its worktrees go.
 *
 * No deny-by-default rule, because none is needed: every worktree lives inside
 * a directory the config names, so each gets one precise line. That precision
 * is what makes this appendable to a `.gitignore` somebody else wrote — it
 * adds rules rather than inverting the file's meaning.
 */
const GITIGNORE_DECLARED_HEADER = `# InDusk workbench context repo.
#
# This workbench DECLARES where each repo's worktrees live, so the trunks and
# worktree directories are named exactly below. No deny-by-default rule is
# needed, and none is imposed.

# Secrets — transferred out-of-band, never committed.
.indusk/extensions/*/.env*
!.indusk/extensions/*/.env.example
env/*.env
.env
.env.*
!.env.example

# Machine-local state — real content, but true only for this machine.
.indusk/eval/
.indusk/current.md.lock
.indusk/sync-stamp
.claude/settings.local.json
node_modules/
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
function trunkBlock(repos: readonly WorkbenchRepo[]): string {
	if (repos.length === 0) return "";
	const lines: string[] = [TRUNK_BLOCK_MARKER];
	for (const repo of repos) {
		lines.push(`/${repoDir(repo)}`);
		// A DECLARED worktrees directory can be named exactly — which is the
		// whole reason declaring it removes the need to deny the root by
		// default. Worktree names are invented at runtime and can never be
		// listed in advance; the directory containing them is knowable.
		if (repo.worktrees) lines.push(`/${repo.worktrees}/`);
	}
	lines.push("");
	return lines.join("\n");
}

/** Every repo places its worktrees somewhere nameable. */
export function allLocationsDeclared(repos: readonly WorkbenchRepo[]): boolean {
	return repos.length > 0 && repos.every((r) => typeof r.worktrees === "string");
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

/**
 * Marker `indusk init` writes into the ignore files it owns.
 *
 * The line between "extend this" and "refuse to touch this". InDusk wrote the
 * file, so InDusk may add rules to it; a file a human wrote is a decision, and
 * appending deny-by-default to it would invert what they meant.
 */
const INDUSK_MANAGED_MARKER = "# InDusk managed";

/** Rules a flat workbench needs, in the order they should be appended. */
const FLAT_WORKBENCH_RULES = `
# --- InDusk workbench (generated) ---
# Worktree directories are created at runtime, so they cannot be named in
# advance — the root is deny-by-default and shared directories are opted back
# in below. Root FILES are untouched.
${ROOT_DENY_RULE}
!/.indusk/
!/.claude/
!/env/
!/scripts/
!/docs/
${SECRETS_RULE}*
!${SECRETS_RULE}.example
env/*.env
.indusk/current.md.lock
`;

/**
 * Add the flat-workbench rules to an ignore file InDusk already owns.
 *
 * Found by running `indusk setup` and then `workbench sync`: init scaffolds a
 * `.gitignore`, so EVERY freshly created workbench tripped the refusal and
 * could not sync at all. A guard that blocks the product's own output is not a
 * guard, it is a bug — and no fixture caught it because fixtures ship no
 * ignore file.
 *
 * Returns true when it topped up.
 */
export function topUpManagedIgnore(workbenchRoot: string): boolean {
	const path = join(workbenchRoot, ".gitignore");
	if (!existsSync(path)) return false;
	const body = readFileSync(path, "utf-8");
	if (!body.includes(INDUSK_MANAGED_MARKER)) return false; // a human's file — refuse elsewhere
	if (body.includes(ROOT_DENY_RULE)) return false; // already correct
	appendFileSync(path, FLAT_WORKBENCH_RULES);
	return true;
}

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
	repos: readonly WorkbenchRepo[] = [],
): ScaffoldResult {
	const created: string[] = [];
	const kept: string[] = [];

	const ignorePath = join(workbenchRoot, ".gitignore");
	if (!existsSync(ignorePath)) {
		// Deny-by-default only where it is NEEDED. A workbench that declares
		// where its worktrees go can name them precisely, and a whole-root denial
		// would be an opinion it does not require.
		writeFileSync(
			ignorePath,
			allLocationsDeclared(repos)
				? `${GITIGNORE_DECLARED_HEADER}\n${trunkBlock(repos)}`
				: `${GITIGNORE_HEADER}\n${trunkBlock(repos)}`,
		);
		created.push(".gitignore");
	} else {
		// TOP UP rather than rewrite. An existing ignore file is a decision
		// somebody made; a repo declared later still needs its symlink named, so
		// only the missing lines are appended.
		const body = readFileSync(ignorePath, "utf-8");
		const missing = repos.filter((r) => !new RegExp(`^/${repoDir(r)}(/)?$`, "m").test(body));
		if (missing.length > 0) {
			const block = body.includes(TRUNK_BLOCK_MARKER)
				? `${trunkBlock(missing).split("\n").slice(1).join("\n")}`
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
	// DERIVED from what the generator actually emits, never restated.
	//
	// These drifted twice: the check asked for one spelling of the root rule
	// while the header wrote another, so a correctly-scaffolded workbench
	// reported a gap and a real gap could have gone unreported. Both times the
	// "fix" was a second copy of a string. Reading the rule out of the constant
	// that writes it is the only version that cannot drift.
	const required: Array<[string, string]> = [
		[
			ROOT_DENY_RULE,
			"the root is not deny-by-default, so the next worktree directory gets committed",
		],
		[SECRETS_RULE, "extension secrets are not ignored"],
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
