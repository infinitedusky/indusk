import {
  approver,
  type SeenWithdrawal,
  withdraw,
} from "@infinitedusky/indusk-mcp/looks/approve";
import type { NextRequest } from "next/server";
import { refuse } from "@/lib/session-host";
import { type LooksBody, readLooksRequest } from "../request";

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

interface UnapproveBody extends LooksBody {
  mockup?: string;
  mockupHash?: string;
  componentsHash?: string;
  kind?: string;
  story?: string;
  snapshotHash?: string;
  foundationHash?: string;
}

/** What is taken back and what the page showed. */
interface Subject {
  kind: "mockup" | "story";
  name: string;
  seen: SeenWithdrawal;
}

/** The subject the body names, or null when it names less than that. */
function subjectOf(body: UnapproveBody): Subject | null {
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
  const read = await readLooksRequest<UnapproveBody, Subject>(request, params, {
    adminMessage: "an approval is taken back only from the admin's own page",
    browserMessage:
      "an approval is taken back only by a person, with Unapprove on the cockpit's Looks page in their browser",
    subjectOf,
    incomplete: () =>
      "taking an approval back needs the project, the mockup or story with the hash it was shown at, and the foundation it was shown on",
  });
  if (read instanceof Response) return read;
  const { app, root, checkout, subject } = read;
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
