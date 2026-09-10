#!/usr/bin/env node
/**
 * PostToolUse hook on Edit|Write: the phase reminder.
 *
 * When an edit to an `impl.md` closes a phase, tell the agent which trajectory
 * rows the next phase opens with — the tests to author red before any code —
 * and to call advance_plan. When a phase is mid-flight, name the rows that will
 * block its close. Advisory: it never blocks.
 *
 * Delivery. A PostToolUse hook reaches the model in exactly one way at exit 0:
 * a JSON envelope on stdout carrying `hookSpecificOutput.additionalContext`.
 * stderr at exit 0 goes to the debug log and nowhere else. For its whole life
 * this hook wrote to stderr and exited 0, so it was never once heard
 * (workbench-trust-fixes, research F9). `console.info` writes to stdout and is
 * on the linter's `noConsole` allowlist; a `console.log` here was swept once
 * already and would be again.
 *
 * Phases. Two sequences ordered by document position (test-phase-structure):
 * "the next phase" is the next heading in the document, whatever its kind, and
 * trajectory cells are read through the shared `_trajectory-parser.js`, so
 * `Build Phase 2`, `Test Phase 1` and `Phase 2` mean here exactly what they
 * mean to check-gates. The nudge text has one definition — this file — pinned
 * by `phase-start-nudge-single-definition.test.ts`.
 */

import { readFileSync } from "node:fs";
import {
	FORWARD_INTELLIGENCE_HEADING,
	fencedLineMask,
	gateHeading,
	parsePhaseHeading,
	phaseOrdinal,
	phaseSequence,
} from "./_impl-headings.js";
import { parseTrajectoryFromBody, stripFrontmatter } from "./_trajectory-parser.js";

let input = "";
for await (const chunk of process.stdin) {
	input += chunk;
}

const event = JSON.parse(input);
const filePath = event.tool_input?.file_path ?? "";

// Fast path: not an impl.md. Silence is the correct output here (A2).
if (!filePath.endsWith("/impl.md") && !filePath.endsWith("\\impl.md")) {
	process.exit(0);
}

let content;
try {
	content = readFileSync(filePath, "utf-8"); // post-edit state
} catch {
	process.exit(0);
}

const GATE_HEADING = gateHeading("(Verification|Context|Document)");
const AUTHORABLE = new Set(["planned", "writable", ""]);
const CLOSES_PHASE = new Set(["passing", "skipped", "blocked"]);

/** Phases in document order, each with its checkbox items (gates included). */
function parsePhases(body) {
	const lines = body.split("\n");
	const fenced = fencedLineMask(lines);
	const phases = [];
	let current = null;
	let section = "items";
	for (let i = 0; i < lines.length; i++) {
		if (fenced[i]) continue;
		const line = lines[i];
		const heading = parsePhaseHeading(line);
		if (heading) {
			if (current) phases.push(current);
			current = { kind: heading.kind, number: heading.number, name: heading.name, items: [] };
			section = "items";
			continue;
		}
		if (GATE_HEADING.test(line)) {
			section = "items";
			continue;
		}
		if (FORWARD_INTELLIGENCE_HEADING.test(line)) {
			section = "forward-intelligence";
			continue;
		}
		if (!current || section !== "items") continue;
		const item = /^-\s+\[([ x])\]\s+/.exec(line);
		if (item) current.items.push({ checked: item[1] === "x" });
	}
	if (current) phases.push(current);
	return phases;
}

const body = stripFrontmatter(content);
const sequence = phaseSequence(body);
const phases = parsePhases(body);
const { rows } = parseTrajectoryFromBody(body);
const hasTestPhases = sequence.some((p) => p.kind === "test");

const ordinalOf = (ref) => phaseOrdinal(ref, sequence);
const label = (p) =>
	p.kind === "test"
		? `Test Phase ${p.number}`
		: hasTestPhases
			? `Build Phase ${p.number}`
			: `Phase ${p.number}`;

/** Rows the next phase must open by authoring, red. */
function writableAtNudge(next) {
	const target = ordinalOf(next);
	const due = rows.filter(
		(r) =>
			ordinalOf({ kind: r.writableAtKind, number: r.writableAt }) === target &&
			AUTHORABLE.has(r.state),
	);
	if (due.length === 0) return null;
	const lines = due.map((r) => `  [${r.id}] ${r.asserts}`);
	return `${label(next)} opens with these tests to author (commit as failing before implementation work):\n${lines.join("\n")}`;
}

const parts = [];

// A phase that just became fully complete, with the next one not yet started.
// "Not started" means NOTHING in it is checked — once the next phase has
// begun, repeating the send-off on every edit is noise, and the phase in
// progress needs its own blockers instead (falsification A19).
for (let i = 0; i + 1 < phases.length; i++) {
	const phase = phases[i];
	const next = phases[i + 1];
	if (phase.items.length === 0 || !phase.items.every((x) => x.checked)) continue;
	if (next.items.some((x) => x.checked)) continue;
	parts.push(
		`${label(phase)} (${phase.name}) is fully complete. Call advance_plan to validate gates before starting ${label(next)}.`,
	);
	const nudge = writableAtNudge(next);
	if (nudge) parts.push(nudge);
	break;
}

// Otherwise: a phase mid-flight whose trajectory rows will block its close.
if (parts.length === 0) {
	for (const phase of phases) {
		const checked = phase.items.filter((x) => x.checked).length;
		if (checked === 0 || checked === phase.items.length) continue;
		const target = ordinalOf(phase);
		const blockers = rows.filter(
			(r) =>
				ordinalOf({ kind: r.passesAtKind, number: r.passesAt }) === target &&
				!CLOSES_PHASE.has(r.state),
		);
		if (blockers.length === 0) continue;
		const lines = blockers.map((r) => `  [${r.id}] ${r.asserts} — state: ${r.state}`);
		parts.push(
			`${label(phase)} trajectory rows still not passing (will block phase close):\n${lines.join("\n")}`,
		);
		break; // one nudge per invocation
	}
}

if (parts.length > 0) {
	console.info(
		JSON.stringify({
			hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: parts.join("\n\n") },
		}),
	);
}
process.exit(0);
