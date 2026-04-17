import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseTrajectory } from "./parser.js";
import { validateTrajectory } from "./validator.js";

const plannerSkillPath = join(import.meta.dirname, "../../../skills/planner.md");

function extractImplTemplate(plannerSkill: string): string {
	const marker = "### impl.md";
	const start = plannerSkill.indexOf(marker);
	if (start === -1) throw new Error("impl.md template section not found in planner.md");

	const codeBlockStart = plannerSkill.indexOf("```markdown", start);
	if (codeBlockStart === -1) throw new Error("impl.md template code block not found");

	const afterFence = codeBlockStart + "```markdown".length;
	const codeBlockEnd = plannerSkill.indexOf("\n```", afterFence);
	if (codeBlockEnd === -1) throw new Error("impl.md template code block not closed");

	return plannerSkill.slice(afterFence, codeBlockEnd).trim();
}

function fillPlaceholders(template: string): string {
	// Replace {Title}, {YYYY-MM-DD}, {status options}, etc. with sensible defaults
	// so the filled template is a valid impl.md.
	return template
		.replace(/\{Title\}/g, "Example Plan")
		.replace(/\{YYYY-MM-DD\}/g, "2026-04-16")
		.replace(/draft \| approved \| in-progress \| completed \| abandoned/g, "draft")
		.replace(/\{What this achieves and why\.\}/g, "Build a thing.")
		.replace(/\{Item\}/g, "Example item")
		.replace(
			/\{one-line assertion — what the test claims is true\}/g,
			"example assertion",
		)
		.replace(/\{another assertion\}/g, "another example assertion")
		.replace(
			/\{Task — include code snippets when syntax matters\}/g,
			"Example task",
		)
		.replace(/\{Name\}/g, "Setup")
		.replace(/\{runnable command, e\.g\. pnpm test\}/g, "pnpm test")
		.replace(
			/\{Concrete CLAUDE\.md edit[^}]+\}/g,
			"Add to Conventions: example",
		)
		.replace(/\{Docs page to write or update[^}]+\}/g, "Update example docs");
}

describe("T13: impl.md template includes Test Trajectory skeleton with required columns", () => {
	const plannerSkill = readFileSync(plannerSkillPath, "utf-8");
	const template = extractImplTemplate(plannerSkill);

	it("contains `## Test Trajectory` heading", () => {
		expect(template).toContain("## Test Trajectory");
	});

	it("table header declares all five required columns", () => {
		const headerLine = template
			.split("\n")
			.find((line) => line.includes("| ID |") && line.includes("Writable at"));
		expect(headerLine).toBeDefined();
		expect(headerLine).toContain("| ID |");
		expect(headerLine).toContain("| Asserts |");
		expect(headerLine).toContain("| Writable at |");
		expect(headerLine).toContain("| Passes at |");
		expect(headerLine).toContain("| State |");
	});

	it("includes a T1 placeholder row", () => {
		expect(template).toMatch(/\|\s*T1\s*\|/);
	});

	it("includes the Deferred Verification subsection (may be commented as optional)", () => {
		expect(template).toContain("### Deferred Verification");
	});

	it("Deferred Verification template has all three required fields", () => {
		const deferredSection = template.slice(template.indexOf("### Deferred Verification"));
		expect(deferredSection).toContain("reason:");
		expect(deferredSection).toContain("would require:");
		expect(deferredSection).toContain("mitigation:");
	});

	it("Phase 1 Verification references test IDs rather than generic 'tests pass'", () => {
		const phaseVerSection = template.slice(template.indexOf("#### Phase 1 Verification"));
		expect(phaseVerSection).toMatch(/T\d+/);
	});

	it("frontmatter declares `trajectory: required`", () => {
		const fmEnd = template.indexOf("\n---", 10);
		const frontmatter = template.slice(0, fmEnd);
		expect(frontmatter).toMatch(/trajectory:\s*required/);
	});
});

describe("T14: planner skill scaffolds an impl that passes all four validator rules", () => {
	const plannerSkill = readFileSync(plannerSkillPath, "utf-8");
	const template = extractImplTemplate(plannerSkill);
	const filled = fillPlaceholders(template);

	it("filled template parses into a valid Trajectory", () => {
		// Strip the frontmatter the way validateTrajectory expects (body only).
		const bodyStart = filled.indexOf("\n---\n", 10);
		const body = bodyStart === -1 ? filled : filled.slice(bodyStart + 5);
		const trajectory = parseTrajectory(body);
		expect(trajectory.present).toBe(true);
		expect(trajectory.rows.length).toBeGreaterThanOrEqual(1);
	});

	it("filled template passes all four trajectory validation rules", () => {
		const bodyStart = filled.indexOf("\n---\n", 10);
		const body = bodyStart === -1 ? filled : filled.slice(bodyStart + 5);
		const errors = validateTrajectory(body);
		expect(errors).toEqual([]);
	});
});
