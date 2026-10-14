import {
  discardProjectDraft,
  induskHome,
  newProjectSessionPlan,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { adminOnly, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Discard a project draft. Its conversation is stopped first if it is running,
 * then its folder is removed. Nothing else was ever written - no directory
 * under the parent, no registered project.
 *
 * promise: an-unkept-project-conversation-leaves-nothing-on-disk
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a project conversation is discarded only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const running = sessionManager().current();
  if (running?.plan === newProjectSessionPlan(id)) {
    await sessionManager().get(running.id)?.stop();
  }
  discardProjectDraft(induskHome(), id);
  return Response.json({ discarded: id });
}
