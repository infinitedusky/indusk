import type { TierStep } from "../models/tier-names.js";
import type { tierForPhase } from "../models/tiers.js";

/** STUB (plan-review-subagent A14, authored RED): answers no model for every step. */
export async function buildStepModel(
	_checkout: string,
	_plan: string,
	_step: TierStep,
	_phase?: string,
): Promise<ReturnType<typeof tierForPhase>> {
	return null;
}
