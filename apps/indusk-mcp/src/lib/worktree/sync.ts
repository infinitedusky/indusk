import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The workbench sync mechanism: commit → pull → push, blindly resolved.
 *
 * ONE function, called by every trigger. The ADR left the trigger open
 * (watcher vs. mutation chokepoints); separating mechanism from trigger means
 * that choice can change later without rewriting any of this. Today it is
 * driven by the `PostToolUse` hook and by `/catchup`; a `--watch` daemon can
 * call the same entry point when the gap is felt.
 *
 * **Commit BEFORE pull**, despite the brief's "pull before everything".
 * The safety property the brief actually names is *both sides are always
 * committed before any merge* — that is what makes blind resolution
 * recoverable, because nothing that was lost is unreachable from `git log`.
 * Pulling into a dirty tree would either refuse (blocking an agent) or stash
 * (inventing a third state nobody can see). Committing first satisfies the
 * real invariant and keeps the tree clean for the merge.
 *
 * Nothing here ever blocks. An unreachable remote leaves the work committed
 * locally and exits 0 — someone else's outage must never become your inability
 * to work.
 */

export interface SyncResult {
	committed: boolean;
	pulled: "ok" | "skipped" | "failed";
	pushed: "ok" | "skipped" | "failed";
	/** Human-facing lines, in order. */
	notes: string[];
	/** True when a remote is configured at all. */
	hasRemote: boolean;
}

function git(cwd: string, args: string[]): { ok: boolean; out: string; err: string } {
	const r = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
		env: {
			...process.env,
			// The loop authors commits, not a person. Without this a machine with
			// no git identity fails to commit and the work is silently uncommitted.
			GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME ?? "indusk",
			GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL ?? "indusk@localhost",
			GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME ?? "indusk",
			GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL ?? "indusk@localhost",
		},
	});
	return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

export function isGitRepo(root: string): boolean {
	return existsSync(join(root, ".git"));
}

/** Initialize the context repo. Local commits work with no remote at all. */
export function ensureContextRepo(root: string): boolean {
	if (isGitRepo(root)) return false;
	git(root, ["init", "--quiet", "--initial-branch=main"]);
	return true;
}

function currentBranch(root: string): string {
	const r = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
	const name = r.out.trim();
	return name && name !== "HEAD" ? name : "main";
}

function remoteName(root: string): string | null {
	const r = git(root, ["remote"]);
	const first = r.out.trim().split("\n").filter(Boolean)[0];
	return first ?? null;
}

/**
 * A timestamp, not a narrative.
 *
 * The workbench history is a sync log — the *content* is the record, and the
 * message only has to be recognizable and unprompted. Anything that tried to
 * summarize would be a lie invented by a loop that does not know why the file
 * changed.
 */
function syncMessage(at: Date): string {
	return `sync ${at.toISOString()}`;
}

export function syncWorkbench(root: string, at: Date = new Date()): SyncResult {
	const notes: string[] = [];
	if (ensureContextRepo(root))
		notes.push("Initialized the workbench context repo (no remote yet).");

	const branch = currentBranch(root);
	const remote = remoteName(root);
	const result: SyncResult = {
		committed: false,
		pulled: "skipped",
		pushed: "skipped",
		notes,
		hasRemote: remote !== null,
	};

	// --- 1. COMMIT. Always first, always local, never blocked. ---
	const dirty = git(root, ["status", "--porcelain"]).out.trim() !== "";
	if (dirty) {
		git(root, ["add", "-A"]);
		const c = git(root, ["commit", "--quiet", "-m", syncMessage(at)]);
		result.committed = c.ok;
		if (!c.ok) {
			// STOP. The entire safety argument for the blind merge below is
			// "both sides are committed before any merge" — that is what makes a
			// lost hunk recoverable from `git log`. When the commit fails the
			// argument is void, and pulling would merge someone else's history
			// over work that exists nowhere but this working tree.
			//
			// A failed commit is ordinary, not exotic: a pre-commit hook, a
			// missing git identity, a full disk, or an `index.lock` held by a
			// concurrent sync all produce it.
			notes.push(`Commit failed, so nothing was pulled or pushed: ${calmly(c.err)}`);
			notes.push("Your working tree is untouched. Fix the commit, then sync again.");
			return result;
		}
		notes.push(`Committed local changes (${syncMessage(at)}).`);
	}

	if (!remote) {
		notes.push(
			"No remote configured — commits are local only. `git remote add origin <url>` to share.",
		);
		return result;
	}

	// --- 2. PULL, resolved blindly. ---
	// `-X theirs` decides hunks that genuinely conflict; `merge=union` in
	// .gitattributes overrides it for the append-shaped files, where BOTH sides
	// are meant. Losing a hunk here is recoverable — step 1 committed it.
	const pull = git(root, [
		"-c",
		"pull.rebase=false",
		"pull",
		"--no-edit",
		"--quiet",
		"-X",
		"theirs",
		remote,
		branch,
	]);
	if (pull.ok) {
		result.pulled = "ok";
	} else {
		// An empty remote (nothing pushed yet) is not a failure.
		const benign = /couldn't find remote ref|no such ref|Couldn't find remote ref/i.test(pull.err);
		result.pulled = benign ? "skipped" : "failed";
		if (!benign)
			notes.push(
				`Pull skipped — remote unreachable (${calmly(pull.err)}). Continuing with local state.`,
			);
	}

	// --- 3. PUSH, best-effort, one retry through a re-pull on rejection. ---
	let push = git(root, ["push", "--quiet", remote, branch]);
	if (!push.ok) {
		git(root, [
			"-c",
			"pull.rebase=false",
			"pull",
			"--no-edit",
			"--quiet",
			"-X",
			"theirs",
			remote,
			branch,
		]);
		push = git(root, ["push", "--quiet", remote, branch]);
	}
	result.pushed = push.ok ? "ok" : "failed";
	if (!push.ok) {
		notes.push(
			`Push deferred — remote unreachable (${calmly(push.err)}). Work is committed locally and goes out on the next sync.`,
		);
	}

	return result;
}

/**
 * Git's own wording, made safe to show for an expected condition.
 *
 * An unreachable remote is NORMAL here — the whole point of committing first
 * is that working offline is not an error. Echoing git's raw `fatal: ...`
 * presents a routine outage as a hard failure, which is exactly the shape A6
 * forbids: someone else's downtime must not read as your problem to fix.
 * The cause is kept, the alarm is not.
 */
function calmly(s: string): string {
	const line =
		s
			.trim()
			.split("\n")
			.find((l) => l.trim() !== "") ?? "";
	return line
		.replace(/^fatal:\s*/i, "")
		.replace(/^error:\s*/i, "")
		.trim();
}

/**
 * Per-repo publish state — the two-clock skew, made visible.
 *
 * A workbench's plan documents auto-sync in seconds while the code they
 * describe pushes when its author decides. A developer who pulls a phase
 * marked complete has no way to tell whether the commits behind it exist
 * anywhere but the author's laptop. "Done" and "present" are two questions on
 * two clocks, and the plan is the faster one.
 */
export interface RepoPublishState {
	name: string;
	present: boolean;
	ahead: number;
	hasRemote: boolean;
	/**
	 * Whether this branch exists on the remote at all.
	 *
	 * Distinct from `ahead === 0`. A branch that was never pushed has no
	 * remote-tracking ref, so no count is meaningful — and calling that "in
	 * sync" is the inversion this field exists to prevent.
	 *
	 * REQUIRED, not optional: every return path sets it, so an optional type
	 * would describe a state the code cannot produce while forcing readers into
	 * `=== false` comparisons to stay correct about it.
	 */
	published: boolean;
}

export function repoPublishState(siblingParent: string, name: string): RepoPublishState {
	const path = join(siblingParent, name);
	if (!existsSync(join(path, ".git"))) {
		return { name, present: false, ahead: 0, hasRemote: false, published: false };
	}
	const remote = remoteName(path);
	if (!remote) return { name, present: true, ahead: 0, hasRemote: false, published: false };

	const branch = currentBranch(path);

	// Does a remote-tracking ref exist at all? `rev-list A..B` ERRORS when it
	// does not, and reading that error as "0 commits ahead" reports the worst
	// case — nothing has ever left this machine — as the most reassuring one.
	const tracked = git(path, ["rev-parse", "--verify", "--quiet", `${remote}/${branch}`]).ok;
	if (!tracked) return { name, present: true, ahead: 0, hasRemote: true, published: false };

	const counted = git(path, ["rev-list", "--count", `${remote}/${branch}..HEAD`]);
	const ahead = counted.ok ? Number.parseInt(counted.out.trim(), 10) || 0 : 0;
	return { name, present: true, ahead, hasRemote: true, published: true };
}
