import type { Cost, QuestionInput } from "./record.js";

/**
 * The cost the admin fixes (ADR decision 3), never the agent: an option that
 * declares it changes the brief, a promise or a look, or skips a gate makes the
 * question expensive; options declaring nothing keep the stated cost. Raised,
 * never lowered.
 *
 * clause: what-was-agreed-is-never-cheap/never-timed-out
 */
type Costed = Pick<QuestionInput, "options" | "cost">;

/** Whether any option of the question changes what was agreed. */
export function changesAgreed(q: Pick<QuestionInput, "options">): boolean {
	return q.options.some((o) => o.changes.length > 0);
}

export function effectiveCost(q: Costed): Cost {
	return changesAgreed(q) ? "expensive" : q.cost;
}
