import type { NextRequest } from "next/server";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Answer what the session asked (admin-plan-authoring, ADR D2):
 * `{ requestId, answers }` for a question, `{ requestId, allow, message? }`
 * for a request to use a tool.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a session is answered only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    requestId?: string;
    answers?: Record<string, string>;
    allow?: boolean;
    message?: string;
  } | null;
  if (!body?.requestId)
    return refuse(400, "a reply names the requestId it answers");
  try {
    if (body.answers) {
      sessionManager().reply(id, {
        requestId: body.requestId,
        answers: body.answers,
      });
    } else if (body.allow === true) {
      sessionManager().reply(id, { requestId: body.requestId, allow: true });
    } else if (body.allow === false) {
      sessionManager().reply(id, {
        requestId: body.requestId,
        allow: false,
        message: body.message || "The person declined.",
      });
    } else {
      return refuse(400, "a reply carries answers, or allow true or false");
    }
    return Response.json({ ok: true });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
