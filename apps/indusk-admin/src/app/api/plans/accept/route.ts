import type { NextRequest } from "next/server";
import { startRelease } from "@/lib/build-host";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Accept a built plan; the release workflow then runs (admin-plan-authoring A19). */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a plan is accepted only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
  } | null;
  if (!body?.project || !body.plan)
    return refuse(400, "acceptance needs project and plan");
  try {
    return Response.json(await startRelease(body.project, body.plan), {
      status: 202,
    });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
