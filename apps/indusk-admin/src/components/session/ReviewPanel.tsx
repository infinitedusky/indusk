"use client";

import type { Review } from "@infinitedusky/indusk-mcp/build";

/**
 * What a person reads before accepting a built plan (admin-plan-authoring
 * A15–A17, A30): each promise with the tests that prove it, what
 * falsification looked for and fixed, the files changed, and every gate item
 * the build skipped, with its reason. The data is `indusk plans review`'s.
 */
export function ReviewPanel({ review }: { review: Review }) {
  return (
    <section
      className="flex flex-col gap-3 rounded border border-gray-200 bg-white p-3 text-sm"
      data-testid="review-panel"
    >
      <h2 className="font-semibold text-gray-800">Review</h2>
      <div>
        <h3 className="font-medium text-gray-700">Promises</h3>
        <ul className="mt-1 flex flex-col gap-1">
          {review.promises.map((p) => (
            <li
              key={p.name}
              className={p.proven ? "text-green-800" : "text-red-700"}
            >
              <span className="font-mono">{p.name}</span>{" "}
              {p.proven
                ? `— proven by ${p.rows.map((r) => r.id).join(", ")}`
                : `— unproven: ${p.why ?? "no passing row names it"}`}
            </li>
          ))}
          {review.promises.length === 0 ? (
            <li className="text-gray-500">This plan makes no promise.</li>
          ) : null}
        </ul>
      </div>
      {review.skippedRituals.map((r) => (
        <p key={r.ritual} className="text-gray-700">
          {r.ritual === "falsification" ? "Falsification" : "Cleanup"} skipped:{" "}
          {r.reason}
        </p>
      ))}
      {review.falsification.map((f) => (
        <div key={f.phase}>
          <h3 className="font-medium text-gray-700">{f.phase}</h3>
          <ul className="mt-1 flex flex-col gap-1">
            {f.rows.map((r) => (
              <li key={r.id}>
                <span className="font-mono">{r.id}</span> ({r.state}){" "}
                {r.asserts}
              </li>
            ))}
            {f.items.map((i) => (
              <li key={i.text} className="text-gray-700">
                {i.done ? "Fixed: " : "Open: "}
                {i.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <h3 className="font-medium text-gray-700">
          Files changed ({review.files.length})
        </h3>
        <ul className="mt-1 font-mono text-xs text-gray-600">
          {review.files.map((f) => (
            <li key={f.path}>
              {f.status} {f.path}
            </li>
          ))}
        </ul>
      </div>
      {review.skips.length > 0 ? (
        <div>
          <h3 className="font-medium text-gray-700">Skipped</h3>
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
