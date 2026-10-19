import type { Amendment, Dismissal } from "../audit/answers.js";
import type { DocumentPosition } from "../lifecycle.js";
import type { Amendment as BriefChange } from "../plans/amendments.js";
import type { StepOutcome } from "./next-step.js";
import type { PlanningStep } from "./step-env.js";

/**
 * What an unattended planning run does next (a-brief-is-planned-unasked, ADR
 * decision 2): the document to write, or why the run waits or ends.
 *
 * A pure decision over the plan as it stands and the outcome of the steps just
 * run, beside `nextBuildStep`. The runner asks it after every step. A document
 * that exists but fails its check is the same step again; the impl counts as
 * ready only when the plan's contract check also passes.
 *
 * promise: an-accepted-brief-is-planned-unasked
 * clause: a-plan-is-read-cold-before-approval/the-planning-run-reads-it-cold
 */

export interface PlanningDocument {
	exists: boolean;
	ok: boolean;
	/** What the document's check said when it refused it, to carry into the run's stop. */
	refusal?: string;
}

/** The plan review (`plan-review.md`) as the planning run reads it. */
export interface PlanningReview {
	exists: boolean;
	/** Every question put, every finding answered: nothing left for the planning agent to do. */
	complete: boolean;
	dismissals: readonly Dismissal[];
	amendments: readonly Amendment[];
	/** The review was written about other documents than stand now: it is read again. */
	stale?: boolean;
	/** What the brief says now that it did not say when it was accepted; absent or empty when nothing changed. */
	briefChanges?: readonly BriefChange[];
}

export interface PlanningState {
	required: readonly DocumentPosition[];
	documents: Record<"test-plan" | "adr" | "impl", PlanningDocument>;
	implStatus: string | null;
	contractOk: boolean;
	unapprovedLooks: readonly string[];
	blocker: string | null;
	review: PlanningReview;
}

export type PlanningDecision =
	| { step: PlanningStep }
	| { step: "wait-for-looks"; looks: readonly string[] }
	| {
			step: "ready-for-approval";
			/** What the plan review's answers waved away, for the person who approves; absent when none. */
			dismissals?: readonly Dismissal[];
			/** The plan review's answers that changed the brief, absent when none. */
			amendments?: readonly Amendment[];
			/** What the brief says now that it did not say when accepted, whatever the review called it; absent when none. */
			briefChanges?: readonly BriefChange[];
	  }
	| { step: "cannot-continue"; why: string };

/** The documents a planning run writes, in the order it writes them. */
const WRITTEN: Array<{ doc: "test-plan" | "adr" | "impl"; step: PlanningStep }> = [
	{ doc: "test-plan", step: "plan-test-plan" },
	{ doc: "adr", step: "plan-adr" },
	{ doc: "impl", step: "plan-impl" },
];

export function nextPlanningStep(
	state: PlanningState,
	outcomes: { last?: StepOutcome; previous?: StepOutcome } = {},
): PlanningDecision {
	const { last, previous } = outcomes;
	if (last?.error)
		return { step: "cannot-continue", why: `the last step's session failed: ${last.error}` };
	if (state.blocker) return { step: "cannot-continue", why: `a blocker: ${state.blocker}` };
	if (last && previous && !last.progressed && !previous.progressed) {
		const refusal = state.documents.impl.refusal;
		return {
			step: "cannot-continue",
			why: `two steps in a row made no progress${refusal ? `; the impl check said: ${refusal}` : ""}`,
		};
	}
	if (state.implStatus !== null && state.implStatus !== "draft") {
		return {
			step: "cannot-continue",
			why: `the impl is ${state.implStatus}, past planning: nothing is written`,
		};
	}
	if (state.unapprovedLooks.length > 0) {
		return { step: "wait-for-looks", looks: state.unapprovedLooks };
	}
	for (const { doc, step } of WRITTEN) {
		if (!state.required.includes(doc)) continue;
		const found = state.documents[doc];
		if (!found.exists || !found.ok) return { step };
	}
	// Every document stands and passes its own check; the plan's contract joins them.
	if (!state.contractOk) return { step: "plan-impl" };
	// A plan is read cold before it is presented: the review is the run's last step, and stays
	// next while it is missing, incomplete or unanswered.
	// A review written about other documents than stand now was not a read of this plan.
	if (!state.review.complete || state.review.stale) return { step: "plan-review" };
	const { dismissals, amendments, briefChanges } = state.review;
	return {
		step: "ready-for-approval",
		...(dismissals.length > 0 ? { dismissals } : {}),
		...(amendments.length > 0 ? { amendments } : {}),
		...(briefChanges && briefChanges.length > 0 ? { briefChanges } : {}),
	};
}
