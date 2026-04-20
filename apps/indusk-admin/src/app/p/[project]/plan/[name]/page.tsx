import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/PlanDetail";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface PlanPageProps {
	params: Promise<{ project: string; name: string }>;
}

/**
 * Server component for `/p/{project}/plan/{name}`. Resolves the project's
 * path via the registry, reads every active + archived plan for that
 * project, finds the requested plan by folder name, and renders PlanDetail.
 *
 * The stale-project branch (path null OR deleted on disk) is handled by
 * the layout (`app/p/[project]/layout.tsx`) — it replaces its own output
 * with `<StaleProjectFailurePage>` in that case, so this page's rendered
 * element is never placed in the DOM. We early-return `null` when path is
 * stale so the page's own code doesn't trip on `readActivePlans` against
 * a deleted dir. `notFound()` is reserved for the genuinely plan-not-found
 * case (path OK, plan name wrong).
 */
export default async function PlanPage({ params }: PlanPageProps) {
	const { project, name } = await params;
	const projectPath = getProjectPath(project);
	if (!projectPath || !projectPathExists(projectPath)) return null;

	const [active, archived] = await Promise.all([
		readActivePlans(projectPath),
		readArchivedPlans(projectPath),
	]);
	const plan =
		active.find((p) => p.name === name) ??
		archived.find((p) => p.name === name);
	if (!plan) {
		notFound();
	}
	return <PlanDetail plan={plan} />;
}
