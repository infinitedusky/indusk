import {
  NEW_PROJECT_SESSION_PROJECT,
  newProjectConversation,
  type ProjectDraftView,
  touchProjectDraft,
} from "@infinitedusky/indusk-mcp/new-project";
import { sessionManager } from "@/lib/session-host";

/**
 * Start a project draft's conversation (new-project-flow, ADR decision 2): the
 * developer's own `claude`, in the draft's folder, told what the person said
 * and which documents they brought. One place, read by the create route (the
 * first message) and the talk route (a later turn, or the session started
 * again). The caller has already checked that no other session runs.
 *
 * promise: a-project-starts-as-a-conversation
 */
export function startProjectConversation(
  draft: ProjectDraftView,
  opts: { text?: string; reopened?: boolean } = {},
): { id: string } {
  touchProjectDraft(draft);
  const convo = newProjectConversation(draft, opts);
  const started = sessionManager().start({
    cwd: convo.cwd,
    kind: convo.kind,
    prompt: convo.prompt,
    project: NEW_PROJECT_SESSION_PROJECT,
    plan: convo.plan,
    onEvent: () => {},
  });
  return { id: started.id };
}

/** The message a refused start is told: what is running instead. */
export function busyMessage(): string | null {
  const running = sessionManager().current();
  return running
    ? `a session is already running: ${running.kind} for ${running.plan} — stop it first`
    : null;
}
