import { notFound } from "next/navigation";
import { getProjectPath } from "@/lib/registry-client";

interface PerProjectPageProps {
	params: Promise<{ project: string }>;
}

/**
 * Per-project landing page. The layout (`app/p/[project]/layout.tsx`) owns
 * the sidebar + PlanList; this page is just the empty-state prompt for the
 * main content area (equivalent to 1.26.0's `app/page.tsx`, but scoped).
 *
 * Returning `notFound()` for unregistered projects matches the layout's
 * behavior; Phase 4 replaces both with the richer
 * `<StaleProjectFailurePage>` that handles path-deleted cases too.
 */
export default async function PerProjectPage({ params }: PerProjectPageProps) {
	const { project } = await params;
	if (!getProjectPath(project)) {
		notFound();
	}

	return (
		<div className="flex h-full flex-col items-center justify-center text-center text-gray-500">
			<h1 className="text-lg font-semibold text-gray-700">Select a plan</h1>
			<p className="mt-2 max-w-sm text-sm">
				Pick a plan from the sidebar to see its phases, trajectory rows, and falsification log.
			</p>
		</div>
	);
}
