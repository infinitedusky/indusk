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
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  PromisesEmpty,
  PromisesProblems,
  PromisesTable,
} from "@/components/Promises";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readAdminRefreshMs } from "@/lib/project-reader";
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
  /** `?window=24h|7d|30d` and `?source=local|production` (promise-timeline). */
  searchParams?: Promise<{ window?: string; source?: string }>;
}

/**
 * Per-project Promises page — `/p/{project}/promises` (day-promises, ADR D8).
 *
 * Reads the registry at request time through the one reader and renders
 * declared state, with observed health beside each behaviour promise from the
 * local Jaeger (day-monitor). A malformed entry is an error block naming the
 * file and the field, with every well-formed entry still listed beneath; no
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
  return (
    <div className="flex flex-col gap-4">
      <LiveRefresh intervalMs={readAdminRefreshMs(projectPath)} />
      {!read.ok && "problems" in read && (
        <PromisesProblems problems={read.problems} />
      )}
      {registry && (
        <PromisesTable
          promises={registry.promises}
          incidents={registry.incidents}
          planHrefPrefix={`/p/${project}/plan/`}
          observed={observed}
          timelines={timelines}
          timelinePath={`/p/${project}/promises`}
          heard={readProjectHeard(projectPath)}
        />
      )}
    </div>
  );
}
