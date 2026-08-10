import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { changedPathsPartitioned } from "../git.js";
import { findPhaseStart, readBoundaries } from "./boundary.js";

/**
 * What this phase changed — the scope Shape reviews.
 *
 * Getting it wrong breaks Shape in either direction: too wide and every phase
 * re-flags code an earlier phase already reviewed; too narrow and real work
 * goes unlooked-at.
 */

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

	const { tracked, untracked } = await changedPathsPartitioned(options.root, start.sha);

	// An unparseable timestamp must not silently narrow the scope, so fall back
	// to the epoch — every untracked file then counts as this phase's.
	const opened = new Date(start.timestamp);
	const openedAt = Number.isNaN(opened.getTime()) ? new Date(0) : opened;

	const untrackedThisPhase: string[] = [];
	for (const rel of untracked) {
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
