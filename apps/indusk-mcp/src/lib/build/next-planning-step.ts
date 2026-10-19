import type { DocumentPosition } from "../lifecycle.js";
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
 */

export interface PlanningDocument {
	exists: boolean;
	ok: boolean;
	/** What the document's check said when it refused it, to carry into the run's stop. */
	refusal?: string;
}

export interface PlanningState {
	required: readonly DocumentPosition[];
	documents: Record<"test-plan" | "adr" | "impl", PlanningDocument>;
	implStatus: string | null;
	contractOk: boolean;
	unapprovedLooks: readonly string[];
	blocker: string | null;
}

export type PlanningDecision =
	| { step: PlanningStep }
	| { step: "wait-for-looks"; looks: readonly string[] }
	| { step: "ready-for-approval" }
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
	return { step: "ready-for-approval" };
}
