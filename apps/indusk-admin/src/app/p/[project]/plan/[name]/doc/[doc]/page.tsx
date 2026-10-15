import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { readPlanPage } from "@/lib/plan-page";
import { planDocuments } from "@/lib/plan-parts-view";
import { readPlanMasterContent } from "@/lib/planning-reader";

interface DocPageProps {
  params: Promise<{ project: string; name: string; doc: string }>;
}

/**
 * `/p/{project}/plan/{name}/doc/{doc}` — one of the plan's documents on its own
 * page: research, brief, test-plan, adr, impl, falsification, cleanup or
 * audit (or `master`, a master's own `master.md`), whichever the plan has. The Documents part of the plan's page links
 * here; a document the plan does not have is a 404.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export default async function PlanDocumentPage({ params }: DocPageProps) {
  const { project, name, doc } = await params;
  const found = await readPlanPage(project, name);
  if (!found) return null;
  const { plan, projectPath } = found;
  // A master's `master.md` is the document `master`: read from the copy the
  // plan is worked in, only when asked for.
  const master =
    doc === "master"
      ? ((await readPlanMasterContent(
          plan.worktree?.path ?? projectPath,
          name,
        )) ?? undefined)
      : undefined;
  const document = planDocuments(plan, master).find((d) => d.slug === doc);
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
