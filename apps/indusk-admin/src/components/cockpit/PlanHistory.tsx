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
      <h2 className="mb-2 font-semibold text-gray-900">What happened</h2>
      <ol className="flex flex-col gap-2">
        {[...entries].reverse().map((e) => (
          <li
            key={`${e.at}-${e.answer}`}
            className="flex flex-col gap-0.5"
            data-testid="history-entry"
          >
            <span className="text-xs text-gray-500">
              <time dateTime={e.at}>{stamp(e.at)}</time> · {e.by}
            </span>
            <span className="text-gray-700">{e.decision}</span>
            <span className="font-medium text-gray-900">→ {e.answer}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
