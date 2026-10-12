"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useLooksPost } from "./useLooksPost";

/**
 * Group approval (ui-promises, Build Phase 5; stories added by
 * storybook-components): the checkboxes on an app's proposed mockups and
 * stories, one select-all, and one Approve for the selection. It is the same
 * act as Approve on a single one — one entry per look, each as the person who
 * clicked and each bound to that look's own hash as the page drew it
 * (`data-mockup-hash`, `data-snapshot-hash`, `data-stylesheet-hash`) — only
 * done for several at once.
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
      `[data-testid="looks-app"][data-app="${CSS.escape(app)}"] input[data-select-mockup], [data-testid="looks-app"][data-app="${CSS.escape(app)}"] input[data-select-story]`,
    ),
  );
}

/**
 * A look as the page drew it: a mockup with the hashes its checkbox carries,
 * or a story with its snapshot and stylesheet hashes (`data-select-story`).
 */
type Shown =
  | {
      kind: "mockup";
      mockup: string;
      mockupHash: string;
      componentsHash: string;
    }
  | {
      kind: "story";
      story: string;
      snapshotHash: string;
      /** Empty when its component has no stylesheet. */
      stylesheetHash: string;
    };

const shownBy = (box: HTMLInputElement): Shown =>
  box.dataset.selectStory !== undefined
    ? {
        kind: "story",
        story: box.value,
        snapshotHash: box.dataset.snapshotHash ?? "",
        stylesheetHash: box.dataset.stylesheetHash ?? "",
      }
    : {
        kind: "mockup",
        mockup: box.value,
        mockupHash: box.dataset.mockupHash ?? "",
        componentsHash: box.dataset.componentsHash ?? "",
      };

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
  /** How many of the drawn mockups and stories are proposed — the ones that have a checkbox. */
  proposed: number;
}) {
  const [selected, setSelected] = useState<Shown[]>([]);
  const total = proposed;
  const { busy, problem, setProblem, post } = useLooksPost(app, "approve");

  useEffect(() => {
    const read = () =>
      setSelected(
        boxesOf(app)
          .filter((b) => b.checked)
          .map(shownBy),
      );
    document.addEventListener("change", read);
    return () => document.removeEventListener("change", read);
  }, [app]);

  if (total === 0) return null;

  const selectAll = (checked: boolean) => {
    const all = boxesOf(app);
    for (const b of all) b.checked = checked;
    setSelected(checked ? all.map(shownBy) : []);
  };

  const approve = async () => {
    const r = await post<{ results: GroupResult[] }>({
      project,
      mockups: selected.flatMap((x) =>
        x.kind === "mockup"
          ? [
              {
                mockup: x.mockup,
                mockupHash: x.mockupHash,
                componentsHash: x.componentsHash,
              },
            ]
          : [],
      ),
      stories: selected.flatMap((x) =>
        x.kind === "story"
          ? [
              {
                story: x.story,
                snapshotHash: x.snapshotHash,
                ...(x.stylesheetHash
                  ? { stylesheetHash: x.stylesheetHash }
                  : {}),
              },
            ]
          : [],
      ),
      foundationHash,
      checkout,
    });
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
