import type { NextRequest } from "next/server";
import { buildState, startBuild } from "@/lib/build-host";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";
import { ownsSession } from "@/lib/session-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the plan's build is doing: `?project=&plan=` (admin-plan-authoring A11–A14). */
export function GET(request: NextRequest): Response {
  const refused = adminOnly(request);
  if (refused) return refused;
  const project = request.nextUrl.searchParams.get("project") ?? "";
  const plan = request.nextUrl.searchParams.get("plan") ?? "";
  const session = sessionManager().current();
  return Response.json({
    build: buildState(project, plan),
    sessionId: ownsSession(session, project, plan, "build") ? session.id : null,
  });
}

/** Build an approved plan, unattended, to review: `{ project, plan }`. */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a build is started only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
  } | null;
  if (!body?.project || !body.plan)
    return refuse(400, "a build needs project and plan");
  try {
    return Response.json(await startBuild(body.project, body.plan), {
      status: 202,
    });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
