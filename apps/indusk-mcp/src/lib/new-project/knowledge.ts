import type { ProjectDraftView } from "./store.js";

/**
 * What the agent knows so far, for the conversation's side panel
 * (new-project-flow, the `knowledge-list` look): the four things a proposal
 * needs, each settled, being asked now, or not yet reached. Read from what
 * the conversation has written - the brief settles why and what, the proposal
 * settles how, where, the name and the place - so the page computes none of it.
 */

export type KnowledgeState = "settled" | "asking" | "open";

export interface KnowledgeEntry {
	key: "why" | "what" | "how-where" | "name-place";
	label: string;
	state: KnowledgeState;
}

export function knowledgeOf(
	draft: Pick<ProjectDraftView, "brief" | "hasProposal">,
): KnowledgeEntry[] {
	const briefed = draft.brief !== null;
	return [
		{
			key: "why",
			label: "Why — goals and success criteria",
			state: briefed || draft.hasProposal ? "settled" : "asking",
		},
		{
			key: "what",
			label: "What — what it is, and its milestones",
			state: briefed || draft.hasProposal ? "settled" : "open",
		},
		{
			key: "how-where",
			label: "How and where — the stack and where it runs",
			state: draft.hasProposal ? "settled" : briefed ? "asking" : "open",
		},
		{
			key: "name-place",
			label: "Name and place",
			state: draft.hasProposal ? "settled" : "open",
		},
	];
}
