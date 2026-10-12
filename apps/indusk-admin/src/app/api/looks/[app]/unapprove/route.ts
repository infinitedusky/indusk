import {
  approver,
  type SeenWithdrawal,
  withdraw,
} from "@infinitedusky/indusk-mcp/looks/approvals";
import { looksCheckouts } from "@infinitedusky/indusk-mcp/looks/overview";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, fromTheBrowser, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unapprove (storybook-components ADR decision 11): a person takes back an
 * approval — a mockup's `{ project, mockup, mockupHash, componentsHash?,
 * foundationHash, checkout }`, or a story's `{ project, kind: "story", story,
 * snapshotHash, foundationHash, checkout }`. The package's `withdraw` records
 * it as the person this machine's git names and commits only the record on
 * that checkout's branch. The hashes are the ones the page showed, as
 * Approve's are: what the checkout now holds being something else is refused,
 * and so is a look that is not approved as it is — there is no approval in
 * force to take back. Answers only the person's own browser, like Approve.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

interface UnapproveBody {
  project?: string;
  mockup?: string;
  mockupHash?: string;
  componentsHash?: string;
  kind?: string;
  story?: string;
  snapshotHash?: string;
  foundationHash?: string;
  checkout?: string | null;
}

/** What is taken back and what the page showed, or null when the body names less than that. */
function subjectOf(
  body: UnapproveBody,
): { kind: "mockup" | "story"; name: string; seen: SeenWithdrawal } | null {
  const { foundationHash } = body;
  if (!foundationHash) return null;
  if (body.kind === "story") {
    if (!body.story || !body.snapshotHash) return null;
    return {
      kind: "story",
      name: body.story,
      seen: { snapshotHash: body.snapshotHash, foundationHash },
    };
  }
  if (!body.mockup || !body.mockupHash) return null;
  return {
    kind: "mockup",
    name: body.mockup,
    seen: {
      mockupHash: body.mockupHash,
      foundationHash,
      ...(body.componentsHash ? { componentsHash: body.componentsHash } : {}),
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> },
): Promise<Response> {
  const refused =
    adminOnly(
      request,
      "an approval is taken back only from the admin's own page",
    ) ??
    fromTheBrowser(
      request,
      "an approval is taken back only by a person, with Unapprove on the cockpit's Looks page in their browser",
    );
  if (refused) return refused;
  const { app } = await params;
  const body = (await request.json().catch(() => null)) as UnapproveBody | null;
  const subject = body?.project ? subjectOf(body) : null;
  if (!body?.project || !subject)
    return refuse(
      400,
      "taking an approval back needs the project, the mockup or story with the hash it was shown at, and the foundation it was shown on",
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
  const result = await withdraw(
    checkout.root,
    app,
    subject.name,
    await approver(root),
    subject.kind,
    subject.seen,
  );
  if (!result.withdrawn) return refuse(409, result.reason);
  return Response.json({ entry: result.entry, commit: result.commit });
}
