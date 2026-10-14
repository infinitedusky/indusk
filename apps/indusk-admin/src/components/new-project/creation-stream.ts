import type {
  CreationStepId,
  CreationStepState,
} from "@infinitedusky/indusk-mcp/new-project/steps";

/**
 * What the accept route says while a project is made, and how a page folds it
 * into what it draws (new-project-flow). One JSON object per line; the route
 * carries what the package's `createProject` reports and decides nothing.
 */

export type CreationEvent =
  | { type: "step"; id: CreationStepId; state: CreationStepState }
  | { type: "done"; name: string; href: string; remoteError?: string }
  | { type: "error"; message: string };

/** The creation as the page draws it. */
export interface CreationView {
  steps: { id: CreationStepId; state: CreationStepState }[];
  /** Where the finished project is read; null until it exists. */
  href: string | null;
  /** Why it stopped, in words; null while it runs and when it succeeds. */
  problem: string | null;
}

export function applyEvent(
  view: CreationView,
  event: CreationEvent,
): CreationView {
  if (event.type === "step") {
    return {
      ...view,
      steps: view.steps.map((s) =>
        s.id === event.id ? { ...s, state: event.state } : s,
      ),
    };
  }
  if (event.type === "done") {
    return {
      ...view,
      href: event.href,
      problem: event.remoteError
        ? `The project is made, but its GitHub repository was not: ${event.remoteError}`
        : null,
    };
  }
  return { ...view, problem: event.message };
}

/** The complete lines in `text` as events, and the unfinished line left over. */
export function parseLines(text: string): {
  events: CreationEvent[];
  rest: string;
} {
  const lines = text.split("\n");
  const rest = lines.pop() ?? "";
  const events: CreationEvent[] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    try {
      events.push(JSON.parse(line) as CreationEvent);
    } catch {
      // A line that is not an event is not one the route wrote; skip it.
    }
  }
  return { events, rest };
}

/** Read the accept route's answer to its end, handing each event on as it arrives. */
export async function readCreation(
  response: Response,
  onEvent: (event: CreationEvent) => void,
): Promise<void> {
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    onEvent({
      type: "error",
      message: body.error ?? `The server answered ${response.status}.`,
    });
    return;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseLines(done ? `${buffer}\n` : buffer);
    buffer = rest;
    for (const event of events) onEvent(event);
    if (done) return;
  }
}
