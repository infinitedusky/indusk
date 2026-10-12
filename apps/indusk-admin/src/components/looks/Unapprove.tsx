"use client";

import { Button } from "@/components/ui/Button";
import { mockupBody, type Shown, storyBody } from "./shown";
import { useLooksPost } from "./useLooksPost";

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

function UnapproveButton({
  app,
  body,
  testId,
  data,
}: {
  app: string;
  body: object;
  testId: string;
  /** The hashes the page drew, as attributes. */
  data: Record<string, string>;
}) {
  const { busy, problem, postAndReload } = useLooksPost(app, "unapprove");

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        data-testid={testId}
        {...data}
        onClick={() => void postAndReload(body)}
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
  mockup,
  mockupHash,
  componentsHash,
  ...shown
}: Shown & {
  mockup: string;
  /** The hash of the mockup as the page drew it, composed. */
  mockupHash: string;
  /** The hash of the snapshots it composes, as the page drew them. */
  componentsHash: string;
}) {
  return (
    <UnapproveButton
      app={shown.app}
      testId="unapprove-mockup"
      data={{
        "data-mockup-hash": mockupHash,
        "data-components-hash": componentsHash,
      }}
      body={mockupBody(shown, mockup, mockupHash, componentsHash)}
    />
  );
}

export function UnapproveStory({
  story,
  snapshotHash,
  ...shown
}: Shown & {
  /** `badge.ok` — the snapshot's name. */
  story: string;
  /** The hash of the snapshot as the page drew it. */
  snapshotHash: string;
}) {
  return (
    <UnapproveButton
      app={shown.app}
      testId="unapprove-story"
      data={{ "data-snapshot-hash": snapshotHash }}
      body={storyBody(shown, story, snapshotHash)}
    />
  );
}
