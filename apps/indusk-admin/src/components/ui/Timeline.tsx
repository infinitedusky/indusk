export type TimelineTone = "good" | "bad";

export interface TimelineItem {
  when: string;
  what: string;
  tone?: TimelineTone;
}

export interface TimelineProps {
  items: readonly TimelineItem[];
  className?: string;
}

/**
 * What happened to a promise, newest first: when, a dot that is green for a
 * held check and red for a broken one, and what it was.
 */
export function Timeline({ items, className = "" }: TimelineProps) {
  return (
    <ol data-component="timeline" className={`grid list-none ${className}`}>
      {items.map((item) => (
        <li
          key={`${item.when} ${item.what}`}
          className="cols-timeline grid gap-2 pb-3 text-md leading-4"
        >
          <span className="whitespace-nowrap font-mono text-xs leading-2 text-ink-faint">
            {item.when}
          </span>
          <span
            className={`mt-tight size-dot-lg rounded-pill border-2 ${
              item.tone === "good"
                ? "border-ok bg-ok"
                : item.tone === "bad"
                  ? "border-bad bg-bad"
                  : "border-idle bg-surface"
            }`}
          />
          <span className={item.tone === "bad" ? "text-bad" : undefined}>
            {item.what}
          </span>
        </li>
      ))}
    </ol>
  );
}
