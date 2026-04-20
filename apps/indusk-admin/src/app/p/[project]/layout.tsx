import { notFound } from "next/navigation";
import { PlanList } from "@/components/PlanList";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { Sidebar } from "@/components/ui/Sidebar";
import {
	readActivePlans,
	readArchivedPlans,
	readMasterPlanOrder,
} from "@/lib/planning-reader";
import {
	getProjectPath,
	readRegistryProjects,
} from "@/lib/registry-client";

interface PerProjectLayoutProps {
	children: React.ReactNode;
	params: Promise<{ project: string }>;
}

/**
 * Per-project layout — scopes the sidebar + plan list to the project named
 * in the URL. Every `/p/{project}/...` route gets this frame; the homepage
 * (`/`) and top-level routes (`/scorecards`) do not.
 *
 * If the named project isn't in the registry, we currently render a
 * Next.js `notFound()`. Phase 4 replaces that with a richer
 * `<StaleProjectFailurePage>` that also covers path-deleted-on-disk cases
 * and gives the user clear recovery instructions.
 *
 * Typed with a local props interface rather than Next 16's global
 * `LayoutProps` helper because the latter's inferred `params` shape
 * regenerates from the route tree during `next build`; running `tsc
 * --noEmit` in isolation (without a prior next build) fails to resolve
 * `LayoutProps`. Keeping a local interface keeps the typecheck hermetic.
 */
export default async function PerProjectLayout({
	children,
	params,
}: PerProjectLayoutProps) {
	const { project } = await params;
	const projectPath = getProjectPath(project);
	if (!projectPath) {
		notFound();
	}

	const [active, archived] = await Promise.all([
		readActivePlans(projectPath),
		readArchivedPlans(projectPath),
	]);
	const masterOrder = readMasterPlanOrder(projectPath);
	const registered = readRegistryProjects().map((p) => ({ name: p.name }));

	return (
		<div className="flex h-full w-full">
			<Sidebar
				header={
					<div className="flex flex-col gap-2">
						<div className="flex items-baseline justify-between">
							<span className="truncate text-sm font-semibold text-gray-900">
								{project}
							</span>
							<span className="text-xs text-gray-500">project</span>
						</div>
						<ProjectSwitcher
							projects={registered}
							currentProject={project}
						/>
					</div>
				}
			>
				<PlanList
					active={active}
					archived={archived}
					masterOrder={masterOrder}
					planHrefPrefix={`/p/${project}/plan/`}
				/>
			</Sidebar>
			<main className="flex-1 overflow-y-auto p-6">{children}</main>
		</div>
	);
}
