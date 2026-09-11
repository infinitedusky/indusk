/**
 * The one hook-side walk from an impl body to its phases and checkbox items.
 *
 * Deliberate port of the TS phase/item walk in `src/lib/impl-parser.ts` (what
 * `getPhaseCompletion` reads). Hooks are plain JS and cannot import the TS
 * module, so the rule lives in two places — this file and that one — and they
 * must change together.
 *
 * Hook-local (`_`-prefixed): imported by hooks, never registered as one, so it
 * needs no settings entry — but it must exist in `.claude/hooks/` or every
 * importer dies at load. `globSync("*.js")` copies it on init and update.
 *
 * **One definition, shared by `check-gates.js` and `gate-reminder.js`, pinned
 * by A24.** Each carried its own copy of this walk until workbench-trust-fixes'
 * cleanup phase; gate-reminder's was the same walk minus the item text, and it
 * recognized one gate kind fewer. That is the shape `_trajectory-parser.js`
 * was extracted from — two copies that had already diverged without anything
 * failing — and the reason this repo extracts hook-side parsers at two rather
 * than waiting for three.
 *
 * Phases are two sequences ordered by document position (`Test Phase N`,
 * `Build Phase N`; `Phase N` means build phase N). Fenced blocks are content,
 * not structure: a deferral may carry a test body with checkbox- and
 * heading-shaped lines. Items under a `Forward Intelligence` heading are
 * notes, not work, and are excluded.
 */

import {
	FORWARD_INTELLIGENCE_HEADING,
	fencedLineMask,
	gateHeading,
	parsePhaseHeading,
} from "./_impl-headings.js";
import { stripFrontmatter } from "./_trajectory-parser.js";

const GATE_KINDS = gateHeading("(Verification|OTel|Context|Document)");

/**
 * @param {string} content — an impl document, with or without frontmatter
 * @returns {{ kind: "test" | "build", number: number, ordinal: number, name: string,
 *   items: { checked: boolean, text: string, gate: string }[] }[]}
 */
export function parseImplPhases(content) {
	const lines = stripFrontmatter(content).split("\n");
	const fenced = fencedLineMask(lines);
	const phases = [];
	let currentPhase = null;
	let currentGateType = "implementation";
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (fenced[i]) continue;
		const phaseMatch = parsePhaseHeading(line);
		if (phaseMatch) {
			if (currentPhase) phases.push(currentPhase);
			currentPhase = {
				number: phaseMatch.number,
				kind: phaseMatch.kind,
				ordinal: phases.length,
				name: phaseMatch.name,
				items: [],
			};
			currentGateType = "implementation";
			continue;
		}
		// [1] is the phase number, [2] the gate kind — see gateHeading().
		const gateMatch = line.match(GATE_KINDS);
		if (gateMatch) {
			currentGateType = gateMatch[2].toLowerCase();
			continue;
		}
		if (FORWARD_INTELLIGENCE_HEADING.test(line)) {
			currentGateType = "_fi";
			continue;
		}
		if (currentPhase && currentGateType !== "_fi") {
			const itemMatch = line.match(/^-\s+\[([ x])\]\s+(.*)/);
			if (itemMatch) {
				currentPhase.items.push({
					checked: itemMatch[1] === "x",
					text: itemMatch[2].trim(),
					gate: currentGateType,
				});
			}
		}
	}
	if (currentPhase) phases.push(currentPhase);
	return phases;
}
