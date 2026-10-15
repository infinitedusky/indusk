"use client";

import { useState } from "react";
import { postJson } from "@/lib/post-json";
import { SessionPanel } from "./SessionPanel";
import { useSessionEvents } from "./use-session-events";

/**
 * Connects the panel to a running session (admin-plan-authoring, ADR D2): its
 * events over `/api/sessions/:id/events`, a person's answers and Stop over
 * the session's routes. When the session writes a file, the page refreshes,
 * so a plan appears and grows in the sidebar as it is written.
 */
export function SessionConnector({
  sessionId,
  fill = false,
}: {
  sessionId: string;
  /** Fill the column it sits in (the brief page's agent). */
  fill?: boolean;
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const { events, running } = useSessionEvents(sessionId, {
    onWrite: (ev) => {
      // Tell the page what the agent wrote, so it can bring that part into
      // view (`FollowAgent`).
      if (ev.type !== "tool") return;
      const file = ev.input.file_path ?? ev.input.notebook_path;
      if (typeof file === "string")
        window.dispatchEvent(
          new CustomEvent(AGENT_WROTE, { detail: { file, input: ev.input } }),
        );
    },
  });

  const post = async (path: string, body: unknown) => {
    const r = await postJson(`/api/sessions/${sessionId}/${path}`, body);
    if (!r.ok) setProblem(r.error);
  };

  return (
    <div className={`flex flex-col gap-1 ${fill ? "min-h-0 flex-1" : ""}`}>
      {problem ? <p className="text-sm text-bad">{problem}</p> : null}
      <SessionPanel
        events={events}
        running={running}
        onAnswer={(requestId, answers) =>
          void post("reply", { requestId, answers })
        }
        onDecide={(requestId, allow) =>
          void post("reply", { requestId, allow })
        }
        onStop={() => void post("stop", {})}
        onSay={(text) => void post("say", { text })}
        fill={fill}
      />
    </div>
  );
}

/** The window event a session fires for each file its agent writes. */
export const AGENT_WROTE = "indusk:agent-wrote";
