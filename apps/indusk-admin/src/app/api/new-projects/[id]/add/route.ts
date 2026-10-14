import {
  addDocument,
  documentNotice,
  findProjectDraft,
  induskHome,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import {
  readSentDocument,
  type SentDocument,
} from "@/lib/new-project-document";
import { draftSession } from "@/lib/new-project-session";
import { adminOnly, refuse, sessionManager } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add a document to a project draft: `{ name, content, encoding? }`. A name
 * already in the draft keeps the newer bytes, and when the agent is in the
 * conversation it is told what changed (the unified diff) through the
 * session's own say route - the same words a person would send - so it works
 * from the new version.
 *
 * promise: a-new-version-of-the-founding-brief-shows-what-changed
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const refused = adminOnly(
    request,
    "a document is added only from the admin's own page",
  );
  if (refused) return refused;
  const { id } = await ctx.params;
  const draft = findProjectDraft(induskHome(), id);
  if (!draft) return refuse(404, `no project conversation ${id}`);
  const sent = (await request.json().catch(() => null)) as SentDocument | null;
  const read = readSentDocument(sent ?? {});
  if (!read.ok) return refuse(400, read.error);
  let added: ReturnType<typeof addDocument>;
  try {
    added = addDocument(draft, read.document);
  } catch (err) {
    return refuse(400, (err as Error).message);
  }
  const running = draftSession(id);
  const told = running !== null;
  if (running) sessionManager().say(running.id, documentNotice(added));
  return Response.json({ ...added, told });
}
