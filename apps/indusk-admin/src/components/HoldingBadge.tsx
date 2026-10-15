/**
 * "holding N" — how many promises a plan owns that are not retired
 * (day-promises, ADR D8). Closed is the resting state; a plan closes holding
 * its promises, and only one holding none is finished. Renders nothing for
 * none, so the fifty archived plans that never stated one stay quiet.
 *
 * Its own file, with no client boundary: the sidebar's plan items and the
 * plan header are server components and render this span without pulling
 * the Promises page module (which carries the client directive for its
 * grouping state) into the client bundle (cleanup, A34).
 */
export function HoldingBadge({ count, plan }: { count: number; plan: string }) {
  if (count <= 0) return null;
  return (
    <span
      data-testid={`holding-${plan}`}
      title={`${plan} holds ${count} promise${count === 1 ? "" : "s"}`}
      className="inline-flex items-center rounded-pill border border-line bg-surface px-2 py-hair text-xs text-ink-soft"
    >
      holding {count}
    </span>
  );
}
