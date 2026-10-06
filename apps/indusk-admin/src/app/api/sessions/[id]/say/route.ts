import type { NextRequest } from "next/server";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Say something to the session in the person's own words: `{ text }` (admin-plan-authoring A1). */
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
    text?: string;
  } | null;
  try {
    sessionManager().say(id, body?.text ?? "");
    return Response.json({ ok: true });
  } catch (err) {
    return refuse(409, (err as Error).message);
  }
}
