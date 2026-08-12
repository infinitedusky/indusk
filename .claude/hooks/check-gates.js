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
import { resolveStateAndGitPaths } from "./_hook-paths.js";
import {
	FORWARD_INTELLIGENCE_HEADING,
	fencedLineMask,
	gateHeading,
	parsePhaseHeading,
	parsePhaseRef,
	phaseExists,
	phaseOrdinal,
	phaseSequence,
} from "./_impl-headings.js";

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
 * Whether the OTel gate should fire for this project. Reads .indusk/config.json
 * and checks otel.role. Returns true if missing/unset/"service", false for
 * library/tool/none. Mirrors shouldEmitOtelGate() in apps/indusk-mcp/src/lib/config.ts.
 */
function shouldEmitOtelGate(statePath) {
	const configPath = `${statePath}/.indusk/config.json`;
	if (!existsSync(configPath)) return true;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const role = config?.otel?.role;
		return role === undefined || role === "service";
	} catch {
		return true;
	}
}

// Workbench-aware state resolution (1.31.7). statePath is where .indusk/ lives.
const { statePath: resolvedStatePath } = resolveStateAndGitPaths(event.cwd ?? process.cwd());
const statePath = resolvedStatePath ?? event.cwd ?? process.cwd();
const otelGateEnabled = shouldEmitOtelGate(statePath);

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
	// Fenced blocks are content, not structure — a deferral may carry the
	// deferred test's body, which contains checkbox- and heading-shaped lines.
	const fenced = fencedLineMask(lines);
	const phases = [];
	let currentPhase = null;
	let currentGateType = "implementation";

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (fenced[lineIndex]) continue;

		const phaseMatch = parsePhaseHeading(line);
		if (phaseMatch) {
			if (currentPhase) phases.push(currentPhase);
			currentPhase = {
				number: phaseMatch.number,
				kind: phaseMatch.kind,
				// Position in the document — the only thing that orders two
				// independently-numbered sequences.
				ordinal: phases.length,
				name: phaseMatch.name,
				items: [],
			};
			currentGateType = "implementation";
			continue;
		}

		// [1] is the phase number, [2] the gate kind — see gateHeading().
		const gateMatch = line.match(gateHeading("(Verification|OTel|Context|Document)"));
		if (gateMatch) {
			currentGateType = gateMatch[2].toLowerCase();
			continue;
		}

		// Forward intelligence — skip
		if (line.match(FORWARD_INTELLIGENCE_HEADING)) {
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

/** Name a phase unambiguously: the two sequences share their digits. */
function phaseLabel(kind, number) {
	return `${kind === "test" ? "Test " : ""}Phase ${number}`;
}

const workflow = detectWorkflow(fullContent);
const requiredGates = WORKFLOW_GATES[workflow] || WORKFLOW_GATES.feature;
const oldPhases = parsePhases(fullContent);
const newPhases = parsePhases(newFullContent);

// ------------------------------------------------------------------
// Zero-parsed-phases rejection.
//
// Control flow below is driven entirely by `newlyChecked`, which is derived
// from parsed phases — so an incoming edit in which no heading parses produces
// an empty list and every gate is skipped. A checkoff arriving alongside a
// broken heading is exactly the shape of that hazard, and it currently exits 0.
//
// This fires only when the incoming content *checks something off* (the caller
// already established a checkbox transition) and still yields no phase: work
// is being claimed as done, and no phase can be held responsible for it.
// ------------------------------------------------------------------
if (newPhases.length === 0) {
	process.stderr.write(
		"Gate check refused: an item was checked off but no phase heading parses in impl.md, " +
			"so no gate could be evaluated. Expected `### Test Phase N: Name`, " +
			"`### Build Phase N: Name`, or `### Phase N: Name`. Check for a typo in a heading.\n",
	);
	process.exit(2);
}

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
				phaseKind: newPhase.kind,
				ordinal: newPhase.ordinal,
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

// Trajectory gates run BEFORE the gate-completeness loop, deliberately.
// Both violations can be present at once — an unauthored test is usually WHY
// a test phase's gate is still open — and the hook reports the first one it
// finds. Reporting "complete Phase 1 gates first" when the cause is a test
// that was never written sends the reader to the symptom; reporting the
// test-first violation sends them to the cause, and fixing the cause clears
// the symptom.

const hasTrajectorySection = /^##\s+Test Trajectory\b/m.test(newFullContent);
if (hasTrajectorySection) {
	const advancingPhases = new Set();
	// Two things advance the test-first obligation: starting build work, and
	// closing a test phase. The second is new — a test phase's items ARE the
	// authoring, so its Verification gate is the moment it claims to be done,
	// and a test phase that can close with unwritten tests has nothing to
	// review, which is the compensating control the whole register rests on.
	for (const item of newlyChecked) {
		if (item.gate === "implementation") advancingPhases.add(item);
		else if (item.gate === "verification" && item.phaseKind === "test") advancingPhases.add(item);
	}

	if (advancingPhases.size > 0) {
		const trajectory = parseTrajectoryFromBody(newFullContent);
		const sequence = phaseSequence(newFullContent);

		// Gate A: test-first authoring, at or before the advancing phase.
		//
		// The comparison used to be `===`, which meant a row was asked about at
		// exactly one moment: miss it and no later phase ever asks again. That
		// is how five rows in `lifecycle-rebalance` were authored four phases
		// late with nothing objecting. Worse, `advancingPhase` is never 0, so
		// `Writable at: Phase 0` — 260 of 444 rows across this repo — could
		// never match at all, and the DEFAULT path of the test-first rule was
		// unenforced by construction.
		//
		// `<=` on the document timeline fixes both: a row due earlier and still
		// unwritten blocks every subsequent checkoff until it is authored.
		const testFirstBlockers = [];
		for (const advancing of advancingPhases) {
			const advancingOrdinal = phaseOrdinal(
				{ kind: advancing.phaseKind, number: advancing.phase },
				sequence,
			);
			const unauthored = trajectory.rows.filter(
				(row) =>
					// A row can only be *late* for a phase the document contains.
					// One naming a phase nobody has written yet is a forward
					// reference, not a missed obligation. `Phase 0` counts as
					// present by definition — it is where the 260 unenforceable
					// rows live, and it is the whole point of this correction.
					phaseExists({ kind: row.writableAtKind, number: row.writableAt }, sequence) &&
					phaseOrdinal({ kind: row.writableAtKind, number: row.writableAt }, sequence) <=
						advancingOrdinal &&
					row.state !== "written" &&
					row.state !== "passing" &&
					row.state !== "skipped" &&
					row.state !== "blocked",
			);
			for (const row of unauthored) {
				testFirstBlockers.push({ advancing, row });
			}
		}

		if (testFirstBlockers.length > 0) {
			const rowLabel = (row) =>
				`${row.writableAtKind === "test" ? "Test " : ""}Phase ${row.writableAt}`;
			const msg = testFirstBlockers
				.map(
					(b) =>
						`${phaseLabel(b.advancing.phaseKind, b.advancing.phase)} test-first violation: row ${b.row.id} is Writable at: ${rowLabel(b.row)} but still ${b.row.state}. Author it as RED before marking work at or after that phase done.`,
				)
				.join("\n");
			process.stderr.write(`${msg}\n`);
			process.exit(2);
		}

		// Gate B: every prior phase must be closable.
		//
		// Expressed over the document timeline rather than by counting from 1:
		// with two sequences there is no "phase 1..N-1" to count through, and
		// the phases that must be closed are simply the ones that come earlier
		// in the document than the phase being advanced.
		const allBlockers = [];
		for (const advancing of advancingPhases) {
			const advancingOrdinal = phaseOrdinal(
				{ kind: advancing.phaseKind, number: advancing.phase },
				sequence,
			);
			for (const row of trajectory.rows) {
				const ref = { kind: row.passesAtKind, number: row.passesAt };
				if (!phaseExists(ref, sequence)) continue;
				const passesOrdinal = phaseOrdinal(ref, sequence);
				if (passesOrdinal >= advancingOrdinal) continue;
				if (row.state !== "passing" && row.state !== "skipped" && row.state !== "blocked") {
					allBlockers.push({ ref, row });
				}
			}
		}

		if (allBlockers.length > 0) {
			const msg = allBlockers
				.map(
					(b) =>
						`  [${b.row.id}] ${b.row.asserts} — state: ${b.row.state} (${phaseLabel(b.ref.kind, b.ref.number)} cannot close until this row is 'passing' or 'skipped')`,
				)
				.join("\n");
			process.stderr.write(
				`Trajectory blocks phase advance (policy: ${gatePolicy}):\n${msg}\n\nEvery trajectory row with 'Passes at: Phase N' must be 'passing', 'skipped', or 'blocked' before advancing past Phase N. See .indusk/planning/tests-first-planning/adr.md Section 6.\n`,
			);
			process.exit(2);
		}
	}
}

// For each newly checked item: if it's an implementation item,
// check that all PREVIOUS phases have complete gates
for (const item of newlyChecked) {
	// Checking gate items is always allowed
	if (item.gate !== "implementation") continue;

	// Check all phases before this item's phase. Ordered by document position:
	// with two sequences numbering independently, `Test Phase 1` and `Build
	// Phase 1` both report number 1, so a number comparison would let build
	// work start while the test phase that authors its tests is still open.
	for (const phase of oldPhases) {
		if (phase.ordinal >= item.ordinal) break;

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
				`${phaseLabel(item.phaseKind, item.phase)} blocked (policy: ${gatePolicy}): complete ${phaseLabel(phase.kind, phase.number)} gates first:\n${missing}\n${skipHint}`,
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
		// Through the shared parser, not a local regex. This was an eighth copy
		// of the phase-reference pattern, found only because Gate A silently
		// stopped firing: it could not read `Test Phase 1`, so every row parsed
		// as NaN and no row ever matched. A duplicated pattern does not announce
		// itself when it falls behind — it just stops enforcing.
		const writable = parsePhaseRef(rec.writableAt || "");
		const passes = parsePhaseRef(rec.passesAt || "");
		rows.push({
			id: rec.id.trim(),
			asserts: (rec.asserts || "").trim(),
			writableAt: writable ? writable.number : Number.NaN,
			passesAt: passes ? passes.number : Number.NaN,
			writableAtKind: writable ? writable.kind : "build",
			passesAtKind: passes ? passes.kind : "build",
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
