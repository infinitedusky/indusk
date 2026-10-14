import {
  draftHomeOf,
  findDraft,
  startFromDraft,
  writeProposal,
} from "@infinitedusky/indusk-mcp/drafts";
import { PlanCommandRefusal } from "@infinitedusky/indusk-mcp/plans";
import { draftSessionPlan } from "@infinitedusky/indusk-mcp/session";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accept a draft's name and type: `{ project, name, type, repo? }`, the
 * agent's proposal as the person left it. The plan is made on its own branch
 * and worktree with the draft as its brief (`indusk plans start --from-draft`),
 * and the draft's own conversation, if still running, is stopped first. A name
 * taken is refused, and the draft is kept so another can be asked for.
 *
 * promise: a-plan-starts-as-a-conversation
 * promise: a-plan-can-start-from-the-admin
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a plan is started only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    name?: string;
    type?: string;
    repo?: string;
  } | null;
  if (!body?.project || !body.name || !body.type) {
    return refuse(400, "accepting a draft needs project, name and type");
  }
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const draft = findDraft(draftHomeOf(root), id);
  if (!draft) return refuse(404, `no draft ${id} in ${body.project}`);
  const running = sessionManager().forPlan(
    body.project,
    draftSessionPlan(id),
  );
  if (running) await sessionManager().get(running.id)?.stop();
  try {
    writeProposal(draft, {
      name: body.name,
      type: body.type,
      ...(body.repo ? { repo: body.repo } : {}),
    });
    const started = await startFromDraft(root, draft);
    return Response.json(
      { plan: started.plan, type: started.type, worktree: started.worktree },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PlanCommandRefusal) return refuse(409, err.message);
    throw err;
  }
}
