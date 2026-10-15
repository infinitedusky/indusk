/**
 * The impl.md parser — string in, phases out. No filesystem.
 *
 * Split from `impl-parser.ts` (admin-ui-phase-progress, Build Phase 3) so the
 * admin UI's browser components can import the one parser: the browser test
 * runtime externalizes `node:fs`, and a static `existsSync` import makes the
 * whole module unloadable there. `impl-parser.ts` re-exports everything here
 * and adds the two functions that touch disk (`resolveImplPath`, `parseImpl`);
 * the `@infinitedusky/indusk-mcp/impl-parser` subpath points at this file.
 */

import matter from "gray-matter";
import {
	FORWARD_INTELLIGENCE_HEADING,
	fencedLineMask,
	gateHeading,
	type PhaseKind,
	type PhaseRef,
	parsePhaseHeading,
} from "./impl-headings.js";

export type GateType = "implementation" | "verification" | "otel" | "context" | "document";

export interface ChecklistItem {
	checked: boolean;
	text: string;
	/** The indented lines recorded under the item (its Note or Result), joined; absent when it has none. */
	note?: string;
	/**
	 * The item's folded detail: the indented block inside its `<details>` fold,
	 * de-indented, the fold's own tags removed and any fenced code kept whole.
	 * Read-only text for a page to draw; absent when the item has no fold.
	 */
	detail?: string;
}

export interface PhaseGate {
	type: GateType;
	items: ChecklistItem[];
}

export interface ImplPhase {
	/**
	 * The phase's number **within its own sequence**. Test Phase 1 and Build
	 * Phase 1 both have number 1 and are different phases — order them by
	 * `ordinal`, never by this.
	 */
	number: number;
	/**
	 * Which sequence this phase belongs to. `"build"` for `### Phase N` as well
	 * as `### Build Phase N`, which are the same thing spelled two ways.
	 */
	kind: PhaseKind;
	/** Position in the document: the only thing that orders two sequences. */
	ordinal: number;
	name: string;
	/**
	 * The phase's opening paragraph: the prose between the heading (past its
	 * `**Tier**:`/`**Goal**:` labels) and the first task. Absent when there is none.
	 */
	summary?: string;
	gates: PhaseGate[];
	blocker: string | null;
	forwardIntelligence: string | null;
}

export interface ParsedImpl {
	title: string;
	status: string;
	phases: ImplPhase[];
	/**
	 * When the plan's build was accepted (admin-plan-authoring): `accepted:` in
	 * the frontmatter, written by `indusk plans accept`. Absent until then.
	 */
	accepted?: string;
}

// One entry per `GateKind` in `impl-headings.ts`. OTel was missing here while
// the hook-side port (`hooks/_impl-phases.js`) recognised it — the two walks
// disagreed about a gate kind until admin-ui-phase-progress (A5).
const GATE_SUFFIXES: Record<string, GateType> = {
	Verification: "verification",
	OTel: "otel",
	Context: "context",
	Document: "document",
};

/** A line that is only the fold's own tags: `<details>`, `<summary>…</summary>`, `</details>`. */
const FOLD_TAGS_ONLY = /^(<details[^>]*>)?\s*(<summary>.*?<\/summary>)?\s*(<\/details>)?$/;

/** A line that opens a task's fold and does not close it on the same line. */
function opensFold(line: string): boolean {
	return /^\s+<details[\s>]/.test(line) && !closesFold(line);
}

/** A line that ends a task's fold. */
function closesFold(line: string): boolean {
	return line.trim().endsWith("</details>");
}

/** A column-zero task or heading: where a fold that was never closed stops hiding lines. */
function endsTaskFold(line: string): boolean {
	return /^-\s+\[[ xX]\]/.test(line) || /^#{1,6}\s/.test(line);
}

/**
 * Which lines of an impl are a task's folded detail or a fenced block, as a
 * mask parallel to `lines`: the text a reader of boxes must leave alone, since
 * anything quoted there is only read (`hidden-detail-is-only-read`).
 */
export function foldedLineMask(lines: string[]): boolean[] {
	const fenced = fencedLineMask(lines);
	const mask: boolean[] = [];
	let inFold = false;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) {
			mask.push(true);
		} else if (inFold && !endsTaskFold(lines[i])) {
			mask.push(true);
			if (closesFold(lines[i])) inFold = false;
		} else if (opensFold(lines[i])) {
			mask.push(true);
			inFold = true;
		} else {
			// Not in a fold, or a fold that never closed and met the next task or
			// heading: that line is read as itself (an unclosed fold fails open, as
			// an unterminated fence masks nothing).
			inFold = false;
			mask.push(false);
		}
	}
	return mask;
}

/** A phase's label lines (`**Tier**: …`, `**Goal**: …`) are not its paragraph. */
const PHASE_LABEL = /^\*\*(Tier|Goal)\*\*:/;

/** De-indent a fold's lines by the first non-blank line's indent and trim blank edges. */
function foldDetail(raw: string[]): string | undefined {
	const kept = raw.filter((l) => !(l.trim() !== "" && FOLD_TAGS_ONLY.test(l.trim())));
	const first = kept.find((l) => l.trim() !== "");
	if (first === undefined) return undefined;
	const indent = first.length - first.trimStart().length;
	const text = kept
		.map((l) => (l.length - l.trimStart().length >= indent ? l.slice(indent) : l.trimStart()))
		.join("\n")
		.trim();
	return text === "" ? undefined : text;
}

function parseChecklistItems(lines: string[]): ChecklistItem[] {
	const items: ChecklistItem[] = [];
	const notes: string[][] = [];
	const details: string[][] = [];
	// Fenced lines belong to a fold's detail, so a `</details>` inside a fence
	// is code, not the fold's end.
	const fenced = fencedLineMask(lines);
	let inFold = false;
	for (const [i, line] of lines.entries()) {
		const match = fenced[i] ? null : line.match(/^-\s+\[([ x])\]\s+(.*)/);
		if (match) {
			items.push({
				checked: match[1] === "x",
				text: match[2].trim(),
			});
			notes.push([]);
			details.push([]);
			inFold = false;
		} else if (items.length > 0) {
			const last = items.length - 1;
			const trimmed = line.trim();
			if (inFold) {
				details[last].push(line);
				if (!fenced[i] && closesFold(line)) inFold = false;
			} else if (!fenced[i] && /^\s+<details[\s>]/.test(line)) {
				inFold = opensFold(line);
				details[last].push(line);
			} else if (/^\s+\S/.test(line)) {
				notes[last].push(trimmed.replace(/^-\s+/, ""));
			}
		}
	}
	return items.map((item, i) => {
		const detail = foldDetail(details[i]);
		return {
			...item,
			...(notes[i].length > 0 ? { note: notes[i].join("\n") } : {}),
			...(detail ? { detail } : {}),
		};
	});
}

export function parseImplString(raw: string): ParsedImpl {
	// gray-matter touches `Buffer` on every call, which the admin's browser
	// runtime does not have. The admin always hands this a frontmatter-free
	// body (its reader split the frontmatter server-side), so only a document
	// that actually opens with a fence goes through gray-matter — identical
	// output for every Node caller, and loadable in the browser.
	const { data, content } = raw.startsWith("---")
		? matter(raw)
		: { data: {} as Record<string, unknown>, content: raw };
	const title = (data.title as string) ?? "";
	const status = (data.status as string) ?? "";
	const accepted = data.accepted instanceof Date ? data.accepted.toISOString() : data.accepted;

	const lines = content.split("\n");
	const phases: ImplPhase[] = [];
	let currentPhase: ImplPhase | null = null;
	let currentGateType: GateType = "implementation";
	let currentGateLines: string[] = [];
	let inForwardIntelligence = false;
	let forwardIntelligenceLines: string[] = [];
	// The phase's opening paragraph is collected until its first task or gate.
	let preamble: string[] | null = null;
	// Inside an item's `<details>` fold, fenced lines are its detail, not structure.
	let inFold = false;

	function closePreamble() {
		if (preamble && currentPhase) {
			const text = preamble.join("\n").trim();
			if (text) currentPhase.summary = text;
		}
		preamble = null;
	}

	function flushGate() {
		if (!currentPhase) return;
		const items = parseChecklistItems(currentGateLines);
		if (items.length > 0) {
			currentPhase.gates.push({ type: currentGateType, items });
		}
		currentGateLines = [];
	}

	// Fenced blocks are content, not structure: a Test Phase 1 deferral may
	// carry the deferred test's body, and that body contains lines shaped
	// exactly like checklist items and gate headings.
	const fenced = fencedLineMask(lines);

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (fenced[lineIndex]) {
			if (inFold && !inForwardIntelligence) currentGateLines.push(line);
			continue;
		}
		if (preamble === null) {
			if (opensFold(line)) inFold = true;
			else if (inFold && closesFold(line)) inFold = false;
		}

		// Phase header: ### Phase N / ### Build Phase N / ### Test Phase N
		const phaseMatch = parsePhaseHeading(line);
		if (phaseMatch) {
			closePreamble();
			flushGate();
			inFold = false;
			if (currentPhase) phases.push(currentPhase);
			currentPhase = {
				number: phaseMatch.number,
				kind: phaseMatch.kind,
				ordinal: phases.length,
				name: phaseMatch.name,
				gates: [],
				blocker: null,
				forwardIntelligence: null,
			};
			currentGateType = "implementation";
			currentGateLines = [];
			preamble = [];
			continue;
		}

		// Forward Intelligence header: #### Phase N Forward Intelligence
		const fiMatch = line.match(FORWARD_INTELLIGENCE_HEADING);
		if (fiMatch) {
			closePreamble();
			flushGate();
			inForwardIntelligence = true;
			forwardIntelligenceLines = [];
			continue;
		}

		// Gate header: #### Phase N Verification|OTel|Context|Document
		const gateMatch = line.match(gateHeading("(Verification|OTel|Context|Document)"));
		if (gateMatch) {
			closePreamble();
			if (inForwardIntelligence && currentPhase) {
				currentPhase.forwardIntelligence = forwardIntelligenceLines.join("\n").trim() || null;
				inForwardIntelligence = false;
			}
			flushGate();
			// [1] is the phase number, [2] the gate kind — see gateHeading().
			currentGateType = GATE_SUFFIXES[gateMatch[2]];
			continue;
		}

		// Blocker line: blocker: description
		if (currentPhase) {
			const blockerMatch = line.match(/^blocker:\s+(.*)/);
			if (blockerMatch) {
				currentPhase.blocker = blockerMatch[1].trim();
				continue;
			}
		}

		if (preamble) {
			if (/^-\s+\[[ x]\]/.test(line)) closePreamble();
			else if (!PHASE_LABEL.test(line)) preamble.push(line);
		}

		if (inForwardIntelligence) {
			forwardIntelligenceLines.push(line);
		} else {
			currentGateLines.push(line);
		}
	}

	// Flush last forward intelligence, gate, and phase
	closePreamble();
	if (inForwardIntelligence && currentPhase) {
		currentPhase.forwardIntelligence = forwardIntelligenceLines.join("\n").trim() || null;
	}
	flushGate();
	if (currentPhase) phases.push(currentPhase);

	return typeof accepted === "string" && accepted
		? { title, status, phases, accepted }
		: { title, status, phases };
}

export interface PhaseCompletion {
	/** The phase's number within its sequence — ambiguous across two sequences; prefer `ref`. */
	phase: number;
	/** Which sequence and number: the unambiguous key (admin-ui-phase-progress). */
	ref: PhaseRef;
	/** Document position — what orders two sequences. */
	ordinal: number;
	name: string;
	complete: boolean;
	totalItems: number;
	checkedItems: number;
	uncheckedByGate: Record<GateType, string[]>;
}

export function getPhaseCompletion(phase: ImplPhase): PhaseCompletion {
	const uncheckedByGate: Record<GateType, string[]> = {
		implementation: [],
		verification: [],
		otel: [],
		context: [],
		document: [],
	};

	let totalItems = 0;
	let checkedItems = 0;

	for (const gate of phase.gates) {
		for (const item of gate.items) {
			totalItems++;
			if (item.checked) {
				checkedItems++;
			} else {
				uncheckedByGate[gate.type].push(item.text);
			}
		}
	}

	return {
		phase: phase.number,
		ref: { kind: phase.kind, number: phase.number },
		ordinal: phase.ordinal,
		name: phase.name,
		complete: checkedItems === totalItems,
		totalItems,
		checkedItems,
		uncheckedByGate,
	};
}

export function getAllPhaseCompletions(parsed: ParsedImpl): PhaseCompletion[] {
	return parsed.phases.map(getPhaseCompletion);
}

/**
 * The phase a `{kind, number}` reference names, or undefined. Number alone is
 * ambiguous once an impl has two sequences (Test Phase 1 / Build Phase 1);
 * every reader that keys a phase should key it this way.
 */
export function findPhase(parsed: ParsedImpl, ref: PhaseRef): ImplPhase | undefined {
	return parsed.phases.find((p) => p.kind === ref.kind && p.number === ref.number);
}
