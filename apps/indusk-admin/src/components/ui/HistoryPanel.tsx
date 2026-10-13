import type { DecisionEntry } from "@infinitedusky/indusk-mcp/plans/history";
import type { HTMLAttributes } from "react";
import { stamp } from "@/lib/stamp";

export interface HistoryPanelProps
  extends Omit<HTMLAttributes<HTMLDetailsElement>, "children"> {
  /** The plan's recorded events, oldest first, as `plans/history` reads them. */
  entries: DecisionEntry[];
  /** Drawn open. Closed unless asked. */
  open?: boolean;
}

/**
 * A plan's History: what happened to it, newest first, each with what, who and
 * when. Closed to one row ("History · 5 events") until the person opens it. It
 * only lists; going back to an earlier point is not offered here.
 */
export function HistoryPanel({
  entries,
  open = false,
  className = "",
  ...rest
}: HistoryPanelProps) {
  const count = `${entries.length} ${entries.length === 1 ? "event" : "events"}`;
  return (
    <details
      data-component="history-panel"
      open={open}
      className={`group overflow-hidden rounded-xl border border-line bg-surface ${className}`}
      {...rest}
    >
      <summary className="flex cursor-pointer list-none items-baseline gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-sm leading-3 text-ink-faint">
          <span className="group-open:hidden">▸</span>
          <span className="hidden group-open:inline">▾</span>
        </span>
        <h2 className="font-display text-base font-bold leading-5">History</h2>
        <span className="font-mono text-xs leading-2 text-ink-faint">
          · {count}
        </span>
      </summary>
      <ol className="list-none border-t border-line">
        {[...entries].reverse().map((e) => (
          <li
            key={`${e.at}-${e.answer}`}
            data-testid="history-entry"
            className="grid gap-hair border-t border-line px-4 py-3 first:border-t-0"
          >
            <span className="font-mono text-xs leading-2 text-ink-faint">
              <time dateTime={e.at}>{stamp(e.at)}</time> · {e.by}
            </span>
            <span className="text-sm leading-3 text-ink-soft">
              {e.decision}
            </span>
            <span className="text-sm font-medium leading-3">→ {e.answer}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
