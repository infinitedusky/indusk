import type { DraftView } from "@infinitedusky/indusk-mcp/drafts";
import { PartSection } from "@/components/ui/PartSection";

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * What the conversation has settled so far, as the agent writes it: the
 * promises, expectations and looks of the draft's brief, named and folded as a
 * plan's page folds them. Read by the package's `drafts/view`; nothing is
 * worked out here.
 *
 * promise: a-plan-page-shows-the-parts-of-its-brief
 */
export function DraftParts({ view }: { view: DraftView }) {
  if (!view.hasBrief) return null;
  return (
    <>
      <PartSection
        data-part="promises"
        title="Promises"
        summary={count(view.promises.length, "promise")}
      >
        <div className="flex flex-wrap gap-2">
          {view.promises.map((name) => (
            <span
              key={name}
              data-testid="draft-promise"
              className="inline-flex items-center rounded-pill border border-line bg-surface px-3 py-snug text-sm leading-3 font-medium"
            >
              {name}
            </span>
          ))}
        </div>
      </PartSection>
      <PartSection
        data-part="expectations"
        title="Expectations"
        summary={count(view.expectations.length, "expectation")}
      >
        <ol className="grid gap-2 text-sm leading-3">
          {view.expectations.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ol>
      </PartSection>
      <PartSection
        data-part="looks"
        title="Looks"
        summary={count(view.looks.length, "look")}
      >
        <div className="flex flex-wrap gap-2">
          {view.looks.map((name) => (
            <span
              key={name}
              data-testid="draft-look"
              className="inline-flex items-center rounded-pill border border-line bg-surface px-3 py-snug font-mono text-xs leading-2"
            >
              {name}
            </span>
          ))}
        </div>
      </PartSection>
    </>
  );
}
