"use client";

import { Button } from "@/components/ui/Button";
import { mockupBody, type Shown, storyBody } from "./shown";
import { useLooksPost } from "./useLooksPost";

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

/** The button and its refusal, for whichever body the caller says was shown. */
function ApproveButton({
  app,
  body,
  testId,
}: {
  app: string;
  body: object;
  testId: string;
}) {
  const { busy, problem, postAndReload } = useLooksPost(app, "approve");

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        data-testid={testId}
        onClick={() => void postAndReload(body)}
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
    <ApproveButton
      app={shown.app}
      testId="approve-mockup"
      body={mockupBody(shown, mockup, mockupHash, componentsHash)}
    />
  );
}

export function ApproveStory({
  story,
  snapshotHash,
  stylesheetHash,
  ...shown
}: Shown & {
  /** `badge.ok` — the snapshot's name. */
  story: string;
  /** The hash of the snapshot as the page drew it. */
  snapshotHash: string;
  /** The hash of its component's stylesheet as the page drew it; null when it has none. */
  stylesheetHash: string | null;
}) {
  return (
    <ApproveButton
      app={shown.app}
      testId="approve-story"
      body={storyBody(shown, story, snapshotHash, stylesheetHash)}
    />
  );
}
