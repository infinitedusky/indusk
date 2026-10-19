/**
 * The question record (decisions-as-questions, ADR decisions 1 and 2): what an
 * unattended session asks when it meets a choice the plan does not settle, and
 * the one check that refuses a question with nothing to accept. `lib/questions/`
 * is the one home of the question rules: the cost is fixed in `cost.ts`, what an
 * unanswered question does in `deadline.ts`, what happens to it in `sweep.ts`.
 *
 * clause: a-decision-is-a-question/asked-with-a-recommendation
 */

export const COSTS = ["cheap", "moderate", "expensive"] as const;
export type Cost = (typeof COSTS)[number];

/** What an option says it changes; any of these is a change to what was agreed. */
export const CHANGES = ["brief", "promise", "look", "gate"] as const;
export type Change = (typeof CHANGES)[number];

export type QuestionState = "waiting" | "answered" | "went-ahead" | "answered-late";

export interface QuestionOption {
	label: string;
	changes: Change[];
}

/** What a session hands in when it asks; the cost is the one it states. */
export interface QuestionInput {
	options: QuestionOption[];
	recommended: string;
	reason: string;
	cost: Cost;
	askedAt: number;
}

export interface Question extends QuestionInput {
	id: string;
	plan: string;
	/** The question in words, as the person reads it. */
	text: string;
	/** The cost the agent stated; `cost` is the effective one the admin fixed. */
	statedCost: Cost;
	/**
	 * The stored wall-clock deadline (ms), or `null` for a question that holds. Always stored
	 * when a question is asked; absent only in a record written by hand, which reads its time
	 * from the settings.
	 */
	dueAt?: number | null;
	state: QuestionState;
	answer?: string;
	/** When the answer was given (ms). */
	answeredAt?: number;
	/** What was done when the question went ahead: the option the session continued with. */
	done?: string;
	/** When it went ahead (ms). */
	wentAheadAt?: number;
	/** The session and request a question still waiting on a set time is held by, while the session lives. */
	session?: { id: string; requestId: string };
	/** The answer has been told to the agent (a held question's session was stopped, so it is told on resume). */
	told?: boolean;
	/** The follow-on plan a late disagreeing answer opened. */
	followOn?: string;
}

export interface Validation {
	ok: boolean;
	missing: string[];
}

const filled = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/** Whether the person's reply is an answer: an empty or blank reply is not. */
export function isAnswer(text: unknown): text is string {
	return filled(text);
}

/**
 * The fields a question lacks, by name: fewer than two options, a recommendation
 * that is not one of them, no reason, or a cost outside the three. A question
 * with something missing goes back to the session, never to the person.
 */
export function validateQuestion(input: Partial<Record<keyof QuestionInput, unknown>>): Validation {
	const missing: string[] = [];
	const options = Array.isArray(input.options) ? (input.options as { label?: unknown }[]) : [];
	const labels = options.map((o) => o?.label).filter(filled);
	if (labels.length < 2 || labels.length !== options.length) missing.push("options");
	if (!filled(input.recommended) || !labels.includes(input.recommended))
		missing.push("recommended");
	if (!filled(input.reason)) missing.push("reason");
	if (!(COSTS as readonly unknown[]).includes(input.cost)) missing.push("cost");
	return { ok: missing.length === 0, missing };
}
