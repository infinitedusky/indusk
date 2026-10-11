import { readHealthNames } from "@infinitedusky/indusk-mcp/promises/display";
import {
  readHealth,
  redPlans,
} from "@infinitedusky/indusk-mcp/promises/health";
import {
  readLookStanding,
  readStanding,
} from "@infinitedusky/indusk-mcp/promises/standing";
import { NeedsYou } from "@/components/cockpit/NeedsYou";
import { NavLink } from "@/components/NavLink";
import { PlanList } from "@/components/PlanList";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { Sidebar } from "@/components/ui/Sidebar";
import {
  UnassignedWorktrees,
  WorktreeRecordError,
} from "@/components/Worktrees";
import { readWaiting } from "@/lib/decisions-reader";
import {
  readActivePlans,
  readArchivedPlans,
  readPlanHierarchy,
  readProjectWorktrees,
} from "@/lib/planning-reader";
import {
  holdingCounts,
  readProjectPromises,
  registryOf,
} from "@/lib/promises-reader";
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

  const [active, archived, research, worktrees] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
    readProjectResearch(projectPath),
    readProjectWorktrees(projectPath),
  ]);
  const hierarchy = readPlanHierarchy(projectPath);
  const masterOrder = hierarchy.roadmap;
  const registered = readRegistryProjects().map((p) => ({ name: p.name }));
  // "holding N" per archived plan (day-promises, ADR D8): derived from the
  // registry on every request, no lifecycle position, absent when none.
  const promisesRead = readProjectPromises(projectPath);
  const holding = holdingCounts(promisesRead);
  // A plan holding a violated promise shows red without being opened
  // (day-monitor, A23) — the same cached read the Promises page makes, red
  // from the alarm source alone (promise-sources, ADR D5).
  const registry = registryOf(promisesRead);
  const reads = registry ? await readHealth(projectPath, registry) : null;
  const red = registry && reads ? redPlans(registry, reads) : new Set<string>();
  // The nav's count is the dashboard's: the package's standing, from the same
  // health read (plan-cockpit, ADR decision 2).
  // A broken look counts beside them (ui-promises ADR decision 7), from the
  // package's look standing — the rows the dashboard lists first.
  const brokenPromises = reads
    ? (await readStanding(projectPath, { health: reads })).filter(
        (s) => s.standing === "broken",
      ).length
    : 0;
  const brokenLooks = (await readLookStanding(projectPath)).rows.filter(
    (l) => l.standing === "broken",
  ).length;
  const brokenCount = brokenPromises + brokenLooks;

  // Each Path's released count: when a release shipped a plan, from the
  // package's `planDates` (display-names), read once for the whole nav.
  const { planDates, planTitles } = readHealthNames(projectPath);

  // Needs you: each plan waiting on the person, with the step it waits at —
  // the package's `planWaiting`, over what the admin holds (ADR decision 2).
  const waiting = readWaiting(project, active);

  return (
    <div data-component="shell" className="flex h-full w-full">
      <Sidebar
        header={
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-semibold text-ink">
                {project}
              </span>
              <span className="text-xs text-ink-faint">project</span>
            </div>
            <ProjectSwitcher projects={registered} currentProject={project} />
          </div>
        }
      >
        <nav className="flex flex-col gap-1 pb-3">
          <NavLink
            href={`/p/${project}/scorecards`}
            className="rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-idle-wash"
          >
            Scorecards
          </NavLink>
          <NavLink
            href={`/p/${project}/promises`}
            data-testid="nav-promises"
            className="flex items-center justify-between rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-idle-wash"
          >
            Promises
            {brokenCount > 0 && (
              <span
                data-testid="broken-count"
                title={`${brokenCount} broken`}
                className="rounded-pill bg-bad px-2 text-xs font-medium text-surface"
              >
                {brokenCount}
              </span>
            )}
          </NavLink>
          <NavLink
            href={`/p/${project}/looks`}
            data-testid="nav-looks"
            className="rounded-md py-1 pr-2 pl-5 text-sm text-ink-soft hover:bg-idle-wash"
          >
            Looks
          </NavLink>
        </nav>
        <NeedsYou project={project} waiting={waiting} titles={planTitles} />
        {!worktrees.ok && (
          <WorktreeRecordError
            file={worktrees.file}
            problem={worktrees.problem}
          />
        )}
        <PlanList
          active={active}
          archived={archived}
          masterOrder={masterOrder}
          grouping={hierarchy}
          holding={holding}
          red={red}
          dates={planDates}
          planHrefPrefix={`/p/${project}/plan/`}
        />
        {worktrees.ok && (
          <UnassignedWorktrees worktrees={worktrees.unassigned} />
        )}
        {research.length > 0 && (
          <nav
            className="flex flex-col gap-1 pt-3 border-t border-line mt-3"
            data-testid="research-group"
          >
            <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-caps text-ink-faint">
              Research
            </h3>
            {research.map((entry) => (
              <NavLink
                key={entry.slug}
                href={`/p/${project}/research/${entry.slug}`}
                className="truncate rounded-md px-2 py-1 text-sm text-ink-soft hover:bg-idle-wash"
                title={entry.title ?? entry.slug}
              >
                {entry.title ?? entry.slug}
              </NavLink>
            ))}
          </nav>
        )}
      </Sidebar>
      <main className="min-w-0 flex-1 overflow-y-auto p-6 max-[759px]:pt-16">
        {children}
      </main>
    </div>
  );
}
