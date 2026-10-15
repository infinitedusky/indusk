"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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
 * Hidden tabs pause; a tab coming back refreshes on its next tick. A tick
 * that comes while the last refresh is still rendering is skipped, so a slow
 * page never has refreshes queued behind it.
 */
export function LiveRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  busy.current = pending;

  useEffect(() => {
    let cancelled = false;
    let probing = false;
    const tick = async () => {
      if (cancelled || document.hidden || probing || busy.current) return;
      probing = true;
      try {
        // A cheap route is the reachability probe: `router.refresh()` never
        // rejects, so this is the only way to learn the server is gone. Not
        // the page itself — a HEAD to it renders the whole page a second time.
        const res = await fetch("/api/sessions", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (cancelled) return;
        startTransition(() => router.refresh());
        setUpdatedAt(new Date());
      } catch {
        if (cancelled) return;
        setFailed(true);
        window.clearInterval(timer);
      } finally {
        probing = false;
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
        className="text-xs text-bad"
      >
        refresh failed — reload the page to resume
      </p>
    );
  }
  return (
    <p
      role="status"
      data-testid="last-updated"
      className="absolute h-px w-px overflow-hidden whitespace-nowrap"
      data-interval-ms={intervalMs}
    >
      {updatedAt
        ? `last updated ${updatedAt.toLocaleTimeString([], { hour12: false })}`
        : `live — refreshes every ${Math.round(intervalMs / 1000)}s`}
    </p>
  );
}
