"use client";

import { useState } from "react";
import type { Replied } from "./SessionPanel";

/**
 * The requests a person's click has closed before the log caught up. A click
 * closes its request at once; a reply the server refuses opens it again. The
 * `decided` event is still the record (`lib/request-decisions`); this is only
 * the early close.
 */
export function useAnsweredRequests() {
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const settle = (requestId: string, reply: Replied) => {
    setAnswered((prev) => new Set(prev).add(requestId));
    void Promise.resolve(reply).then((accepted) => {
      if (accepted === false)
        setAnswered((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
    });
  };
  return { answered, settle };
}
