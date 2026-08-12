import { parseImplString } from "../impl-parser.js";
import { changedPathsSince, showFileAt } from "./git.js";
import type { VerifyFinding } from "./verify.js";

/**
 * Phantom work — an item checked off with no corresponding change.
 *
 * The failure nobody had named. An agent flips checkboxes and writes no code:
 * no gate item is unchecked, no goalpost moved, the tests were already green
 * from an earlier phase, and every other detection passes. Only the diff since
 * the baseline shows the work never happened.
 *
 * The rule is deliberately NARROW. It fires only when the diff touches nothing
 * but the plan's own impl.md, and stays silent the moment any real change
 * exists — which means it does not catch a phase that wrote something trivial
 * to satisfy the check. That is the intended trade: attributing a checklist
 * item to a specific hunk is not reliably possible, and a detector that cries
 * wolf gets disabled, which costs more than the cases it would have caught.
 */
export async function detectPhantomWork(options: {
	root: string;
	baselineSha: string;
	implRepoRelPath: string;
	currentContent: string;
	phase: number;
}): Promise<VerifyFinding[]> {
	const changed = await changedPathsSince(options.root, options.baselineSha);
	// Nothing changed at all: this is not a phase that claimed work — it is a
	// phase that did nothing, which the gate detections already speak to.
	if (changed.length === 0) return [];

	const somethingRealChanged = changed.some(
		(path) => path !== options.implRepoRelPath && !isMachineState(path),
	);
	if (somethingRealChanged) return [];

	// Only the plan file moved. Which implementation items became checked?
	const baselineContent = await showFileAt(
		options.root,
		options.baselineSha,
		options.implRepoRelPath,
	);
	if (baselineContent === null) return [];

	const newlyChecked = newlyCheckedImplementationItems(
		baselineContent,
		options.currentContent,
		options.phase,
	);

	return newlyChecked.map((item) => ({
		kind: "phantom" as const,
		item,
		message: `"${item}" was checked off in Phase ${options.phase}, but nothing outside the plan file changed since ${options.baselineSha.slice(0, 7)} — the checkbox moved and the work did not.`,
	}));
}

/**
 * InDusk's own bookkeeping — never evidence that a phase did work.
 *
 * This exclusion is load-bearing rather than tidy. The verify ledger is tracked,
 * so from the first clean run onward it appears in every later phase's diff —
 * which made "nothing but impl.md changed" permanently false and silently
 * switched this detection off. Verify's own success artifact was disabling
 * verify. The commit cadence excludes `.indusk/eval` from staging for the
 * adjacent reason.
 *
 * Shape's phase-boundary record sprang the same trap a second time, and worse:
 * it is written when a phase **opens**, so it lands in the diff of a phase that
 * has not done anything yet. **Any newly tracked InDusk artifact has to be
 * registered here in the commit that first writes it** — this list is not
 * discovered, it is maintained.
 *
 * Deliberately NOT shared with `shape/changed.ts`'s `isNotCode`, which excludes
 * all of `.indusk/` including plan documents. Phantom cannot do that: `impl.md`
 * is precisely the file it needs to see. Same shape of question, genuinely
 * different answers — one definition here would be a merge of two rules, not a
 * de-duplication of one.
 */
function isMachineState(repoRelPath: string): boolean {
	return (
		repoRelPath.startsWith(".indusk/verify/") ||
		repoRelPath.startsWith(".indusk/eval/") ||
		repoRelPath === ".indusk/phase-boundary.jsonl"
	);
}

/**
 * Implementation items in the given phase that went unchecked → checked.
 *
 * Gate items (Verification/Context/Document) are excluded: checking a gate item
 * legitimately changes only the plan file, so flagging those would fire on every
 * honest phase close.
 */
function newlyCheckedImplementationItems(
	baselineContent: string,
	currentContent: string,
	phase: number,
): string[] {
	const before = implementationItemsAt(baselineContent, phase);
	const after = implementationItemsAt(currentContent, phase);

	// Match by POSITION, not by text. Matching on text let a reworded item read
	// as brand-new rather than as a checkoff, and brand-new items are never
	// flagged — so editing the wording while ticking the box walked straight
	// past this detection. Position survives the edit; text does not.
	return after
		.filter((item, index) => item.checked && before[index]?.checked === false)
		.map((item) => item.text);
}

function implementationItemsAt(
	content: string,
	phase: number,
): Array<{ text: string; checked: boolean }> {
	const parsed = parseImplString(content);
	const target = parsed.phases.find((p) => p.number === phase);
	if (!target) return [];
	return target.gates
		.filter((gate) => gate.type === "implementation")
		.flatMap((gate) => gate.items.map((item) => ({ text: item.text, checked: item.checked })));
}
