"use client";

import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** The tools whose use means the agent wrote a file. */
const WRITES = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

/**
 * The one way to hear a running agent: its events over
 * `/api/sessions/:id/events`, whether it still runs, and a page refresh when
 * it writes a file or ends - so what it writes shows as it is written.
 * `onWrite` hears each write event too (the plan page uses it to bring the
 * written part into view). A null session is nothing running. Every
 * conversation uses this; none opens its own `EventSource`.
 */
export function useSessionEvents(
  sessionId: string | null,
  opts: { onWrite?: (ev: StartedEvent) => void } = {},
): { events: StartedEvent[]; running: boolean } {
  const router = useRouter();
  // Held in a ref: the effect below belongs to the session, not to the router
  // object or to a callback that changes each render.
  const refresh = useRef(() => router.refresh());
  refresh.current = () => router.refresh();
  const onWrite = useRef(opts.onWrite);
  onWrite.current = opts.onWrite;
  const [events, setEvents] = useState<StartedEvent[]>([]);
  const [running, setRunning] = useState(sessionId !== null);

  useEffect(() => {
    setEvents((prev) => (prev.length === 0 ? prev : []));
    setRunning(sessionId !== null);
    if (!sessionId) return;
    const source = new EventSource(`/api/sessions/${sessionId}/events`);
    source.onmessage = (message) => {
      const ev = JSON.parse(message.data) as StartedEvent;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "tool" && WRITES.includes(ev.name)) {
        refresh.current();
        onWrite.current?.(ev);
      }
      if (ev.type === "exit") {
        setRunning(false);
        source.close();
        refresh.current();
      }
    };
    source.onerror = () => {
      setRunning(false);
      source.close();
    };
    return () => source.close();
  }, [sessionId]);

  return { events, running };
}
