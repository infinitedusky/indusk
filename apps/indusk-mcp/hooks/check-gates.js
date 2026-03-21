#!/usr/bin/env node
/**
 * PreToolUse hook: blocks phase transitions in impl.md when gates are incomplete.
 *
 * Exit 0 = allow the edit
 * Exit 2 = block the edit (stderr sent to agent as feedback)
 */

import { readFileSync } from "node:fs";

// Read hook input from stdin
let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const toolInput = event.tool_input ?? {};

// Determine file path based on tool type
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

// Check for skip-gates escape hatch
const newContent = toolInput.new_string ?? toolInput.content ?? "";
if (newContent.includes("<!-- skip-gates -->")) {
	process.exit(0);
}

// Detect checkbox transition: - [ ] → - [x]
const oldContent = toolInput.old_string ?? "";

// For Edit tool: check if old_string has unchecked and new_string has checked
// For Write tool: we need to compare with the file on disk
let hasCheckboxTransition = false;

if (event.tool_name === "Edit" && oldContent && newContent) {
	const oldUnchecked = (oldContent.match(/- \[ \]/g) || []).length;
	const newUnchecked = (newContent.match(/- \[ \]/g) || []).length;
	const oldChecked = (oldContent.match(/- \[x\]/g) || []).length;
	const newChecked = (newContent.match(/- \[x\]/g) || []).length;
	hasCheckboxTransition = newChecked > oldChecked || newUnchecked < oldUnchecked;
} else if (event.tool_name === "Write") {
	// For Write, compare with file on disk
	try {
		const diskContent = readFileSync(filePath, "utf-8");
		const diskChecked = (diskContent.match(/- \[x\]/g) || []).length;
		const writeChecked = (newContent.match(/- \[x\]/g) || []).length;
		hasCheckboxTransition = writeChecked > diskChecked;
	} catch {
		// File doesn't exist yet — new impl, allow
		process.exit(0);
	}
}

if (!hasCheckboxTransition) {
	process.exit(0);
}

// Parse the impl file to understand phase structure
// Read the full file to get current state, then apply the edit mentally
let fullContent;
try {
	fullContent = readFileSync(filePath, "utf-8");
} catch {
	process.exit(0);
}

// For Edit, apply the edit to get the new full content
let newFullContent;
if (event.tool_name === "Edit" && oldContent) {
	newFullContent = fullContent.replace(oldContent, newContent);
} else if (event.tool_name === "Write") {
	newFullContent = newContent;
} else {
	process.exit(0);
}

// Parse phases from the NEW content (after edit) and OLD content (before edit)
function parsePhases(content) {
	// Strip frontmatter
	const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/);
	const body = fmMatch ? content.slice(fmMatch[0].length) : content;

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

		// Forward intelligence — skip
		if (line.match(/^####\s+Phase\s+\d+\s+Forward Intelligence\b/)) {
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

const oldPhases = parsePhases(fullContent);
const newPhases = parsePhases(newFullContent);

// Find which items were just checked (were unchecked before, checked now)
const newlyChecked = [];
for (let pi = 0; pi < newPhases.length; pi++) {
	const newPhase = newPhases[pi];
	const oldPhase = oldPhases[pi];
	if (!oldPhase) continue;

	for (let ii = 0; ii < newPhase.items.length; ii++) {
		const newItem = newPhase.items[ii];
		const oldItem = oldPhase.items[ii];
		if (!oldItem) continue;

		if (newItem.checked && !oldItem.checked) {
			newlyChecked.push({
				phase: newPhase.number,
				phaseName: newPhase.name,
				text: newItem.text,
				gate: newItem.gate,
			});
		}
	}
}

if (newlyChecked.length === 0) {
	process.exit(0);
}

// For each newly checked item: if it's an implementation item,
// check that all PREVIOUS phases have complete gates
for (const item of newlyChecked) {
	// Checking gate items is always allowed
	if (item.gate !== "implementation") continue;

	// Check all phases before this item's phase
	for (const phase of oldPhases) {
		if (phase.number >= item.phase) break;

		const uncheckedGates = phase.items.filter(
			(i) =>
				!i.checked && (i.gate === "verification" || i.gate === "context" || i.gate === "document"),
		);

		if (uncheckedGates.length > 0) {
			const missing = uncheckedGates.map((i) => `  [${i.gate}] ${i.text}`).join("\n");
			process.stderr.write(
				`Phase ${item.phase} blocked: complete Phase ${phase.number} gates first:\n${missing}\n`,
			);
			process.exit(2);
		}
	}
}

// All checks passed
process.exit(0);
