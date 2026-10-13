import {
  PlanCommandRefusal,
  reapprovePlan,
} from "@infinitedusky/indusk-mcp/plans";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, fromTheBrowser, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve the amendments a plan waits on (brief-as-the-contract ADR decision
 * 6): `{ project }`. Only from the admin's own page (`adminOnly`), and only
 * from the person's browser (`fromTheBrowser`, the `Sec-Fetch-Site:
 * same-origin` the look approval requires) — a script or an agent's request
 * sets `Host` and `Origin` itself and carries no fetch metadata, and is
 * refused before anything is read. What waits, and what approving it writes,
 * is the package's `reapprovePlan`; a refusal there is a 409 naming why.
 *
 * promise: a-change-to-what-was-agreed-needs-the-person
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const refused =
    adminOnly(
      request,
      "an amendment is approved only from the admin's own page",
    ) ??
    fromTheBrowser(
      request,
      "an amendment is approved only by a person, with Approve on the plan's page in their browser",
    );
  if (refused) return refused;
  const { name } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
  } | null;
  if (!body?.project) return refuse(400, "an approval needs the project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  try {
    return Response.json(await reapprovePlan(root, name));
  } catch (err) {
    if (err instanceof PlanCommandRefusal) return refuse(409, err.message);
    throw err;
  }
}
