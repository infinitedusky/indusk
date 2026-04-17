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
			// Add trajectory nudges if applicable
			const trajectory = parseTrajectoryRows(content);
			if (trajectory.rows.length > 0) {
				const startNudge = writableAtNudge(trajectory, nextPhase.number);
				if (startNudge) console.error(`\n${startNudge}`);
			}
			process.exit(0);
		}
	}
}

// Additional nudge: if any phase is mid-execution (some items checked, some not)
// and has trajectory rows blocking close, warn about them.
const trajectory = parseTrajectoryRows(content);
if (trajectory.rows.length > 0) {
	for (const phase of phases) {
		const anyChecked = phase.items.some((i) => i.checked);
		const allChecked = phase.items.every((i) => i.checked);
		if (!anyChecked || allChecked) continue;
		const blockers = trajectory.rows.filter(
			(row) =>
				row.passesAt === phase.number &&
				row.state !== "passing" &&
				row.state !== "skipped" &&
				row.state !== "blocked",
		);
		if (blockers.length > 0) {
			const lines = blockers.map((r) => `  [${r.id}] ${r.asserts} — state: ${r.state}`);
			console.error(
				`Phase ${phase.number} trajectory rows still not passing (will block phase close):\n${lines.join("\n")}`,
			);
			break; // one nudge per hook invocation
		}
	}
}

process.exit(0);

// ------------------------------------------------------------------
// Trajectory parsing (minimal — just id, passesAt, state)
// ------------------------------------------------------------------

function parseTrajectoryRows(implContent) {
	const fmMatch = implContent.match(/^---\n[\s\S]*?\n---\n/);
	const body = fmMatch ? implContent.slice(fmMatch[0].length) : implContent;
	const lines = body.split("\n");

	let inTrajectory = false;
	const tableLines = [];
	for (const line of lines) {
		if (/^##\s+Test Trajectory\b/.test(line)) {
			inTrajectory = true;
			continue;
		}
		if (!inTrajectory) continue;
		if (/^###\s+Deferred Verification\b/.test(line)) break;
		if (/^#{1,3}\s+/.test(line)) {
			const depth = (line.match(/^(#{1,6})/) || ["", ""])[1].length;
			if (depth <= 3) break;
		}
		tableLines.push(line);
	}

	const pipeLines = tableLines.filter((l) => l.trim().startsWith("|"));
	if (pipeLines.length < 2) return { rows: [] };
	const header = parseRow(pipeLines[0]);
	const sep = parseRow(pipeLines[1]);
	if (!sep.every((c) => /^:?-+:?$/.test(c))) return { rows: [] };

	const keys = header.map((h) => {
		const n = h.toLowerCase().trim();
		if (n === "id") return "id";
		if (n === "writable at") return "writableAt";
		if (n === "passes at") return "passesAt";
		if (n === "state") return "state";
		if (n === "asserts") return "asserts";
		return n;
	});

	const rows = [];
	for (let i = 2; i < pipeLines.length; i++) {
		const cells = parseRow(pipeLines[i]);
		if (cells.length !== keys.length) continue;
		const rec = {};
		for (let j = 0; j < keys.length; j++) rec[keys[j]] = cells[j];
		if (!rec.id) continue;
		const w = (rec.writableAt || "").match(/^\s*Phase\s+(\d+)\s*$/i);
		const p = (rec.passesAt || "").match(/^\s*Phase\s+(\d+)\s*$/i);
		rows.push({
			id: rec.id.trim(),
			asserts: (rec.asserts || "").trim(),
			writableAt: w ? Number.parseInt(w[1], 10) : Number.NaN,
			passesAt: p ? Number.parseInt(p[1], 10) : Number.NaN,
			state: (rec.state || "").toLowerCase().trim(),
		});
	}
	return { rows };
}

function parseRow(line) {
	const t = line.trim();
	if (!t.startsWith("|") || !t.endsWith("|")) return [];
	return t
		.slice(1, -1)
		.split("|")
		.map((c) => c.trim());
}

function writableAtNudge(trajectory, phase) {
	const rows = trajectory.rows.filter(
		(r) =>
			r.writableAt === phase && (r.state === "planned" || r.state === "writable" || r.state === ""),
	);
	if (rows.length === 0) return null;
	const lines = rows.map((r) => `  [${r.id}] ${r.asserts}`);
	return `Phase ${phase} opens with these tests to author (commit as failing before implementation work):\n${lines.join("\n")}`;
}
