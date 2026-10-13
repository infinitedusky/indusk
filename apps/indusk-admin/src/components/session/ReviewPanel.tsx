"use client";

import type { Review } from "@infinitedusky/indusk-mcp/build";

/** How each close-out ritual is named when the review says it was skipped. */
const RITUAL_TITLES: Record<
  Review["skippedRituals"][number]["ritual"],
  string
> = {
  falsification: "Falsification",
  cleanup: "Cleanup",
  audit: "Audit",
};

/**
 * What a person reads before accepting a built plan (admin-plan-authoring
 * A15–A17, A30): each promise with the tests that prove it, what
 * falsification looked for and fixed, the files changed, and every gate item
 * the build skipped, with its reason. The data is `indusk plans review`'s.
 */
export function ReviewPanel({ review }: { review: Review }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3 text-sm"
      data-testid="review-panel"
    >
      <h2 className="font-semibold text-ink">Review</h2>
      {review.uncommittedOnMain.length > 0 ? (
        <div
          className="rounded-md border border-warn bg-warn-wash p-2 text-warn"
          role="alert"
        >
          <p className="font-medium">
            Uncommitted on main, where this plan will land
          </p>
          <p className="text-xs">
            It may be someone's work, so the release stops until it is committed
            or moved:
          </p>
          <ul className="mt-1 font-mono text-xs">
            {review.uncommittedOnMain.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {review.evidence.length > 0 ? (
        <div data-testid="review-evidence">
          <h3 className="font-medium text-ink-soft">Evidence</h3>
          <p className="text-xs text-ink-faint">
            You approved the brief. These are read, not signed off.
          </p>
          <ul className="mt-1 font-mono text-xs text-ink-soft">
            {review.evidence.map((e) => (
              <li key={e.document} data-document={e.document}>
                {e.document} — {e.path}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <h3 className="font-medium text-ink-soft">Promises</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {review.promises.map((p) => (
            <li key={p.name} className={p.proven ? "text-ok" : "text-bad"}>
              <span className="font-mono">{p.name}</span>{" "}
              {p.proven
                ? `— proven by ${p.rows.map((r) => r.id).join(", ")}`
                : `— unproven: ${p.why ?? "no passing row names it"}`}
            </li>
          ))}
          {review.promises.length === 0 ? (
            <li className="text-ink-faint">This plan makes no promise.</li>
          ) : null}
        </ul>
      </div>
      {review.skippedRituals.map((r) => (
        <p key={r.ritual} className="text-ink-soft">
          {RITUAL_TITLES[r.ritual]} skipped: {r.reason}
        </p>
      ))}
      {review.falsification.map((f) => (
        <div key={f.phase}>
          <h3 className="font-medium text-ink-soft">{f.phase}</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {f.rows.map((r) => (
              <li key={r.id}>
                <span className="font-mono">{r.id}</span> ({r.state}){" "}
                {r.asserts}
              </li>
            ))}
            {f.items.map((i) => (
              <li key={i.text} className="text-ink-soft">
                {i.done ? "Fixed: " : "Open: "}
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="font-medium text-ink-soft">
          Files changed ({review.files.length})
        </h3>
        <ul className="mt-1 font-mono text-xs text-ink-soft">
          {review.files.map((f) => (
            <li key={f.path}>
              {f.status} {f.path}
            </li>
          ))}
        </ul>
      </div>
      {review.skips.length > 0 ? (
        <div>
          <h3 className="font-medium text-ink-soft">Skipped</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {review.skips.map((s) => (
              <li key={`${s.phase}-${s.item}`}>
                {s.phase}, {s.gate}: {s.item}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
