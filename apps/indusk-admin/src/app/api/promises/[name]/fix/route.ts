import { fixPrompt } from "@infinitedusky/indusk-mcp/promises/fix";
import { proofOf } from "@infinitedusky/indusk-mcp/promises/proof";
import type { NextRequest } from "next/server";
import { readProjectPromises, registryOf } from "@/lib/promises-reader";
import { getProjectPath } from "@/lib/registry-client";
import {
  adminOnly,
  planLocation,
  refuse,
  sessionManager,
} from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * *Start a fix plan* (plan-cockpit, ADR decision 4): `{ project }` starts the
 * developer's own `claude` for a broken promise, its first message the
 * package's `fixPrompt` for the break — worded once, in the package, for this
 * route and the editor alike. The session runs where the promise's owning plan
 * lives now (its worktree, else the project). The owning plan's planning session is
 * the one it can collide with; a second is refused, naming the first.
 *
 * promise: a-break-opens-a-fix-in-one-click
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a fix is started only from the admin's own page",
  );
  if (refused) return refused;
  const { name } = await params;
  const body = (await request.json().catch(() => null)) as {
    project?: string;
  } | null;
  if (!body?.project) return refuse(400, "a fix needs a project");
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const entry = registryOf(readProjectPromises(root))?.promises.find(
    (p) => p.name === name || p.aliases.includes(name),
  );
  const proof = entry ? await proofOf(root, entry.name) : null;
  if (!entry || !proof)
    return refuse(404, `${root} has no promise named ${name}`);
  if (!proof.broken)
    return refuse(
      409,
      `${entry.name} is not broken, so there is nothing to fix`,
    );
  const where = await planLocation(body.project, entry.owner);
  if ("error" in where) return refuse(404, where.error);
  try {
    const { id, session } = sessionManager().start({
      cwd: where.cwd,
      ...(where.addDirs ? { addDirs: where.addDirs } : {}),
      kind: "planning",
      prompt: fixPrompt(proof.broken),
      project: body.project,
      plan: entry.owner,
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
