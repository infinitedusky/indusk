import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { validateWrite } from "./helpers/hook-runner.js";
import { summaryImpl } from "./helpers/phase-summary-fixture.js";

/**
 * promise: an-impl-phase-explains-itself — A18 of the story-first-phases impl.
 *
 * The falsification and cleanup skills hand out a phase template. Beside the
 * original, each carries a variant for an impl that has opted in to
 * `phase_summary: required`, in a fenced block right after the marker line
 * `<!-- template: phase_summary required -->`. Filled in mechanically and
 * placed in an opted-in impl, it must pass the save check as written.
 */

const skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "skills");
const MARKER = "<!-- template: phase_summary required -->";

/** The fenced block that follows the marker line, or null when there is none. */
function optedInTemplate(skill: string): string | null {
	const lines = readFileSync(join(skillsDir, `${skill}.md`), "utf-8").split("\n");
	const at = lines.findIndex((l) => l.trim() === MARKER);
	if (at === -1) return null;
	const open = lines.findIndex((l, i) => i > at && /^```/.test(l));
	if (open === -1) return null;
	const close = lines.findIndex((l, i) => i > open && /^```\s*$/.test(l));
	return close === -1 ? null : lines.slice(open + 1, close).join("\n");
}

/** Fill every placeholder with fixed plain words: row numbers first, then the rest. */
function fill(template: string): string {
	return template
		.replace(/\{M\+1\}/g, "3")
		.replace(/\{M\}/g, "2")
		.replace(/\bPhase N\b/g, "Build Phase 2")
		.replace(/\{[^{}]*\}/g, "the work this phase does");
}

describe.each(["falsify", "cleanup"])("A18 — the %s skill's opted-in phase template", (skill) => {
	it("exists, marked, beside the original", () => {
		expect(optedInTemplate(skill), `${skill}.md has no ${MARKER} block`).not.toBeNull();
	});

	it("passes the save check, filled in as written, on an impl that has opted in", async () => {
		const template = optedInTemplate(skill);
		expect(template, `${skill}.md has no ${MARKER} block`).not.toBeNull();
		const filled = fill(template as string);
		expect(filled).not.toMatch(/\{[^}]*\}/);
		const impl = `${summaryImpl("demo", {
			trajectoryRows: [
				"| T1 | the thing holds | Test Phase 1 | Build Phase 1 | planned |",
				"| T2 | a hypothesis fails today | Build Phase 1 | Build Phase 2 | planned |",
				"| T3 | another hypothesis fails today | Build Phase 1 | Build Phase 2 | planned |",
			],
		})}\n${filled}\n`;
		const r = await validateWrite(impl);
		expect(r.exitCode, r.stderr).toBe(0);
	});
});

/**
 * promise: an-impl-phase-explains-itself — A2 of the impl-tasks-are-instructions
 * impl (the falsify and cleanup half). A task placeholder asks for an
 * instruction, a verification placeholder for what must hold.
 */
function placeholderLines(template: string): { gate: string; line: string }[] {
	const found: { gate: string; line: string }[] = [];
	let gate = "";
	for (const line of template.split("\n")) {
		if (/^###\s/.test(line)) gate = "";
		else if (/^####\s/.test(line)) gate = line;
		else if (/^- \[ \] \{/.test(line)) found.push({ gate, line });
	}
	return found;
}

describe.each(["falsify", "cleanup"])("A2 — the %s template's placeholders", (skill) => {
	const lines = () => placeholderLines(optedInTemplate(skill) ?? "");

	it("every task placeholder asks for an instruction", () => {
		const tasks = lines().filter((p) => p.gate === "");
		expect(tasks.length, `${skill}.md has no task placeholders`).toBeGreaterThan(0);
		for (const { line } of tasks) expect(line, line).toMatch(/\binstruction\b/i);
	});

	it("every Context and Document placeholder asks for an instruction (A6)", () => {
		const gateTasks = lines().filter((p) => /(Context|Document)\s*$/.test(p.gate));
		expect(gateTasks.length, `${skill}.md has no Context or Document placeholders`).toBeGreaterThanOrEqual(2);
		for (const { line } of gateTasks) expect(line, line).toMatch(/\binstruction\b/i);
	});

	it("every verification placeholder asks for what must hold", () => {
		const items = lines().filter((p) => /Verification\s*$/.test(p.gate));
		expect(items.length, `${skill}.md has no verification placeholders`).toBeGreaterThan(0);
		for (const { line } of items) expect(line, line).toMatch(/must hold/i);
	});
});
