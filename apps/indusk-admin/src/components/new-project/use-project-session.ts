"use client";

import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/post-json";

const WRITES = ["Write", "Edit", "MultiEdit", "NotebookEdit"];

/**
 * A project conversation's running session as the thread needs it: its events
 * over `/api/sessions/:id/events`, whether it still runs, and the person's
 * answers, words and Stop sent back through the session's routes. The same
 * routes `SessionConnector` uses; when the agent writes a file the page
 * refreshes, so what it knows and its proposal show as they are written.
 */
export function useProjectSession(sessionId: string | null) {
  const router = useRouter();
  // Held in a ref: the effect below belongs to the session, not to the router object.
  const refresh = useRef(() => router.refresh());
  refresh.current = () => router.refresh();
  const [events, setEvents] = useState<StartedEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setEvents((prev) => (prev.length === 0 ? prev : []));
    setRunning(sessionId !== null);
    if (!sessionId) return;
    const source = new EventSource(`/api/sessions/${sessionId}/events`);
    source.onmessage = (message) => {
      const ev = JSON.parse(message.data) as StartedEvent;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "tool" && WRITES.includes(ev.name)) refresh.current();
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

  const post = async (path: string, body: unknown) => {
    if (!sessionId) return;
    const r = await postJson(`/api/sessions/${sessionId}/${path}`, body);
    if (!r.ok) setProblem(r.error);
  };

  return {
    events,
    running,
    problem,
    answer: (requestId: string, answers: Record<string, string>) =>
      void post("reply", { requestId, answers }),
    decide: (requestId: string, allow: boolean) =>
      void post("reply", { requestId, allow }),
    say: (text: string) => void post("say", { text }),
    stop: () => void post("stop", {}),
  };
}
