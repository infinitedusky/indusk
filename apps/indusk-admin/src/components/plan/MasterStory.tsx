import Link from "next/link";
import type { ReactNode } from "react";
import { SubplanRow } from "@/components/ui/SubplanRow";
import type { MasterStory as Story } from "@/lib/master-story";

/**
 * A master plan's page beneath its frame, as the approved `plan.master`
 * mockup draws it: what the master is for, how many of its plans are released,
 * in draft and queued (and where to read the master itself), then "The plans,
 * in order" as a `SubplanRow` each. The rows and counts are `masterStory`'s,
 * the Path group the nav counts, so this page and the nav agree.
 */
export function MasterStory({
  purpose,
  story,
  masterHref,
}: {
  /** The master's `description:`; empty when it wrote none. */
  purpose: string | null;
  story: Story;
  masterHref: string;
}) {
  const { rows, counts } = story;
  return (
    <>
      <section className="grid gap-3">
        {purpose ? (
          <p
            className="measure-message text-lg leading-6 text-ink-soft"
            data-testid="master-purpose"
          >
            {purpose}
          </p>
        ) : null}
        <div
          className="flex flex-wrap items-baseline gap-x-5 gap-y-2 text-sm leading-3 text-ink-soft"
          data-testid="master-counts"
        >
          <Count n={counts.released}>of {counts.total} released</Count>
          <Count n={counts.drafts}>in draft</Count>
          <Count n={counts.queued}>queued</Count>
          <Link
            href={masterHref}
            className="story-link font-medium text-dusk no-underline"
          >
            Read the master plan
          </Link>
        </div>
      </section>
      <section className="grid gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h2 className="font-display text-lg font-bold leading-4">
            The plans, in order
          </h2>
          <span className="font-mono text-xs leading-2 text-ink-faint">
            {counts.total} {counts.total === 1 ? "plan" : "plans"}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {rows.map((row) => (
            <SubplanRow
              key={row.handle}
              number={<span data-testid="subplan-number">{row.number}</span>}
              initials={row.initials}
              state={row.state}
              title={row.title}
              description={row.description}
              stage={row.stage}
              href={row.href}
            />
          ))}
        </div>
      </section>
    </>
  );
}

function Count({ n, children }: { n: number; children: ReactNode }) {
  return (
    <span>
      <b className="mr-1 font-mono text-md font-semibold leading-1 text-ink">
        {n}
      </b>{" "}
      {children}
    </span>
  );
}
