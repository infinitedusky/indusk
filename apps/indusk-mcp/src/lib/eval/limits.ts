/**
 * What the evaluator does when the model will not or cannot give a scorecard
 * (evaluator-waits-out-limits).
 *
 *  - A **limit refusal** (`api_error_status: 429`, "You've hit your weekly
 *    limit") says nothing about the commit. It is not a failed evaluation: the
 *    commit WAITS — logged as waiting, queued in the file the commit hook
 *    drains, never counted against `every-commit-evaluated` — and a later
 *    commit's trigger evaluates it again.
 *  - An answer with **no scorecard** (a resumed session replied "Noted — …")
 *    is asked once more, in the same session, for the scorecard alone.
 *
 * promise: a-limited-evaluation-waits
 * promise: a-prose-reply-is-asked-again
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evalDir } from "../bookkeeping/roots.js";
import { isRateLimitedResult } from "../session/rate-limit.js";
import { type ClaudeRun, spawnClaude } from "./claude-run.js";
import { evaluatorPermissionArgs } from "./permissions.js";
import { extractScorecardJson } from "./scorecard-extractor.js";
import type { EvalWaitingEntry } from "./types.js";

/** The second ask, sent in the session whose first answer had no scorecard. */
export const SCORECARD_ONLY_PROMPT =
	"Your last answer had no scorecard. Reply with the scorecard JSON only, for the commit you just evaluated: one JSON object, no commentary before or after it.";

/** Words of a refusal that is the account's limit, not the API's momentary load. */
const LIMIT_WORDS = /limiting requests|hit your [\w ]*limit|weekly limit|usage limit reached/i;
/** A limit that a minute's wait will not lift (the weekly one). */
const LONG_LIMIT_WORDS = /hit your [\w ]*limit|weekly limit/i;

function parseJson(stdout: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(stdout);
		return typeof parsed === "object" && parsed !== null ? parsed : null;
	} catch {
		return null;
	}
}

/** The model's answer text: `result` of the CLI's JSON, or the raw output. */
export function answerText(stdout: string): string {
	const json = parseJson(stdout);
	const text = json?.result ?? json?.text ?? json?.content;
	return typeof text === "string" ? text : stdout;
}

export function sessionIdOf(stdout: string): string | undefined {
	const id = parseJson(stdout)?.session_id;
	return typeof id === "string" && id !== "" ? id : undefined;
}

/** Whether the answer holds a scorecard object anywhere in it. */
export function hasScorecard(stdout: string): boolean {
	return extractScorecardJson(answerText(stdout)) !== null;
}

/**
 * Whether a run failed because the model refused it for a limit: the API's
 * `429` (rate limiting, or the account's weekly limit), or the words of one on
 * a failed run. A run that succeeded is never a refusal, whatever it says.
 */
export function isLimitRefusal(run: { code: number | null; stdout: string }): boolean {
	const json = parseJson(run.stdout);
	const failed = run.code !== 0 || json?.is_error === true;
	if (!failed) return false;
	if (json && isRateLimitedResult(json)) return true;
	return LIMIT_WORDS.test(answerText(run.stdout));
}

/** A refusal that waiting seconds will not lift: do not retry it in this run. */
export function isLongLimit(run: { stdout: string }): boolean {
	return LONG_LIMIT_WORDS.test(answerText(run.stdout));
}

/** The args that resume the evaluator's session with one more message. */
export function resumeArgs(sessionId: string): string[] {
	return [
		"--print",
		"--output-format",
		"json",
		"--resume",
		sessionId,
		"--mcp-config",
		".mcp.json",
		...evaluatorPermissionArgs(),
	];
}

/**
 * Ask once more, in the same session, for the scorecard alone. Returns the
 * second run, or null when the first gave no session to ask in.
 */
export async function askForScorecard(
	first: ClaudeRun,
	fallbackSessionId: string | undefined,
	cwd: string,
): Promise<ClaudeRun | null> {
	const sessionId = sessionIdOf(first.stdout) ?? fallbackSessionId;
	if (!sessionId) return null;
	return spawnClaude(resumeArgs(sessionId), SCORECARD_ONLY_PROMPT, cwd);
}

/** The reason a run with no scorecard fails: the answer it gave, on one line. */
export function noScorecardReason(stdout: string): string {
	const answer = answerText(stdout).replace(/\s+/g, " ").trim().slice(0, 300);
	return `the evaluator answered without a scorecard: ${answer || "(empty answer)"}`;
}

export interface WaitingCommit {
	projectRoot: string;
	gitRoot?: string;
	changeId: string;
	mode: "eval" | "baseline";
}

function readJsonl(path: string): Record<string, unknown>[] {
	if (!existsSync(path)) return [];
	return readFileSync(path, "utf8")
		.split("\n")
		.filter((l) => l.trim())
		.flatMap((l) => {
			try {
				return [JSON.parse(l) as Record<string, unknown>];
			} catch {
				// a partial line from a crashed writer — the results.log precedent
				return [];
			}
		});
}

/**
 * Leave a commit waiting. It is queued in `pending.jsonl` (once), marked
 * `waiting`, and taken out of the drained ledger: the commit hook writes that
 * ledger before it spawns a retry, so without this a commit refused during a
 * retry would look done and never be tried again. Returns the entry for the
 * eval log.
 */
export function leaveWaiting(commit: WaitingCommit, run: ClaudeRun): EvalWaitingEntry {
	const dir = evalDir(commit.projectRoot);
	mkdirSync(dir, { recursive: true });

	const queuePath = join(dir, "pending.jsonl");
	const alreadyWaiting = readJsonl(queuePath).some(
		(r) => r.sha === commit.changeId && r.waiting === true,
	);
	if (!alreadyWaiting) {
		const record = {
			sha: commit.changeId,
			source: process.env.INDUSK_EVAL_SOURCE ?? "commit",
			waiting: true,
			timestamp: new Date().toISOString(),
			...(commit.gitRoot ? { repo: commit.gitRoot } : {}),
		};
		appendFileSync(queuePath, `${JSON.stringify(record)}\n`, "utf8");
	}

	const drainedPath = join(dir, "pending-drained.jsonl");
	const drained = readJsonl(drainedPath);
	if (drained.some((r) => r.sha === commit.changeId)) {
		const kept = drained.filter((r) => r.sha !== commit.changeId);
		writeFileSync(
			drainedPath,
			kept.map((r) => JSON.stringify(r)).join("\n") + (kept.length ? "\n" : ""),
			"utf8",
		);
	}

	return {
		version: 1,
		timestamp: new Date().toISOString(),
		mode: commit.mode,
		changeId: commit.changeId,
		waiting: true,
		message: `the model refused for a limit; the commit waits for a later trigger: ${answerText(run.stdout).replace(/\s+/g, " ").trim().slice(0, 300)}`,
	};
}
