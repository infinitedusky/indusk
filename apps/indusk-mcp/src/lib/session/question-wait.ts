/**
 * Who holds a place under `sessions.max` while a question waits (decisions-as-
 * questions, ADR decision 6): a question that holds ends its session, so the plan
 * leaves the running set and a queued plan can take the place; a question on a set
 * time keeps its session, and its place. `runningCount` is the one count the cap
 * reads (`SessionManager.capRefusal`).
 *
 * clause: the-cost-sets-the-wait/a-hold-frees-the-slot
 * promise: sessions-are-capped
 */
export interface Slots {
	/** The plans (or sessions) holding a place. */
	running: string[];
	/** The plans waiting on a held question: no session, no place. */
	waiting: string[];
}

/** `plan` asked a question. When it holds it leaves the running set; on a set time it stays. */
export function waitOnQuestion(slots: Slots, plan: string, question: { holds: boolean }): Slots {
	if (!question.holds) return slots;
	return {
		running: slots.running.filter((p) => p !== plan),
		waiting: slots.waiting.includes(plan) ? slots.waiting : [...slots.waiting, plan],
	};
}

/** `plan`'s held question was answered: it is no longer waiting (it asks for a place when its run restarts). */
export function resumeFromQuestion(slots: Slots, plan: string): Slots {
	return { ...slots, waiting: slots.waiting.filter((p) => p !== plan) };
}

export const runningCount = (slots: Slots): number => slots.running.length;
