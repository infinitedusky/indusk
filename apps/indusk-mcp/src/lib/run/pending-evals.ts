import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * The pending-eval queue (dawn-hook-parity A3/A4, ADR Decision 3).
 *
 * The thin lane records one durable record per loop-owned commit in
 * `.indusk/eval/pending.jsonl`; a later drain — from any environment that has
 * the `claude` CLI — evaluates each exactly once. This decouples the lane
 * from Claude Code entirely (A9): the lane appends, the drain spawns.
 *
 * Dedup inherits the eval rail's `markProcessed` invariant: the drained
 * ledger is written BEFORE the evaluator spawns (a crashed spawn is a logged
 * gap, never a double-eval), and an already-drained sha is a STOP, not a
 * re-append.
 */

export interface PendingEvalRecord {
	sha: string;
	plan: string;
	phase: number;
	source: string;
	timestamp: string;
}

const PENDING_FILE = "pending.jsonl";
const DRAINED_FILE = "pending-drained.jsonl";

/**
 * The eval state dir for a worktree — workbench-aware: first ancestor
 * carrying `.indusk/` wins (mirrors the hooks' state-path walk), falling back
 * to the worktree root itself.
 */
export function resolveEvalStateDir(worktreeRoot: string): string {
	let current = resolve(worktreeRoot);
	for (let i = 0; i < 40; i++) {
		if (existsSync(join(current, ".indusk"))) {
			return join(current, ".indusk", "eval");
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return join(resolve(worktreeRoot), ".indusk", "eval");
}

/** Append one record — one successful loop commit — to the pending queue. */
export async function appendPendingEval(
	worktreeRoot: string,
	record: PendingEvalRecord,
): Promise<void> {
	const dir = resolveEvalStateDir(worktreeRoot);
	await mkdir(dir, { recursive: true });
	await appendFile(join(dir, PENDING_FILE), `${JSON.stringify(record)}\n`, "utf8");
}

async function readJsonl(path: string): Promise<Array<Record<string, unknown>>> {
	const raw = await readFile(path, "utf8").catch(() => "");
	return raw
		.split("\n")
		.filter((line) => line.trim())
		.flatMap((line) => {
			try {
				return [JSON.parse(line) as Record<string, unknown>];
			} catch {
				// Malformed lines are skipped, never fatal — append-only logs may
				// carry partial lines from crashed writers (results.log precedent).
				return [];
			}
		});
}

/** Pending records not yet in the drained ledger, oldest first. */
export async function listPending(worktreeRoot: string): Promise<PendingEvalRecord[]> {
	const dir = resolveEvalStateDir(worktreeRoot);
	const pending = (await readJsonl(join(dir, PENDING_FILE))) as unknown as PendingEvalRecord[];
	const drained = new Set(
		(await readJsonl(join(dir, DRAINED_FILE))).map((r) => r.sha as string),
	);
	return pending.filter((r) => typeof r.sha === "string" && !drained.has(r.sha));
}

/**
 * Mark a sha drained. Returns `{ alreadyDrained: true }` — a STOP signal,
 * never a re-append — when the ledger already carries it.
 */
export async function markDrained(
	worktreeRoot: string,
	sha: string,
): Promise<{ alreadyDrained: boolean }> {
	const dir = resolveEvalStateDir(worktreeRoot);
	const drained = await readJsonl(join(dir, DRAINED_FILE));
	if (drained.some((r) => r.sha === sha)) {
		return { alreadyDrained: true };
	}
	await mkdir(dir, { recursive: true });
	await appendFile(
		join(dir, DRAINED_FILE),
		`${JSON.stringify({ sha, drainedAt: new Date().toISOString() })}\n`,
		"utf8",
	);
	return { alreadyDrained: false };
}
