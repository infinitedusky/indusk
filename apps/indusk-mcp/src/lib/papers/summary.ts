import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { readPublishedRecord } from "./provenance.js";

/**
 * Papers as documents: the status vocabulary, the summary the parser reports,
 * the content hash a publish records, and staleness derived from it.
 *
 * Lifted out of `plan-parser.ts` (writing-skill cleanup) because the parser
 * is the lifecycle-document parser and this is a different document kind;
 * the parser re-exports the public names so the `planning/plan-parser`
 * subpath and every existing import keep working. This module must not
 * import the parser.
 */

/**
 * Papers — prose documents that declare `kind: paper` in frontmatter and live
 * beside (or instead of) the lifecycle documents. Declared, never inferred
 * from filenames: a thesis, a shape document, and an essay can all be papers,
 * and nothing about a name says which. See `.indusk/planning/writing-skill/adr.md`.
 */
export const PAPER_STATUSES = ["draft", "accepted", "published"] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number] | "malformed";

export interface PaperSummary {
	file: string;
	title: string;
	/** `malformed` when the status is outside the vocabulary — never silently a draft. */
	status: PaperStatus;
	/**
	 * Derived on every read, never stored: the paper is published and its
	 * content no longer matches the hash the publish recorded (or no hash was
	 * recorded, which cannot be confirmed current and so reads stale).
	 */
	stale: boolean;
}

/**
 * The content hash a publish records and staleness compares against.
 *
 * Hashes the document with `status` and the `published` block removed, so
 * writing either back after a publish does not change what it hashes; a
 * publish computes this on the pre-write content and the next read computes
 * it on the written file and gets the same answer.
 */
export function paperContentHash(raw: string): string {
	const { data, content } = matter(raw);
	const rest: Record<string, unknown> = { ...data };
	delete rest.published;
	delete rest.status;
	return `sha256:${createHash("sha256").update(matter.stringify(content, rest)).digest("hex")}`;
}

function isPaperStatus(value: unknown): value is (typeof PAPER_STATUSES)[number] {
	return typeof value === "string" && (PAPER_STATUSES as readonly string[]).includes(value);
}

/**
 * One document read as a paper; null when it does not declare `kind: paper`.
 * A document whose frontmatter cannot be parsed cannot declare anything, so
 * it is not a paper here — the lifecycle walk reports it if it is a lifecycle
 * document, and the admin's raw view shows it either way.
 */
export function readPaper(planDir: string, file: string): PaperSummary | null {
	const raw = readFileSync(join(planDir, file), "utf-8");
	let data: Record<string, unknown>;
	try {
		data = matter(raw).data as Record<string, unknown>;
	} catch {
		return null;
	}
	if (data.kind !== "paper") return null;
	const status: PaperStatus = isPaperStatus(data.status) ? data.status : "malformed";
	return {
		file,
		title: typeof data.title === "string" ? data.title : file,
		status,
		stale: paperIsStale(raw, data, status),
	};
}

/**
 * The staleness policy, in one place: a published paper is stale when its
 * current content hash differs from the one the publish recorded, or when
 * no hash was recorded at all (published by hand; cannot be confirmed
 * current, so it reads stale rather than reassuringly fresh). Anything not
 * yet published has nothing to be stale against. The publish step records
 * exactly what this compares, so the two must agree here, not in two places.
 */
export function paperIsStale(
	raw: string,
	data: Record<string, unknown>,
	status: PaperStatus,
): boolean {
	if (status !== "published") return false;
	const published = readPublishedRecord(data);
	const recorded = typeof published?.hash === "string" ? published.hash : null;
	return recorded === null || recorded !== paperContentHash(raw);
}

const PAPER_STATUS_ORDER: Record<PaperStatus, number> = {
	malformed: 0,
	draft: 1,
	accepted: 2,
	published: 3,
};

/** The least-advanced paper's status; `malformed` outranks everything so it surfaces. */
export function leastAdvancedPaperStatus(papers: PaperSummary[]): PaperStatus {
	return papers.reduce<PaperStatus>(
		(least, p) => (PAPER_STATUS_ORDER[p.status] < PAPER_STATUS_ORDER[least] ? p.status : least),
		"published",
	);
}

export function paperNextStep(papers: PaperSummary[]): string {
	const malformed = papers.find((p) => p.status === "malformed");
	if (malformed) {
		return `Fix paper status in ${malformed.file} (expected ${PAPER_STATUSES.join(" | ")})`;
	}
	const draft = papers.find((p) => p.status === "draft");
	if (draft) return `Review paper: ${draft.file}`;
	const owed = papers.filter((p) => p.status === "accepted" || p.stale).length;
	if (owed > 0) return `Publish ${owed} paper(s)`;
	return "Done";
}
