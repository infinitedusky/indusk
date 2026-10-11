"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Group approval (ui-promises, Build Phase 5): the checkboxes on an app's
 * proposed mockups, one select-all, and one Approve for the selection. It is
 * the same act as Approve on a single mockup — the route records one entry
 * per mockup, each as the person who clicked and each bound to that
 * mockup's own hash — only done for several at once.
 *
 * The rows are the server's markup, so the selection lives in the checkboxes
 * themselves (`input[data-select-mockup]` inside this app's section): this
 * reads them rather than mirroring them into state.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

/** The selection checkboxes of `app`'s rows, which are the server's markup. */
function boxesOf(app: string): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `[data-testid="looks-app"][data-app="${CSS.escape(app)}"] input[data-select-mockup]`,
    ),
  );
}

interface GroupResult {
  mockup: string;
  approved: boolean;
  reason?: string;
}

export function ApproveSelected({
  project,
  app,
  foundationHash,
  checkout,
  proposed,
}: {
  project: string;
  app: string;
  foundationHash: string;
  /** The plan whose worktree is shown; null for the project's own checkout. */
  checkout: string | null;
  /** How many of the app's mockups are proposed — the ones that have a checkbox. */
  proposed: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const total = proposed;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setSelected(
        boxesOf(app)
          .filter((b) => b.checked)
          .map((b) => b.value),
      );
    document.addEventListener("change", read);
    return () => document.removeEventListener("change", read);
  }, [app]);

  if (total === 0) return null;

  const selectAll = (checked: boolean) => {
    const all = boxesOf(app);
    for (const b of all) b.checked = checked;
    setSelected(checked ? all.map((b) => b.value) : []);
  };

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<{ results: GroupResult[] }>(
      `/api/looks/${encodeURIComponent(app)}/approve`,
      { project, mockups: selected, foundationHash, checkout },
    );
    setBusy(false);
    const results = r.ok ? r.body.results : [];
    const refused = r.ok
      ? results.filter((x) => !x.approved)
      : [{ mockup: "", approved: false, reason: r.error }];
    if (refused.length > 0) {
      setProblem(
        refused
          .map((x) => `${x.mockup} ${x.reason ?? "refused"}`.trim())
          .join("; "),
      );
      if (results.some((x) => x.approved)) window.location.reload();
      return;
    }
    window.location.reload();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-3 text-sm text-ink-soft"
      data-testid="approve-selected"
    >
      <label className="flex items-center gap-tight">
        <input
          type="checkbox"
          data-testid="select-all-proposed"
          checked={selected.length === total}
          onChange={(e) => selectAll(e.target.checked)}
        />
        Select all proposed
      </label>
      <Button
        size="sm"
        data-testid="approve-selected-button"
        onClick={() => void approve()}
        disabled={busy || selected.length === 0}
      >
        {busy ? "Approving…" : `Approve ${selected.length} selected`}
      </Button>
      {problem ? (
        <span role="alert" className="text-xs text-bad">
          {problem}
        </span>
      ) : null}
    </div>
  );
}
