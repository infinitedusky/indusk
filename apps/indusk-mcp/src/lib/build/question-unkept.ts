/**
 * A question that cannot be written to the plan's history is not asked, and the session is
 * never told to decide the choice itself: it is told to stop, and the step ends as unable
 * to continue, naming the failure (clause never-decided-silently).
 *
 * clause: a-decision-is-a-question/never-decided-silently
 */
export interface UnkeptQuestion {
	/** What the session is told: stop, and decide nothing. */
	message: string;
	/** The step's error: why the run cannot continue. */
	error: string;
}

export function unkeptQuestion(id: string, failure: unknown): UnkeptQuestion {
	const why = failure instanceof Error ? failure.message : String(failure);
	return {
		message: `Question ${id} could not be recorded in the plan's history, so it was not asked. Stop now: do not decide this choice yourself and do no more work on it. The run ends here and the person is told why.`,
		error: `question ${id} could not be kept in the plan's history: ${why}`,
	};
}
