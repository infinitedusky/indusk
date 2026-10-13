/**
 * Drafts: conversations not yet kept as plans (brief-as-the-contract, Build
 * Phase 5). A draft lives under the project's home, outside every checkout.
 *
 * promise: a-conversation-that-is-not-kept-leaves-nothing-in-the-repository
 */

export interface Draft {
	id: string;
	dir: string;
}

export interface Proposal {
	name: string;
	type: string;
	repo?: string;
}

export interface DraftSummary {
	id: string;
}

// Not yet written: the tests for A19-A21 are authored first and fail here.
export function createDraft(_home: string, _docs: { brief?: string; research?: string }): Draft {
	return { id: "", dir: "" };
}
export function writeProposal(_draft: Draft, _proposal: Proposal): void {}
export function listDrafts(_home: string): DraftSummary[] {
	return [];
}
export function discardDraft(_home: string, _id: string): void {}
export async function startFromDraft(_project: string, _draft: Draft): Promise<{ plan: string; worktree: string }> {
	return { plan: "", worktree: "" };
}
