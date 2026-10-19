import type { NextRequest } from "next/server";
import { planningConversationEnded } from "@/lib/build-host";
import {
  adminOnly,
  planLocation,
  refuse,
  refuseRunning,
  sessionManager,
} from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One plan's session, `?project=&plan=&kind=` (kind optional; either when
 * omitted), or null. Never "the" session: a route says which plan it means.
 * With no project and plan the answer is null, which keeps the page's
 * reachability probe (`LiveRefresh`) a cheap 200.
 */
export function GET(request: NextRequest): Response {
  const refused = adminOnly(request);
  if (refused) return refused;
  const params = request.nextUrl.searchParams;
  const project = params.get("project");
  const plan = params.get("plan");
  const kind = params.get("kind");
  if (kind !== null && kind !== "planning" && kind !== "build")
    return refuse(400, "kind is planning or build");
  const session =
    project && plan
      ? sessionManager().forPlan(project, plan, kind ?? undefined)
      : undefined;
  return Response.json({ session: session ?? null });
}

/**
 * Start a session for a plan: `{ project, plan, kind, prompt }`. It runs in the
 * plan's worktree while it has one. When this plan already has a session of
 * this kind and no page is showing it, the person is coming back to it: the
 * answer is its id, and the page attaches. When a page is showing it already,
 * the start is refused with the question whether to continue it here
 * (`refuseRunning`). One beyond `sessions.max` is refused, naming what runs.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a session is started only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
    kind?: string;
    prompt?: string;
  } | null;
  if (
    !body?.project ||
    !body.plan ||
    !body.prompt ||
    (body.kind !== "planning" && body.kind !== "build")
  ) {
    return refuse(
      400,
      "a session needs project, plan, prompt, and kind planning or build",
    );
  }
  const manager = sessionManager();
  const { project, plan } = body;
  const running = manager.forPlan(body.project, body.plan, body.kind);
  if (running && !manager.isWatched(running.id)) {
    return Response.json({ id: running.id, attached: true });
  }
  const where = await planLocation(body.project, body.plan);
  if ("error" in where) return refuse(404, where.error);
  try {
    const { id, session } = sessionManager().start({
      cwd: where.cwd,
      ...(where.addDirs ? { addDirs: where.addDirs } : {}),
      kind: body.kind,
      prompt: body.prompt,
      project: body.project,
      plan: body.plan,
      onEvent: () => {},
      // The brief is accepted from inside a planning conversation, where the
      // planning run is held back; the conversation's end asks for it.
      ...(body.kind === "planning"
        ? {
            onEnd: (startedAt) =>
              void planningConversationEnded(project, plan, startedAt),
          }
        : {}),
    });
    return Response.json(
      { id, pid: session.pid, cwd: where.cwd },
      { status: 201 },
    );
  } catch (err) {
    // The same plan's session: say so, and hand its id back so the page can
    // offer to continue it here instead of starting another.
    const running = (err as { running?: { id: string } }).running;
    if (running) return refuseRunning((err as Error).message, running);
    return refuse(409, (err as Error).message);
  }
}
