/**
 * Sidebar's plan-list slot when no plans exist.
 * Used by the App layout (Phase 1 placeholder) and tested directly
 * for T12 — empty-state behavior must not produce a blank screen.
 */
export function EmptyPlansSidebarSlot() {
  return (
    <div
      className="px-2 py-4 text-sm text-ink-faint"
      data-testid="sidebar-empty-state"
    >
      No plans yet — create one with{" "}
      <code className="rounded-md bg-idle-wash px-1 py-hair text-xs">
        /planner
      </code>
      .
    </div>
  );
}
