import type { NextRequest } from "next/server";
import {
  adminOnly,
  planLocation,
  refuse,
  sessionManager,
} from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The session running now, if any (admin-plan-authoring, ADR D2). */
export function GET(request: NextRequest): Response {
  const refused = adminOnly(request);
  if (refused) return refused;
  return Response.json({ session: sessionManager().current() ?? null });
}

/**
 * Start a session for a plan: `{ project, plan, kind, prompt }`. It runs in the
 * plan's worktree while it has one. One at a time; a second is refused,
 * naming the first.
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
