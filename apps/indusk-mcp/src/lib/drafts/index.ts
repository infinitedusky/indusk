/**
 * Drafts: conversations not yet kept as plans (brief-as-the-contract, Build
 * Phase 5), held under the project's home and outside every checkout.
 */

export {
	AGED_AFTER_DAYS,
	createDraft,
	type Draft,
	type DraftSummary,
	describeDraftAge,
	discardDraft,
	draftsDir,
	findDraft,
	listDrafts,
	type Proposal,
	readDraftDocument,
	readProposal,
	sweepDrafts,
	touchDraft,
	writeProposal,
} from "./store.js";
