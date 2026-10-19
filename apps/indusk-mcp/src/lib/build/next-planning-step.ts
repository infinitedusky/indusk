import type { DocumentPosition } from "../lifecycle.js";
import type { StepOutcome } from "./next-step.js";
import type { PlanningStep } from "./step-env.js";

/** Stub: built in the item that follows its tests. */

export interface PlanningDocument {
	exists: boolean;
	ok: boolean;
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

export function nextPlanningStep(
	_state: PlanningState,
	_outcomes: { last?: StepOutcome; previous?: StepOutcome } = {},
): PlanningDecision {
	throw new Error("not built");
}
