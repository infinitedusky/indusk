"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Unapprove (storybook-components ADR decision 11): a person takes back an
 * approval — the mistaken one — from the mockup or story it was made on. It
 * sends the hash of what the page drew, as Approve does, and the route refuses
 * when the checkout now holds something else; the record gains a withdrawal,
 * the look reads proposed, and the page reads again. The hash is also on the
 * button, so what the page showed is readable without running it.
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

function UnapproveButton({
  app,
  body,
  testId,
  data,
}: {
  app: string;
  body: Record<string, unknown>;
  testId: string;
  /** The hashes the page drew, as attributes. */
  data: Record<string, string>;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const unapprove = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(
      `/api/looks/${encodeURIComponent(app)}/unapprove`,
      body,
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    window.location.reload();
  };

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        data-testid={testId}
        {...data}
        onClick={() => void unapprove()}
        disabled={busy}
      >
        {busy ? "Unapproving…" : "Unapprove"}
      </Button>
      {problem ? (
        <span role="alert" className="text-xs text-bad">
          {problem}
        </span>
      ) : null}
    </span>
  );
}

export function UnapproveMockup({
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
    <UnapproveButton
      app={app}
      testId="unapprove-mockup"
      data={{
        "data-mockup-hash": mockupHash,
        "data-components-hash": componentsHash,
      }}
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

export function UnapproveStory({
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
    <UnapproveButton
      app={app}
      testId="unapprove-story"
      data={{ "data-snapshot-hash": snapshotHash }}
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
