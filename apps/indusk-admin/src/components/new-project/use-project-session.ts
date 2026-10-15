"use client";

import { useState } from "react";
import { postJson } from "@/lib/post-json";
import { useSessionEvents } from "../session/use-session-events";

/**
 * A project conversation's running session as the thread needs it: its events
 * over `/api/sessions/:id/events`, whether it still runs, and the person's
 * answers, words and Stop sent back through the session's routes. The same
 * routes `SessionConnector` uses; when the agent writes a file the page
 * refreshes, so what it knows and its proposal show as they are written.
 */
export function useProjectSession(sessionId: string | null) {
  const { events, running } = useSessionEvents(sessionId);
  const [problem, setProblem] = useState<string | null>(null);

  const post = async (path: string, body: unknown) => {
    if (!sessionId) return false;
    const r = await postJson(`/api/sessions/${sessionId}/${path}`, body);
    if (!r.ok) setProblem(r.error);
    return r.ok;
  };

  return {
    events,
    running,
    problem,
    answer: (requestId: string, answers: Record<string, string>) =>
      post("reply", { requestId, answers }),
    decide: (requestId: string, allow: boolean) =>
      post("reply", { requestId, allow }),
    say: (text: string) => void post("say", { text }),
    stop: () => void post("stop", {}),
  };
}
