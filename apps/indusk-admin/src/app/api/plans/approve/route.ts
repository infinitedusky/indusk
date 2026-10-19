import {
  approvePlan,
  PlanCommandRefusal,
} from "@infinitedusky/indusk-mcp/plans";
import type { NextRequest } from "next/server";
import { planningState, startBuild } from "@/lib/build-host";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start the approved plan's build. The approval stands whatever this answers:
 * a build that cannot start (another is running, the cap is held) is said, not
 * thrown, so the person sees an approved plan and why it is not yet building.
 */
async function buildAfterApproval(
  project: string,
  plan: string,
): Promise<{ started: true } | { started: false; why: string }> {
  try {
    await startBuild(project, plan);
    return { started: true };
  } catch (err) {
    return { started: false, why: (err as Error).message };
  }
}

/**
 * Approve a plan (admin-plan-authoring A9, A23): `{ project, plan }`. The same
 * command as `indusk plans approve` — the brief check, then the documents and
 * promises merge to the trunk — and then its build starts, unattended
 * (a-brief-is-planned-unasked A8). A refusal is returned as the command words
 * it and starts nothing.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a plan is approved only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
    plan?: string;
  } | null;
  if (!body?.project || !body.plan)
    return refuse(400, "approval needs project and plan");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  // The documents are still being written: approving would merge them under the
  // session, and the build it starts would be refused as "being planned".
  const planning = planningState(body.project, body.plan);
  if (planning?.running) {
    return refuse(
      409,
      `${body.plan} is still being planned${planning.step ? ` (${planning.step})` : ""}: approve it when the run stops for approval`,
    );
  }
  try {
    const approved = await approvePlan(root, body.plan);
    // Only an approval that returned starts the build; a refusal above started nothing.
    return Response.json({
      ...approved,
      build: await buildAfterApproval(body.project, body.plan),
    });
  } catch (err) {
    if (err instanceof PlanCommandRefusal) return refuse(409, err.message);
    throw err;
  }
}
