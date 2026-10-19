import { isDue, type QuestionWait, readQuestionWait } from "./deadline.js";
import { readQuestions, recordQuestion } from "./history.js";
import type { Question } from "./record.js";
import { reportClause } from "./signals.js";

/**
 * The sweep (ADR decisions 4 and 5): a question still waiting whose stored time has
 * come is sent on with its recommendation and marked `went-ahead`, with when and
 * what was done. A question that holds, or one that changes what was agreed, is
 * never touched however long it waits, and the sweep never approves anything: it
 * only picks the recommended option. `send` tells the session (best-effort: a
 * session gone, as after a restart, still leaves the record saying what the admin
 * did; the next step starts from the record).
 *
 * clause: the-cost-sets-the-wait/the-setting-decides
 * clause: the-cost-sets-the-wait/holds-by-default
 * clause: what-was-agreed-is-never-cheap/never-timed-out
 */
export function sweep(
	questions: readonly Question[],
	now: number,
	wait: QuestionWait,
	send: (q: Question, choice: string) => void,
): Question[] {
	return questions.map((q) => {
		if (q.state !== "waiting" || !isDue(q, now, wait)) return q;
		try {
			send(q, q.recommended);
		} catch {
			// The session may be gone; the record still says what was done.
		}
		return { ...q, state: "went-ahead", done: q.recommended, wentAheadAt: now };
	});
}

/**
 * The sweep over a plan's recorded questions: read them, send on the ones whose
 * time has come, and keep each as it now stands. Run on every admin read, so a
 * question left while the admin was down goes ahead on that read (late, never early).
 * `waitSetting` throws on a setting it refuses; the sweep then holds everything.
 */
export function sweepHistory(
	anyCheckout: string,
	plan: string,
	now: number,
	waitSetting: () => QuestionWait,
	send: (q: Question, choice: string) => void,
): Question[] {
	const before = readQuestions(anyCheckout, plan);
	if (!before.some((q) => q.state === "waiting")) return before;
	let wait: QuestionWait;
	try {
		wait = waitSetting();
	} catch {
		wait = readQuestionWait({});
	}
	const after = sweep(before, now, wait, send);
	after.forEach((q, i) => {
		if (q === before[i]) return;
		recordQuestion(anyCheckout, q);
		// A due question was sent ahead as its cost's setting said (clause the-setting-decides).
		void reportClause(anyCheckout, "the-setting-decides", { outcome: "upheld" });
	});
	return after;
}
