import type { NextRequest } from "next/server";
import { refuse, sameOrigin, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stop the session (admin-plan-authoring A21): it is interrupted, and what it wrote stays written. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (!sameOrigin(request.headers.get("origin"), request.headers.get("host"))) {
    return refuse(403, "a session is stopped only from the admin's own page");
  }
  const { id } = await params;
  try {
    await sessionManager().stop(id);
    return Response.json({ ok: true });
  } catch (err) {
    return refuse(404, (err as Error).message);
  }
}
