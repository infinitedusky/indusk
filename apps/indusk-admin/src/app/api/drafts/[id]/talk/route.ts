import {
  draftHomeOf,
  findDraft,
  touchDraft,
} from "@infinitedusky/indusk-mcp/drafts";
import {
  alreadyRunningOnThisPlan,
  draftConversation,
  draftSessionPlan,
} from "@infinitedusky/indusk-mcp/session";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Talk in a draft: `{ project, text?, reopened? }`. Starts the draft's
 * conversation in the draft's own folder (`draftConversation`), so the agent
 * reads and writes nothing in a checkout; the person's words, if any, ride in
 * the first message. One conversation per draft; other plans' sessions are not in its way.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a conversation is started only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    text?: string;
    reopened?: boolean;
  } | null;
  if (!body?.project) return refuse(400, "a conversation needs a project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const draft = findDraft(draftHomeOf(root), id);
  if (!draft) return refuse(404, `no draft ${id} in ${body.project}`);
  const running = sessionManager().forPlan(
    body.project,
    draftSessionPlan(id),
    "planning",
  );
  if (running) {
    return Response.json(
      { error: alreadyRunningOnThisPlan(running), running: { id: running.id } },
      { status: 409 },
    );
  }
  touchDraft(draft);
  const convo = draftConversation(draft, {
    ...(body.reopened ? { reopened: true } : {}),
    ...(body.text ? { firstMessage: body.text } : {}),
  });
  try {
    const started = sessionManager().start({
      cwd: convo.cwd,
      kind: convo.kind,
      prompt: convo.prompt,
      project: body.project,
      plan: convo.plan,
      onEvent: () => {},
    });
    return Response.json({ id: started.id }, { status: 201 });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
