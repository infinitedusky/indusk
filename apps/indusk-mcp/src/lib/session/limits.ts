import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type QuestionWait, readQuestionWait } from "../questions/deadline.js";
import { induskHome } from "../version-check.js";

/** How many sessions a machine runs together when its config says nothing. */
export const DEFAULT_SESSIONS_MAX = 4;

/**
 * The machine's cap on running sessions (sessions-per-plan, ADR decision 2):
 * `sessions.max` from the InDusk home's `config.json`, a positive integer.
 * The daemon serves every project, so the cap belongs to the machine, not to
 * a project's config. An absent or malformed file reads as the default —
 * a bad config never takes the daemon down.
 *
 * promise: sessions-are-capped
 */
export function readSessionsMax(home: string = induskHome()): number {
	const path = join(home, "config.json");
	if (!existsSync(path)) return DEFAULT_SESSIONS_MAX;
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as { sessions?: { max?: unknown } };
		const max = parsed?.sessions?.max;
		return typeof max === "number" && Number.isInteger(max) && max > 0 ? max : DEFAULT_SESSIONS_MAX;
	} catch {
		return DEFAULT_SESSIONS_MAX;
	}
}

/**
 * What an unanswered question does, per cost (decisions-as-questions, ADR decision
 * 4): `sessions.question_wait.cheap|moderate|expensive` from the InDusk home's
 * `config.json` — `hold`, a whole number of minutes, or `immediate`. Absent reads
 * as `hold` for every cost. A value that is none of these throws, naming the key;
 * the caller decides what a bad setting does (the sweep holds everything).
 */
export function readQuestionWaitSetting(home: string = induskHome()): QuestionWait {
	const path = join(home, "config.json");
	if (!existsSync(path)) return readQuestionWait({});
	let parsed: { sessions?: { question_wait?: unknown } };
	try {
		parsed = JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return readQuestionWait({});
	}
	return readQuestionWait(parsed?.sessions?.question_wait);
}
