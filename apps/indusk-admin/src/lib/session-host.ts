import { SessionManager } from "@infinitedusky/indusk-mcp/session";
import { livePlanCopy } from "@infinitedusky/indusk-mcp/worktree/plan-worktrees";
import { getProjectPath } from "./registry-client";

/**
 * The admin daemon's side of sessions (admin-plan-authoring, ADR D2). The
 * daemon is one long-lived Next server, and its route handlers share one
 * session manager — held on `globalThis`, because Next may load a route's
 * module more than once and a second manager would not know the first's
 * session. Everything a session does is the package's; this file only finds
 * the manager, where a plan lives, and whether a request came from the
 * admin's own page.
 */

const KEY = Symbol.for("indusk.admin.sessionManager");

export function sessionManager(): SessionManager {
  const g = globalThis as unknown as Record<symbol, SessionManager | undefined>;
  g[KEY] ??= new SessionManager();
  return g[KEY];
}

/**
 * Whether a request that changes something came from the admin's own page.
 * A route here can start the developer's `claude`, so a request another site's
 * page makes in their browser must be refused. The browser's `Origin` is
 * compared with the `Host` the request was sent to — not with the URL Next
 * sees, which behind the Caddy route (`indusk.dawn`) is the loopback address.
 */
export function sameOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The project's root and where `plan` lives in it now — its worktree while it has one. */
export async function planLocation(
  project: string,
  plan: string,
): Promise<{ root: string; cwd: string } | { error: string }> {
  const root = getProjectPath(project);
  if (!root) return { error: `no project named ${project}` };
  const live = await livePlanCopy(root, plan);
  if (!live.ok)
    return { error: `the worktree record cannot be read: ${live.problem}` };
  return { root, cwd: live.copy.root };
}

/** A JSON error response with `status`. */
export function refuse(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
