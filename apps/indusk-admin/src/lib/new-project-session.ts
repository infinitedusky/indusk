import {
  appendTranscript,
  NEW_PROJECT_SESSION_PROJECT,
  newProjectConversation,
  newProjectSessionPlan,
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
    confined: convo.confined,
    prompt: convo.prompt,
    project: NEW_PROJECT_SESSION_PROJECT,
    plan: convo.plan,
    onEvent: () => {},
  });
  // The draft keeps what is said (ADR decision 9): a marker for where this
  // session begins, what the person said to start it, then every event the
  // manager holds or hears - its `say` included - so a reopened conversation
  // shows its turns with no agent running.
  appendTranscript(draft, { type: "session", id: started.id });
  if (opts.text) appendTranscript(draft, { type: "you", text: opts.text });
  sessionManager().subscribe(started.id, (ev) => appendTranscript(draft, ev));
  return { id: started.id };
}

/** The message a refused start is told: what is running instead. */
export function busyMessage(): string | null {
  const running = sessionManager().current();
  return running
    ? `a session is already running: ${running.kind} for ${running.plan} — stop it first`
    : null;
}

/** The session now running that is this draft's conversation, if it is. */
export function draftSession(id: string) {
  const running = sessionManager().current();
  return running?.plan === newProjectSessionPlan(id) ? running : null;
}

/** Stop the draft's agent if it runs; the one check accept and discard share. */
export async function stopDraftSession(id: string): Promise<void> {
  const running = draftSession(id);
  if (running) await sessionManager().get(running.id)?.stop();
}
