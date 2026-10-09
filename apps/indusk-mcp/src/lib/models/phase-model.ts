import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PhaseRef } from "../impl-headings.js";
import { livePlanCopy } from "../worktree/plan-worktrees.js";
import { phaseTier, readTierConfig, tierForPhase } from "./tiers.js";

/**
 * The tier and model a phase of a plan is built on, read from the plan's live
 * copy (its worktree while it has one) and the project's config. `null` when
 * the project names no model for it: the session's own, as before tiers.
 */
export async function phaseModel(
	checkout: string,
	plan: string,
	phase: PhaseRef,
): Promise<ReturnType<typeof tierForPhase>> {
	const live = await livePlanCopy(checkout, plan);
	if (!live.ok) throw new Error(`the worktree record ${live.file} cannot be read: ${live.problem}`);
	const path = join(live.copy.dir, "impl.md");
	if (!existsSync(path)) throw new Error(`${plan} has no impl.md in ${live.copy.dir}`);
	const override = phaseTier(readFileSync(path, "utf-8"), phase);
	return tierForPhase(readTierConfig(checkout), "work", override);
}
