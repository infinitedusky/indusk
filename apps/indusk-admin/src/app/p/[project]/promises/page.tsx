import { LiveRefresh } from "@/components/LiveRefresh";
import {
  PromisesEmpty,
  PromisesProblems,
  PromisesTable,
} from "@/components/Promises";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readAdminRefreshMs } from "@/lib/project-reader";
import { healthRows, readHealth } from "@/lib/promise-health";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface PromisesRouteProps {
  params: Promise<{ project: string }>;
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
  // Observed health (day-monitor, ADR D9): one cached read of the local
  // Jaeger; unreachable is said, never drawn green.
  const health = registry ? await readHealth(projectPath, registry) : null;
  const observed =
    registry && health
      ? {
          rows: healthRows(registry, health),
          ...(health.ok ? {} : { unknownSince: health.unknownSince }),
        }
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
        />
      )}
    </div>
  );
}
