import { approve, approver } from "@infinitedusky/indusk-mcp/looks/approvals";
import { looksCheckouts } from "@infinitedusky/indusk-mcp/looks/overview";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a mockup (ui-promises ADR decision 3): `{ project, mockup,
 * foundationHash, checkout }`. The package's `approve` records it as the
 * person this machine's git names, bound to the mockup's and the foundation's
 * hashes as the checkout holds them, and commits the record on that checkout's
 * branch. `checkout` is the plan whose worktree the page showed, or null for
 * the project's own checkout; it is resolved from the plan-worktree record,
 * never taken as a path. `foundationHash` is the foundation the page showed: a
 * foundation is approved only with a mockup, so an approval of one the person
 * did not see is refused, as is a mockup the checkout does not hold.
 *
 * promise: a-mockup-is-approved-by-a-person
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a mockup is approved only from the admin's own page",
  );
  if (refused) return refused;
  const { app } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    mockup?: string;
    /** A group approval: each named mockup is approved on its own, in order. */
    mockups?: string[];
    foundationHash?: string;
    checkout?: string | null;
  } | null;
  const names = body?.mockups ?? (body?.mockup ? [body.mockup] : []);
  if (
    !body?.project ||
    !body.foundationHash ||
    names.length === 0 ||
    names.some((n) => typeof n !== "string" || n === "")
  )
    return refuse(
      400,
      "an approval needs the project, the mockup and the foundation it was shown on",
    );
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const checkout = (await looksCheckouts(root)).find(
    (c) => c.plan === (body.checkout ?? null),
  );
  if (!checkout)
    return refuse(
      404,
      `plan ${JSON.stringify(body.checkout)} has no worktree here that holds mockups`,
    );
  const by = await approver(root);
  const results = [];
  for (const mockup of names) {
    results.push({
      mockup,
      ...(await approve(checkout.root, app, mockup, by, {
        foundationHash: body.foundationHash,
      })),
    });
  }
  if (!body.mockups) {
    const [only] = results;
    if (!only?.approved) return refuse(409, only?.reason ?? "refused");
    return Response.json({ entry: only.entry, commit: only.commit });
  }
  // A group approval answers for each mockup: one refused does not undo the
  // ones recorded, and the page says which.
  return Response.json(
    { results },
    { status: results.some((r) => r.approved) ? 200 : 409 },
  );
}
