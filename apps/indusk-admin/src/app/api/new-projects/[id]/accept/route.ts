import {
  CreationError,
  createProject,
  findProjectDraft,
  induskHome,
  ProposalError,
  saveProposal,
  validateProposal,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { stopDraftSession } from "@/lib/new-project-session";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Accept a project draft's proposal and make the project, answering as the
 * steps happen: one JSON object per line - `{ type: "step", id, state }` as
 * each step starts or ends, then `{ type: "done", name, href }` or
 * `{ type: "error", message }`. The package makes the project; this route only
 * carries what it reports. Nothing is made unless the page asks. The draft's
 * running session is stopped first, as discard does.
 *
 * The request carries `{ proposal }`: the proposal as the person last saved
 * it. It is saved over `proposal.json` after the agent has stopped, and
 * creation reads that - never what the agent wrote after the press, which a
 * still-running agent could otherwise change between the person's last look
 * and the project (a GitHub repository included).
 *
 * promise: a-new-project-publishes-nothing-unasked
 * promise: a-new-project-is-made-by-the-agent
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a project is made only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const draft = findProjectDraft(induskHome(), id);
  if (!draft) return refuse(404, `no project conversation ${id}`);
  const body = (await request.json().catch(() => null)) as {
    proposal?: unknown;
  } | null;
  const checked = validateProposal(body?.proposal);
  if (checked.proposal === null) {
    return refuse(
      400,
      `Create needs the proposal as the person saved it: ${checked.problems.join("; ")}`,
    );
  }
  // The conversation is over once the project is made: its agent would keep
  // running in the deleted draft folder and hold the one session slot.
  await stopDraftSession(id);
  try {
    saveProposal(draft, checked.proposal);
  } catch (err) {
    if (err instanceof ProposalError) return refuse(400, err.message);
    throw err;
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const created = await createProject(induskHome(), id, {
          report: (step, state) => send({ type: "step", id: step, state }),
        });
        send({
          type: "done",
          name: created.name,
          href: `/p/${created.name}/`,
          ...(created.remoteError ? { remoteError: created.remoteError } : {}),
        });
      } catch (err) {
        send({
          type: "error",
          message:
            err instanceof CreationError ? err.message : (err as Error).message,
        });
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
