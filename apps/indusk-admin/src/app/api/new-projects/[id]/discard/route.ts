import {
  discardProjectDraft,
  induskHome,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { stopDraftSession } from "@/lib/new-project-session";
import { adminOnly } from "@/lib/session-host";

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
  await stopDraftSession(id);
  discardProjectDraft(induskHome(), id);
  return Response.json({ discarded: id });
}
