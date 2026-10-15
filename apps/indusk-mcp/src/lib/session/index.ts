/**
 * Sessions of the developer's own `claude` (admin-plan-authoring, ADR D1),
 * one definition behind the admin and the build runner.
 */

export {
	type DraftConversation,
	draftConversation,
	draftPrompt,
	draftSessionPlan,
} from "./draft.js";
export { isAdminHost } from "./hosts.js";
export { DEFAULT_SESSIONS_MAX, readSessionsMax } from "./limits.js";
export {
	alreadyRunningOnThisPlan,
	defaultRecordPath,
	type ManagedStart,
	SessionBusy,
	SessionManager,
	type SessionRecord,
} from "./manager.js";
export { type Decision, decideBuildPermission, refuseBuildQuestion } from "./permissions.js";
export {
	answerQuestion,
	buildArgs,
	decidePermission,
	interrupt,
	type PermissionEvent,
	parseSessionLine,
	type Question,
	type QuestionEvent,
	type SessionEvent,
	type SessionKind,
	userMessage,
} from "./protocol.js";
export {
	type Session,
	type SessionOptions,
	type StartedEvent,
	startSession,
} from "./start.js";
export {
	isTrusted,
	projectOf,
	type TrustOutcome,
	trustLikeProject,
	trustProject,
} from "./trust.js";
