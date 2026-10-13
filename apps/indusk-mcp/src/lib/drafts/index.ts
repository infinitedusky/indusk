/**
 * Drafts: conversations not yet kept as plans (brief-as-the-contract, Build
 * Phase 5), held under the project's home and outside every checkout.
 */

export { AGED_AFTER_DAYS, describeDraftAge } from "./age.js";
export { startFromDraft } from "./start.js";
export {
	createDraft,
	type Draft,
	type DraftSummary,
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
export { type DraftView, draftHomeOf, readDraftRows, readDraftView } from "./view.js";
