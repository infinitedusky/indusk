import { notFound } from "next/navigation";
import type { SubplanEntry } from "@/components/ParentPlanView";
import { PlanDetail } from "@/components/PlanDetail";
import {
  readActivePlans,
  readArchivedPlans,
  readPlanHierarchy,
  readPlanMasterContent,
} from "@/lib/planning-reader";
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

  // Parent plan? Resolve its declared children against what exists on disk
  // (dawn-ui-plan-grouping Phase 3). Missing/corrupt declarations yield an
  // empty list here, and PlanDetail falls back to the standard sections —
  // grouping never hides a plan.
  const declared = readPlanHierarchy(projectPath).subplans[name] ?? [];
  let subplans: SubplanEntry[] | undefined;
  let masterContent: string | undefined;
  if (declared.length > 0) {
    // Archived first so an active plan overwrites it on a name collision —
    // matching the `active.find ?? archived.find` precedence above (T11).
    const byName = new Map(
      [...archived, ...active].map((p) => [p.name, p] as const),
    );
    subplans = declared.map((n) => ({ name: n, plan: byName.get(n) }));
    masterContent =
      (await readPlanMasterContent(projectPath, name)) ?? undefined;
  }

  return (
    <PlanDetail
      plan={plan}
      subplans={subplans}
      masterContent={masterContent}
      planHrefPrefix={`/p/${project}/plan/`}
    />
  );
}
