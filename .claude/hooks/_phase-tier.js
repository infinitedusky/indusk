/**
 * The hook-side port of the phase tier line (model-per-phase): `**Tier**:
 * <tier> — <reason>` under a phase heading, and the rule the validator holds it
 * to — a tier that is one of strong, med, weak or baby, and a reason when it
 * differs from the work step's default.
 *
 * Deliberate port of `src/lib/models/tiers.ts` (`phaseTierLines`,
 * `tierRuleProblems`). Hooks are plain JS and cannot import the TS module, so
 * the rule lives in two places and they must change together.
 *
 * Hook-local (`_`-prefixed): imported by `validate-impl-structure.js`, never
 * registered as a hook.
 */

import { fencedLineMask, parsePhaseHeading } from "./_impl-headings.js";

const TIERS = ["strong", "med", "weak", "baby"];
// Every step `readWorkflowSteps` reads: the two it ran before tiers, and the five that carry a default tier.
const STEPS = ["land", "release", "plan", "work", "falsify", "cleanup", "retrospective"];
const TIER_LINE = /^\*\*Tier\*\*:\s*(\S+)(?:\s+[—–-]+\s+(.*\S))?\s*$/;

function phaseTierLines(implBody) {
	const lines = implBody.split("\n");
	const fenced = fencedLineMask(lines);
	const out = [];
	let current = null;
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

/**
 * Problems with an impl's tier lines: more than one under a phase, an unknown
 * tier, a tier other than the work step's default with no reason, and (when the
 * project names tiers) a tier with no model. `tiers` is `workflow.tiers`.
 */
export function tierRuleProblems(implBody, defaultTier, tiers = {}) {
	const problems = [];
	const seen = new Set();
	for (const line of phaseTierLines(implBody)) {
		const label = `${line.ref.kind === "test" ? "Test" : "Build"} Phase ${line.ref.number}`;
		if (seen.has(label)) {
			problems.push(
				`${label}: more than one \`**Tier**:\` line — keep one; an escalation replaces the line`,
			);
			continue;
		}
		seen.add(label);
		if (!TIERS.includes(line.tier)) {
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

/**
 * The tier config the way `readTierConfig` reads it: a tier key that is not a
 * tier, a model that is not a non-empty string, and a step's default tier that
 * is not a tier are each a problem naming the key.
 */
export function tierConfigProblems(config) {
	const problems = [];
	const workflow = config?.workflow;
	for (const [key, model] of Object.entries(workflow?.tiers ?? {})) {
		if (!TIERS.includes(key)) {
			problems.push(`workflow.tiers.${key} is not a tier; the tiers are ${TIERS.join(", ")}`);
		} else if (typeof model !== "string" || model.trim() === "") {
			problems.push(`workflow.tiers.${key} must be a model alias (a non-empty string)`);
		}
	}
	for (const [step, section] of Object.entries(workflow?.steps ?? {})) {
		if (!STEPS.includes(step)) {
			problems.push(`workflow.steps.${step} is not a step InDusk reads`);
			continue;
		}
		const tier = section?.tier;
		if (tier !== undefined && !TIERS.includes(tier)) {
			problems.push(
				`workflow.steps.${step}.tier must be one of ${TIERS.join(", ")}; got ${JSON.stringify(tier)}`,
			);
		}
	}
	return problems;
}

/** The work step's default tier from `.indusk/config.json`, or undefined. */
export function workDefaultTier(config) {
	const tier = config?.workflow?.steps?.work?.tier;
	return TIERS.includes(tier) ? tier : undefined;
}
