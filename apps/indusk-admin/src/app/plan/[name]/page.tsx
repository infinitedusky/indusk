import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/PlanDetail";
import {
  type Plan,
  readActivePlans,
  readArchivedPlans,
  readEvalScorecards,
} from "@/lib/planning-reader";
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
  const scorecards = await readEvalScorecards(projectRoot, planDateRange(plan));
  return <PlanDetail plan={plan} scorecards={scorecards} />;
}

/**
 * Approximate the plan's lifetime as the date range to fetch scorecards for.
 * Start: brief.date frontmatter (or epoch fallback). End: retrospective.date
 * frontmatter (or now).
 *
 * Per Phase 5 Context note: this is a date-range overlap, NOT a real plan↔commit
 * join. A scorecard whose timestamp falls in the range surfaces under this plan
 * even if the underlying commit doesn't relate to it. v2 may add a `plan` field
 * to scorecards to tighten this, but v1's simplicity is fine for the demo.
 */
function planDateRange(plan: Plan): { from: Date; to: Date } {
  const fromStr = plan.brief?.frontmatter.date;
  const toStr = plan.retrospective?.frontmatter.date;
  const from = parseDate(fromStr) ?? new Date(0);
  const to = parseDate(toStr) ?? new Date();
  return { from, to };
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  // gray-matter parses YAML dates as Date objects when written without quotes
  // (`date: 2026-04-19`), as strings when quoted. Handle both.
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
