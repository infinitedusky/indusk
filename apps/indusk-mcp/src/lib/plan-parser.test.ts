import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAllPlans, parsePlan } from "./plan-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parsePlan", () => {
	it("parses the mcp-dev-system plan", () => {
		const plan = parsePlan(join(projectRoot, "planning/mcp-dev-system"));
		expect(plan.name).toBe("mcp-dev-system");
		expect(plan.stage).toBe("impl");
		expect(plan.stageStatus).toBe("in-progress");
		expect(plan.documents).toContain("brief.md");
		expect(plan.documents).toContain("adr.md");
		expect(plan.documents).toContain("impl.md");
	});

	it("extracts dependencies from brief", () => {
		const plan = parsePlan(join(projectRoot, "planning/mcp-dev-system"));
		expect(plan.dependencies).toContain("context-skill");
		expect(plan.dependencies).toContain("verify-skill");
		expect(plan.dependencies).toContain("code-quality-system");
		expect(plan.dependencies).toContain("codegraph-context");
		expect(plan.dependencies).toContain("document-skill");
	});

	it("parses a completed plan", () => {
		const plan = parsePlan(join(projectRoot, "planning/context-skill"));
		expect(plan.stage).toBe("impl");
		expect(plan.stageStatus).toBe("completed");
		expect(plan.nextStep).toBe("Create retrospective");
	});
});

describe("parseAllPlans", () => {
	it("returns all plans sorted by name", () => {
		const plans = parseAllPlans(projectRoot);
		expect(plans.length).toBeGreaterThanOrEqual(6);

		const names = plans.map((p) => p.name);
		expect(names).toContain("mcp-dev-system");
		expect(names).toContain("context-skill");

		// Verify sorted
		const sorted = [...names].sort();
		expect(names).toEqual(sorted);
	});

	it("returns empty array for missing planning dir", () => {
		const plans = parseAllPlans("/tmp/nonexistent-project");
		expect(plans).toEqual([]);
	});
});
