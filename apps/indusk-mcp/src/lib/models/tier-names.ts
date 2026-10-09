/**
 * The four tiers and the steps that name a default one (model-per-phase). Names
 * only, so the config reader and `tiers.ts` can both import them.
 */
export const TIERS = ["strong", "med", "weak", "baby"] as const;
export type Tier = (typeof TIERS)[number];

/** The skill steps that carry a default tier. */
export const TIER_STEPS = ["plan", "work", "falsify", "cleanup", "audit", "retrospective"] as const;
export type TierStep = (typeof TIER_STEPS)[number];

export function isTier(value: unknown): value is Tier {
	return typeof value === "string" && (TIERS as readonly string[]).includes(value);
}

export function isTierStep(value: unknown): value is TierStep {
	return typeof value === "string" && (TIER_STEPS as readonly string[]).includes(value);
}

/** The tier config, or a tier a phase names, cannot be honoured; the message names the cause. */
export class TierConfigError extends Error {}
