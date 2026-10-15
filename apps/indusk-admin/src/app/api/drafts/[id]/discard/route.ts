import { discardDraft, draftHomeOf } from "@infinitedusky/indusk-mcp/drafts";
import { draftSessionPlan } from "@infinitedusky/indusk-mcp/session";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discard a draft: `{ project }`. Its folder is removed from the project's
 * home, its conversation stopped first if it is running. Nothing in a checkout
 * is touched, because nothing of it was ever there.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a draft is discarded only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
  } | null;
  if (!body?.project) return refuse(400, "discarding a draft needs a project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const running = sessionManager().forPlan(body.project, draftSessionPlan(id));
  if (running) await sessionManager().get(running.id)?.stop();
  discardDraft(draftHomeOf(root), id);
  return Response.json({ discarded: id });
}
