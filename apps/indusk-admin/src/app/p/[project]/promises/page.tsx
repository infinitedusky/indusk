import { readHealthNames } from "@infinitedusky/indusk-mcp/promises/display";
import {
  alarmRead,
  healthRows,
  readHealth,
  ruleFor,
} from "@infinitedusky/indusk-mcp/promises/health";
import {
  alarmSource,
  type SourceName,
} from "@infinitedusky/indusk-mcp/promises/sources";
import { readStanding } from "@infinitedusky/indusk-mcp/promises/standing";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  PromisesDashboard,
  PromisesEmpty,
  PromisesProblems,
} from "@/components/Promises";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readPlanHierarchy } from "@/lib/planning-reader";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { buildRows, parseQuery } from "@/lib/promise-dashboard";
import { readTimelineView } from "@/lib/promise-timeline";
import {
  readProjectHeard,
  readProjectPromises,
  registryOf,
} from "@/lib/promises-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";
import { parseWindow } from "@/lib/timeline-strip";

/** The timeline's read budget: the health read's two seconds, again. */
const TIMELINE_TIMEOUT_MS = 2_000;

interface PromisesRouteProps {
  params: Promise<{ project: string }>;
  /**
   * `?window=24h|7d|30d` and `?source=local|production` (promise-timeline);
   * `?group=state|plan|path`, `?sort=activity|name|plan` and `?q=<text>` (the
   * dashboard, plan-cockpit ADR decision 5).
   */
  searchParams?: Promise<{
    window?: string;
    source?: string;
    group?: string;
    sort?: string;
    q?: string;
  }>;
}

/**
 * Per-project Promises dashboard — `/p/{project}/promises` (day-promises, ADR
 * D8; plan-cockpit, ADR decision 5).
 *
 * Every promise with where it stands, from the package's `readStanding` — one
 * health read shared with it — grouped, sorted and filtered by the URL's
 * query, broken first. A malformed entry is an error block naming the file
 * and the field, with every well-formed entry still listed beneath; no
 * registry at all is an empty state that says how to create one.
 *
 * Live like the plan page (day-always-on, ADR D8): a violation arriving from
 * a deployed system has to turn the chip red without anyone reloading, or the
 * page is a snapshot pretending to be a status board. Same `LiveRefresh` at
 * the project's `admin.refresh_ms`, which also bounds the health read's cache.
 *
 * Stale-path handling parallels the scorecards page: an unregistered or
 * deleted project renders `<StaleProjectFailurePage>` (HTTP 200).
 */
export default async function PerProjectPromisesPage({
  params,
  searchParams,
}: PromisesRouteProps) {
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

  const read = readProjectPromises(projectPath);
  if (!read.ok && "missing" in read) {
    return <PromisesEmpty dir={read.missing} />;
  }
  const registry = registryOf(read);
  // Observed health (day-monitor, ADR D9), per source (promise-sources, ADR
  // D7): one cached read each; unreachable is said, never drawn green.
  // The alarm source's chip leads: it is the one that raises (ADR D5).
  const reads = registry
    ? await readHealth(projectPath, registry, {
        cacheMs: readAdminRefreshMs(projectPath),
      })
    : null;
  const alarm = reads ? alarmRead(reads) : undefined;
  const health = reads
    ? [...reads].sort((a, b) => Number(b === alarm) - Number(a === alarm))
    : null;
  const observed =
    registry && health
      ? health.map((read) => ({
          name: read.name,
          rows: healthRows(registry, read, ruleFor(read, health)),
          ...(read.ok
            ? {}
            : {
                unknownSince: read.unknownSince,
                ...(read.blind
                  ? { blind: { where: read.where, intake: read.blind.intake } }
                  : {}),
              }),
        }))
      : undefined;
  // The timeline (promise-timeline, ADR D6): one source and window, from the
  // URL; the alarm source by default — production when there is one.
  const query = (await searchParams) ?? {};
  const window = parseWindow(query.window);
  const names = (reads ?? []).map((r) => r.name);
  const source: SourceName =
    query.source === "local" || query.source === "production"
      ? query.source
      : alarmSource(names.length ? names : ["local"]);
  const timelines =
    registry && names.includes(source)
      ? await readTimelineView(projectPath, registry, {
          window,
          source,
          sources: names,
          timeoutMs: TIMELINE_TIMEOUT_MS,
        })
      : undefined;
  const standing = reads
    ? await readStanding(projectPath, { health: reads })
    : [];
  const planNames = readHealthNames(projectPath);
  const declarations = readPlanHierarchy(projectPath);
  const rows = buildRows(standing, {
    planTitles: planNames.planTitles,
    words: planNames.words,
    declarations,
    heard: readProjectHeard(projectPath).rows,
    now: Date.now(),
  });
  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      {!read.ok && "problems" in read && (
        <PromisesProblems problems={read.problems} />
      )}
      {registry && (
        <PromisesDashboard
          rows={rows}
          query={parseQuery(query)}
          pathOrder={Object.keys(declarations.subplans)}
          promises={registry.promises}
          incidents={registry.incidents}
          path={`/p/${project}/promises`}
          planHrefPrefix={`/p/${project}/plan/`}
          observed={observed}
          timelines={timelines}
        />
      )}
    </div>
  );
}
