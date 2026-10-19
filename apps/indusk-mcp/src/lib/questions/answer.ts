import { differs, openFollowOnOnTrunk } from "./follow-on.js";
import { readQuestions, recordQuestion } from "./history.js";
import { isAnswer, type Question } from "./record.js";

/**
 * The person's answer applied to a question's record (ADR decisions 7, 8 and 9).
 * An empty reply is not an answer. A question still waiting becomes `answered`;
 * one that already went ahead becomes `answered-late`, keeping what was done, so
 * the follow-on rule (Build Phase 3) can compare the answer with it.
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: a-late-answer-opens-a-follow-on/every-decision-stays
 */
export function applyAnswer(q: Question, answer: string, now: number): Question {
	if (!isAnswer(answer)) throw new Error("a reply needs words: an empty reply is not an answer");
	if (q.state === "answered" || q.state === "answered-late") {
		throw new Error(`question ${q.id} was already answered`);
	}
	const { session: _live, ...rest } = q;
	return {
		...rest,
		answer: answer.trim(),
		answeredAt: now,
		state: q.state === "went-ahead" ? "answered-late" : "answered",
	};
}

/** The answers still to tell the agent: answered while the session was stopped, and not yet told. */
export function untold(questions: readonly Question[]): Question[] {
	return questions.filter((q) => q.state === "answered" && q.answer !== undefined && !q.told);
}

/** The words a resumed session starts from: each answer under the question it was given to. */
export function answersNote(questions: readonly Question[]): string {
	if (questions.length === 0) return "";
	const lines = questions.map((q) => `- ${q.id}, "${q.text}" — the person answered: ${q.answer}`);
	return `\n\nQuestions you asked earlier have been answered. Use these answers, and do not ask them again:\n${lines.join("\n")}\n`;
}

/**
 * Apply the person's answer to question `id` of `plan` and keep it in the history.
 * A late answer (the question already went ahead) that differs from what was done
 * also opens the plan's one draft follow-on, linked from the record (ADR decision 8).
 * Throws on an empty reply, an unknown question, or one already answered.
 */
export function answerQuestionRecord(
	anyCheckout: string,
	plan: string,
	id: string,
	text: string,
	now = Date.now(),
): Question {
	const q = readQuestions(anyCheckout, plan).find((x) => x.id === id);
	if (!q) throw new Error(`${plan} has no question ${id}`);
	let next = applyAnswer(q, text, now);
	if (next.state === "answered-late" && differs(next, text)) {
		const follow = openFollowOnOnTrunk(anyCheckout, next, text);
		if (follow.plan) next = { ...next, followOn: follow.plan };
	}
	recordQuestion(anyCheckout, next);
	return next;
}
