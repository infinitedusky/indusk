export type StatTone = "ok" | "bad";

export interface StatProps {
  label: string;
  value: string;
  /** What the number is over: "last 30 days", "now". */
  note?: string;
  /** Colours the value when it is a good or a bad number. */
  tone?: StatTone;
  className?: string;
}

/**
 * One number and what it counts, drawn on the surface so a row of them
 * reads as one ruled strip.
 */
export function Stat({ label, value, note, tone, className = "" }: StatProps) {
  return (
    <div
      data-component="stat"
      className={`grid gap-1 bg-surface px-4 py-3 ${className}`}
    >
      <span className="text-2xs font-semibold uppercase leading-1 tracking-caps text-ink-faint">
        {label}
      </span>
      <span
        className={`font-mono text-xl font-semibold leading-5 ${
          tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : ""
        }`}
      >
        {value}
      </span>
      {note ? (
        <span className="text-xs leading-2 text-ink-faint">{note}</span>
      ) : null}
    </div>
  );
}
