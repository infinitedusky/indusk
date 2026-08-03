import Link from "next/link";
import { PlanList } from "@/components/PlanList";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  readActivePlans,
  readArchivedPlans,
  readPlanHierarchy,
} from "@/lib/planning-reader";
import {
  getProjectPath,
  projectPathExists,
  readRegistryProjects,
} from "@/lib/registry-client";
import { readProjectResearch } from "@/lib/research-reader";

interface PerProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}

/**
 * Per-project layout — scopes the sidebar + plan list to the project named
 * in the URL. Every `/p/{project}/...` route gets this frame; the homepage
 * (`/`) and top-level routes (`/scorecards`) do not.
 *
 * If the named project isn't in the registry OR its registered path no
 * longer exists on disk, renders `<StaleProjectFailurePage>` — a 200
 * response with recovery instructions, NOT a 500 or 404. This is the
 * invariant T11 asserts.
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

  if (!projectPath || !projectPathExists(projectPath)) {
    return (
      <StaleProjectFailurePage
        projectName={project}
        projectPath={projectPath ?? undefined}
      />
    );
  }

  const [active, archived, research] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
    readProjectResearch(projectPath),
  ]);
  const hierarchy = readPlanHierarchy(projectPath);
  const masterOrder = hierarchy.roadmap;
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
            <ProjectSwitcher projects={registered} currentProject={project} />
          </div>
        }
      >
        <nav className="flex flex-col gap-1 pb-3">
          <Link
            href={`/p/${project}/scorecards`}
            className="rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
          >
            Scorecards
          </Link>
        </nav>
        <PlanList
          active={active}
          archived={archived}
          masterOrder={masterOrder}
          grouping={hierarchy}
          planHrefPrefix={`/p/${project}/plan/`}
        />
        {research.length > 0 && (
          <nav
            className="flex flex-col gap-1 pt-3 border-t border-gray-200 mt-3"
            data-testid="research-group"
          >
            <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Research
            </h3>
            {research.map((entry) => (
              <Link
                key={entry.slug}
                href={`/p/${project}/research/${entry.slug}`}
                className="truncate rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100"
                title={entry.title ?? entry.slug}
              >
                {entry.title ?? entry.slug}
              </Link>
            ))}
          </nav>
        )}
      </Sidebar>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
