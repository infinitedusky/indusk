import { useState } from "react";
import { type Posted, postJson } from "@/lib/post-json";

/**
 * The state every button on the Looks page that asks the route to record or
 * take back an approval shares: busy while the POST is out, the route's
 * refusal as `problem`, and the page reading again once it is recorded.
 * `post` answers with what the route sent, for the one caller (the group
 * Approve) that reads a body; `postAndReload` is the single act's whole turn.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export function useLooksPost(app: string, action: "approve" | "unapprove") {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const post = async <T>(body: unknown): Promise<Posted<T>> => {
    setBusy(true);
    setProblem(null);
    const r = await postJson<T>(
      `/api/looks/${encodeURIComponent(app)}/${action}`,
      body,
    );
    setBusy(false);
    return r;
  };

  const postAndReload = async (body: unknown) => {
    const r = await post(body);
    if (!r.ok) {
      setProblem(r.error);
      return;
    }
    // The whole page reads again: the record, the chip and the coverage.
    window.location.reload();
  };

  return { busy, problem, setProblem, post, postAndReload };
}
