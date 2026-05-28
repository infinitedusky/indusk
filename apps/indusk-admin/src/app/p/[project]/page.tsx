interface PerProjectPageProps {
  params: Promise<{ project: string }>;
}

/**
 * Per-project landing page. The layout (`app/p/[project]/layout.tsx`) owns
 * the sidebar + PlanList AND the stale-project failure branch (T11) — when
 * the registry lookup fails or the path is deleted, the layout replaces
 * its own output entirely with `<StaleProjectFailurePage>` and this page's
 * rendered element is never placed in the DOM.
 *
 * So the page is an unconditional empty-state — no notFound() call, no
 * re-check of the project path. Trust the layout.
 */
export default async function PerProjectPage({ params }: PerProjectPageProps) {
  // Awaiting params is still required by Next 16's dynamic-segment contract,
  // even though this page doesn't branch on the value.
  await params;

  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
      <h1 className="text-lg font-semibold text-gray-700">Select a plan</h1>
      <p className="mt-2 max-w-sm text-sm">
        Pick a plan from the sidebar to see its phases, trajectory rows, and
        falsification log.
      </p>
    </div>
  );
}
