/**
 * New project flow (new-project-flow): a project starts as a conversation held
 * under the InDusk home, outside every checkout, and is made only when a person
 * accepts the proposal. The admin reads and writes a draft through this module
 * and the `indusk new-project` command, never with a process of its own.
 */

export { induskHome } from "../telemetry/status.js";
export {
	type CreatedProject,
	type CreateOptions,
	CreationError,
	createProject,
	readCreation,
} from "./create.js";
export { type AddedDocument, addDocument, documentNotice } from "./documents.js";
export { type KnowledgeEntry, type KnowledgeState, knowledgeOf } from "./knowledge.js";
export { isUnderParent, type ParentSetBy, parentSetBy, readParent, setParent } from "./parent.js";
export {
	NEW_PROJECT_SESSION_PROJECT,
	newProjectConversation,
	newProjectPrompt,
	newProjectSessionPlan,
	type ProjectConversation,
} from "./prompt.js";
export {
	loadProposal,
	type Proposal,
	type ProposalCheck,
	ProposalError,
	type ProposalRecommendation,
	readProposal,
	saveProposal,
	validateProposal,
} from "./proposal.js";
export {
	type CreationRecord,
	type CreationStepId,
	type CreationStepState,
	creationStepIds,
	stepLabel,
} from "./steps.js";
export {
	createProjectDraft,
	type DraftDocument,
	discardProjectDraft,
	documentName,
	documentsDir,
	findProjectDraft,
	newProjectsDir,
	type ProjectDraft,
	type ProjectDraftView,
	projectDraftCreatedAt,
	readProjectDraft,
	touchProjectDraft,
} from "./store.js";
export {
	appendTranscript,
	type ConversationFigures,
	conversationFigures,
	type FoldOpened,
	readTranscript,
	recordFoldOpened,
	type SessionMarker,
	type ToolRefused,
	type TranscriptLine,
	transcriptPath,
} from "./transcript.js";
