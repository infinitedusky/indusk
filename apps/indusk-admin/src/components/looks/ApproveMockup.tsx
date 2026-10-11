"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Approve (ui-promises ADR decision 3): the one way a mockup becomes the
 * reference. It sends the foundation the person is looking at, so an
 * approval never covers a foundation they did not see; the route records who
 * and when and commits the record on `main`, and the page reads again.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export function ApproveMockup({
  project,
  app,
  mockup,
  foundationHash,
}: {
  project: string;
  app: string;
  mockup: string;
  foundationHash: string;
}) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(`/api/looks/${encodeURIComponent(app)}/approve`, {
      project,
      mockup,
      foundationHash,
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
        <span role="alert" className="text-xs text-red-700">
          {problem}
        </span>
      ) : null}
    </span>
  );
}
