import { differs, openFollowOnOnTrunk } from "./follow-on.js";
import { readQuestions, recordQuestion } from "./history.js";
import { isAnswer, type Question } from "./record.js";
import { reportClause } from "./signals.js";

/**
 * The person's answer applied to a question's record (ADR decisions 7, 8 and 9).
 * An empty reply is not an answer. A question still waiting becomes `answered`;
 * one that already went ahead (or was answered late once) becomes `answered-late`, keeping what was done, so
 * the follow-on rule (Build Phase 3) can compare the answer with it.
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: a-late-answer-opens-a-follow-on/every-decision-stays
 */
export function applyAnswer(q: Question, answer: string, now: number): Question {
	if (!isAnswer(answer)) throw new Error("a reply needs words: an empty reply is not an answer");
	if (q.state === "answered") {
		throw new Error(`question ${q.id} was already answered`);
	}
	const { session: _live, ...rest } = q;
	return {
		...rest,
		answer: answer.trim(),
		answeredAt: now,
		state: q.state === "waiting" ? "answered" : "answered-late",
	};
}

/**
 * What the agent has still to be told: an answer given while the session was stopped, and
 * a go-ahead no session heard (`told: false`; one with no `told` was sent to a live session).
 */
export function untold(questions: readonly Question[]): Question[] {
	return questions.filter(
		(q) =>
			(q.state === "answered" && q.answer !== undefined && !q.told) ||
			(q.state === "went-ahead" && q.told === false),
	);
}

/** The words a resumed session starts from: each answer under the question it was given to. */
export function answersNote(questions: readonly Question[]): string {
	if (questions.length === 0) return "";
	const lines = questions.map((q) =>
		q.state === "went-ahead"
			? `- ${q.id}, "${q.text}" — went ahead with your recommendation: ${q.done}`
			: `- ${q.id}, "${q.text}" — the person answered: ${q.answer}`,
	);
	return `\n\nQuestions you asked earlier have been answered. Use these answers, and do not ask them again:\n${lines.join("\n")}\n`;
}

/**
 * Apply the person's answer to question `id` of `plan` and keep it in the history.
 * A late answer (the question already went ahead) that differs from what was done
 * also opens the plan's one draft follow-on, linked from the record (ADR decision 8).
 * A late answer may be given again; it rewrites the open follow-on (ADR decision 8).
 * Throws on an empty reply, an unknown question, or one already answered in time.
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
		void reportClause(
			anyCheckout,
			"disagreement-opens-a-plan",
			follow.plan
				? { outcome: "upheld" }
				: {
						outcome: "broken",
						symptom: `${plan}/${id} was answered late and differently, and no follow-on opened`,
					},
		);
	}
	recordQuestion(anyCheckout, next);
	return next;
}
