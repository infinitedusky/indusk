/**
 * Sidebar's plan-list slot when no plans exist.
 * Used by the App layout (Phase 1 placeholder) and tested directly
 * for T12 — empty-state behavior must not produce a blank screen.
 */
export function EmptyPlansSidebarSlot() {
	return (
		<div className="px-2 py-4 text-sm text-gray-500" data-testid="sidebar-empty-state">
			No plans yet — create one with{" "}
			<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/planner</code>.
		</div>
	);
}
