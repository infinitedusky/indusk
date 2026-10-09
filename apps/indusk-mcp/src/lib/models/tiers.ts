import { readTiers, readWorkflowSteps } from "../checks/steps.js";
import { fencedLineMask, type PhaseRef, parsePhaseHeading } from "../impl-headings.js";
import {
	isTier,
	TIER_STEPS,
	TIERS,
	type Tier,
	TierConfigError,
	type TierStep,
} from "./tier-names.js";

export { isTier, TIERS, type Tier, TierConfigError } from "./tier-names.js";
export { readTiers };

/**
 * Which model a phase is built on (model-per-phase). The config names a model
 * for each tier and a default tier for each step; a phase's impl may name a
 * different tier, with its reason. Pure over its inputs — the config and the
 * impl body are read by the caller.
 *
 * Mirrored by `hooks/_phase-tier.js`, which holds the same line grammar for
 * the validator (a hook cannot import this module); change them together.
 */

export interface TierConfig {
	tiers: Partial<Record<Tier, string>>;
	steps: Partial<Record<TierStep, Tier>>;
}

/** The project's tiers and each step's default tier, validated; empty when it names none. */
export function readTierConfig(checkout: string): TierConfig {
	const workflow = readWorkflowSteps(checkout);
	const steps: TierConfig["steps"] = {};
	for (const step of TIER_STEPS) {
		const tier = workflow[step]?.tier;
		if (isTier(tier)) steps[step] = tier;
	}
	return { tiers: readTiers(checkout), steps };
}

/** A phase's `**Tier**:` line, as written. `tier` is unchecked text. */
export interface PhaseTierLine {
	ref: PhaseRef;
	tier: string;
	reason: string | null;
}

const TIER_LINE = /^\*\*Tier\*\*:\s*(\S+)(?:\s+[—–-]+\s+(.*\S))?\s*$/;

/** Every `**Tier**:` line under a phase heading, outside fenced blocks. */
export function phaseTierLines(implBody: string): PhaseTierLine[] {
	const lines = implBody.split("\n");
	const fenced = fencedLineMask(lines);
	const out: PhaseTierLine[] = [];
	let current: PhaseRef | null = null;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const heading = parsePhaseHeading(lines[i]);
		if (heading) {
			current = { kind: heading.kind, number: heading.number };
			continue;
		}
		if (/^#{1,3}\s/.test(lines[i])) current = null;
		if (!current) continue;
		const m = TIER_LINE.exec(lines[i]);
		if (m) out.push({ ref: current, tier: m[1], reason: m[2] ?? null });
	}
	return out;
}

/** The tier line under one phase, if it has one. */
export function phaseTier(implBody: string, phase: PhaseRef): PhaseTierLine | undefined {
	return phaseTierLines(implBody).find(
		(l) => l.ref.kind === phase.kind && l.ref.number === phase.number,
	);
}

/**
 * The tier and model a phase of `step` is built on. `null` when the project
 * names no tiers at all — the session's own model, as before tiers existed.
 * A project that names tiers but none for the tier asked is a
 * `TierConfigError`: answering the session's model would build the phase on
 * the wrong one without a word.
 */
export function tierForPhase(
	config: TierConfig,
	step: TierStep,
	override: { tier: string } | undefined,
): { tier: Tier; model: string } | null {
	const named = override?.tier ?? config.steps[step];
	if (!isTier(named)) return null;
	if (Object.keys(config.tiers).length === 0) return null;
	const model = config.tiers[named];
	if (model === undefined) {
		throw new TierConfigError(
			`the tier ${named} has no model: add workflow.tiers.${named} to the config`,
		);
	}
	return { tier: named, model };
}

/** The tiers above, nearest first. */
const ESCALATION: Record<Tier, Tier | null> = {
	baby: "weak",
	weak: "med",
	med: "strong",
	strong: null,
};

/** Failed attempts a tier gets before the phase moves up. */
export const ATTEMPTS_PER_TIER = 3;

/**
 * What a phase that keeps failing does next: `null` to keep going, the next
 * tier up once `failures` reaches three, `"blocker"` when it is already on the
 * strongest tier and a person must look.
 */
export function nextTier(tier: Tier, failures: number): Tier | "blocker" | null {
	if (failures < ATTEMPTS_PER_TIER) return null;
	return ESCALATION[tier] ?? "blocker";
}

/**
 * Problems with an impl's tier lines: more than one under a phase, a tier that
 * is not one of the four, a tier other than the step's default with no
 * reason, and (when the project names tiers) a tier with no model. Names the
 * phase.
 */
export function tierRuleProblems(
	implBody: string,
	defaultTier: Tier | undefined,
	tiers: Partial<Record<Tier, string>> = {},
): string[] {
	const problems: string[] = [];
	const seen = new Set<string>();
	for (const line of phaseTierLines(implBody)) {
		const label = `${line.ref.kind === "test" ? "Test" : "Build"} Phase ${line.ref.number}`;
		if (seen.has(label)) {
			problems.push(
				`${label}: more than one \`**Tier**:\` line — keep one; an escalation replaces the line`,
			);
			continue;
		}
		seen.add(label);
		if (!isTier(line.tier)) {
			problems.push(`${label}: tier "${line.tier}" is not one of ${TIERS.join(", ")}`);
		} else if (defaultTier !== undefined && line.tier !== defaultTier && line.reason === null) {
			problems.push(
				`${label}: tier ${line.tier} differs from the work step's default (${defaultTier}) and gives no reason — write \`**Tier**: ${line.tier} — <reason>\``,
			);
		} else if (Object.keys(tiers).length > 0 && tiers[line.tier] === undefined) {
			problems.push(
				`${label}: tier ${line.tier} has no model — add workflow.tiers.${line.tier} to the config`,
			);
		}
	}
	return problems;
}
