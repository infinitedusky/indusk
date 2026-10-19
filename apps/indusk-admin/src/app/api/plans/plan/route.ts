import type { NextRequest } from "next/server";
import { planningState, startPlanning } from "@/lib/build-host";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What the plan's planning run is doing: `?project=&plan=` (a-brief-is-planned-unasked). */
export function GET(request: NextRequest): Response {
  const refused = adminOnly(request);
  if (refused) return refused;
  const project = request.nextUrl.searchParams.get("project") ?? "";
  const plan = request.nextUrl.searchParams.get("plan") ?? "";
  return Response.json({ planning: planningState(project, plan) });
}

/**
 * Ask for the plan to be written from its accepted brief, unattended:
 * `{ project, plan }`. A run begins only when the brief is accepted, every
 * look it names is approved and a document is still to write; otherwise the
 * answer says why none began (200), so `accept-brief` and the look approval can
 * ask at every moment a run might now be due. It never approves the plan.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a planning run is started only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
  } | null;
  if (!body?.project || !body.plan)
    return refuse(400, "a planning run needs project and plan");
  try {
    const planning = await startPlanning(body.project, body.plan);
    return Response.json(planning, { status: planning.started ? 202 : 200 });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
