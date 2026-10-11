"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Approve (ui-promises ADR decision 3): the one way a mockup becomes the
 * reference. It sends the mockup's hash and the foundation's as the page
 * showed them, so an approval never covers a mockup or a foundation the person
 * did not see; the route records who
 * and when and commits the record on the branch of the checkout the page
 * showed, and the page reads again.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export function ApproveMockup({
  project,
  app,
  mockup,
  mockupHash,
  foundationHash,
  checkout,
}: {
  project: string;
  app: string;
  mockup: string;
  /** The hash of the mockup as the page drew it. */
  mockupHash: string;
  foundationHash: string;
  /** The plan whose worktree is shown; null for the project's own checkout. */
  checkout: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(`/api/looks/${encodeURIComponent(app)}/approve`, {
      project,
      mockup,
      mockupHash,
      foundationHash,
      checkout,
    });
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
        data-testid="approve-mockup"
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
