import type { StartedEvent } from "@infinitedusky/indusk-mcp/session";

/**
 * A session's events as a conversation (new-project-flow, ADR decision 9): the
 * person and the agent taking turns. Pure - events in, turns out - so the
 * thread that draws them and the page that reopens them with no agent running
 * read the same turns. The shared session panel keeps drawing events as a log;
 * this is the reading a thread needs.
 */

/** What the agent waits on the person for: a question, or a request to use a tool. */
export type WaitingEvent = Extract<
  StartedEvent,
  { type: "question" | "permission" }
>;

export type Turn =
  | { who: "you"; text: string }
  | {
      who: "agent";
      /** What the agent said last: the part worth reading. */
      reply: string;
      /** The tools it used and the text before the reply, in order. */
      working: string[];
      /** Questions and permission requests nobody has answered; never folded away. */
      waiting: WaitingEvent[];
    };

export interface TurnOptions {
  /** Request ids already answered; those are no longer waiting. */
  answered?: ReadonlySet<string>;
  /** False when no agent runs: nothing can be waiting on a person then. */
  running?: boolean;
}

/** A tool's input in a few words: the path it names, or its command, or nothing. */
export function describeToolInput(input: Record<string, unknown>): string {
  for (const key of [
    "file_path",
    "path",
    "notebook_path",
    "command",
    "pattern",
    "skill",
  ]) {
    if (typeof input[key] === "string") return String(input[key]);
  }
  return "";
}

const failureOf = (ev: Extract<StartedEvent, { type: "result" }>): string => {
  const said = ev.text.split("\n")[0]?.trim();
  return `Failed — ${said || ev.subtype}`;
};

export function turnsOf(
  events: readonly StartedEvent[],
  { answered = new Set<string>(), running = true }: TurnOptions = {},
): Turn[] {
  const turns: Turn[] = [];
  let items: { text: boolean; line: string }[] = [];
  let waiting: WaitingEvent[] = [];
  let result: string | null = null;
  let failed = false;

  const flush = () => {
    if (items.length === 0 && waiting.length === 0 && result === null) return;
    let replyAt = -1;
    if (!failed) {
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i]?.text) {
          replyAt = i;
          break;
        }
      }
    }
    const reply = replyAt >= 0 ? (items[replyAt]?.line ?? "") : (result ?? "");
    turns.push({
      who: "agent",
      reply,
      working: items.filter((_, i) => i !== replyAt).map((item) => item.line),
      waiting,
    });
    items = [];
    waiting = [];
    result = null;
    failed = false;
  };

  for (const ev of events) {
    switch (ev.type) {
      case "you":
        flush();
        turns.push({ who: "you", text: ev.text });
        break;
      case "text":
        items.push({ text: true, line: ev.text });
        break;
      case "tool":
        items.push({
          text: false,
          line: `${ev.name} ${describeToolInput(ev.input)}`.trim(),
        });
        break;
      case "question":
      case "permission":
        if (running && !answered.has(ev.requestId)) waiting.push(ev);
        break;
      case "result":
        result = ev.ok ? ev.text : failureOf(ev);
        failed = !ev.ok;
        break;
      default:
        break;
    }
  }
  flush();
  return turns;
}
