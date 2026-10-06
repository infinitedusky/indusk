import { PlanCommandRefusal, startPlan } from "@infinitedusky/indusk-mcp/plans";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { refuse, sameOrigin, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * New plan (admin-plan-authoring A1, A7): `{ project, type, name }`. The plan
 * starts on its own branch and worktree (`indusk plans start`), then a
 * planning session runs `/planner <type> <name>` there. Refused before
 * anything is made while another session runs, so no worktree is left
 * without its conversation.
 *
 * promise: a-plan-can-start-from-the-admin
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return refuse(403, "a plan is started only from the admin's own page");
  }
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    type?: string;
    name?: string;
  } | null;
  if (!body?.project || !body.type || !body.name) {
    return refuse(400, "a new plan needs project, type and name");
  }
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const running = sessionManager().current();
  if (running) {
    return refuse(
      409,
      `a session is already running: ${running.kind} for ${running.plan} — stop it first`,
    );
  }
  try {
    const started = await startPlan(root, body.type, body.name);
    const { id } = sessionManager().start({
      cwd: started.worktree,
      kind: "planning",
      prompt: `/planner ${started.type} ${started.plan}`,
      project: body.project,
      plan: started.plan,
      onEvent: () => {},
    });
    return Response.json(
      { id, plan: started.plan, worktree: started.worktree },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof PlanCommandRefusal) return refuse(409, err.message);
    throw err;
  }
}
