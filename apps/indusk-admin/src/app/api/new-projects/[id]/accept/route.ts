import {
  CreationError,
  createProject,
  findProjectDraft,
  induskHome,
  newProjectSessionPlan,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

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
  if (!findProjectDraft(induskHome(), id)) {
    return refuse(404, `no project conversation ${id}`);
  }
  // The conversation is over once the project is made: its agent would keep
  // running in the deleted draft folder and hold the one session slot.
  const running = sessionManager().current();
  if (running?.plan === newProjectSessionPlan(id)) {
    await sessionManager().get(running.id)?.stop();
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
