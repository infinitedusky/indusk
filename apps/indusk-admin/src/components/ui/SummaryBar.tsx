export interface SummaryCounts {
  broken: number;
  proving: number;
  declared: number;
  enforced: number;
}

export interface SummaryBarProps {
  counts: SummaryCounts;
  /** Right of the legend: "13 promises across 4 plans". */
  note?: string;
  className?: string;
}

const SEGMENTS: ReadonlyArray<{ key: keyof SummaryCounts; colour: string }> = [
  { key: "broken", colour: "bg-bad" },
  { key: "proving", colour: "bg-warn" },
  { key: "declared", colour: "bg-idle" },
  { key: "enforced", colour: "bg-ok" },
];

/**
 * The project's promises at a glance: one bar split by standing, broken
 * first, and a legend that names each count.
 */
export function SummaryBar({ counts, note, className = "" }: SummaryBarProps) {
  return (
    <section
      data-component="summary-bar"
      aria-label="Promises by state"
      className={`grid gap-snug ${className}`}
    >
      <div className="flex h-dot-lg gap-hair overflow-hidden rounded-sm bg-surface">
        {SEGMENTS.filter(({ key }) => counts[key] > 0).map(
          ({ key, colour }) => (
            <span
              key={key}
              className={`block ${colour}`}
              style={{ flex: counts[key] }}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-tight text-sm leading-3 text-ink-soft">
        {SEGMENTS.map(({ key }) => (
          <span key={key}>
            <b className="mr-1 font-mono text-md font-semibold leading-1 text-ink">
              {counts[key]}
            </b>
            {key}
          </span>
        ))}
        {note ? <span className="ml-auto">{note}</span> : null}
      </div>
    </section>
  );
}
