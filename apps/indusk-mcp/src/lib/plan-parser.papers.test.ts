import { describe, expect, it } from "vitest";
import { paper, planFolder } from "../__tests__/helpers/papers-fixture.js";
import { parsePlan } from "./plan-parser.js";

/**
 * Papers in the plan parser (writing-skill A1, A3; A2 is deferred to Build
 * Phase 1 because it asserts on a field `PlanSummary` does not have yet).
 *
 * Authored red at Test Phase 1: today a folder of `kind: paper` documents
 * reports `stage: unknown` with next step "Create a brief", and a paper
 * carrying a status outside the vocabulary is not reported at all.
 */

describe("papers in the plan parser", () => {
	it("A1: a papers-only folder reports stage paper, a derived status, and a real next step", () => {
		const dir = planFolder({
			"paper-1.md": paper({ title: "One", status: "draft" }),
			"paper-2.md": paper({ title: "Two", status: "accepted" }),
		});

		const s = parsePlan(dir);
		expect(s.stage).toBe("paper");
		// Least-advanced paper wins: draft < accepted < published.
		expect(s.stageStatus).toBe("draft");
		expect(s.nextStep).not.toBe("Create a brief");
		expect(s.nextStep).toMatch(/paper-1\.md/);
	});

	it("A3: a paper with a status outside the vocabulary is reported malformed, never read as draft", () => {
		const dir = planFolder({
			"paper-1.md": paper({ title: "One", status: "finished" }),
		});

		const s = parsePlan(dir);
		expect(s.stage).toBe("paper");
		expect(s.stageStatus).toBe("malformed");
		expect(s.nextStep).toMatch(/paper-1\.md/);
		expect(s.nextStep).toMatch(/status/i);
	});
});
