import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { StaleProjectFailurePage } from "@/components/StaleProjectFailurePage";
import { readResearchContent } from "@/lib/research-reader";
import { getProjectPath, projectPathExists } from "@/lib/registry-client";

interface ResearchRouteProps {
  params: Promise<{ project: string; slug: string }>;
}

/**
 * Per-project research article — renders a markdown file from the project's
 * `.indusk/research/` directory. Resolves either `{slug}.md` (top-level) or
 * `{slug}/README.md` (nested). Returns `notFound()` when the slug doesn't
 * exist. Stale/unregistered projects get the same failure page as the rest
 * of the `/p/{project}/...` tree.
 */
export default async function ResearchPage({ params }: ResearchRouteProps) {
  const { project, slug } = await params;
  const projectPath = getProjectPath(project);

  if (!projectPath || !projectPathExists(projectPath)) {
    return (
      <StaleProjectFailurePage
        projectName={project}
        projectPath={projectPath ?? undefined}
      />
    );
  }

  const content = await readResearchContent(projectPath, slug);
  if (content === null) notFound();

  return (
    <article
      className="flex flex-col gap-4"
      data-testid="research-article"
      data-research-slug={slug}
    >
      <Markdown>{content}</Markdown>
    </article>
  );
}
