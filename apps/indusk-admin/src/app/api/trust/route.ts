import { trustProject } from "@infinitedusky/indusk-mcp/session";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trust a project in Claude Code (workbench-plan-authoring D12, A25):
 * `{ project }`. Sent only by the person's click on "Trust in Claude Code";
 * writes only `hasTrustDialogAccepted` for the project's root.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a project is trusted only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
  } | null;
  if (!body?.project) return refuse(400, "trust needs a project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const trust = trustProject(root);
  if (trust === "untrusted")
    return refuse(
      409,
      "Claude Code's config could not be read; nothing was written",
    );
  return Response.json({ trust });
}
