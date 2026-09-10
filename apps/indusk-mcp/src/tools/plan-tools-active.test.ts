import { describe, expect, it } from "vitest";
import { isActivePlan, isActivePlanStatus } from "./plan-tools.js";

/**
 * A17 (indusk-makeover Phase 7 falsification): the `list_plans { active: true }`
 * filter must include plans whose most-advanced doc is `completed` — a
 * completed impl still inside planning/ is by definition awaiting the
 * close-out rituals (falsify/cleanup/retrospective). Only archival (moving to
 * planning/archive/) removes a plan from the active list.
 */
describe("isActivePlanStatus (A17)", () => {
	it("includes completed — plans awaiting close-out are active", () => {
		expect(isActivePlanStatus("completed")).toBe(true);
	});

	for (const status of ["accepted", "approved", "in-progress", "proposed"]) {
		it(`includes ${status}`, () => {
			expect(isActivePlanStatus(status)).toBe(true);
		});
	}

	for (const status of ["draft", "complete", "", "abandoned", "superseded"]) {
		it(`excludes ${status || "(empty)"}`, () => {
			expect(isActivePlanStatus(status)).toBe(false);
		});
	}
});

/**
 * writing-skill Build Phase 1: a paper-stage plan (a folder of `kind: paper`
 * documents with no lifecycle document) is in motion while any paper is
 * still a draft or awaits its first publish. Its `stageStatus` is the
 * least-advanced paper's status, so the rule reads that one value.
 */
describe("isActivePlan — paper-stage plans", () => {
	it("is active while the least-advanced paper is a draft", () => {
		expect(isActivePlan({ stage: "paper", stageStatus: "draft" })).toBe(true);
	});

	it("is active while a paper awaits its first publish", () => {
		expect(isActivePlan({ stage: "paper", stageStatus: "accepted" })).toBe(true);
	});

	it("is done once every paper is published, even if one has gone stale since", () => {
		expect(isActivePlan({ stage: "paper", stageStatus: "published" })).toBe(false);
	});

	it("a malformed paper does not make a plan active — it makes it a fix", () => {
		expect(isActivePlan({ stage: "paper", stageStatus: "malformed" })).toBe(false);
	});

	it("every other stage keeps the document-status rule", () => {
		expect(isActivePlan({ stage: "brief", stageStatus: "draft" })).toBe(false);
		expect(isActivePlan({ stage: "impl", stageStatus: "completed" })).toBe(true);
	});
});
