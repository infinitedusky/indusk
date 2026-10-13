import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { planDocuments } from "@/lib/plan-parts-view";
import { readActivePlans, readArchivedPlans } from "@/lib/planning-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface DocPageProps {
  params: Promise<{ project: string; name: string; doc: string }>;
}

/**
 * `/p/{project}/plan/{name}/doc/{doc}` — one of the plan's documents on its own
 * page: research, brief, test-plan, adr, impl, falsification, cleanup or
 * audit, whichever the plan has. The Documents part of the plan's page links
 * here; a document the plan does not have is a 404.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanDocumentPage({ params }: DocPageProps) {
  const { project, name, doc } = await params;
  const projectPath = getProjectPath(project);
  if (!projectPath || !projectPathExists(projectPath)) return null;
  const [active, archived] = await Promise.all([
    readActivePlans(projectPath),
    readArchivedPlans(projectPath),
  ]);
  const plan =
    active.find((p) => p.name === name) ??
    archived.find((p) => p.name === name);
  const document = plan
    ? planDocuments(plan).find((d) => d.slug === doc)
    : undefined;
  if (!document) notFound();
  return (
    <article
      className="grid gap-4"
      data-testid="plan-document-page"
      data-document={document.slug}
    >
      <a className="text-sm text-ink-soft" href={`/p/${project}/plan/${name}`}>
        Back to {name}
      </a>
      <h1 className="font-display text-2xl font-bold leading-5">
        {document.label}
      </h1>
      <Markdown>{document.content}</Markdown>
    </article>
  );
}
