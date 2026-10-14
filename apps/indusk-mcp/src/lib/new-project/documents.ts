import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { diffFiles } from "../git.js";
import { type DraftDocument, documentName, documentsDir, type ProjectDraft } from "./store.js";

/**
 * Adding a document to a draft (new-project-flow, ADR decision 4). A name the
 * draft already holds keeps the newer bytes, and what changed between the two
 * is returned as a unified diff - the text the admin says to the agent so it
 * works from the new version and knows what moved. The older bytes are not
 * kept: the draft holds one version of a document, the latest.
 *
 * promise: a-new-version-of-the-founding-brief-shows-what-changed
 */

export interface AddedDocument {
	name: string;
	/** A document of this name was already in the draft. */
	replaced: boolean;
	/** Unified diff of old to new; "" when nothing differs or the name is new. */
	diff: string;
}

/** Put `doc` in the draft's `documents/`; report what it replaced, if anything. */
export function addDocument(draft: ProjectDraft, doc: DraftDocument): AddedDocument {
	const name = documentName(doc.name);
	const dir = documentsDir(draft);
	mkdirSync(dir, { recursive: true });
	const target = join(dir, name);
	const replaced = existsSync(target);
	let diff = "";
	if (replaced) {
		const scratch = mkdtempSync(join(tmpdir(), "new-project-diff-"));
		try {
			const before = join(scratch, "before", name);
			const after = join(scratch, "after", name);
			mkdirSync(join(scratch, "before"));
			mkdirSync(join(scratch, "after"));
			copyFileSync(target, before);
			writeFileSync(after, doc.content);
			diff = readableDiff(diffFiles(before, after), name);
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	}
	writeFileSync(target, doc.content);
	return { name, replaced, diff };
}

/** git's headers name scratch paths; this names the document and drops the plumbing lines. */
function readableDiff(raw: string, name: string): string {
	return raw
		.split("\n")
		.filter((line) => !line.startsWith("diff --git ") && !line.startsWith("index "))
		.map((line) => {
			if (line.startsWith("--- ")) return `--- ${name} (before)`;
			if (line.startsWith("+++ ")) return `+++ ${name} (after)`;
			return line;
		})
		.join("\n");
}

/**
 * What the agent is told when a document reaches a conversation it is already
 * in: the difference, when a name was replaced, so it works from the new
 * version, or where to read a document it has not seen. The words are the
 * package's, so the admin and a person at the command line send the same.
 */
export function documentNotice(added: AddedDocument): string {
	if (!added.replaced) return `A document was added: ./documents/${added.name}. Read it.`;
	return `A newer version of ./documents/${added.name} was added. What changed:\n\n${added.diff || "(nothing differs)"}\n\nWork from the new version.`;
}
