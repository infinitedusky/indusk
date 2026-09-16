"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Keeps the plan page live without a reload (admin-ui-phase-progress, ADR D6).
 *
 * Every `intervalMs` it asks the server whether the page is still reachable
 * and, if so, calls `router.refresh()` — Next re-runs the server components
 * for this route and streams the new tree in, so a checkoff written to disk
 * shows up while the viewer's open sections and scroll position stay put.
 * One data path: no route handler, no fetch of a second shape, no socket.
 *
 * It says what it is doing — "last updated HH:MM:SS" — and when a tick fails
 * it stops and says so, rather than silently showing a stale page as live.
 * Hidden tabs pause; a tab coming back refreshes on its next tick.
 */
export function LiveRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled || document.hidden) return;
      try {
        // A HEAD to the page itself is the reachability probe: `router.refresh()`
        // never rejects, so this is the only way to learn the server is gone.
        const res = await fetch(window.location.href, {
          method: "HEAD",
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (cancelled) return;
        router.refresh();
        setUpdatedAt(new Date());
      } catch {
        if (cancelled) return;
        setFailed(true);
        window.clearInterval(timer);
      }
    };
    const timer = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [intervalMs, router]);

  if (failed) {
    return (
      <p
        role="status"
        data-testid="refresh-failed"
        className="text-xs text-red-700"
      >
        refresh failed — reload the page to resume
      </p>
    );
  }
  return (
    <p
      role="status"
      data-testid="last-updated"
      className="text-xs text-gray-400"
      data-interval-ms={intervalMs}
    >
      {updatedAt
        ? `last updated ${updatedAt.toLocaleTimeString([], { hour12: false })}`
        : `live — refreshes every ${Math.round(intervalMs / 1000)}s`}
    </p>
  );
}
