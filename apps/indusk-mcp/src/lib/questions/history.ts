import { appendHistoryLine, readHistoryLines } from "../plans/history.js";
import type { Question } from "./record.js";

/**
 * Every question stays in the plan's history in all four states (ADR decision 9),
 * written through the history's one writer (`plans/history.ts`), so a question and
 * the answers beside it share a lock, a commit path and a file that survives
 * landing and archiving. A question's line carries the whole record as JSON; the
 * latest line for an id is its current state.
 *
 *   - <at> — question <id> <state> — <record JSON>
 *
 * The person's answer is also a decision line (`appendDecision`), written by the one
 * place that delivers an answer (the admin's decision route), so it is never written twice.
 *
 * clause: a-late-answer-opens-a-follow-on/every-decision-stays
 */
const LINE = /^- (\S+) — question (\S+) (waiting|answered|went-ahead|answered-late) — (\{.*\})$/;

/** Record `q` in its current state. */
export function recordQuestion(anyCheckout: string, q: Question, at = new Date()): void {
	const line = `- ${at.toISOString()} — question ${q.id} ${q.state} — ${JSON.stringify(q)}`;
	appendHistoryLine(anyCheckout, q.plan, line, `question ${q.id} ${q.state}`);
}

/** Every question of `plan`, each in the state last recorded, oldest first. */
export function readQuestions(anyCheckout: string, plan: string): Question[] {
	const latest = new Map<string, Question>();
	for (const line of readHistoryLines(anyCheckout, plan)) {
		const m = LINE.exec(line);
		if (!m) continue;
		try {
			const q = JSON.parse(m[4] ?? "") as Question;
			latest.set(q.id, q);
		} catch {
			// A line that does not parse is not a question; the file is never edited by hand.
		}
	}
	return [...latest.values()];
}

/** The next free question id for `plan`: `q-1`, `q-2`, … */
export function nextQuestionId(anyCheckout: string, plan: string): string {
	const n = readQuestions(anyCheckout, plan).reduce(
		(max, q) => Math.max(max, Number(/^q-(\d+)$/.exec(q.id)?.[1] ?? 0)),
		0,
	);
	return `q-${n + 1}`;
}
