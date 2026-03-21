#!/usr/bin/env node
/**
 * PostToolUse hook: nudges the agent to call advance_plan when a phase is complete.
 *
 * This hook is advisory — it cannot block. It outputs a reminder message
 * that appears in the conversation as additional context.
 */

import { readFileSync } from "node:fs";

// Read hook input from stdin
let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const toolInput = event.tool_input ?? {};
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

// Read the impl file (post-edit state)
let content;
try {
	content = readFileSync(filePath, "utf-8");
} catch {
	process.exit(0);
}

// Parse phases
function parsePhases(text) {
	const fmMatch = text.match(/^---\n[\s\S]*?\n---\n/);
	const body = fmMatch ? text.slice(fmMatch[0].length) : text;

	const lines = body.split("\n");
	const phases = [];
	let currentPhase = null;
	let currentGateType = "implementation";

	for (const line of lines) {
		const phaseMatch = line.match(/^###\s+Phase\s+(\d+)[:\s]+(.*)/);
		if (phaseMatch) {
			if (currentPhase) phases.push(currentPhase);
			currentPhase = {
				number: parseInt(phaseMatch[1], 10),
				name: phaseMatch[2].trim(),
				items: [],
			};
			currentGateType = "implementation";
			continue;
		}

		const gateMatch = line.match(/^####\s+Phase\s+\d+\s+(Verification|Context|Document)\b/);
		if (gateMatch) {
			currentGateType = gateMatch[1].toLowerCase();
			continue;
		}

		if (line.match(/^####\s+Phase\s+\d+\s+Forward Intelligence\b/)) {
			currentGateType = "_fi";
			continue;
		}

		if (currentPhase && currentGateType !== "_fi") {
			const itemMatch = line.match(/^-\s+\[([ x])\]\s+(.*)/);
			if (itemMatch) {
				currentPhase.items.push({
					checked: itemMatch[1] === "x",
					gate: currentGateType,
				});
			}
		}
	}
	if (currentPhase) phases.push(currentPhase);
	return phases;
}

const phases = parsePhases(content);

// Find the first phase that just became fully complete
// (all items checked, including gates)
for (const phase of phases) {
	const allChecked = phase.items.every((i) => i.checked);
	if (!allChecked) continue;

	// Check if the next phase has any unchecked items (meaning work hasn't started there yet)
	const nextPhase = phases.find((p) => p.number === phase.number + 1);
	if (nextPhase) {
		const nextHasUnchecked = nextPhase.items.some((i) => !i.checked);
		if (nextHasUnchecked) {
			// This phase is complete and next phase hasn't started
			const result = {
				hookSpecificOutput: {
					hookEventName: "PostToolUse",
				},
			};
			// Output reminder as JSON to stdout
			console.log(JSON.stringify(result));
			console.error(
				`Phase ${phase.number} (${phase.name}) is fully complete. Call advance_plan to validate gates before starting Phase ${nextPhase.number}.`,
			);
			process.exit(0);
		}
	}
}

process.exit(0);
