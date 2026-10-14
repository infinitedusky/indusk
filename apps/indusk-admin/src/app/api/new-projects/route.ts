import {
  createProjectDraft,
  discardProjectDraft,
  induskHome,
  readProjectDraft,
} from "@infinitedusky/indusk-mcp/new-project";
import type { NextRequest } from "next/server";
import {
  readSentDocument,
  type SentDocument,
} from "@/lib/new-project-document";
import {
  busyMessage,
  startProjectConversation,
} from "@/lib/new-project-session";
import { adminOnly, refuse } from "@/lib/session-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * New project (new-project-flow, ADR decision 2): `{ message, documents? }`.
 * Opens a draft under the InDusk home holding the first message and the
 * documents, and starts the conversation with the agent that holds both. No
 * project is needed and none is made: the draft is a folder of its own, and a
 * start that fails removes it.
 *
 * promise: a-project-starts-as-a-conversation
 */
export async function POST(request: NextRequest): Promise<Response> {
  const refused = adminOnly(
    request,
    "a project conversation is started only from the admin's own page",
  );
  if (refused) return refused;
  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    documents?: SentDocument[];
  } | null;
  if (typeof body?.message !== "string" || body.message.trim() === "")
    return refuse(400, "a new project needs a message: what you want to build");
  const busy = busyMessage();
  if (busy) return refuse(409, busy);

  const documents = [];
  for (const sent of body.documents ?? []) {
    const read = readSentDocument(sent);
    if (!read.ok) return refuse(400, read.error);
    documents.push(read.document);
  }
  const home = induskHome();
  let draft: ReturnType<typeof createProjectDraft>;
  try {
    draft = createProjectDraft(home, { message: body.message, documents });
  } catch (err) {
    return refuse(400, (err as Error).message);
  }
  const view = readProjectDraft(home, draft.id);
  if (!view) return refuse(500, "the draft was not kept");
  try {
    startProjectConversation(view);
  } catch (err) {
    discardProjectDraft(home, draft.id);
    return refuse(409, (err as Error).message);
  }
  return Response.json({ id: draft.id }, { status: 201 });
}
