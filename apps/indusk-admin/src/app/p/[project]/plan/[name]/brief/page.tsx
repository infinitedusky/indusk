import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface BriefPageProps {
  params: Promise<{ project: string; name: string }>;
}

/**
 * `/p/{project}/plan/{name}/brief` — the brief itself, one click below the
 * plan's three parts (brief-as-the-contract ADR decision 7): the document a
 * person approves, read from the checkout the plan is worked in.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanBriefPage({ params }: BriefPageProps) {
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
  if (!plan?.brief) notFound();
  return (
    <article className="grid gap-4" data-testid="plan-brief">
      <a className="text-sm text-ink-soft" href={`/p/${project}/plan/${name}`}>
        Back to {name}
      </a>
      <Markdown>{plan.brief.content}</Markdown>
    </article>
  );
}
