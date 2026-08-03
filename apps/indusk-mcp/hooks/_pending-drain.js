/**
 * Pending-eval queue drain for InDusk hooks (dawn-hook-parity).
 *
 * The Dawn thin lane (`atdawn run`) cannot spawn an evaluator — it may run on
 * a machine with no `claude` CLI — so every loop-owned commit is queued in
 * `.indusk/eval/pending.jsonl`. This module evaluates that backlog, exactly
 * once per record, from any environment that CAN evaluate.
 *
 * Lifted out of `eval-trigger.js` (dawn-hook-parity cleanup): that hook's job
 * is decide-and-spawn on a commit; draining a queue is a separate concern that
 * happens to share the same entry point. Hook-local module, following the
 * `_hook-paths.js` precedent — the `_` prefix marks "imported by hooks, not a
 * registered hook itself" (no settings entry), and `globSync("*.js")` on both
 * the init and update paths copies it into consumers' `.claude/hooks/`
 * alongside the hooks that import it.
 *
 * The durability contract, hard-won in falsification (A12):
 *
 *   - The drained ledger is written BEFORE each spawn, so a drain that crashes
 *     mid-record leaves a logged gap rather than double-evaluating it.
 *   - That entry is PROVISIONAL: an evaluator that exits non-zero means the
 *     record was never evaluated, so it is un-drained and stays queued. A
 *     machine that cannot evaluate must never silently empty the backlog —
 *     the queue exists precisely to survive that case.
 */

import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Read a jsonl file into records. Missing file → []; malformed lines are
 * skipped, never fatal (append-only logs can carry a partial line from a
 * crashed writer — the results.log precedent).
 */
function readJsonl(path) {
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf8")
		.split("\n")
		.filter((line) => line.trim())
		.flatMap((line) => {
			try {
				return [JSON.parse(line)];
			} catch {
				return [];
			}
		});
}

/**
 * Spawn one evaluation. Resolves TRUE only when the child exits 0 — the
 * caller uses that to decide whether the record may stay drained.
 *
 * `INDUSK_EVAL_CMD` overrides the per-record command (receives
 * `<sha> <source>` as argv) so tests can drive the drain without a real
 * evaluator session.
 */
function runOne(record, { cwd, triggerScript }) {
	return new Promise((resolveRun) => {
		const recordSource = record.source ?? "atdawn";
		const override = process.env.INDUSK_EVAL_CMD;
		const [cmd, ...baseArgs] = override
			? override.split(" ").filter(Boolean)
			: [
					process.execPath,
					"--no-warnings",
					triggerScript,
					"--source",
					recordSource,
					"--change-id",
					record.sha,
				];
		const args = override ? [...baseArgs, record.sha, recordSource] : baseArgs;
		const child = spawn(cmd, args, { cwd, stdio: ["ignore", "ignore", "inherit"] });
		child.on("close", (code) => resolveRun(code === 0));
		child.on("error", () => resolveRun(false));
	});
}

/**
 * Drain the pending-eval queue under `statePath`, sequentially.
 *
 * Sequential and awaited by design: a drain is a foreground maintenance
 * command (`/rail-check`), and awaiting serializes evaluator pressure.
 * Recorded limitation: the real per-record child detaches its inner
 * evaluator, so a very large backlog still fans out — drain at rail-check
 * cadence rather than letting the queue grow unbounded.
 *
 * @returns {Promise<{drained: number, failed: string[], alreadyDrained: number}>}
 */
export async function drainPendingEvals({ statePath, cwd, triggerScript, log }) {
	const evalDir = resolve(statePath, ".indusk", "eval");
	const drainedPath = resolve(evalDir, "pending-drained.jsonl");

	const pending = readJsonl(resolve(evalDir, "pending.jsonl"));
	const drainedShas = new Set(readJsonl(drainedPath).map((r) => r.sha));
	const todo = pending.filter((r) => typeof r.sha === "string" && !drainedShas.has(r.sha));

	const failed = [];
	let drained = 0;

	for (const record of todo) {
		mkdirSync(evalDir, { recursive: true });
		appendFileSync(
			drainedPath,
			`${JSON.stringify({ sha: record.sha, drainedAt: new Date().toISOString() })}\n`,
			"utf8",
		);
		const ok = await runOne(record, { cwd, triggerScript });
		if (ok) {
			drained++;
		} else {
			failed.push(record.sha);
			// Un-drain: rewrite the ledger without this sha so it is retried.
			const kept = readJsonl(drainedPath).filter((r) => r.sha !== record.sha);
			writeFileSync(
				drainedPath,
				kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""),
				"utf8",
			);
		}
	}

	const alreadyDrained = pending.length - todo.length;
	log?.(
		`drain complete — ${drained} drained, ${failed.length} failed (still queued), ${alreadyDrained} already drained`,
	);
	return { drained, failed, alreadyDrained };
}
