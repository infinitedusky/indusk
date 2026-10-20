import { askDecision } from "../questions/ask.js";
import type { QuestionWait } from "../questions/deadline.js";
import type { Question } from "../questions/record.js";
import type { QuestionEvent } from "../session/protocol.js";

/**
 * What an unattended session's `ask_decision` request gets back (decisions-as-
 * questions, ADR decisions 2, 5 and 6), as a pure function of the request and the
 * question store's reads. The caller records the question and sends the reply.
 *
 *   - refused: the session is told what is missing and asks again;
 *   - go-ahead (the cost's setting is `immediate`): the session is answered at once
 *     with its own recommendation and goes on;
 *   - hold: the session is told the question waits for the person and ends; the run
 *     stops and frees its place; it resumes with the answer;
 *   - timed: no reply yet. The request stays open, the session keeps its place, and
 *     the sweep or the person's answer settles it.
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: the-cost-sets-the-wait/a-hold-frees-the-slot
 */
export type DecisionReply =
	| { to: "refuse"; message: string }
	| { to: "answer"; answers: Record<string, string>; question: Question }
	| { to: "hold"; message: string; question: Question }
	| { to: "wait"; question: Question };

export interface DecisionStore {
	nextId(): string;
	wait(): QuestionWait;
	now(): number;
}

export function holdMessage(q: Question): string {
	return `Question ${q.id} was recorded for the person and waits for their answer. This session ends here and starts again with the answer; do no more work on this choice. Stop now.`;
}

export function receiveDecision(
	ev: QuestionEvent,
	plan: string,
	store: DecisionStore,
): DecisionReply {
	const outcome = askDecision(ev.input, {
		plan,
		id: store.nextId(),
		now: store.now(),
		wait: store.wait(),
	});
	switch (outcome.kind) {
		case "refused":
			return { to: "refuse", message: outcome.message };
		case "go-ahead":
			return {
				to: "answer",
				answers: { [outcome.question.text]: outcome.question.recommended },
				question: outcome.question,
			};
		case "hold":
			return { to: "hold", message: holdMessage(outcome.question), question: outcome.question };
		case "timed":
			return { to: "wait", question: outcome.question };
	}
}
