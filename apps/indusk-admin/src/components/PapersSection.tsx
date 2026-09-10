import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/ui/Badge";
import {
  paperStatusLabel,
  paperStatusToBadge,
} from "@/components/ui/badge-variant";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { sectionMarkdown } from "@/lib/markdown-export";
import type { Plan } from "@/lib/planning-reader";

/**
 * Papers — one collapsible per `kind: paper` document, its status badge
 * beside the title. The label `published (stale)` is derived by the shared
 * parser from the content hash, never stored; a papers-only plan renders this
 * section and nothing else.
 */
export function PapersSection({
  planName,
  papers,
}: {
  planName: string;
  papers: NonNullable<Plan["papers"]>;
}) {
  return (
    <section className="flex flex-col gap-2" data-testid="papers-section">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Papers
      </h2>
      {papers.map((paper) => {
        const label = paperStatusLabel(paper.status, paper.stale);
        return (
          <div
            key={paper.file}
            className="flex flex-col gap-1"
            data-testid={`paper-${paper.file}`}
          >
            <div className="flex items-center gap-2">
              <Badge variant={paperStatusToBadge(paper.status, paper.stale)}>
                {label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {paper.file}
              </span>
            </div>
            <CollapsibleSection
              title={paper.title}
              defaultOpen={false}
              persistKey={`plan:${planName}:paper:${paper.file}`}
              copyMarkdown={sectionMarkdown(paper.title, paper.content ?? "")}
            >
              <Markdown>{paper.content ?? ""}</Markdown>
            </CollapsibleSection>
          </div>
        );
      })}
    </section>
  );
}
