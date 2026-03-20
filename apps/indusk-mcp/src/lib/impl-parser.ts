import { existsSync, readFileSync } from "node:fs";
import matter from "gray-matter";

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
	number: number;
	name: string;
	gates: PhaseGate[];
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

	function flushGate() {
		if (!currentPhase) return;
		const items = parseChecklistItems(currentGateLines);
		if (items.length > 0) {
			currentPhase.gates.push({ type: currentGateType, items });
		}
		currentGateLines = [];
	}

	for (const line of lines) {
		// Phase header: ### Phase N: Name
		const phaseMatch = line.match(/^###\s+Phase\s+(\d+)[:\s]+(.*)/);
		if (phaseMatch) {
			flushGate();
			if (currentPhase) phases.push(currentPhase);
			currentPhase = {
				number: Number.parseInt(phaseMatch[1], 10),
				name: phaseMatch[2].trim(),
				gates: [],
			};
			currentGateType = "implementation";
			currentGateLines = [];
			continue;
		}

		// Gate header: #### Phase N Verification|Context|Document
		const gateMatch = line.match(/^####\s+Phase\s+\d+\s+(Verification|Context|Document)\b/);
		if (gateMatch) {
			flushGate();
			currentGateType = GATE_SUFFIXES[gateMatch[1]];
			continue;
		}

		currentGateLines.push(line);
	}

	// Flush last gate and phase
	flushGate();
	if (currentPhase) phases.push(currentPhase);

	return { title, status, phases };
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
