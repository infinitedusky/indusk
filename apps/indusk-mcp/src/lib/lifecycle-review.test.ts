import { describe, expect, it } from "vitest";
import type { RetrospectiveReadiness } from "./cleanup/gate.js";
import type { ParsedImpl } from "./impl-parser-core.js";
import { derivePlanPosition, PLAN_POSITIONS } from "./lifecycle.js";
import type { PlanSummary } from "./plan-parser.js";

/**
 * admin-plan-authoring A31 — the planning rule that a plan adding a lifecycle
 * position renders it, in the same plan.
 *
 * A built plan stops for review, and is then accepted; both are positions a
 * person needs to see on the plan's page. Today a plan whose phases and
 * rituals are closed reads "cleaned, awaiting /retrospective" — the build
 * would have gone straight on to the retrospective it must never start. The
 * admin renders every position in `PLAN_POSITIONS` (pinned by its
 * `lifecycle-render-parity` test), so a position added here without a label
 * there fails that test.
 */

const summary: PlanSummary = {
	name: "seat-holds",
	stage: "impl",
	stageStatus: "completed",
	nextStep: "",
	dependencies: [],
	documents: ["brief.md", "test-plan.md", "adr.md", "impl.md"],
};

const ready: RetrospectiveReadiness = {
	falsificationOk: true,
	cleanupOk: true,
	rowsOk: true,
	nonTerminalRows: [],
	promisesOk: true,
	unprovenPromises: [],
	passes: true,
	missing: [],
};

function impl(accepted?: string): ParsedImpl {
	return {
		title: "seat-holds",
		status: "completed",
		phases: [],
		...(accepted ? { accepted } : {}),
	} as ParsedImpl;
}

describe("A31 — a built plan is in review, then accepted", () => {
	it("review and accepted are positions, between cleanup and the retrospective", () => {
		const order = [...PLAN_POSITIONS];
		expect(order).toEqual(expect.arrayContaining(["review", "accepted"]));
		expect(order.indexOf("cleanup")).toBeLessThan(order.indexOf("review" as never));
		expect(order.indexOf("review" as never)).toBeLessThan(order.indexOf("accepted" as never));
		expect(order.indexOf("accepted" as never)).toBeLessThan(order.indexOf("retrospective"));
	});

	it("every phase and ritual closed, not accepted: in review, awaiting the person", () => {
		const state = derivePlanPosition({ summary, impl: impl(), readiness: ready, archived: false });
		expect(state.position).toBe("review");
		expect(state.awaiting).toMatch(/review/);
	});

	it("accepted: the release runs, and the retrospective is its first step", () => {
		const state = derivePlanPosition({
			summary,
			impl: impl("2026-10-06T16:00:00Z"),
			readiness: ready,
			archived: false,
		});
		expect(state.position).toBe("accepted");
		expect(state.awaiting).toMatch(/retrospective/);
	});
});

/**
 * promise: a-plan-is-audited-by-a-fresh-reader-before-it-closes — plan-review-subagent A22.
 *
 * A cleaned plan with no audit.md (and no skip) waits at `audit`, not `review`:
 * the admin must not offer Accept before the audit has run.
 */
describe("A22 — a cleaned plan awaits its audit before review", () => {
	it("audit sits between cleanup and review in PLAN_POSITIONS", () => {
		const order = [...PLAN_POSITIONS] as string[];
		expect(order.indexOf("audit")).toBe(order.indexOf("cleanup") + 1);
		expect(order.indexOf("audit")).toBeLessThan(order.indexOf("review"));
	});

	it("readiness.missing includes audit: position audit, cleaned, awaiting /audit", () => {
		const state = derivePlanPosition({
			summary,
			impl: impl(),
			readiness: { ...ready, passes: false, missing: ["audit"] },
			archived: false,
		});
		expect(state).toMatchObject({ position: "audit", awaiting: "cleaned, awaiting /audit" });
	});

	it("audit not missing: review as before", () => {
		const state = derivePlanPosition({ summary, impl: impl(), readiness: ready, archived: false });
		expect(state.position).toBe("review");
	});
});
