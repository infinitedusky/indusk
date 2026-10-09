import { readBuildPlan } from "../build/read-plan.js";
import type { PhaseRef } from "../impl-headings.js";
import { phaseTier, readTierConfig, tierForPhase } from "./tiers.js";

/**
 * The tier and model a phase of a plan is built on, read from the plan's live
 * copy (its worktree while it has one) and the project's config. `null` when
 * the project names no tiers: the session's own model, as before.
 */
export async function phaseModel(
	checkout: string,
	plan: string,
	phase: PhaseRef,
): Promise<ReturnType<typeof tierForPhase>> {
	const { content } = await readBuildPlan(checkout, plan);
	return tierForPhase(readTierConfig(checkout), "work", phaseTier(content, phase));
}
