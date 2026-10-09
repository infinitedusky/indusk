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

/** Problems with an impl's tier lines; `defaultTier` is the work step's, or undefined. */
export function tierRuleProblems(implBody, defaultTier) {
	const problems = [];
	for (const line of phaseTierLines(implBody)) {
		const label = `${line.ref.kind === "test" ? "Test" : "Build"} Phase ${line.ref.number}`;
		if (!TIERS.includes(line.tier)) {
			problems.push(`${label}: tier "${line.tier}" is not one of ${TIERS.join(", ")}`);
		} else if (defaultTier !== undefined && line.tier !== defaultTier && line.reason === null) {
			problems.push(
				`${label}: tier ${line.tier} differs from the work step's default (${defaultTier}) and gives no reason — write \`**Tier**: ${line.tier} — <reason>\``,
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
