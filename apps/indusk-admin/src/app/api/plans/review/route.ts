import {
  BuildPlanUnreadable,
  buildReview,
} from "@infinitedusky/indusk-mcp/build";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The review of a built plan, `?project=&plan=` — what `indusk plans review --json` prints (A15–A17, A30). */
export async function GET(request: NextRequest): Promise<Response> {
  const refused = adminOnly(request);
  if (refused) return refused;
  const project = request.nextUrl.searchParams.get("project") ?? "";
  const plan = request.nextUrl.searchParams.get("plan") ?? "";
  const root = getProjectPath(project);
  if (!root) return refuse(404, `no project named ${project}`);
  try {
    return Response.json(await buildReview(root, plan));
  } catch (err) {
    if (err instanceof BuildPlanUnreadable) return refuse(404, err.message);
    throw err;
  }
}
