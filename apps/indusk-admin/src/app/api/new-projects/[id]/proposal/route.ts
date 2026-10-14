import {
  findProjectDraft,
  induskHome,
  ProposalError,
  saveProposal,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Keep the person's edits to a project draft's proposal. The package checks
 * them as it checks the agent's - a turn-off of the brief or the test plan, a
 * decline with no reason, a name that is not a folder - and writes nothing for
 * one it refuses; the refusal names every problem.
 *
 * promise: the-core-is-always-kept
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a proposal is changed only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const draft = findProjectDraft(induskHome(), id);
  if (!draft) return refuse(404, `no project conversation ${id}`);
  const edited = await request.json().catch(() => null);
  try {
    return Response.json({ proposal: saveProposal(draft, edited) });
  } catch (err) {
    if (err instanceof ProposalError) return refuse(400, err.message);
    throw err;
  }
}
