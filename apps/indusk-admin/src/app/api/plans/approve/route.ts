import {
  approvePlan,
  PlanCommandRefusal,
} from "@infinitedusky/indusk-mcp/plans";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { refuse, sameOrigin } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve a plan (admin-plan-authoring A9, A23): `{ project, plan }`. The same
 * command as `indusk plans approve` — the brief check, then the documents and
 * promises merge to the trunk. A refusal is returned as the command words it.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return refuse(403, "a plan is approved only from the admin's own page");
  }
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
  } | null;
  if (!body?.project || !body.plan)
    return refuse(400, "approval needs project and plan");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  try {
    const approved = await approvePlan(root, body.plan);
    return Response.json(approved);
  } catch (err) {
    if (err instanceof PlanCommandRefusal) return refuse(409, err.message);
    throw err;
  }
}
