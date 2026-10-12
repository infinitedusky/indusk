import {
  type LooksCheckout,
  looksCheckouts,
} from "@infinitedusky/indusk-mcp/looks/overview";
import type { NextRequest } from "next/server";
import { getProjectPath } from "@/lib/registry-client";
import { adminOnly, fromTheBrowser, refuse } from "@/lib/session-host";

/**
 * How the Approve and Unapprove routes read a request, once: only the person's
 * own browser on the admin's page (`adminOnly`, then `fromTheBrowser`), the
 * JSON body, the project the body names, and the checkout it names. What each
 * route does with the body — which subject it parses and what it records —
 * stays in the route. The decision of what a request may do is the package's
 * (`approve`, `withdraw`); this reads where it was made.
 *
 * `checkout` is the plan whose worktree the page showed, or null for the
 * project's own checkout, resolved from the plan-worktree record and never
 * taken as a path. The package's `resolveLooksCheckout` falls back to the one
 * worktree that holds looks when the project's own has none; an approval is
 * written where the page was drawn, so the plan named is the plan found or the
 * request is refused.
 *
 * promise: a-mockup-is-approved-by-a-person
 */

/** The fields every looks write names, whatever it records. */
export interface LooksBody {
  project?: string;
  checkout?: string | null;
}

/** A request that passed: the app, the project's root, the checkout to write in, and what the body parsed to. */
export interface ReadRequest<B extends LooksBody, S> {
  app: string;
  body: B & { project: string };
  root: string;
  checkout: LooksCheckout;
  subject: S;
}

export async function readLooksRequest<B extends LooksBody, S>(
  request: NextRequest,
  params: Promise<{ app: string }>,
  {
    adminMessage,
    browserMessage,
    subjectOf,
    incomplete,
  }: {
    /** Why only the admin's own page may ask. */
    adminMessage: string;
    /** Why only a person in their browser may ask. */
    browserMessage: string;
    /** What the body names, or null when it names less than the write binds. */
    subjectOf: (body: B) => S | null;
    /** The 400 text for a body that names less. */
    incomplete: (body: B | null) => string;
  },
): Promise<Response | ReadRequest<B, S>> {
  const refused =
    adminOnly(request, adminMessage) ?? fromTheBrowser(request, browserMessage);
  if (refused) return refused;
  const { app } = await params;
  const body = (await request.json().catch(() => null)) as B | null;
  const subject = body?.project ? subjectOf(body) : null;
  if (!body?.project || !subject) return refuse(400, incomplete(body));
  const root = getProjectPath(body.project);
  if (!root) return refuse(404, `no project named ${body.project}`);
  const checkout = (await looksCheckouts(root)).find(
    (c) => c.plan === (body.checkout ?? null),
  );
  if (!checkout)
    return refuse(
      404,
      `plan ${JSON.stringify(body.checkout)} has no worktree here that holds mockups`,
    );
  return {
    app,
    body: body as B & { project: string },
    root,
    checkout,
    subject,
  };
}
