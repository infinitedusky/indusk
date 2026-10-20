import type { RunnerStop } from "../build/runner.js";
import { PROCESS_GONE } from "./liveness.js";

/**
 * The words for how a run stopped, in one place beside the phase the plan is on
 * (a-run-can-be-trusted). A stopped run keeps naming the plan's real phase, read
 * from the plan (`shownPhase`), and says what starts it again: the existing Build
 * button. A run whose process is gone says it died rather than disappearing.
 *
 * clause: a-run-is-read-from-its-record/shows-where-it-is
 */

const at = (phase: string | null): string => (phase ? ` at ${phase}` : "");

export function stopSentence(stop: RunnerStop, phase: string | null): string {
	switch (stop.step) {
		case "review":
			return "Built. It waits for your review.";
		case "amendment":
			return `Stopped${phase ? ` at ${phase}` : ""}: the brief changed after you approved it (${stop.amendments.join(", ")}). It waits for your re-approval.`;
		case "judgement":
			return `Stopped${phase ? ` at ${phase}` : ""} for a judgement the plan declared — ${stop.item}`;
		case "question":
			return `Stopped${phase ? ` at ${phase}` : ""}: it asked a question (${stop.id}) and waits for your answer, holding no place. Your answer starts it again.`;
		case "cannot-continue":
			if (stop.why === PROCESS_GONE) {
				return `Stopped: the run died (${PROCESS_GONE}). Build starts it again${at(phase)}.`;
			}
			return `Stopped${phase ? ` at ${phase}` : ""}: ${stop.why}. Build starts it again once that is fixed.`;
		case "released":
			return "Built, accepted by its workflow, and released.";
		case "release-failed":
			return `Built and accepted by its workflow; the release stopped: ${stop.why}`;
	}
}
