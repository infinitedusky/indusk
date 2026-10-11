import {
  approve,
  approver,
} from "@infinitedusky/indusk-mcp/looks/approvals";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a mockup (ui-promises ADR decision 3): `{ project, mockup,
 * foundationHash }`. The package's `approve` records it as the person this
 * machine's git names, bound to the mockup's and the foundation's hashes as
 * `main` holds them, and commits the record on `main`. `foundationHash` is the
 * foundation the page showed: a foundation is approved only with a mockup, so
 * an approval of one the person did not see is refused, as is a mockup `main`
 * does not hold.
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
    foundationHash?: string;
  } | null;
  if (!body?.project || !body.mockup || !body.foundationHash)
    return refuse(
      400,
      "an approval needs the project, the mockup and the foundation it was shown on",
    );
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const result = await approve(root, app, body.mockup, await approver(root), {
    foundationHash: body.foundationHash,
  });
  if (!result.approved) return refuse(409, result.reason);
  return Response.json({ entry: result.entry, commit: result.commit });
}
