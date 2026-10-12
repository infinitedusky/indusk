"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Approve (ui-promises ADR decision 3; storybook-components ADR decision 5):
 * the one way a mockup or a story becomes the reference. It sends the hash of
 * what the page drew — a mockup's composed hash and its components' hash, a
 * story's snapshot hash — and the foundation's, so an approval never covers
 * something the person did not see; the route records who and when and
 * commits the record on the branch of the checkout the page showed, and the
 * page reads again.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

interface Shown {
  project: string;
  app: string;
  foundationHash: string;
  /** The plan whose worktree is shown; null for the project's own checkout. */
  checkout: string | null;
}

/** The button and its refusal, for whichever body the caller says was shown. */
function ApproveButton({
  app,
  body,
  testId,
}: {
  app: string;
  body: Record<string, unknown>;
  testId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(
      `/api/looks/${encodeURIComponent(app)}/approve`,
      body,
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    // The whole page reads again: the record, the chip and the coverage.
    window.location.reload();
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        data-testid={testId}
        onClick={() => void approve()}
        disabled={busy}
      >
        {busy ? "Approving…" : "Approve"}
      </Button>
      {problem ? (
        <span role="alert" className="text-xs text-bad">
          {problem}
        </span>
      ) : null}
    </span>
  );
}

export function ApproveMockup({
  project,
  app,
  mockup,
  mockupHash,
  componentsHash,
  foundationHash,
  checkout,
}: Shown & {
  mockup: string;
  /** The hash of the mockup as the page drew it, composed. */
  mockupHash: string;
  /** The hash of the snapshots it composes, as the page drew them. */
  componentsHash: string;
}) {
  return (
    <ApproveButton
      app={app}
      testId="approve-mockup"
      body={{
        project,
        mockup,
        mockupHash,
        componentsHash,
        foundationHash,
        checkout,
      }}
    />
  );
}

export function ApproveStory({
  project,
  app,
  story,
  snapshotHash,
  foundationHash,
  checkout,
}: Shown & {
  /** `badge.ok` — the snapshot's name. */
  story: string;
  /** The hash of the snapshot as the page drew it. */
  snapshotHash: string;
}) {
  return (
    <ApproveButton
      app={app}
      testId="approve-story"
      body={{
        project,
        kind: "story",
        story,
        snapshotHash,
        foundationHash,
        checkout,
      }}
    />
  );
}
