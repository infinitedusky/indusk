/**
 * Deliberate port of `src/lib/trajectory/register.ts` — reading Test Phase 1's
 * register.
 *
 * Hook-local (`_`-prefixed): imported by hooks, never registered as one, so it
 * needs no settings entry — but it must exist in `.claude/hooks/` or the
 * importing hook dies at load.
 *
 * One `_`-prefixed module per `src/lib` module, one-to-one. That correspondence
 * is the point: "change the TS and every JS port together" is a rule you can
 * follow by reading two filenames, rather than by hunting inside a
 * thousand-line hook for the parts that happen to be mirrored.
 *
 * Change `src/lib/trajectory/register.ts` and this file together.
 */

import { fencedLineMask, parsePhaseHeading } from "./_impl-headings.js";

// `#### Deferred to Test Phase N` justifies a later test phase's existence;
// `#### Regression Guards` declares rows green the moment they are written.
const DEFERRED_TO_TEST_PHASE = /^####\s+Deferred to Test Phase\s+(\d+)\b/;
const REGRESSION_GUARDS_HEADING = /^####\s+Regression Guards\b/;
const REGISTER_ENTRY_ID = /^\s*-\s+\*\*([TA]\d+)\*\*/;

export function parseRegister(implBody) {
	const lines = implBody.split("\n");
	const fenced = fencedLineMask(lines);
	const justifiedTestPhases = new Set();
	const regressionGuards = new Set();

	let inTestPhaseOne = false;
	let inGuards = false;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const line = lines[i];

		const heading = parsePhaseHeading(line);
		if (heading) {
			inTestPhaseOne = heading.kind === "test" && heading.number === 1;
			inGuards = false;
			continue;
		}
		if (!inTestPhaseOne) continue;

		const deferred = DEFERRED_TO_TEST_PHASE.exec(line);
		if (deferred) {
			justifiedTestPhases.add(Number.parseInt(deferred[1], 10));
			inGuards = false;
			continue;
		}
		if (REGRESSION_GUARDS_HEADING.test(line)) {
			inGuards = true;
			continue;
		}
		if (/^####\s+/.test(line)) {
			inGuards = false;
			continue;
		}
		if (inGuards) {
			const entry = REGISTER_ENTRY_ID.exec(line);
			if (entry) regressionGuards.add(entry[1]);
		}
	}

	return { justifiedTestPhases, regressionGuards };
}
