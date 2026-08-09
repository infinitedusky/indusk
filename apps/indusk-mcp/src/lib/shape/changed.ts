import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { findPhaseStart, readBoundaries } from "./boundary.js";

/**
 * What this phase changed — the scope Shape reviews.
 *
 * Getting it wrong breaks Shape in either direction: too wide and every phase
 * re-flags code an earlier phase already reviewed; too narrow and real work
 * goes unlooked-at.
 */

const execFileAsync = promisify(execFile);

async function git(root: string, ...args: string[]): Promise<string> {
	const { stdout } = await execFileAsync("git", args, {
		cwd: root,
		maxBuffer: 32 * 1024 * 1024,
	});
	return stdout.trim();
}

/**
 * InDusk's own bookkeeping and the plan documents — never code a phase "wrote".
 *
 * The boundary record is the sharp case: it is written when the phase OPENS, so
 * without this exclusion every phase would show a change before doing any work,
 * and a docs-only phase would look like it had a code surface. That is the same
 * self-satisfying-artifact trap the verify ledger sprang on phantom detection —
 * a tool's own output becoming an input to its own next decision.
 */
function isNotCode(repoRelPath: string): boolean {
	return repoRelPath.startsWith(".indusk/");
}

/**
 * Repo-relative paths this phase changed, including files written but never
 * staged — unstaged work is still work (the lesson `atdawn verify` learned when
 * an agent that wrote code without `git add` looked identical to one that wrote
 * nothing).
 */
/**
 * Did this untracked file appear during the phase?
 *
 * Untracked work has no commit to place it in time, so its mtime is the only
 * evidence available — and without this filter, a scratch file written in
 * Phase 1 and never staged is attributed to Phase 2 and every phase after it.
 * Unreadable stat means keep the file: over-reporting costs a re-read, while
 * dropping real work is the failure this whole scope exists to prevent.
 */
async function appearedAfter(root: string, relPath: string, opened: Date): Promise<boolean> {
	try {
		const info = await stat(join(root, relPath));
		return info.mtime >= opened;
	} catch {
		return true;
	}
}

export async function changedFilesForPhase(options: {
	root: string;
	plan: string;
	phase: number;
}): Promise<string[]> {
	const start = findPhaseStart(await readBoundaries(options.root), options.plan, options.phase);
	if (start === null) {
		throw new Error(
			`No phase-boundary record for ${options.plan} phase ${options.phase} — the phase was never opened, so its changes cannot be scoped. Refusing to review the whole tree.`,
		);
	}

	const committed = await git(options.root, "diff", "--name-only", start.sha, "HEAD");
	const unstaged = await git(options.root, "diff", "--name-only", "HEAD");
	const untracked = await git(options.root, "ls-files", "--others", "--exclude-standard");

	const tracked = [...committed.split("\n"), ...unstaged.split("\n")]
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	// An unparseable timestamp must not silently narrow the scope, so fall back
	// to the epoch — every untracked file then counts as this phase's.
	const opened = new Date(start.timestamp);
	const openedAt = Number.isNaN(opened.getTime()) ? new Date(0) : opened;

	const untrackedThisPhase: string[] = [];
	for (const line of untracked.split("\n")) {
		const rel = line.trim();
		if (rel.length === 0) continue;
		if (await appearedAfter(options.root, rel, openedAt)) untrackedThisPhase.push(rel);
	}

	const candidates = [...new Set([...tracked, ...untrackedThisPhase])].filter(
		(line) => !isNotCode(line),
	);

	// Deletions come back from `git diff` too. A path that is gone cannot be
	// reviewed, and counting it would give a deletion-only phase a code surface
	// it does not have — the same existence filter `cleanup/oversized.ts` applies.
	const present: string[] = [];
	for (const rel of candidates) {
		if (existsSync(join(options.root, rel))) present.push(rel);
	}
	return present;
}
