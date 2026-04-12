#!/usr/bin/env node
/**
 * PreToolUse hook: validates that impl phases have all four gate sections.
 *
 * Every phase must have: implementation items, Verification, OTel*, Context, Document.
 * Sections can opt out with (none needed), (not applicable), or skip-reason: {why}.
 *
 * *OTel section is conditional on the project's `otel.role` in .indusk/config.json:
 *   - unset or "service": OTel section is required (default behavior)
 *   - "library" / "tool" / "none": OTel section is NOT required (gate silenced)
 * This mirrors `shouldEmitOtelGate()` in apps/indusk-mcp/src/lib/config.ts.
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
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

/**
 * Find the project root by walking up from a starting directory looking for
 * a .indusk/ or .claude/ directory. Falls back to event.cwd if none found.
 * Mirrors the pattern used in check-catchup.js.
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
 * and checks otel.role. Returns true if the config is missing, if otel.role is
 * unset, or if otel.role is "service" — matches shouldEmitOtelGate() in
 * apps/indusk-mcp/src/lib/config.ts exactly.
 */
function shouldEmitOtelGate(projectRoot) {
	const configPath = `${projectRoot}/.indusk/config.json`;
	if (!existsSync(configPath)) return true;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const role = config?.otel?.role;
		return role === undefined || role === "service";
	} catch {
		return true; // on parse error, preserve default behavior
	}
}

const projectRoot = findProjectRoot(event.cwd ?? process.cwd());
const otelGateEnabled = shouldEmitOtelGate(projectRoot);

// Check for skip-gates escape hatch
const newContent = toolInput.new_string ?? toolInput.content ?? "";

// Read gate policy
function readGatePolicy() {
	// Check the content being written for a gate_policy in frontmatter
	const contentToCheck = toolInput.content ?? toolInput.new_string ?? "";
	const fmMatch = contentToCheck.match(/gate_policy:\s*(strict|ask|auto)/);
	if (fmMatch) return fmMatch[1];
	// Check existing file
	try {
		const existing = readFileSync(filePath, "utf-8");
		const existingFm = existing.match(/^---\n([\s\S]*?)\n---\n/);
		if (existingFm) {
			const m = existingFm[1].match(/gate_policy:\s*(strict|ask|auto)/);
			if (m) return m[1];
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
	return "ask";
}

const gatePolicy = readGatePolicy();

if (newContent.includes("<!-- skip-gates -->") && gatePolicy !== "strict") {
	process.exit(0);
}

// Determine the full new content after edit
let newFullContent;
if (event.tool_name === "Edit" && toolInput.old_string) {
	try {
		const diskContent = readFileSync(filePath, "utf-8");
		newFullContent = diskContent.replace(toolInput.old_string, newContent);
	} catch {
		// File doesn't exist yet — will be created by Write
		newFullContent = newContent;
	}
} else if (event.tool_name === "Write") {
	newFullContent = toolInput.content ?? "";
} else {
	process.exit(0);
}

// Only validate if this edit is adding/modifying phase structure
// Check if the edit contains phase headers
const editContent = toolInput.new_string ?? toolInput.content ?? "";
const hasPhaseHeader = /###\s+Phase\s+\d+/.test(editContent);
const hasChecklistItem = /- \[ \]/.test(editContent);

// If the edit doesn't touch phase structure, allow it
if (!hasPhaseHeader && !hasChecklistItem) {
	process.exit(0);
}

// Parse frontmatter to detect workflow type
const fmMatch = newFullContent.match(/^---\n([\s\S]*?)\n---\n/);
const frontmatter = fmMatch ? fmMatch[1] : "";
const body = fmMatch ? newFullContent.slice(fmMatch[0].length) : newFullContent;

// Detect workflow type from frontmatter (workflow: bugfix|refactor|feature)
// or infer from plan structure
const workflowMatch = frontmatter.match(/workflow:\s*(bugfix|refactor|feature|spike)/);
const workflow = workflowMatch ? workflowMatch[1] : "feature";

// Different workflows have different requirements.
// OTel is further gated on the project's `otel.role` in .indusk/config.json —
// libraries/tools/none opt out of the OTel gate entirely. Workflows that normally
// require OTel (feature, refactor) will only require it when otelGateEnabled is true.
const requirements = {
	feature: { verification: true, otel: otelGateEnabled, context: true, document: true },
	refactor: { verification: true, otel: otelGateEnabled, context: true, document: true },
	bugfix: { verification: true, otel: false, context: false, document: true },
	spike: { verification: false, otel: false, context: false, document: false },
}[workflow];
const lines = body.split("\n");

const phases = [];
let currentPhase = null;
let currentSection = "implementation";

for (const line of lines) {
	const phaseMatch = line.match(/^###\s+Phase\s+(\d+)[:\s]+(.*)/);
	if (phaseMatch) {
		if (currentPhase) phases.push(currentPhase);
		currentPhase = {
			number: parseInt(phaseMatch[1], 10),
			name: phaseMatch[2].trim(),
			hasImplementation: false,
			hasVerification: false,
			hasOtel: false,
			hasContext: false,
			hasDocument: false,
			verificationIsOptOut: false,
			otelIsOptOut: false,
			contextIsOptOut: false,
			documentIsOptOut: false,
		};
		currentSection = "implementation";
		continue;
	}

	if (!currentPhase) continue;

	// Detect gate section headers
	const verMatch = line.match(/^####\s+Phase\s+\d+\s+Verification\b/);
	if (verMatch) {
		currentPhase.hasVerification = true;
		currentSection = "verification";
		continue;
	}

	const otelMatch = line.match(/^####\s+Phase\s+\d+\s+OTel\b/);
	if (otelMatch) {
		currentPhase.hasOtel = true;
		currentSection = "otel";
		continue;
	}

	const ctxMatch = line.match(/^####\s+Phase\s+\d+\s+Context\b/);
	if (ctxMatch) {
		currentPhase.hasContext = true;
		currentSection = "context";
		continue;
	}

	const docMatch = line.match(/^####\s+Phase\s+\d+\s+Document\b/);
	if (docMatch) {
		currentPhase.hasDocument = true;
		currentSection = "document";
		continue;
	}

	// Check for implementation items
	if (currentSection === "implementation" && /^-\s+\[[ x]\]/.test(line)) {
		currentPhase.hasImplementation = true;
	}

	// Track opt-out content in gate sections
	const isOptOutLine =
		line.includes("(none needed)") ||
		line.includes("(not applicable)") ||
		line.includes("skip-reason:");
	if (currentPhase && isOptOutLine) {
		if (currentSection === "verification") currentPhase.verificationIsOptOut = true;
		if (currentSection === "otel") currentPhase.otelIsOptOut = true;
		if (currentSection === "context") currentPhase.contextIsOptOut = true;
		if (currentSection === "document") currentPhase.documentIsOptOut = true;
	}

	// Forward intelligence doesn't count as a gate
	if (line.match(/^####\s+Phase\s+\d+\s+Forward Intelligence\b/)) {
		currentSection = "fi";
	}
}
if (currentPhase) phases.push(currentPhase);

// Validate each phase
const errors = [];
for (const phase of phases) {
	if (!phase.hasImplementation) continue; // Skip phases with no impl items (might be a header-only outline)

	const missing = [];
	if (requirements.verification && !phase.hasVerification) missing.push("Verification");
	if (requirements.otel && !phase.hasOtel) missing.push("OTel");
	if (requirements.context && !phase.hasContext) missing.push("Context");
	if (requirements.document && !phase.hasDocument) missing.push("Document");

	if (missing.length > 0) {
		errors.push(`Phase ${phase.number} (${phase.name}) is missing: ${missing.join(", ")}`);
	}

	// In strict mode, opt-outs are not allowed — sections must have real items
	// In ask mode, opt-outs are not allowed at write time — every gate must have a real item
	// Opt-outs only happen during /work (execution time), not during /plan (write time)
	if (gatePolicy === "strict" || gatePolicy === "ask") {
		const optOuts = [];
		if (requirements.verification && phase.hasVerification && phase.verificationIsOptOut)
			optOuts.push("Verification");
		if (requirements.otel && phase.hasOtel && phase.otelIsOptOut) optOuts.push("OTel");
		if (requirements.context && phase.hasContext && phase.contextIsOptOut) optOuts.push("Context");
		if (requirements.document && phase.hasDocument && phase.documentIsOptOut)
			optOuts.push("Document");
		if (optOuts.length > 0) {
			const modeHint =
				gatePolicy === "strict"
					? "strict mode — no opt-outs allowed"
					: "ask mode — every gate must have a real item when the impl is written. Opt-outs happen during /work after asking the user";
			errors.push(
				`Phase ${phase.number} (${phase.name}): ${optOuts.join(", ")} cannot use opt-outs at write time (${modeHint})`,
			);
		}
	}
}

// ------------------------------------------------------------------
// Trajectory validation (tests-first-planning, Phase 1)
//
// Four additive rules run when either:
//   (a) frontmatter includes `trajectory: required`, OR
//   (b) the body contains a `## Test Trajectory` section
//
// Otherwise this section is skipped — grandfathered impls pass through.
//
// Rules:
//   1. trajectory-presence: `## Test Trajectory` section is present
//   2. cross-reference-integrity: phase Verification test-ID references exist in trajectory
//   3. temporal-coherence: every row has Writable at ≤ Passes at
//   4. deferred-completeness: every Deferred Verification row has reason, would require, mitigation
// ------------------------------------------------------------------

const trajectoryRequiredFrontmatter = /trajectory:\s*required/.test(frontmatter);
const hasTrajectoryHeading = /^##\s+Test Trajectory\b/m.test(body);
const trajectoryValidationEnabled = trajectoryRequiredFrontmatter || hasTrajectoryHeading;

if (trajectoryValidationEnabled) {
	const trajectoryErrors = validateTrajectory(body);
	if (trajectoryErrors.length > 0) {
		process.stderr.write(
			`Test Trajectory validation failed (policy: ${gatePolicy}):\n${trajectoryErrors.map((e) => `  [${e.rule}] ${e.message}`).join("\n")}\n\nSee .indusk/planning/tests-first-planning/adr.md Sections 3-6 for the Test Trajectory shape and validator rules.\n`,
		);
		process.exit(2);
	}
}

if (errors.length > 0) {
	const msg = errors.join("\n");
	const reqNames = Object.entries(requirements)
		.filter(([, v]) => v)
		.map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
	const skipHint =
		gatePolicy === "strict"
			? "Gate policy is 'strict' — all sections must have real items, no overrides.\n"
			: gatePolicy === "ask"
				? "Gate policy is 'ask' — every gate must have a real item when writing the impl. Opt-outs happen during /work after asking the user.\n"
				: "If a section isn't needed, add it with (none needed) or skip-reason: {why}\nExample: #### Phase 1 Document\\n(none needed)\n";
	process.stderr.write(
		`Impl structure incomplete (workflow: ${workflow}, policy: ${gatePolicy}):\n${msg}\n\nThis workflow requires: ${reqNames.join(", ")} sections per phase.\n${skipHint}To change requirements, add 'workflow: bugfix' to the impl frontmatter.\n`,
	);
	process.exit(2);
}

process.exit(0);

// ------------------------------------------------------------------
// Trajectory validation helpers (pure JS, mirrors
// apps/indusk-mcp/src/lib/trajectory/validator.ts and parser.ts)
// ------------------------------------------------------------------

function validateTrajectory(implBody) {
	const errors = [];

	// Rule 1: trajectory presence
	if (!/^##\s+Test Trajectory\b/m.test(implBody)) {
		errors.push({
			rule: "trajectory-presence",
			message:
				"Impl is missing the `## Test Trajectory` section. Every impl using the new shape must declare its tests at the top as a table with columns: ID | Asserts | Writable at | Passes at | State.",
		});
		return errors;
	}

	const trajectory = parseTrajectoryFromBody(implBody);
	errors.push(...validateCrossReferenceIntegrity(implBody, trajectory));
	errors.push(...validateTemporalCoherence(trajectory));
	errors.push(...validateDeferredCompleteness(trajectory));
	return errors;
}

function parseTrajectoryFromBody(implBody) {
	const lines = implBody.split("\n");
	let inTrajectory = false;
	let inDeferred = false;
	const tableLines = [];
	const deferredLines = [];

	for (const line of lines) {
		if (/^##\s+Test Trajectory\b/.test(line)) {
			inTrajectory = true;
			inDeferred = false;
			continue;
		}
		if (!inTrajectory) continue;

		if (/^###\s+Deferred Verification\b/.test(line)) {
			inDeferred = true;
			continue;
		}

		if (/^#{1,3}\s+/.test(line) && !/^###\s+Deferred Verification\b/.test(line)) {
			const depth = (line.match(/^(#{1,6})/) || ["", ""])[1].length;
			if (depth <= 3) break;
		}

		if (inDeferred) deferredLines.push(line);
		else tableLines.push(line);
	}

	return {
		rows: parseTrajectoryTable(tableLines),
		deferred: parseDeferredBlock(deferredLines),
	};
}

function parseTableRow(line) {
	const trimmed = line.trim();
	if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
	return trimmed
		.slice(1, -1)
		.split("|")
		.map((cell) => cell.trim());
}

function normalizeHeader(header) {
	const normalized = header.toLowerCase().replace(/\s+/g, " ").trim();
	const aliases = {
		id: "id",
		asserts: "asserts",
		"writable at": "writableAt",
		"passes at": "passesAt",
		state: "state",
		kind: "kind",
		scope: "scope",
	};
	return aliases[normalized] || normalized;
}

function parsePhaseRef(cell) {
	const match = cell.match(/^\s*Phase\s+(\d+)\s*$/i);
	return match ? Number.parseInt(match[1], 10) : Number.NaN;
}

function parseTrajectoryTable(lines) {
	const pipeLines = lines.filter((l) => l.trim().startsWith("|"));
	if (pipeLines.length < 2) return [];
	const header = parseTableRow(pipeLines[0]);
	const sep = parseTableRow(pipeLines[1]);
	if (!sep.every((c) => /^:?-+:?$/.test(c))) return [];
	const keys = header.map(normalizeHeader);

	const rows = [];
	for (let i = 2; i < pipeLines.length; i++) {
		const cells = parseTableRow(pipeLines[i]);
		if (cells.length !== keys.length) continue;
		const rec = {};
		for (let j = 0; j < keys.length; j++) rec[keys[j]] = cells[j];
		if (!rec.id || !rec.asserts) continue;
		rows.push({
			id: rec.id.trim(),
			asserts: rec.asserts.trim(),
			writableAt: parsePhaseRef(rec.writableAt || ""),
			passesAt: parsePhaseRef(rec.passesAt || ""),
		});
	}
	return rows;
}

function parseDeferredBlock(lines) {
	const rows = [];
	let current = null;
	const flush = () => {
		if (current && current.name !== undefined) {
			rows.push({
				name: current.name,
				reason: current.reason || "",
				wouldRequire: current.wouldRequire || "",
				mitigation: current.mitigation || "",
			});
		}
		current = null;
	};
	for (const rawLine of lines) {
		const line = rawLine.replace(/\s+$/, "");
		const nameMatch = line.match(/^-\s+\*\*(.+?)\*\*\s*(?:—\s*(.*))?$/);
		if (nameMatch) {
			flush();
			current = { name: nameMatch[1].trim() };
			const rest = nameMatch[2];
			if (rest) {
				const rm = rest.match(/reason:\s*([^—]+?)(?:\s*—|$)/i);
				const wm = rest.match(/would require:\s*([^—]+?)(?:\s*—|$)/i);
				const mm = rest.match(/mitigation:\s*(.+)$/i);
				if (rm) current.reason = rm[1].trim();
				if (wm) current.wouldRequire = wm[1].trim();
				if (mm) current.mitigation = mm[1].trim();
			}
			continue;
		}
		if (!current) continue;
		const subMatch = line.match(/^\s+-\s+(reason|would require|mitigation):\s*(.*)$/i);
		if (subMatch) {
			const key = subMatch[1].toLowerCase();
			const value = subMatch[2].trim();
			if (key === "reason") current.reason = value;
			else if (key === "would require") current.wouldRequire = value;
			else if (key === "mitigation") current.mitigation = value;
		}
	}
	flush();
	return rows;
}

function validateCrossReferenceIntegrity(implBody, trajectory) {
	const errors = [];
	const knownIds = new Set(trajectory.rows.map((r) => r.id));
	const allowed = new Set(["schema-only", "delete", "refactor", "infra"]);
	const noTestsRegex = /\(no tests flip at this phase\s*[—–-]+\s*reason:\s*([a-z-]+)\s*\)/i;
	const testIdPattern = /\bT\d+\b/g;

	const lines = implBody.split("\n");
	let currentPhase = null;
	let inVerification = false;
	let foundRef = false;
	let foundDecl = false;
	let itemCount = 0;

	const flushPhase = () => {
		if (currentPhase !== null && inVerification && itemCount > 0 && !foundRef && !foundDecl) {
			errors.push({
				rule: "cross-reference-integrity",
				message: `Phase ${currentPhase} Verification has no test ID references and no "(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})" declaration.`,
			});
		}
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const phaseMatch = line.match(/^###\s+Phase\s+(\d+)\b/);
		if (phaseMatch) {
			flushPhase();
			currentPhase = Number.parseInt(phaseMatch[1], 10);
			inVerification = false;
			foundRef = false;
			foundDecl = false;
			itemCount = 0;
			continue;
		}
		const verMatch = line.match(/^####\s+Phase\s+(\d+)\s+Verification\b/);
		if (verMatch && currentPhase !== null) {
			flushPhase();
			inVerification = true;
			foundRef = false;
			foundDecl = false;
			itemCount = 0;
			continue;
		}
		if (
			inVerification &&
			/^####\s+Phase\s+\d+\s+(OTel|Context|Document|Forward Intelligence)\b/.test(line)
		) {
			flushPhase();
			inVerification = false;
			continue;
		}
		if (inVerification) {
			const item = line.match(/^-\s+\[[ xX]\]\s+(.*)/);
			if (item) {
				itemCount++;
				const text = item[1];
				const noTests = text.match(noTestsRegex);
				if (noTests) {
					foundDecl = true;
					const reason = noTests[1].toLowerCase();
					if (!allowed.has(reason)) {
						errors.push({
							rule: "cross-reference-integrity",
							line: i + 1,
							message: `Phase ${currentPhase} Verification: "(no tests flip at this phase — reason: ${reason})" uses disallowed reason. Allowed: schema-only, delete, refactor, infra.`,
						});
					}
					continue;
				}
				const ids = text.match(testIdPattern);
				if (ids) {
					foundRef = true;
					for (const id of ids) {
						if (!knownIds.has(id)) {
							errors.push({
								rule: "cross-reference-integrity",
								line: i + 1,
								message: `Phase ${currentPhase} Verification references test ID \`${id}\` but no such row exists in the Test Trajectory table.`,
							});
						}
					}
				}
			}
		}
	}
	flushPhase();
	return errors;
}

function validateTemporalCoherence(trajectory) {
	const errors = [];
	for (const row of trajectory.rows) {
		if (!Number.isFinite(row.writableAt)) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has invalid "Writable at" — expected "Phase N" where N is a number.`,
			});
			continue;
		}
		if (!Number.isFinite(row.passesAt)) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has invalid "Passes at" — expected "Phase N" where N is a number.`,
			});
			continue;
		}
		if (row.writableAt > row.passesAt) {
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has "Writable at" Phase ${row.writableAt} > "Passes at" Phase ${row.passesAt}. A test cannot pass before its dependencies exist.`,
			});
		}
	}
	return errors;
}

function validateDeferredCompleteness(trajectory) {
	const errors = [];
	for (const row of trajectory.deferred) {
		const missing = [];
		if (!row.reason) missing.push("reason");
		if (!row.wouldRequire) missing.push("would require");
		if (!row.mitigation) missing.push("mitigation");
		if (missing.length > 0) {
			errors.push({
				rule: "deferred-completeness",
				message: `Deferred Verification row "${row.name}" is missing: ${missing.join(", ")}. Every deferred row requires all three fields — reason, would require, mitigation.`,
			});
		}
	}
	return errors;
}
