import type { DecisionEntry } from "@infinitedusky/indusk-mcp/plans/history";
import { stamp } from "@/lib/stamp";

/**
 * A plan's *What happened* (plan-cockpit, ADR decision 4): each decision it
 * waited on, the answer and when, as `plans/history` recorded them on `main`
 * — so they are still here after the admin restarts. Newest first.
 *
 * promise: decisions-wait-in-one-place
 */
export function PlanHistory({ entries }: { entries: DecisionEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-4 text-sm" data-testid="plan-history">
      <h2 className="mb-2 font-semibold text-ink">What happened</h2>
      <ol className="flex flex-col gap-2">
        {[...entries].reverse().map((e) => (
          <li
            key={`${e.at}-${e.answer}`}
            className="flex flex-col gap-hair"
            data-testid="history-entry"
          >
            <span className="text-xs text-ink-faint">
              <time dateTime={e.at}>{stamp(e.at)}</time> · {e.by}
            </span>
            <span className="text-ink-soft">{e.decision}</span>
            <span className="font-medium text-ink">→ {e.answer}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
