import {
  findProjectDraft,
  induskHome,
  recordFoldOpened,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The person opened a reply's working ("See more"). The draft's transcript
 * keeps a `fold-opened` line, which creation counts into the span
 * (`conversation.folds_opened`, new-project-flow expectation 5) before the
 * draft is deleted.
 *
 * promise: a-project-conversation-is-a-back-and-forth
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a reply is opened only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const draft = findProjectDraft(induskHome(), id);
  if (!draft) return refuse(404, `no project conversation ${id}`);
  recordFoldOpened(draft);
  return Response.json({ recorded: id });
}
