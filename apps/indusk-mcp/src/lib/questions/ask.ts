import { effectiveCost } from "./cost.js";
import { dueAt, type QuestionWait } from "./deadline.js";
import {
	CHANGES,
	type Change,
	type Cost,
	type Question,
	type QuestionOption,
	validateQuestion,
} from "./record.js";

/**
 * What an unattended session's `ask_decision` request becomes (ADR decisions 1, 2,
 * 3 and 5): a malformed one is refused to the session, saying what is missing; a
 * well-formed one becomes a record whose cost the admin fixed and whose deadline is
 * stored from its cost's setting. The outcome says what the caller does with the
 * session: tell it to go on (`go-ahead`, the setting is `immediate`), end it and
 * free its slot (`hold`), or leave it waiting for the stored time (`timed`).
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 * clause: the-cost-sets-the-wait/a-hold-frees-the-slot
 */
export type AskOutcome =
	| { kind: "refused"; message: string }
	| { kind: "go-ahead"; question: Question }
	| { kind: "hold"; question: Question }
	| { kind: "timed"; question: Question };

export interface AskContext {
	plan: string;
	/** The id the record is given: the next free one in the plan's history. */
	id: string;
	now: number;
	wait: QuestionWait;
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function optionsOf(raw: unknown): { options: QuestionOption[]; bad: boolean } {
	const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
	let bad = false;
	const options = list.map((o) => {
		const declared = Array.isArray(o?.changes) ? (o.changes as unknown[]) : [];
		const changes = declared.filter((c): c is Change =>
			(CHANGES as readonly unknown[]).includes(c),
		);
		if (changes.length !== declared.length) bad = true;
		return { label: text(o?.label), changes };
	});
	return { options, bad };
}

export function askDecision(input: unknown, ctx: AskContext): AskOutcome {
	const raw = (input ?? {}) as Record<string, unknown>;
	const { options, bad } = optionsOf(raw.options);
	const asked = {
		options,
		recommended: text(raw.recommended),
		reason: text(raw.reason),
		cost: raw.cost,
		askedAt: ctx.now,
	};
	const check = validateQuestion(asked);
	const missing = bad ? [...check.missing, "options.changes"] : check.missing;
	if (!text(raw.question)) missing.push("question");
	if (missing.length > 0) {
		return {
			kind: "refused",
			message: `This question was not asked: ${[...new Set(missing)].join(", ")} missing or malformed. A decision needs the question, at least two options (each \`changes\` listing only brief, promise, look or gate), the label of the option you recommend, your reason, and a cost of cheap, moderate or expensive. Ask it again complete.`,
		};
	}
	const stated = asked.cost as Cost;
	const base = { ...asked, cost: stated };
	const cost = effectiveCost(base);
	const due = dueAt({ ...base, cost }, ctx.wait);
	const question: Question = {
		...base,
		id: ctx.id,
		plan: ctx.plan,
		text: text(raw.question),
		statedCost: stated,
		cost,
		dueAt: due,
		state: "waiting",
	};
	if (due === null) return { kind: "hold", question };
	if (due <= ctx.now) {
		return {
			kind: "go-ahead",
			question: {
				...question,
				state: "went-ahead",
				done: question.recommended,
				wentAheadAt: ctx.now,
			},
		};
	}
	return { kind: "timed", question };
}
