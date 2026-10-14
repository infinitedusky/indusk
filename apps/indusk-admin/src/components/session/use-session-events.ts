"use client";

import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { useEffect } from "react";

/** Stub: the subscription's behaviour lands in the next commit. */
export function useSessionEvents(
  sessionId: string | null,
  _opts: { onWrite?: (ev: StartedEvent) => void } = {},
): { events: StartedEvent[]; running: boolean } {
  useEffect(() => {
    if (sessionId) new EventSource(`/api/sessions/${sessionId}/events`);
  }, [sessionId]);
  return { events: [], running: false };
}
