import { describe, expect, it } from "vitest";
import { derivePlanPosition } from "../lib/lifecycle.js";
import type { PlanSummary } from "../lib/plan-parser.js";

/**
 * planner-promises A21 — a regression guard.
 *
 * The why left the brief: a brief now holds expectations and promises, and
 * everything else is research. Bugfix and refactor plans start at the brief
 * and their type does not require a research document. They may carry one
 * anyway, and it must read as a document the plan has, never as something
 * unexpected; and a plan of those types without one must not read as missing
 * it. Both hold today — this pins them, because the brief template now sends
 * the why to a document those types were never asked for.
 */

function segments(workflow: string, documents: string[]): Record<string, string> {
	const summary = {
		name: "demo",
		stage: "impl",
		stageStatus: "in-progress",
		nextStep: "",
		dependencies: [],
		documents,
		workflow,
	} as unknown as PlanSummary;
	return derivePlanPosition({ summary, impl: null, readiness: null, archived: false })
		.segments as Record<string, string>;
}

describe.each(["bugfix", "refactor"])("planner-promises A21 — a %s plan and research", (type) => {
	it("carrying a research document, it reads as done", () => {
		const s = segments(type, ["research.md", "brief.md", "test-plan.md", "impl.md"]);
		expect(s.research).toBe("done");
	});

	it("without one, it reads as skipped, never missing", () => {
		const s = segments(type, ["brief.md", "test-plan.md", "impl.md"]);
		expect(s.research).toBe("skipped");
	});
});
