import { redirect } from "next/navigation";

interface BriefPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * `/p/{project}/plan/{name}/brief` — kept so the old address works: the brief
 * is one of the plan's documents, read at `/doc/brief`.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanBriefPage({ params }: BriefPageProps) {
  const { project, name } = await params;
  redirect(`/p/${project}/plan/${name}/doc/brief`);
}
