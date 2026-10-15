/**
 * The phase-summary rule (`phase_summary: required`): the hook-side home of
 * what the save check refuses in a phase paragraph and a task line.
 *
 * Hook-local (`_`-prefixed): imported by `validate-impl-structure.js`, never
 * registered as a hook. The row-label pattern below is exported once so the
 * cross-reference rule reads the same labels; `TEST_ID_PATTERN` in
 * `src/lib/trajectory/validator.ts` is its deliberate TypeScript mirror.
 *
 * promise: an-impl-phase-explains-itself
 */

import { ANY_PHASE_HEADING, fencedLineMask } from "./_impl-headings.js";

/** A trajectory row label (`T3`, `A12`). Bounded to [TA] on purpose. */
export const ROW_LABEL = /\b[TA]\d+\b/;
const ROW_LABEL_G = new RegExp(ROW_LABEL.source, "g");

/**
 * With `phase_summary: required`, every phase opens with a summary paragraph
 * (the lines between its heading and its first task or `####`, label lines
 * such as `**Tier**:` and `**Goal**:` aside), and that paragraph and every
 * column-zero task line carry no code span and no row label. The folded detail
 * under a task is not read here. Register sections (`#### Deferred to …`,
 * `#### Regression Guards`) and Forward Intelligence hold entries and notes,
 * not tasks, and are not read either.
 *
 * Returns one message per problem, each naming the phase or the task.
 *
 * promise: an-impl-phase-explains-itself
 */
export function phaseSummaryProblems(implBody, required) {
	if (!required) return [];
	const LABEL_LINE = /^\*\*[^*]+\*\*:/;
	const NOT_TASKS = /^####\s+.*\b(?:Deferred to|Regression Guards|Forward Intelligence)\b/;
	const ITEM = /^-\s+\[[ xX]\]\s+(.*)/;
	const lines = implBody.split("\n");
	const fenced = fencedLineMask(lines);
	const problems = [];
	let phase = null;
	let intro = null; // the summary lines while the phase's opening is being read
	let readTasks = true;

	const closeIntro = () => {
		if (intro === null) return;
		if (intro.length === 0) {
			problems.push(
				`${phase} has no summary paragraph: write, after its Tier line and before its first task, what the phase does for the whole plan.`,
			);
		} else {
			const labels = [...new Set(intro.join(" ").match(ROW_LABEL_G) ?? [])];
			if (labels.length > 0) {
				problems.push(
					`${phase}'s summary paragraph names the row label ${labels.join(", ")}: say what the test proves instead.`,
				);
			}
		}
		intro = null;
	};

	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const line = lines[i];
		if (ANY_PHASE_HEADING.test(line)) {
			closeIntro();
			phase = line.replace(/^###\s+/, "").trim();
			intro = [];
			readTasks = true;
			continue;
		}
		if (/^#{1,3}\s/.test(line)) {
			// Any other heading of this rank or above ends the checklist's phase.
			closeIntro();
			phase = null;
			continue;
		}
		if (phase === null) continue;
		if (/^####\s/.test(line)) {
			closeIntro();
			readTasks = !NOT_TASKS.test(line);
			continue;
		}
		const item = line.match(ITEM);
		if (item) {
			closeIntro();
			if (!readTasks) continue;
			const text = item[1].trim();
			if (text.includes("`")) {
				problems.push(
					`The task "${text}" in ${phase} carries code on its line: a task is one plain sentence for someone who knows the project but none of its shorthand; code and row labels belong in its Technical detail.`,
				);
			}
			const labels = [...new Set(text.match(ROW_LABEL_G) ?? [])];
			if (labels.length > 0) {
				problems.push(
					`The task "${text}" in ${phase} names the row label ${labels.join(", ")}: a task is one plain sentence for someone who knows the project but none of its shorthand; row labels belong in its Technical detail.`,
				);
			}
			continue;
		}
		if (intro !== null && line.trim() !== "" && !LABEL_LINE.test(line)) intro.push(line);
	}
	closeIntro();
	return problems;
}
