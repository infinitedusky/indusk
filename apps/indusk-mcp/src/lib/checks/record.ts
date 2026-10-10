import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { gitSync } from "../bookkeeping/git.js";
import { readJsonl } from "../bookkeeping/jsonl.js";
import { bookkeepingRoots } from "../bookkeeping/roots.js";

/**
 * The record of green slow runs (release-checks-run-once D1–D2), in the
 * project's home: the same file from the main checkout and every worktree, so
 * a run recorded at landing in a plan's worktree is found by the release on
 * `main`. Per machine by design — a run on another machine is not evidence
 * here. Only fully green runs over a clean tree are ever written.
 *
 * promise: slow-checks-run-once-per-tree
 */
export interface GreenRun {
	key: string;
	at: string;
	command: string;
	cwd: string;
	/** The commit the run was made on (release-records-its-failures D9); absent on runs recorded before. */
	sha?: string;
}

function recordPath(anyCheckout: string): string {
	return join(bookkeepingRoots(anyCheckout).home, "slow-runs.jsonl");
}

export function recordGreenRun(anyCheckout: string, run: GreenRun): void {
	const path = recordPath(anyCheckout);
	mkdirSync(bookkeepingRoots(anyCheckout).home, { recursive: true });
	appendFileSync(path, `${JSON.stringify(run)}\n`);
}

/** The latest green run that covered `key`, or `null`. */
export function findCoveringRun(anyCheckout: string, key: string): GreenRun | null {
	const runs = readJsonl(recordPath(anyCheckout)).filter(
		(r): r is GreenRun & Record<string, unknown> =>
			r.key === key && typeof r.at === "string" && typeof r.cwd === "string",
	);
	return runs.at(-1) ?? null;
}

/** The commit a checkout is on, for a green run's `sha` and the release record; `unknown` outside git. */
export function headCommit(checkout: string): string {
	const head = gitSync(checkout, "rev-parse", "HEAD");
	return head.code === 0 ? head.out : "unknown";
}
