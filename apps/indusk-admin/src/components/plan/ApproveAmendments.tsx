"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Approve the amendments a plan waits on. The request goes to the plan's
 * `reapprove` route, which accepts it only from this page in a person's
 * browser; what approving writes is the package's `plans reapprove`.
 */
export function ApproveAmendments({
  project,
  plan,
}: {
  project: string;
  plan: string;
}) {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const approve = async () => {
    setBusy(true);
    setProblem(null);
    const r = await postJson(
      `/api/plans/${encodeURIComponent(plan)}/reapprove`,
      { project },
    );
    setBusy(false);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    router.refresh();
  };
  return (
    <span className="grid gap-1">
      <Button
        data-testid="approve-amendments"
        disabled={busy}
        onClick={() => void approve()}
      >
        Approve
      </Button>
      {problem ? (
        <span role="alert" className="text-sm text-bad">
          {problem}
        </span>
      ) : null}
    </span>
  );
}
