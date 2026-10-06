"use client";

import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SessionPanel } from "./SessionPanel";

/**
 * Connects the panel to a running session (admin-plan-authoring, ADR D2): its
 * events over `/api/sessions/:id/events`, a person's answers and Stop over
 * the session's routes. When the session writes a file, the page refreshes,
 * so a plan appears and grows in the sidebar as it is written.
 */
export function SessionConnector({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [events, setEvents] = useState<StartedEvent[]>([]);
  const [running, setRunning] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setEvents([]);
    setRunning(true);
    const source = new EventSource(`/api/sessions/${sessionId}/events`);
    source.onmessage = (message) => {
      const ev = JSON.parse(message.data) as StartedEvent;
      setEvents((prev) => [...prev, ev]);
      if (ev.type === "tool" && WRITES.includes(ev.name)) router.refresh();
      if (ev.type === "exit") {
        setRunning(false);
        source.close();
        router.refresh();
      }
    };
    source.onerror = () => {
      setRunning(false);
      source.close();
    };
    return () => source.close();
  }, [sessionId, router]);

  const post = async (path: string, body: unknown) => {
    const r = await fetch(`/api/sessions/${sessionId}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok)
      setProblem(
        ((await r.json().catch(() => ({}))) as { error?: string }).error ??
          `HTTP ${r.status}`,
      );
  };

  return (
    <div className="flex flex-col gap-1">
      {problem ? <p className="text-sm text-red-700">{problem}</p> : null}
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
      />
    </div>
  );
}

const WRITES = ["Write", "Edit", "MultiEdit", "NotebookEdit"];
