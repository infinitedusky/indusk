import type { PlanningDecision, PlanningState } from "./next-planning-step.js";
import type { PlanningStep } from "./step-env.js";

/** Stub: built in the item that follows its tests. */

export interface PlanningRunnerDeps {
	read: () => Promise<PlanningState>;
	run: (step: PlanningStep) => Promise<{ error: string | null }>;
	onStep?: (step: PlanningStep) => void;
}

export type PlanningStop = Exclude<PlanningDecision, { step: PlanningStep }>;

export async function runPlanning(_deps: PlanningRunnerDeps): Promise<PlanningStop> {
	throw new Error("not built");
}
