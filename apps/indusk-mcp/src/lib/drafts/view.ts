import { bookkeepingRoots } from "../bookkeeping/roots.js";
import { listedLooks } from "../plans/parts.js";
import { parseBriefContract } from "../promises/brief-contract.js";
import { describeDraftAge } from "./age.js";
import {
	type Draft,
	findDraft,
	listDrafts,
	type Proposal,
	readDraftDocument,
	readProposal,
} from "./store.js";

/**
 * Where the drafts of the project at `anyCheckout` live: its home, the same
 * from every checkout (`indusk eval home`). One definition, read by the CLI and
 * the admin's routes.
 */
export const draftHomeOf = (anyCheckout: string): string => bookkeepingRoots(anyCheckout).home;

/** What a draft's page shows of the conversation so far: the parts of the brief it has written, and the proposal. */
export interface DraftView {
	id: string;
	title: string;
	proposal: Proposal | null;
	hasBrief: boolean;
	hasResearch: boolean;
	/** The promises the brief makes, by name. */
	promises: string[];
	expectations: string[];
	/** The looks the brief lists, by name. */
	looks: string[];
	age: string;
	aged: boolean;
}

export function readDraftView(home: string, id: string, now: Date = new Date()): DraftView | null {
	const draft: Draft | null = findDraft(home, id);
	if (!draft) return null;
	const summary = listDrafts(home, now).find((d) => d.id === id);
	const text = readDraftDocument(draft, "brief");
	const parsed = text === null ? null : parseBriefContract(text);
	const brief = parsed?.shape === "contract" ? parsed : null;
	return {
		id,
		title: summary?.title ?? "a new conversation",
		proposal: readProposal(draft),
		hasBrief: text !== null,
		hasResearch: readDraftDocument(draft, "research") !== null,
		promises: brief?.makes.map((m) => m.name) ?? [],
		expectations: brief?.expectations.map((e) => e.text) ?? [],
		looks: brief ? listedLooks(brief).map((l) => l.name) : [],
		age: describeDraftAge(summary?.updatedMs ?? now.getTime(), now),
		aged: summary?.aged ?? false,
	};
}

/** The drafts of the project, as the project page lists them. */
export function readDraftRows(
	anyCheckout: string,
	now: Date = new Date(),
): Array<{ id: string; title: string; age: string; aged: boolean }> {
	return listDrafts(draftHomeOf(anyCheckout), now).map((d) => ({
		id: d.id,
		title: d.title,
		age: describeDraftAge(d.updatedMs, now),
		aged: d.aged,
	}));
}
