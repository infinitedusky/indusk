import { markPlanningStop } from "../audit/review-signal.js";
import {
	nextPlanningStep,
	type PlanningDecision,
	type PlanningState,
} from "./next-planning-step.js";
import type { StepOutcome } from "./next-step.js";
import { PLANNING_STEPS, type PlanningStep } from "./step-env.js";

/**
 * An unattended planning run (a-brief-is-planned-unasked, ADR decision 4),
 * mirroring `runBuild`: read the plan, ask `nextPlanningStep`, run that step as
 * a fresh session, repeat. It ends when the impl passes its check (waiting for
 * the person's approval), when a look is not yet approved, or when it cannot
 * continue: a blocker, a failed session, two steps without progress. It never
 * approves and never builds; approval is the person's, and the admin starts the
 * build from it.
 *
 * Everything that touches the world is a dependency, so the decisions here are
 * tested with fakes; the real wiring is `build-session.ts`.
 *
 * promise: an-accepted-brief-is-planned-unasked
 */

export interface PlanningRunnerDeps {
	read: () => Promise<PlanningState>;
	/** Run one step's session to its end; `error` when it failed after its retries. */
	run: (step: PlanningStep) => Promise<{ error: string | null }>;
	onStep?: (step: PlanningStep) => void;
	/** Where the run reports reaching approval (the plan review's clauses); absent, it reports nothing. */
	signals?: { root: string; plan: string };
}

/** Every answer that is not a document to write ends the run. */
export type PlanningStop = Exclude<PlanningDecision, { step: PlanningStep }>;

function isWrite(d: PlanningDecision): d is { step: PlanningStep } {
	return (PLANNING_STEPS as readonly string[]).includes(d.step);
}

export async function runPlanning(deps: PlanningRunnerDeps): Promise<PlanningStop> {
	let last: StepOutcome | undefined;
	let previous: StepOutcome | undefined;
	let reviewed: boolean | undefined;
	for (;;) {
		const before = await deps.read();
		// A review that stood complete when the run began was read cold before it.
		reviewed ??= before.review.complete;
		const next = nextPlanningStep(before, { last, previous });
		if (!isWrite(next)) {
			if (next.step === "ready-for-approval" && deps.signals) {
				await markPlanningStop(deps.signals.root, deps.signals.plan, {
					reviewed,
					reviewComplete: before.review.complete,
				});
			}
			return next;
		}
		if (next.step === "plan-review") reviewed = true;
		deps.onStep?.(next.step);
		const { error } = await deps.run(next.step);
		const after = await deps.read();
		previous = last;
		last = { progressed: fingerprint(after) !== fingerprint(before), error };
	}
}

/** What changing counts as progress: a document appearing or passing, the impl's status, a blocker. */
function fingerprint(state: PlanningState): string {
	return JSON.stringify([
		state.documents,
		state.implStatus,
		state.contractOk,
		state.unapprovedLooks,
		state.blocker,
		state.review,
	]);
}
