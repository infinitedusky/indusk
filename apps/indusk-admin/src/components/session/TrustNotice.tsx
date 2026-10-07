"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { postJson } from "@/lib/post-json";

/**
 * Trust in Claude Code (workbench-plan-authoring D12, A25). Claude Code
 * ignores an untrusted project's allow-list, so every session there asks
 * about everything. The click is the person's consent, as accepting Claude
 * Code's own prompt is; nothing is trusted without it.
 */
export function TrustNotice({
  project,
  trusted,
}: {
  project: string;
  trusted: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(trusted);
  const [error, setError] = useState<string | null>(null);
  if (done) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
      <span>
        Claude Code doesn't trust this project yet, so sessions ask about
        everything.
      </span>
      <Button
        size="sm"
        onClick={async () => {
          const r = await postJson("/api/trust", { project });
          if (!r.ok) return setError(r.error);
          setDone(true);
          router.refresh();
        }}
      >
        Trust in Claude Code
      </Button>
      {error ? <span className="text-red-700">{error}</span> : null}
    </div>
  );
}
