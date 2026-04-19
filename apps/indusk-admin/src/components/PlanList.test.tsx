import { describe, it } from "vitest";

/**
 * Trajectory tests for PlanList behavior. Written here at Phase 1 per the
 * tests-first discipline; skipped until the components they import land.
 *
 * - T2 (Phase 3): sidebar lists every active plan in this project
 * - T4 (Phase 3): archive section is visually distinct + collapsed by default
 * - T5 (Phase 4): clicking a plan in the sidebar shows the plan's content in the main pane
 *
 * When PlanList lands in Phase 3 (and the plan/[name] route in Phase 4),
 * remove the `.skip()` calls and replace the placeholder `it.skip` bodies
 * with real assertions against the rendered components.
 */
describe("PlanList — sidebar list of plans (T2/T4)", () => {
	it.skip("T2 — renders every active plan from props as a clickable list item (unblock: Phase 3)", () => {
		// Will import { PlanList } from "./PlanList" — doesn't exist until Phase 3.
		// Render with mock plans, assert each name appears, assert each is a Link.
	});

	it.skip("T4 — renders an archived section that is visually distinct and collapsed by default (unblock: Phase 3)", () => {
		// Will pass `archived` prop with mock archived plans, assert section title,
		// assert section starts collapsed (chevron right, content hidden),
		// assert clicking expands it.
	});
});

describe("Plan navigation (T5)", () => {
	it.skip("T5 — clicking a plan link navigates to /plan/[name] (unblock: Phase 4)", () => {
		// Will simulate click on a PlanList item, assert URL changes,
		// assert plan/[name] page renders the plan's content.
	});
});
