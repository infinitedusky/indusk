import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import {
	FORWARD_INTELLIGENCE_HEADING,
	fencedLineMask,
	gateHeading,
	type PhaseKind,
	parsePhaseHeading,
} from "./impl-headings.js";

export type GateType = "implementation" | "verification" | "context" | "document";

export interface ChecklistItem {
	checked: boolean;
	text: string;
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
	gates: PhaseGate[];
	blocker: string | null;
	forwardIntelligence: string | null;
}

export interface ParsedImpl {
	title: string;
	status: string;
	phases: ImplPhase[];
}

const GATE_SUFFIXES: Record<string, GateType> = {
	Verification: "verification",
	Context: "context",
	Document: "document",
};

function parseChecklistItems(lines: string[]): ChecklistItem[] {
	const items: ChecklistItem[] = [];
	for (const line of lines) {
		const match = line.match(/^-\s+\[([ x])\]\s+(.*)/);
		if (match) {
			items.push({
				checked: match[1] === "x",
				text: match[2].trim(),
			});
		}
	}
	return items;
}

export function parseImplString(raw: string): ParsedImpl {
	const { data, content } = matter(raw);
	const title = (data.title as string) ?? "";
	const status = (data.status as string) ?? "";

	const lines = content.split("\n");
	const phases: ImplPhase[] = [];
	let currentPhase: ImplPhase | null = null;
	let currentGateType: GateType = "implementation";
	let currentGateLines: string[] = [];
	let inForwardIntelligence = false;
	let forwardIntelligenceLines: string[] = [];

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
		if (fenced[lineIndex]) continue;

		// Phase header: ### Phase N / ### Build Phase N / ### Test Phase N
		const phaseMatch = parsePhaseHeading(line);
		if (phaseMatch) {
			flushGate();
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
			continue;
		}

		// Forward Intelligence header: #### Phase N Forward Intelligence
		const fiMatch = line.match(FORWARD_INTELLIGENCE_HEADING);
		if (fiMatch) {
			flushGate();
			inForwardIntelligence = true;
			forwardIntelligenceLines = [];
			continue;
		}

		// Gate header: #### Phase N Verification|Context|Document
		const gateMatch = line.match(gateHeading("(Verification|Context|Document)"));
		if (gateMatch) {
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

		if (inForwardIntelligence) {
			forwardIntelligenceLines.push(line);
		} else {
			currentGateLines.push(line);
		}
	}

	// Flush last forward intelligence, gate, and phase
	if (inForwardIntelligence && currentPhase) {
		currentPhase.forwardIntelligence = forwardIntelligenceLines.join("\n").trim() || null;
	}
	flushGate();
	if (currentPhase) phases.push(currentPhase);

	return { title, status, phases };
}

/**
 * Resolve a `<plan>` argument to its impl.md: an explicit impl.md path, a
 * directory containing one, or a plan name under `.indusk/planning/`.
 *
 * **One definition on purpose.** `atdawn run` and `atdawn verify` both take a
 * plan argument, and if they resolved it differently, verify would judge a file
 * run never executed. That is not a duplicated-lines problem — it is a silent
 * divergence between two enforcement lanes, so the rule lives here and both
 * callers import it.
 */
export function resolveImplPath(projectRoot: string, plan: string): string | null {
	const candidates = plan.endsWith("impl.md")
		? [resolve(projectRoot, plan)]
		: [
				resolve(projectRoot, plan, "impl.md"),
				resolve(projectRoot, ".indusk", "planning", plan, "impl.md"),
			];
	return candidates.find((p) => existsSync(p)) ?? null;
}

export function parseImpl(filePath: string): ParsedImpl {
	if (!existsSync(filePath)) {
		return { title: "", status: "", phases: [] };
	}
	return parseImplString(readFileSync(filePath, "utf-8"));
}

export interface PhaseCompletion {
	phase: number;
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
