import { createDraft, draftHomeOf } from "@infinitedusky/indusk-mcp/drafts";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * New plan (brief-as-the-contract, ADR decision 6): `{ project }`. Opens an
 * empty draft in the project's home and nothing else — no name, no type, no
 * branch, and no file in any checkout. The page then moves to the draft, where
 * the conversation runs.
 *
 * promise: a-plan-starts-as-a-conversation
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a conversation is started only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
  } | null;
  if (!body?.project) return refuse(400, "a new conversation needs a project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const draft = createDraft(draftHomeOf(root), {});
  return Response.json({ id: draft.id }, { status: 201 });
}
