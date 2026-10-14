import type { DraftDocument } from "@infinitedusky/indusk-mcp/new-project";

/**
 * A document as the page sends it: its name and its text, or its bytes in
 * base64 when it is not text. Returns what the package stores, or why not.
 */
export interface SentDocument {
  name?: unknown;
  content?: unknown;
  encoding?: unknown;
}

export function readSentDocument(
  sent: SentDocument,
): { ok: true; document: DraftDocument } | { ok: false; error: string } {
  if (typeof sent.name !== "string" || sent.name.trim() === "")
    return { ok: false, error: "a document needs a name" };
  if (typeof sent.content !== "string")
    return { ok: false, error: `${sent.name} has no content` };
  return {
    ok: true,
    document: {
      name: sent.name,
      content:
        sent.encoding === "base64"
          ? Buffer.from(sent.content, "base64")
          : sent.content,
    },
  };
}
