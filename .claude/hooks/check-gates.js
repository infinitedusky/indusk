#!/usr/bin/env node
/**
 * PreToolUse hook: blocks phase transitions in impl.md when gates are incomplete.
 *
 * The OTel gate is conditional on the project's `otel.role` in .indusk/config.json:
 *   - unset or "service": OTel gate is enforced (default)
 *   - "library" / "tool" / "none": OTel gate is silenced (mirrors validate-impl-structure)
 *
 * Exit 0 = allow the edit
 * Exit 2 = block the edit (stderr sent to agent as feedback)
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

// Read gate policy from the impl file and settings
function readGatePolicy() {
	try {
		const content = readFileSync(filePath, "utf-8");
		const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
		if (fmMatch) {
			const policyMatch = fmMatch[1].match(/gate_policy:\s*(strict|ask|auto)/);
			if (policyMatch) return policyMatch[1];
		}
	} catch {
		// ignore
	}
	// Check project settings
	try {
		const settingsPath = `${event.cwd}/.claude/settings.json`;
		const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		if (settings.indusk?.gate_policy) return settings.indusk.gate_policy;
	} catch {
		// ignore
	}
	return "ask"; // default
}

const gatePolicy = readGatePolicy();

// In strict mode, skip-gates escape hatch is not allowed
if (newContent.includes("<!-- skip-gates -->") && gatePolicy !== "strict") {
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

// Detect workflow type from content frontmatter
function detectWorkflow(content) {
	const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
	const fm = fmMatch ? fmMatch[1] : "";
	const m = fm.match(/workflow:\s*(bugfix|refactor|feature|spike)/);
	return m ? m[1] : "feature";
}

/**
 * Find the project root by walking up from a starting directory looking for
 * a .indusk/ or .claude/ directory. Falls back to startDir if none found.
 */
function findProjectRoot(startDir) {
	let dir = startDir;
	for (let i = 0; i < 10; i++) {
		if (existsSync(`${dir}/.indusk`) || existsSync(`${dir}/.claude`)) return dir;
		const parent = resolve(dir, "..");
		if (parent === dir) break;
		dir = parent;
	}
	return startDir;
}

/**
 * Whether the OTel gate should fire for this project. Reads .indusk/config.json
 * and checks otel.role. Returns true if missing/unset/"service", false for
 * library/tool/none. Mirrors shouldEmitOtelGate() in apps/indusk-mcp/src/lib/config.ts.
 */
function shouldEmitOtelGate(projectRoot) {
	const configPath = `${projectRoot}/.indusk/config.json`;
	if (!existsSync(configPath)) return true;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const role = config?.otel?.role;
		return role === undefined || role === "service";
	} catch {
		return true;
	}
}

const projectRoot = findProjectRoot(event.cwd ?? process.cwd());
const otelGateEnabled = shouldEmitOtelGate(projectRoot);

// Which gate types are required per workflow.
// OTel is filtered out below when the project opts out via otel.role.
const WORKFLOW_GATES_BASE = {
	feature: ["verification", "otel", "context", "document"],
	refactor: ["verification", "otel", "context", "document"],
	bugfix: ["verification", "document"],
	spike: [],
};

const WORKFLOW_GATES = Object.fromEntries(
	Object.entries(WORKFLOW_GATES_BASE).map(([wf, gates]) => [
		wf,
		otelGateEnabled ? gates : gates.filter((g) => g !== "otel"),
	]),
);

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

		const gateMatch = line.match(/^####\s+Phase\s+\d+\s+(Verification|OTel|Context|Document)\b/);
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

const workflow = detectWorkflow(fullContent);
const requiredGates = WORKFLOW_GATES[workflow] || WORKFLOW_GATES.feature;
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

		const isOverridden = (text) => {
			if (gatePolicy === "strict") return false;

			const hasBareOptOut =
				text.includes("(none needed)") ||
				text.includes("(not applicable)") ||
				text.includes("skip-reason:");

			if (gatePolicy === "auto") return hasBareOptOut;

			// ask mode: requires conversation proof
			// Format: (none needed — asked: "{question}" — user: "{answer}")
			const hasConversationProof =
				/\(none needed\s*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"\)/.test(text) ||
				/\(not applicable\s*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"\)/.test(text) ||
				/skip-reason:.*—\s*asked:\s*"[^"]+"\s*—\s*user:\s*"[^"]+"/.test(text);

			return hasConversationProof;
		};

		const uncheckedGates = phase.items.filter(
			(i) => !i.checked && !isOverridden(i.text) && requiredGates.includes(i.gate),
		);

		if (uncheckedGates.length > 0) {
			const missing = uncheckedGates.map((i) => `  [${i.gate}] ${i.text}`).join("\n");
			const skipHint =
				gatePolicy === "strict"
					? "Gate policy is 'strict' — no overrides allowed.\n"
					: gatePolicy === "ask"
						? 'Gate policy is \'ask\' — to skip, you must ask the user and include proof.\nFormat: (none needed — asked: "your question" — user: "their answer")\n'
						: "To skip a gate item, mark with (none needed) or skip-reason: {why}\n";
			process.stderr.write(
				`Phase ${item.phase} blocked (policy: ${gatePolicy}): complete Phase ${phase.number} gates first:\n${missing}\n${skipHint}`,
			);
			process.exit(2);
		}
	}
}

// ------------------------------------------------------------------
// Trajectory enforcement: if advancing past Phase N (checking an
// implementation item in Phase N+1 or later), every trajectory row
// with `Passes at: Phase K` where K <= N must be in state `passing`,
// `skipped`, or `blocked`. Planned/writable/written states fail the
// phase close — the whole point of the tests-first-planning system is
// that deferral is structurally impossible.
//
// Skipped if the impl has no `## Test Trajectory` section (grandfathered).
// ------------------------------------------------------------------

const hasTrajectorySection = /^##\s+Test Trajectory\b/m.test(newFullContent);
if (hasTrajectorySection) {
	const advancingPhases = new Set();
	for (const item of newlyChecked) {
		if (item.gate === "implementation") advancingPhases.add(item.phase);
	}

	if (advancingPhases.size > 0) {
		const trajectory = parseTrajectoryFromBody(newFullContent);
		const allBlockers = [];
		for (const advancingPhase of advancingPhases) {
			// Closing phases = every phase strictly before advancingPhase
			for (let closingPhase = 1; closingPhase < advancingPhase; closingPhase++) {
				const blockers = trajectory.rows.filter(
					(row) =>
						row.passesAt === closingPhase &&
						row.state !== "passing" &&
						row.state !== "skipped" &&
						row.state !== "blocked",
				);
				for (const row of blockers) {
					allBlockers.push({ phase: closingPhase, row });
				}
			}
		}

		if (allBlockers.length > 0) {
			const msg = allBlockers
				.map(
					(b) =>
						`  [${b.row.id}] ${b.row.asserts} — state: ${b.row.state} (Phase ${b.phase} cannot close until this row is 'passing' or 'skipped')`,
				)
				.join("\n");
			process.stderr.write(
				`Trajectory blocks phase advance (policy: ${gatePolicy}):\n${msg}\n\nEvery trajectory row with 'Passes at: Phase N' must be 'passing', 'skipped', or 'blocked' before advancing past Phase N. See .indusk/planning/tests-first-planning/adr.md Section 6.\n`,
			);
			process.exit(2);
		}
	}
}

// All checks passed
process.exit(0);

// ------------------------------------------------------------------
// Trajectory parser (pure JS, mirrors parser.ts — simplified to read
// just id, passesAt, and state which is all this hook needs).
// ------------------------------------------------------------------

function parseTrajectoryFromBody(implContent) {
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
		if (/^#{1,3}\s+/.test(line) && !/^###\s+Deferred Verification\b/.test(line)) {
			const depth = (line.match(/^(#{1,6})/) || ["", ""])[1].length;
			if (depth <= 3) break;
		}
		if (/^###\s+Deferred Verification\b/.test(line)) break;
		tableLines.push(line);
	}

	const pipeLines = tableLines.filter((l) => l.trim().startsWith("|"));
	if (pipeLines.length < 2) return { rows: [] };
	const header = parseRowCells(pipeLines[0]);
	const sep = parseRowCells(pipeLines[1]);
	if (!sep.every((c) => /^:?-+:?$/.test(c))) return { rows: [] };

	const keys = header.map((h) => {
		const n = h.toLowerCase().trim();
		if (n === "id") return "id";
		if (n === "passes at") return "passesAt";
		if (n === "state") return "state";
		if (n === "writable at") return "writableAt";
		if (n === "asserts") return "asserts";
		return n;
	});

	const rows = [];
	for (let i = 2; i < pipeLines.length; i++) {
		const cells = parseRowCells(pipeLines[i]);
		if (cells.length !== keys.length) continue;
		const rec = {};
		for (let j = 0; j < keys.length; j++) rec[keys[j]] = cells[j];
		if (!rec.id) continue;
		const passesMatch = (rec.passesAt || "").match(/^\s*Phase\s+(\d+)\s*$/i);
		rows.push({
			id: rec.id.trim(),
			asserts: (rec.asserts || "").trim(),
			passesAt: passesMatch ? Number.parseInt(passesMatch[1], 10) : Number.NaN,
			state: (rec.state || "").toLowerCase().trim(),
		});
	}
	return { rows };
}

function parseRowCells(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((c) => c.trim());
}
