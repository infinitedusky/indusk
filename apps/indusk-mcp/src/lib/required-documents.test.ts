import { describe, expect, it } from "vitest";
import { nextRequiredDocument } from "./lifecycle.js";
import { requiredDocuments } from "./workflow-types.js";

// promise: the-core-is-always-kept

describe("a workflow's required documents minus the ones a project turned off", () => {
	it("drops a turned-off document and keeps the order of the rest", () => {
		expect(requiredDocuments("feature", ["adr"])).toEqual([
			"research",
			"brief",
			"test-plan",
			"impl",
			"retrospective",
		]);
	});

	it("keeps the core whatever is asked, since a config naming it is refused where it is read", () => {
		expect(requiredDocuments("feature", ["brief", "test-plan"])).toContain("brief");
		expect(requiredDocuments("feature", ["brief", "test-plan"])).toContain("test-plan");
	});

	it("changes nothing when nothing is off", () => {
		expect(requiredDocuments("bugfix")).toEqual(["brief", "test-plan", "impl", "retrospective"]);
	});

	it("does not ask for a turned-off document next", () => {
		expect(nextRequiredDocument("test-plan", "feature")).toBe("adr");
		expect(nextRequiredDocument("test-plan", "feature", ["adr"])).toBe("impl");
	});
});
