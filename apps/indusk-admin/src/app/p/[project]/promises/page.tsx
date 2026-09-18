import {
  PromisesEmpty,
  PromisesProblems,
  PromisesTable,
} from "@/components/Promises";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface PromisesRouteProps {
  params: Promise<{ project: string }>;
}

/**
 * Per-project Promises page — `/p/{project}/promises` (day-promises, ADR D8).
 *
 * Reads the registry at request time through the one reader and renders
 * declared state only: every `enforced` chip is hollow, because nothing in
 * this step observes anything. A malformed entry is an error block naming the
 * file and the field, with every well-formed entry still listed beneath; no
 * registry at all is an empty state that says how to create one.
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
  return (
    <div className="flex flex-col gap-4">
      {!read.ok && "problems" in read && (
        <PromisesProblems problems={read.problems} />
      )}
      {registry && (
        <PromisesTable
          promises={registry.promises}
          incidents={registry.incidents}
          planHrefPrefix={`/p/${project}/plan/`}
        />
      )}
    </div>
  );
}
