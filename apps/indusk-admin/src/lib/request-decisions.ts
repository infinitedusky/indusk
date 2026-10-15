import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";

/** A request's decision, as its `decided` event recorded it. */
export type Decision = Extract<StartedEvent, { type: "decided" }>;

/** Each decided request's `decided` event, by request id. */
export function decisionsOf(
  events: readonly StartedEvent[],
): Map<string, Decision> {
  const decisions = new Map<string, Decision>();
  for (const ev of events)
    if (ev.type === "decided") decisions.set(ev.requestId, ev);
  return decisions;
}
