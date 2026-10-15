import { notFound } from "next/navigation";
import {
  type Plan,
  readActivePlans,
  readArchivedPlans,
} from "@/lib/planning-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

/**
 * The plan a plan route renders: `/plan/{name}`, its `/brief` and each
 * `/doc/{doc}` find it one way.
 *
 * Returns `null` when the project's path is gone — the layout replaces the
 * page with its stale-project failure then, so the route has nothing to
 * render. An active plan wins over an archived one of the same name;
 * `notFound()` is only for a plan that does not exist.
 */
export async function readPlanPage(
  project: string,
  name: string,
): Promise<{ projectPath: string; plan: Plan } | null> {
  const projectPath = getProjectPath(project);
  if (!projectPath || !projectPathExists(projectPath)) return null;
  const [active, archived] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
  ]);
  const plan =
    active.find((p) => p.name === name) ??
    archived.find((p) => p.name === name);
  if (!plan) notFound();
  return { projectPath, plan };
}
