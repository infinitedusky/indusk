import { describe, expect, it } from "vitest";
import { newPlanPrompt } from "./new-plan-prompt.js";

// workbench-plan-authoring A24: in the live check, given only
// `/planner <type> <name>`, the agent planned from the title.
describe("A24: a new plan's agent prepares, then asks", () => {
	const prompt = newPlanPrompt("bugfix", "seat-timer");

	it("still runs the planner for the plan's type and name", () => {
		expect(prompt.startsWith("/planner bugfix seat-timer")).toBe(true);
	});

	it("tells it to read the project's state first", () => {
		expect(prompt).toContain(".indusk/planning/master.md");
		expect(prompt).toContain(".indusk/current.md");
		expect(prompt).toContain("indusk promises check");
	});

	it("tells it to say it is ready and ask for a description", () => {
		expect(prompt).toMatch(/ready/i);
		expect(prompt).toMatch(/describe/i);
	});

	it("tells it not to infer the plan from its name", () => {
		expect(prompt).toMatch(/not .*(infer|guess).* from (its|the) name/i);
	});
});
