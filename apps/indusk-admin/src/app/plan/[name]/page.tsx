import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/PlanDetail";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { getProjectRoot } from "@/lib/project-root";

interface PlanPageProps {
  params: Promise<{ name: string }>;
}

/**
 * Server component for `/plan/[name]`. Reads every active and archived plan
 * (cheap — filesystem walk + frontmatter parse), finds the requested plan by
 * folder name, then loads any eval scorecards in the plan's date range and
 * renders PlanDetail. Returns 404 for unknown names.
 *
 * Reading every plan on each request is intentionally simple at v1. Most
 * projects have <50 plans; the cost is tens of milliseconds. v2 may add
 * a single-plan fast path if profiling justifies it.
 */
export default async function PlanPage({ params }: PlanPageProps) {
  const { name } = await params;
  const projectRoot = getProjectRoot();
  const [active, archived] = await Promise.all([
    readActivePlans(projectRoot),
    readArchivedPlans(projectRoot),
  ]);
  const plan = active.find((p) => p.name === name) ?? archived.find((p) => p.name === name);
  if (!plan) {
    notFound();
  }
  return <PlanDetail plan={plan} />;
}
