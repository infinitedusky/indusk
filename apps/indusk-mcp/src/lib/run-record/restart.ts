import type { PlanningDecision } from "../build/next-planning-step.js";
import type { BuildStep } from "../build/next-step.js";
import type { RunKind } from "./record.js";

/**
 * Where Build starts a run that died (a-run-can-be-trusted, Decision 5): asked
 * of the plan's own documents, never of the record, whose step and phase are
 * history. The decisions themselves stay `nextBuildStep` and
 * `nextPlanningStep`; this only chooses which of them to ask.
 *
 * promise: nothing-ships-until-accepted
 * clause: a-run-is-read-from-its-record/dead-reads-stopped
 */

export type Restart =
	| { run: "planning"; decision: PlanningDecision }
	| { run: "build"; step: BuildStep }
	| { run: "release" };

export interface RestartReads {
	/** The impl's `status:`, or null when there is no impl. */
	implStatus: string | null;
	/** The plan was accepted (`accepted:` in the impl). */
	accepted: boolean;
	build: () => BuildStep;
	planning: () => PlanningDecision;
}

const PAST_PLANNING = ["approved", "in-progress", "completed"];

/**
 * A plan whose impl is not yet approved is still being planned, whatever kind of run
 * died: never a build step before approval, never the release. A release restarts only
 * for a plan that was accepted; a build never answers the release.
 */
export function restartStep(dead: RunKind, reads: RestartReads): Restart {
	if (reads.implStatus === null || !PAST_PLANNING.includes(reads.implStatus)) {
		return { run: "planning", decision: reads.planning() };
	}
	if (dead === "release" && reads.accepted) return { run: "release" };
	return { run: "build", step: reads.build() };
}
