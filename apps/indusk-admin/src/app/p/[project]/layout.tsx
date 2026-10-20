import { readHealthNames } from "@infinitedusky/indusk-mcp/promises/display";
import {
  readHealth,
  redPlans,
} from "@infinitedusky/indusk-mcp/promises/health";
import {
  readLookStanding,
  readStanding,
} from "@infinitedusky/indusk-mcp/promises/standing";
import { CockpitFrame } from "@/components/cockpit/CockpitFrame";
import { NavViewLink } from "@/components/cockpit/NavItems";
import { NeedsYou } from "@/components/cockpit/NeedsYou";
import { NavLink } from "@/components/NavLink";
import { PlanList } from "@/components/PlanList";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import {
  UnassignedWorktrees,
  WorktreeRecordError,
} from "@/components/Worktrees";
import {
  needsProcessList,
  readWaiting,
  startPage,
  withSituations,
} from "@/lib/decisions-reader";
import { worktreePromises } from "@/lib/plan-health";
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

  // The nav is read for every page of the project: it keeps its own count of reads and starts.
  const page = startPage("nav", projectPath);
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
  // A plan holding a broken promise shows red without being opened
  // (day-monitor, A23) — the same cached read the Promises page makes, red
  // from the alarm source alone (promise-sources, ADR D5).
  const registry = registryOf(promisesRead);
  const reads = registry ? await readHealth(projectPath, registry) : null;
  // The plans' worktrees' promises too, as each plan's page reads them, so a
  // break red on a plan's page is red here (plan-page-promise-health A7).
  const red =
    registry && reads
      ? redPlans(
          registry,
          reads,
          worktreePromises(
            projectPath,
            active.flatMap((p) => (p.worktree ? [p.worktree.path] : [])),
          ),
        )
      : new Set<string>();
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
  const { planDates, words } = await readHealthNames(projectPath);
  // Each plan's title, from the copy the admin reads it from (its worktree
  // first), so Needs you names a worktree plan by its own title.
  const planTitles = Object.fromEntries(
    [...active, ...archived].map((p) => [p.name, p.title]),
  );

  // Needs you: each plan waiting on the person, with the step it waits at —
  // the package's `planWaiting`, over what the admin holds (ADR decision 2).
  // The process list and the trunk's landings are read once for the nav and shared with the page.
  const read = await page.reads({
    processList: () => needsProcessList(project, active),
  });
  const waiting = await readWaiting(project, projectPath, active, read);
  // What each plan reads as, and what runs for it, from the package's one reader of both.
  const situated = await withSituations(project, projectPath, active, waiting, {
    read,
  });
  page.finish(active.length);

  const summary = `${active.length} ${active.length === 1 ? "plan" : "plans"}`;

  return (
    <CockpitFrame
      project={project}
      summary={summary}
      nav={
        <>
          <div className="nav-hide px-1 pb-1">
            <ProjectSwitcher projects={registered} currentProject={project} />
          </div>
          <NeedsYou project={project} waiting={waiting} titles={planTitles} />
          <NavViewLink
            href={`/p/${project}/scorecards`}
            icon="S"
            label="Scorecards"
          />
          <NavViewLink
            href={`/p/${project}/promises`}
            data-testid="nav-promises"
            icon="P"
            label="Promises"
            count={
              brokenCount > 0 ? (
                <span
                  data-testid="broken-count"
                  title={`${brokenCount} broken`}
                >
                  {brokenCount}
                </span>
              ) : undefined
            }
          />
          <NavViewLink
            href={`/p/${project}/looks`}
            data-testid="nav-looks"
            icon="L"
            label="Looks"
          />
          {!worktrees.ok && (
            <WorktreeRecordError
              file={worktrees.file}
              problem={worktrees.problem}
            />
          )}
          <div className="nav-hide flex flex-col gap-4">
            <PlanList
              active={situated}
              archived={archived}
              masterOrder={masterOrder}
              grouping={hierarchy}
              holding={holding}
              red={red}
              dates={planDates}
              words={words}
              waiting={Object.fromEntries(waiting.map((w) => [w.plan, w.step]))}
              planHrefPrefix={`/p/${project}/plan/`}
            />
            {worktrees.ok && (
              <UnassignedWorktrees worktrees={worktrees.unassigned} />
            )}
            {research.length > 0 && (
              <nav className="flex flex-col gap-1" data-testid="research-group">
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
          </div>
        </>
      }
    >
      {children}
    </CockpitFrame>
  );
}
