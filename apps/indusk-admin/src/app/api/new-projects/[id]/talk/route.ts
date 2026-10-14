import {
  induskHome,
  readProjectDraft,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import {
  busyMessage,
  startProjectConversation,
} from "@/lib/new-project-session";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talk in a project draft: `{ text?, reopened? }`. Starts the conversation
 * again in the draft's folder - a later turn, or after the session ended -
 * with what the person says now riding in the first message. One session at a
 * time, as everywhere. (The first message is `/api/new-projects`'s, which
 * starts the session as it creates the draft.)
 *
 * promise: a-project-starts-as-a-conversation
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a project conversation is started only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    text?: string;
    reopened?: boolean;
  } | null;
  const draft = readProjectDraft(induskHome(), id);
  if (!draft) return refuse(404, `no project conversation ${id}`);
  const busy = busyMessage();
  if (busy) return refuse(409, busy);
  try {
    const started = startProjectConversation(draft, {
      ...(body?.reopened ? { reopened: true } : {}),
      ...(body?.text ? { text: body.text } : {}),
    });
    return Response.json({ id: started.id }, { status: 201 });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
