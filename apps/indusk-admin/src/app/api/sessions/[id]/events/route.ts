import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The session's events as server-sent events (admin-plan-authoring, ADR D2):
 * everything so far, then each new one, until the session exits or the panel
 * goes away. One `data:` line of JSON per event.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(request);
  if (refused) return refused;
  const { id } = await params;
  if (!sessionManager().get(id))
    return refuse(404, `no session ${id} is running`);
  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      unsubscribe = sessionManager().subscribe(id, (ev) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        if (ev.type === "exit") close();
      });
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
