import type { NextRequest } from "next/server";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Approve the amendments a plan waits on (brief-as-the-contract ADR decision
 * 6). Not built yet: Build Phase 3 authors A13 against this module first.
 */
export async function POST(
  request: NextRequest,
  _ctx: { params: Promise<{ name: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "an amendment is approved only from the admin's own page",
  );
  if (refused) return refused;
  return refuse(501, "approving an amendment is not built yet");
}
