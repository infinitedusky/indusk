import type { NextRequest } from "next/server";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stop the session (admin-plan-authoring A21): it is interrupted, and what it wrote stays written. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a session is stopped only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await params;
  try {
    await sessionManager().stop(id);
    return Response.json({ ok: true });
  } catch (err) {
    return refuse(404, (err as Error).message);
  }
}
