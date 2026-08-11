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
import { dirname } from "node:path";
import { resolveStateAndGitPaths } from "./_hook-paths.js";
import {
	ANY_PHASE_HEADING,
	ANY_PHASE_HEADING_LOOSE,
	FORWARD_INTELLIGENCE_HEADING,
	gateHeading,
	PHASE_HEADING,
	parsePhaseRef,
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
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

/**
 * Resolve the state path for the file being edited. Prefer walking up from
 * the file's own directory — the file being edited is always inside the
 * project, and its directory chain reliably contains `.indusk/` even when
 * `event.cwd` is set to something unrelated by the calling environment
 * (observed from the Claude Code VS Code extension on impl edits). Falls
 * back to `event.cwd` and finally `process.cwd()`.
 *
 * Workbench-aware (1.31.7): uses the shared `resolveStateAndGitPaths` helper.
 * This hook only needs statePath (no git operations), so gitPath is discarded.
 */
function resolveStatePath(filePath, eventCwd) {
	if (filePath) {
		const { statePath } = resolveStateAndGitPaths(dirname(filePath));
		if (statePath) return statePath;
	}
	const { statePath } = resolveStateAndGitPaths(eventCwd ?? process.cwd());
	return statePath ?? eventCwd ?? process.cwd();
}

/**
 * Whether the OTel gate should fire for this project. Reads .indusk/config.json
 * and checks otel.role. Returns true if the config is missing, if otel.role is
 * unset, or if otel.role is "service" — matches shouldEmitOtelGate() in
 * apps/indusk-mcp/src/lib/config.ts exactly.
 */
function shouldEmitOtelGate(statePath) {
	const configPath = `${statePath}/.indusk/config.json`;
	if (!existsSync(configPath)) return true;
	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8"));
		const role = config?.otel?.role;
		return role === undefined || role === "service";
	} catch {
		return true; // on parse error, preserve default behavior
	}
}

const statePath = resolveStatePath(filePath, event.cwd);
const otelGateEnabled = shouldEmitOtelGate(statePath);

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
const hasPhaseHeader = ANY_PHASE_HEADING_LOOSE.test(editContent);
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
	const phaseMatch = line.match(PHASE_HEADING);
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
	const verMatch = line.match(gateHeading("Verification"));
	if (verMatch) {
		currentPhase.hasVerification = true;
		currentSection = "verification";
		continue;
	}

	const otelMatch = line.match(gateHeading("OTel"));
	if (otelMatch) {
		currentPhase.hasOtel = true;
		currentSection = "otel";
		continue;
	}

	const ctxMatch = line.match(gateHeading("Context"));
	if (ctxMatch) {
		currentPhase.hasContext = true;
		currentSection = "context";
		continue;
	}

	const docMatch = line.match(gateHeading("Document"));
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
	if (line.match(FORWARD_INTELLIGENCE_HEADING)) {
		currentSection = "fi";
	}
}
if (currentPhase) phases.push(currentPhase);

// ------------------------------------------------------------------
// Zero-parsed-phases rejection.
//
// Every structural rule below is keyed on parsed phases, so when none parse
// there is nothing to enforce against and the write sails through. A typo in a
// heading therefore does not fail — it silently disables the entire validator,
// which is the worst possible failure mode for a change that alters what a
// heading looks like.
//
// The condition is deliberately "there is work here and no phase claims it",
// not merely "no phases": a plan mid-authoring legitimately has frontmatter
// and prose before its first phase exists, and refusing that would block the
// document from ever being written.
// ------------------------------------------------------------------
const bodyHasChecklistItems = /^\s*-\s+\[[ xX]\]/m.test(body);
if (phases.length === 0 && bodyHasChecklistItems) {
	process.stderr.write(
		"Impl structure invalid: the document has checklist items but no phase heading parses, " +
			"so every structural rule would be skipped silently.\n" +
			"Expected `### Test Phase N: Name`, `### Build Phase N: Name`, or `### Phase N: Name` " +
			"(the last two are the same thing). Check for a typo in a heading.\n",
	);
	process.exit(2);
}

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
const rationaleRequiredFrontmatter = /rationale:\s*required/.test(frontmatter);
// Anchor to start-of-line within frontmatter (m flag) so the key is only matched
// when it appears as a top-level YAML key — NOT when its name appears as a
// substring inside a quoted value (e.g., a `title:` mentioning the key).
// Surfaced by /falsify hypothesis 1: a documentation plan whose title contained
// the literal `rationale_baseline: 1` silently inherited that baseline from the
// title's substring. See .indusk/planning/rationale-baseline-frontmatter/falsification.md.
const rationaleBaselineMatch = frontmatter.match(/^rationale_baseline:\s*(\d+)/m);
const rationaleBaseline = rationaleBaselineMatch
	? Number.parseInt(rationaleBaselineMatch[1], 10)
	: 0;

if (trajectoryValidationEnabled) {
	const trajectoryErrors = validateTrajectory(
		body,
		rationaleRequiredFrontmatter,
		rationaleBaseline,
	);
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

function validateTrajectory(implBody, rationaleRequired, rationaleBaseline = 0) {
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
	errors.push(...validateTemporalCoherence(trajectory, phaseSequence(body)));
	errors.push(...validateDeferredCompleteness(trajectory));
	if (rationaleRequired) {
		errors.push(...validateRationaleCompleteness(implBody, trajectory, rationaleBaseline));
	}
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

function parsePhaseRefNumber(cell) {
	return parsePhaseRef(cell)?.number ?? Number.NaN;
}

function parsePhaseRefKind(cell) {
	return parsePhaseRef(cell)?.kind ?? "build";
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
			writableAt: parsePhaseRefNumber(rec.writableAt || ""),
			passesAt: parsePhaseRefNumber(rec.passesAt || ""),
			writableAtKind: parsePhaseRefKind(rec.writableAt || ""),
			passesAtKind: parsePhaseRefKind(rec.passesAt || ""),
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
	// Accept T-prefixed (test) and A-prefixed (acceptance) IDs — mirrors
	// TEST_ID_PATTERN in lib/trajectory/validator.ts. Bounded to [TA] on purpose.
	const testIdPattern = /\b[TA]\d+\b/g;

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
		const phaseMatch = line.match(ANY_PHASE_HEADING);
		if (phaseMatch) {
			flushPhase();
			currentPhase = Number.parseInt(phaseMatch[1], 10);
			inVerification = false;
			foundRef = false;
			foundDecl = false;
			itemCount = 0;
			continue;
		}
		const verMatch = line.match(gateHeading("Verification"));
		if (verMatch && currentPhase !== null) {
			flushPhase();
			inVerification = true;
			foundRef = false;
			foundDecl = false;
			itemCount = 0;
			continue;
		}
		if (inVerification && gateHeading("(OTel|Context|Document|Forward Intelligence)").test(line)) {
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

function validateTemporalCoherence(trajectory, trajectorySequence) {
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
		// Ordered on the document's timeline, not by number — two sequences
		// numbering independently share their digits. Reduces to the number
		// when the document has no test phase.
		const writableOrd = phaseOrdinal(
			{ kind: row.writableAtKind, number: row.writableAt },
			trajectorySequence,
		);
		const passesOrd = phaseOrdinal(
			{ kind: row.passesAtKind, number: row.passesAt },
			trajectorySequence,
		);
		if (writableOrd > passesOrd) {
			const label = (n, kind) => `${kind === "test" ? "Test " : ""}Phase ${n}`;
			errors.push({
				rule: "temporal-coherence",
				message: `Trajectory row \`${row.id}\` has "Writable at" ${label(row.writableAt, row.writableAtKind)} after "Passes at" ${label(row.passesAt, row.passesAtKind)}. A test cannot pass before its dependencies exist.`,
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

// ------------------------------------------------------------------
// Rationale validation (earliest-writable discipline)
//
// When frontmatter has `rationale: required`, the impl must contain a
// `### Trajectory Rationale` subsection with an entry per trajectory row.
// Each entry names what prevents authoring the test at Phase 0 (pre-plan).
// Read the entries together: shared weak excuses signal over-sequencing.
// ------------------------------------------------------------------

function validateRationaleCompleteness(implBody, trajectory, baseline = 0) {
	const errors = [];
	const baselineNum = Number.isFinite(baseline) ? Number(baseline) : 0;

	const rowsNeedingRationale = trajectory.rows.filter(
		(r) => Number.isFinite(r.writableAt) && r.writableAt > baselineNum,
	);
	const hasSubsection = /^###\s+Trajectory Rationale\b/m.test(implBody);
	const rationaleIds = hasSubsection ? parseRationaleBlock(implBody) : new Set();

	if (rowsNeedingRationale.length > 0 && !hasSubsection) {
		errors.push({
			rule: "rationale-completeness",
			message: `\`rationale: required\` is set and ${rowsNeedingRationale.length} trajectory row(s) have \`Writable at\` later than Phase ${baselineNum}, but the impl is missing the \`### Trajectory Rationale\` subsection. Rows at or below the baseline don't need rationale; rows where authoring waits on later plan code do — add an entry for ${rowsNeedingRationale.map((r) => r.id).join(", ")}.`,
		});
	}

	const missing = [];
	for (const row of rowsNeedingRationale) {
		if (!rationaleIds.has(row.id)) missing.push(row.id);
	}

	if (missing.length > 0 && hasSubsection) {
		errors.push({
			rule: "rationale-completeness",
			message: `Trajectory rows with \`Writable at\` later than Phase ${baselineNum} missing from \`### Trajectory Rationale\`: ${missing.join(", ")}. Every row whose authoring waits on later plan code needs a \`- **TN** \`Writable at: Phase N\` — {reason}\` entry. Rows at or below the baseline (Phase ${baselineNum}) do not need rationale.`,
		});
	}

	const extra = [...rationaleIds].filter((id) => !trajectory.rows.some((r) => r.id === id));
	if (extra.length > 0) {
		errors.push({
			rule: "rationale-completeness",
			message: `\`### Trajectory Rationale\` contains entries for IDs not present in the trajectory table: ${extra.join(", ")}. Remove the stale entries or add the missing trajectory rows.`,
		});
	}

	return errors;
}

function parseRationaleBlock(implBody) {
	const lines = implBody.split("\n");
	const ids = new Set();
	let inRationale = false;

	for (const line of lines) {
		if (/^###\s+Trajectory Rationale\b/.test(line)) {
			inRationale = true;
			continue;
		}
		if (!inRationale) continue;
		// Break on next heading of depth 1-3 (new section starts)
		if (/^#{1,3}\s+/.test(line) && !/^###\s+Trajectory Rationale\b/.test(line)) break;
		// Match `- **TN**` at the start of a rationale entry
		const match = line.match(/^-\s+\*\*([TA]\d+)\*\*/);
		if (match) ids.add(match[1]);
	}

	return ids;
}
