import type { NextRequest } from "next/server";
import {
  adminOnly,
  planLocation,
  refuse,
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
 * plan's worktree while it has one. A second session of the same kind on the
 * plan, or one beyond `sessions.max`, is refused, naming what runs.
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
    });
    return Response.json(
      { id, pid: session.pid, cwd: where.cwd },
      { status: 201 },
    );
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
