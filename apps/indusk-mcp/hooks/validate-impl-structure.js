#!/usr/bin/env node
/**
 * PreToolUse hook: validates that impl phases have all four gate sections.
 *
 * Every phase must have: implementation items, Verification, OTel, Context, Document.
 * Sections can opt out with (none needed), (not applicable), or skip-reason: {why}.
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
const filePath = toolInput.file_path ?? "";

// Fast path: not an impl.md file
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

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

// Different workflows have different requirements
const requirements = {
	feature: { verification: true, otel: true, context: true, document: true },
	refactor: { verification: true, otel: true, context: true, document: true },
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
		if (requirements.otel && phase.hasOtel && phase.otelIsOptOut)
			optOuts.push("OTel");
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
