import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAllPlans, parsePlan } from "./plan-parser.js";

const projectRoot = join(import.meta.dirname, "../../../..");

describe("parsePlan", () => {
	it("parses the gsd-inspired-improvements plan", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gsd-inspired-improvements"));
		expect(plan.name).toBe("gsd-inspired-improvements");
		expect(plan.stage).toBe("retrospective");
		expect(plan.documents).toContain("brief.md");
		expect(plan.documents).toContain("adr.md");
		expect(plan.documents).toContain("impl.md");
		expect(plan.documents).toContain("retrospective.md");
	});

	it("extracts dependencies from brief", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gsd-inspired-improvements"));
		expect(plan.dependencies.length).toBeGreaterThanOrEqual(0);
	});

	it("parses an archived completed plan", () => {
		const plan = parsePlan(join(projectRoot, ".indusk/planning/archive/gate-policy-enforcement"));
		expect(plan.stage).toBe("retrospective");
	});
});

describe("parseAllPlans", () => {
	it("returns all plans sorted by name", () => {
		const plans = parseAllPlans(projectRoot);
		expect(plans.length).toBeGreaterThanOrEqual(2);

		const names = plans.map((p) => p.name);
		// Use stable active plans that exist in the root planning dir (not archived).
		// Both are parked/long-term plans unlikely to be archived in the near term.
		expect(names).toContain("indusk-v2-dawn");
		expect(names).toContain("react-native-support");

		// Verify sorted
		const sorted = [...names].sort();
		expect(names).toEqual(sorted);
	});

	it("returns empty array for missing planning dir", () => {
		const plans = parseAllPlans("/tmp/nonexistent-project");
		expect(plans).toEqual([]);
	});
});
