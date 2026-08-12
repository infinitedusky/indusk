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
	fencedLineMask,
	gateHeading,
	PHASE_HEADING,
	parsePhaseHeading,
	phaseExists,
	phaseOrdinal,
	phaseSequence,
	unterminatedFenceLine,
} from "./_impl-headings.js";
import { parseRegister } from "./_register.js";
import { parseTrajectoryFromBody } from "./_trajectory-parser.js";

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
// Line-anchored, like every value-bearing frontmatter key here — the
// `rationale_baseline` lesson was a title's substring silently setting a
// baseline, and the same shape of bug is available to any unanchored match.
const testPhasesRequiredFrontmatter = /^test_phases:\s*required/m.test(frontmatter);
const rationaleBaselineMatch = frontmatter.match(/^rationale_baseline:\s*(\d+)/m);
const rationaleBaseline = rationaleBaselineMatch
	? Number.parseInt(rationaleBaselineMatch[1], 10)
	: 0;

if (trajectoryValidationEnabled) {
	const trajectoryErrors = validateTrajectory(
		body,
		rationaleRequiredFrontmatter,
		rationaleBaseline,
		testPhasesRequiredFrontmatter,
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

function validateTrajectory(
	implBody,
	rationaleRequired,
	rationaleBaseline = 0,
	testPhasesRequired = false,
) {
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

	// Before anything structural: an unterminated fence means the document does
	// not say what it appears to say. The mask fails open so the phases survive,
	// but the author needs to hear the real problem rather than the downstream
	// noise a leaked code body produces.
	const fenceLine = unterminatedFenceLine(implBody);
	if (fenceLine !== null) {
		errors.push({
			rule: "unterminated-fence",
			message: `Unterminated code fence opened at body line ${fenceLine}. A deferral's carried test body must be closed, or the block runs to the end of the file. To nest a fence inside a carried body, make the outer marker longer (four backticks around a block containing three).`,
		});
		return errors;
	}

	const trajectory = parseTrajectoryFromBody(implBody);
	const sequence = phaseSequence(implBody);
	const hasTestPhase = sequence.some((p) => p.kind === "test");
	errors.push(...validateCrossReferenceIntegrity(implBody, trajectory));
	errors.push(...validateTemporalCoherence(trajectory, sequence));
	errors.push(...validateDeferredCompleteness(trajectory));
	errors.push(...validateTestPhasePresence(sequence, testPhasesRequired));
	errors.push(...validateTestPhaseJustification(implBody, sequence));
	errors.push(...validateTestPhaseGates(implBody, sequence));
	errors.push(...validateRegressionGuards(implBody, trajectory, sequence));
	// The register absorbs `### Trajectory Rationale`: when a test phase exists,
	// deferral justification lives in Test Phase 1, and requiring the legacy
	// section too would be two homes for one fact. Impls without a test phase
	// are unaffected — which is every impl written before this rule existed.
	if (rationaleRequired && !hasTestPhase) {
		errors.push(...validateRationaleCompleteness(implBody, trajectory, rationaleBaseline));
	}
	return errors;
}

/**
 * Read Test Phase 1's register. Scanning stops at the next phase heading — the
 * register belongs to the FIRST test phase, and an entry written under a later
 * phase is not a justification recorded up front, which is its whole purpose.
 * Fenced lines are skipped so a carried test body cannot pose as an entry.
 */

/** A new impl must open with a test phase. Gated on `test_phases: required`. */
function validateTestPhasePresence(sequence, required) {
	if (!required) return [];
	if (sequence.some((p) => p.kind === "test")) return [];
	return [
		{
			rule: "test-phase-presence",
			message:
				"`test_phases: required` is set but this impl has no test phase. Add `### Test Phase 1` as the first phase — it authors every test that can honestly be authored and records, in its register, every test that cannot. Naming the omission matters more than naming the rule: without it, the discipline the whole document is built around is the only one with nowhere to happen.",
		},
	];
}

/**
 * Every test phase must carry its Verification gate.
 *
 * The four-gate loop deliberately skips test phases — a test phase carries one
 * gate, not four, because Context and Document on a phase that ships nothing
 * would be `(none needed)` noise. But nothing then required the one, and that
 * gate is the U1 compensating control: the deferral review that stands in for
 * a check nobody can write. An author who omits it deletes the plan's answer
 * to its own Deferred Verification row, silently.
 */
function validateTestPhaseGates(implBody, sequence) {
	const testPhases = sequence.filter((p) => p.kind === "test");
	if (testPhases.length === 0) return [];
	const lines = implBody.split("\n");
	const fenced = fencedLineMask(lines);

	const withGate = new Set();
	let current = null;
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const heading = parsePhaseHeading(lines[i]);
		if (heading) {
			current = heading.kind === "test" ? heading.number : null;
			continue;
		}
		if (current === null) continue;
		const gate = lines[i].match(gateHeading("Verification"));
		if (gate) withGate.add(current);
	}

	return testPhases
		.filter((p) => !withGate.has(p.number))
		.map((p) => ({
			rule: "test-phase-gate",
			message: `Test Phase ${p.number} has no \`#### Test Phase ${p.number} Verification\` gate. That gate is where its deferred test bodies get reviewed — "will this compile at the phase it names, and does it assert what it claims?" — which is the only control standing in for a check nobody can write. Without it the phase can close having reviewed nothing.`,
		}));
}

/** Every test phase after the first must be justified in the first. */
function validateTestPhaseJustification(implBody, sequence) {
	const later = sequence.filter((p) => p.kind === "test" && p.number > 1);
	if (later.length === 0) return [];
	const { justifiedTestPhases } = parseRegister(implBody);
	return later
		.filter((p) => !justifiedTestPhases.has(p.number))
		.map((p) => ({
			rule: "test-phase-justification",
			message: `Test Phase ${p.number} exists but Test Phase 1 does not justify it. Add a \`#### Deferred to Test Phase ${p.number}\` entry there saying why those tests cannot be authored up front — a later test phase is a deviation from "author everything first", and the register is where every deviation is recorded.`,
		}));
}

/**
 * A row that passes in the same test phase that authors it has no red window.
 * That is legitimate and is also what a rubber stamp looks like, so the author
 * must say which. Scoped to rows whose BOTH ends name a test phase: a
 * build-phase row where writable equals passes is the ordinary
 * unit-test-for-new-code case, which is why no existing impl is affected.
 */
function validateRegressionGuards(implBody, trajectory, sequence) {
	const greenOnArrival = trajectory.rows.filter(
		(r) =>
			r.writableAtKind === "test" &&
			r.passesAtKind === "test" &&
			Number.isFinite(r.writableAt) &&
			r.writableAt === r.passesAt &&
			// Only for a test phase the document actually contains. Otherwise the
			// instruction — "add an entry under `#### Regression Guards` in Test
			// Phase 1" — names a heading that does not exist and cannot be
			// followed. Same reasoning `phaseExists` applies to Gate A;
			// `test-phase-presence` is the rule that names the real problem.
			phaseExists({ kind: r.writableAtKind, number: r.writableAt }, sequence),
	);
	if (greenOnArrival.length === 0) return [];
	const { regressionGuards } = parseRegister(implBody);
	return greenOnArrival
		.filter((r) => !regressionGuards.has(r.id))
		.map((r) => ({
			rule: "regression-guard-declaration",
			message: `Trajectory row \`${r.id}\` passes in the same test phase that authors it, so it has no red phase. That is allowed, but it must be declared: add a \`- **${r.id}** — {why}\` entry under \`#### Regression Guards\` in Test Phase 1. A row green on arrival is either a regression guard or a rubber stamp, and only the author knows which.`,
		}));
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
