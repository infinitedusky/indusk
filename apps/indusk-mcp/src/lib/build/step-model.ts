import { type PhaseRef, parsePhaseHeading } from "../impl-headings.js";
import { phaseModel } from "../models/phase-model.js";
import type { TierStep } from "../models/tier-names.js";
import { readTierConfig, tierForPhase } from "../models/tiers.js";

/**
 * promise: each-phase-runs-on-its-model — the model an admin build's step runs on.
 *
 * A `work` step runs on its phase's model (the phase's `**Tier**:` line, or the
 * work step's default); the rituals run on their step's default tier. `null`
 * when the project names no tiers: the session runs on `claude`'s own model.
 * A tier the config has no model for throws `TierConfigError`, which the caller
 * lets fail the step rather than building on the wrong model without a word.
 *
 * `phase` is the string `nextBuildStep` gives ("Build Phase 2: The inputs …").
 */
export async function buildStepModel(
	checkout: string,
	plan: string,
	step: TierStep,
	phase?: string,
): Promise<ReturnType<typeof tierForPhase>> {
	const ref = step === "work" && phase !== undefined ? phaseRef(phase) : null;
	if (ref) return phaseModel(checkout, plan, ref);
	return tierForPhase(readTierConfig(checkout), step, undefined);
}

/** The phase a `nextBuildStep` string names — read as the heading it was cut from. */
function phaseRef(phase: string): PhaseRef | null {
	const heading = parsePhaseHeading(`### ${phase}`);
	return heading ? { kind: heading.kind, number: heading.number } : null;
}
