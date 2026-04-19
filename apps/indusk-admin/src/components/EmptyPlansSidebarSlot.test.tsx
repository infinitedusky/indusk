import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { EmptyPlansSidebarSlot } from "./EmptyPlansSidebarSlot";

/**
 * T12: when the planning directory is empty, the user sees an empty-state
 * message rather than a blank screen or JS error. This test verifies the
 * EmptyPlansSidebarSlot renders the expected guidance copy.
 *
 * Phase 3 will wire the layout to render this slot when planning-reader
 * returns zero plans; the same empty-state copy will then be visible
 * in the actual sidebar.
 */
describe("EmptyPlansSidebarSlot — visible empty-state copy (T12)", () => {
	it("renders without crashing", async () => {
		const { container } = await render(<EmptyPlansSidebarSlot />);
		expect(container.querySelector('[data-testid="sidebar-empty-state"]')).not.toBeNull();
	});

	it("includes 'No plans yet' guidance text", async () => {
		const { container } = await render(<EmptyPlansSidebarSlot />);
		const text = container.textContent ?? "";
		expect(text).toContain("No plans yet");
	});

	it("references the /planner command as the recovery action", async () => {
		const { container } = await render(<EmptyPlansSidebarSlot />);
		const text = container.textContent ?? "";
		expect(text).toContain("/planner");
	});
});
