import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/PlanDetail";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { getProjectPath } from "@/lib/registry-client";

interface PlanPageProps {
	params: Promise<{ project: string; name: string }>;
}

/**
 * Server component for `/p/{project}/plan/{name}`. Resolves the project's
 * path via the registry, then reads every active + archived plan for that
 * project, finds the requested plan by folder name, and renders PlanDetail.
 * 404s for unregistered projects AND unknown plan names — both failure
 * modes share the same affordance (Next.js not-found UI) in Phase 3;
 * Phase 4 adds the richer stale-project failure page.
 *
 * Reading every plan per request stays intentionally simple at v1. Most
 * projects have <50 plans; the cost is tens of milliseconds.
 */
export default async function PlanPage({ params }: PlanPageProps) {
	const { project, name } = await params;
	const projectPath = getProjectPath(project);
	if (!projectPath) {
		notFound();
	}

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
	return <PlanDetail plan={plan} />;
}
