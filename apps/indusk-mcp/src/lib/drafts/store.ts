import { randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { isUsableSegment } from "../path-segment.js";
import { DAY_MS, isAged } from "./age.js";

/**
 * Drafts: conversations not yet kept as plans (brief-as-the-contract, ADR
 * decision 6). A draft is a folder under the project's home —
 * `<home>/drafts/<id>/` — so nothing of it is in any checkout or on any
 * branch until a person accepts a name for it. What the conversation writes is
 * `brief.md` (promises, expectations, looks) or `research.md` (notes), and the
 * agent's proposal is `proposal.json`.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */

export interface Draft {
	id: string;
	/** `<home>/drafts/<id>`. */
	dir: string;
}

/** What the agent proposes, and the person accepts or edits. */
export interface Proposal {
	name: string;
	type: string;
	/** In a workbench wrapping several repos, the one the plan's code goes in. */
	repo?: string;
}

export interface DraftSummary extends Draft {
	/** What the conversation is about, in a line: the proposal's name, or the first thing its documents say. */
	title: string;
	proposal: Proposal | null;
	hasBrief: boolean;
	/** When the draft was last touched, ms since the epoch. */
	updatedMs: number;
	/** Untouched for `AGED_AFTER_DAYS` or more. */
	aged: boolean;
}

const MARKER = "draft.json";

export const draftsDir = (home: string): string => join(home, "drafts");

/** A new, empty draft; `docs` seeds the documents the conversation would write. */
export function createDraft(
	home: string,
	docs: { brief?: string; research?: string } = {},
	now: Date = new Date(),
): Draft {
	const id = `${now.getTime().toString(36)}-${randomBytes(3).toString("hex")}`;
	const dir = join(draftsDir(home), id);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, MARKER), `${JSON.stringify({ id, created: now.toISOString() })}\n`);
	if (docs.brief !== undefined) writeFileSync(join(dir, "brief.md"), docs.brief);
	if (docs.research !== undefined) writeFileSync(join(dir, "research.md"), docs.research);
	return { id, dir };
}

/** The draft `id`, or null when there is none (an id is one clean segment, never a path). */
export function findDraft(home: string, id: string): Draft | null {
	if (!isUsableSegment(id)) return null;
	const dir = join(draftsDir(home), id);
	return existsSync(join(dir, MARKER)) ? { id, dir } : null;
}

export function writeProposal(draft: Draft, proposal: Proposal): void {
	writeFileSync(join(draft.dir, "proposal.json"), `${JSON.stringify(proposal, null, 2)}\n`);
}

export function readProposal(draft: Draft): Proposal | null {
	try {
		const raw = JSON.parse(
			readFileSync(join(draft.dir, "proposal.json"), "utf-8"),
		) as Partial<Proposal>;
		if (typeof raw.name !== "string" || typeof raw.type !== "string") return null;
		return {
			name: raw.name,
			type: raw.type,
			...(typeof raw.repo === "string" ? { repo: raw.repo } : {}),
		};
	} catch {
		return null;
	}
}

/** A document the conversation wrote, or null when it has not written it (or only blank). */
export function readDraftDocument(draft: Draft, doc: "brief" | "research"): string | null {
	try {
		const text = readFileSync(join(draft.dir, `${doc}.md`), "utf-8");
		return text.trim() === "" ? null : text;
	} catch {
		return null;
	}
}

/** Mark the draft as talked in just now, so it is not aged while a person is on it. */
export function touchDraft(draft: Draft, now: Date = new Date()): void {
	utimesSync(join(draft.dir, MARKER), now, now);
}

function newestMtimeMs(dir: string): number {
	let newest = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		newest = Math.max(newest, entry.isDirectory() ? newestMtimeMs(path) : statSync(path).mtimeMs);
	}
	return newest;
}

const firstLine = (text: string | null): string | null => {
	const line = text
		?.split("\n")
		.map((l) => l.replace(/^#+\s*/, "").trim())
		.find((l) => l !== "" && l !== "---" && !/^[a-z_]+:/.test(l));
	return line || null;
};

/** Every draft in the home, most recently touched first. */
export function listDrafts(home: string, now: Date = new Date()): DraftSummary[] {
	const root = draftsDir(home);
	if (!existsSync(root)) return [];
	const found: DraftSummary[] = [];
	for (const entry of readdirSync(root, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const draft = findDraft(home, entry.name);
		if (!draft) continue;
		const proposal = readProposal(draft);
		const brief = readDraftDocument(draft, "brief");
		const updatedMs = newestMtimeMs(draft.dir);
		found.push({
			...draft,
			title:
				proposal?.name ??
				firstLine(brief) ??
				firstLine(readDraftDocument(draft, "research")) ??
				"a new conversation",
			proposal,
			hasBrief: brief !== null,
			updatedMs,
			aged: isAged(updatedMs, now),
		});
	}
	return found.sort((a, b) => b.updatedMs - a.updatedMs);
}

/** Throw a draft away: its folder, and nothing else. Quiet when it is already gone. */
export function discardDraft(home: string, id: string): void {
	const draft = findDraft(home, id);
	if (draft) rmSync(draft.dir, { recursive: true, force: true });
}

/** Where an aged draft is kept: `<home>/drafts/archive/<id>/`, which is not itself a draft (it has no marker). */
export const draftsArchiveDir = (home: string): string => join(draftsDir(home), "archive");

/**
 * Archive every draft untouched for `maxAgeDays` or more, moved whole to
 * `<home>/drafts/archive/<id>/` (ADR decision 9: a draft nobody returned to is
 * archived, never lost — what it held can still be read). Returns their ids.
 * `dryRun` only reads.
 */
export function sweepDrafts(
	home: string,
	opts: { maxAgeDays: number; now?: Date; dryRun?: boolean },
): string[] {
	const now = (opts.now ?? new Date()).getTime();
	const old = listDrafts(home).filter((d) => now - d.updatedMs >= opts.maxAgeDays * DAY_MS);
	if (!opts.dryRun) {
		mkdirSync(draftsArchiveDir(home), { recursive: true });
		for (const d of old) {
			const kept = join(draftsArchiveDir(home), d.id);
			rmSync(kept, { recursive: true, force: true });
			renameSync(d.dir, kept);
		}
	}
	return old.map((d) => d.id);
}
