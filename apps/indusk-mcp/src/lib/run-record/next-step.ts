import { openConfirmations, type Situation } from "./situation.js";

/**
 * Every plan that is not closed shows what happens next and who takes it
 * (a-run-can-be-trusted, `always-a-next-step`): what the system is doing now, or what
 * it waits on and whether the person or an event completes it. A plan that reads
 * stuck is one whose next step is not written down; this never answers nothing for
 * an open plan.
 *
 * clause: a-run-is-read-from-its-record/always-a-next-step
 */

export interface NextStep {
	text: string;
	/** `system` is doing it now, `person` takes it, `event` completes it when it happens. */
	by: "system" | "person" | "event";
}

/** `null` only for a closed plan. */
export function nextStepFor(s: Situation): NextStep | null {
	switch (s.kind) {
		case "closed":
			return null;
		case "planning":
			return { text: "the system is writing the plan; it stops for your approval", by: "system" };
		case "building":
			return { text: "the system is building it; it stops at review", by: "system" };
		case "releasing":
			return { text: "the system is landing it on main", by: "system" };
		case "waiting":
			return {
				text:
					s.waitingOn === "plan-review"
						? "ask the plan's agent to write its plan review, then approve it"
						: s.waitingOn === "review"
							? "review the build and accept it, which runs the release"
							: s.waitingOn === "approval"
								? "approve the plan so its build can start"
								: s.waitingOn === "amendment"
									? "re-approve the brief so the build can go on"
									: "answer the question the agent asked",
				by: "person",
			};
		case "stopped":
			return {
				text:
					s.stoppedKind === "release"
						? "press Build to start the release again"
						: "press Build to start it again from where the plan stands",
				by: "person",
			};
		case "complete": {
			// A list nobody read, or one that could not be read, is never "everything confirmed" (A92).
			if (s.confirmationNote !== undefined) return { text: s.confirmationNote, by: "person" };
			const open = openConfirmations(s.confirmations);
			return open.length > 0
				? {
						text: `it closes when each clause signal reports from a real run and each live check is confirmed (${open.length} left)`,
						by: "event",
					}
				: { text: "everything is confirmed; the retrospective closes it", by: "person" };
		}
		case "idle":
			return {
				text: s.stepName
					? `start ${s.stepName} from the plan's page`
					: "run the retrospective to close it",
				by: "person",
			};
	}
}
