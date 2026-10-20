import { changesAgreed, effectiveCost } from "./cost.js";
import { COSTS, type Cost, type QuestionInput } from "./record.js";

/**
 * What an unanswered question does (ADR decisions 4 and 5): one setting per cost,
 * `sessions.question_wait.<cost>` — `hold` (the default), a whole number of
 * minutes, or `immediate`. The deadline is a stored wall-clock time taken from the
 * setting when the question is asked, so a restart never gives more time and a
 * down admin makes a question go ahead late, never early. A question that changes
 * what was agreed holds whatever the settings say.
 *
 * clause: the-cost-sets-the-wait/holds-by-default
 * clause: the-cost-sets-the-wait/the-setting-decides
 * clause: what-was-agreed-is-never-cheap/never-timed-out
 */
export type Wait = "hold" | "immediate" | { minutes: number };
export type QuestionWait = Record<Cost, Wait>;

const MINUTE = 60_000;

/** Normalise the three settings, `hold` where one is absent; throws naming the key on any other value. */
export function readQuestionWait(raw: unknown): QuestionWait {
	const given = (raw ?? {}) as Record<string, unknown>;
	const out = {} as QuestionWait;
	for (const cost of COSTS) {
		const v = given[cost];
		const key = `sessions.question_wait.${cost}`;
		if (v === undefined || v === "hold") out[cost] = "hold";
		else if (v === "immediate") out[cost] = "immediate";
		else if (typeof v === "number" && Number.isInteger(v) && v > 0) out[cost] = { minutes: v };
		else
			throw new Error(
				`${key} is ${JSON.stringify(v)}; use "hold", a whole number of minutes, or "immediate"`,
			);
	}
	return out;
}

type Timed = Pick<QuestionInput, "options" | "cost" | "askedAt"> & { dueAt?: number | null };

/** The time a question is due, from its cost's setting: `null` when it holds. */
export function dueAt(q: Timed, wait: QuestionWait): number | null {
	if (changesAgreed(q)) return null;
	const w = wait[effectiveCost(q)];
	if (w === "hold") return null;
	if (w === "immediate") return q.askedAt;
	return q.askedAt + w.minutes * MINUTE;
}

/**
 * Whether the question's time has come. A stored `dueAt` (null included) is the
 * deadline set when it was asked; a question with none stored reads it from the
 * settings. What was agreed is never due.
 */
export function isDue(q: Timed, now: number, wait: QuestionWait): boolean {
	if (changesAgreed(q)) return false;
	const due = q.dueAt !== undefined ? q.dueAt : dueAt(q, wait);
	return due !== null && now >= due;
}
