import type { TranscriptLine } from "@infinitedusky/indusk-mcp/new-project";
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

/** Where an agent turn stands: still going, replied, or ended before replying. */
export type TurnStatus = "working" | "done" | "stopped";

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
      status: TurnStatus;
    };

export interface TurnOptions {
  /** Request ids already answered; those are no longer waiting. */
  answered?: ReadonlySet<string>;
  /** False when no agent runs: nothing can be waiting on a person then. */
  running?: boolean;
}

/** The look state an agent turn draws (`message.<state>`): its status, and for a reply whether its working is folded or open. */
export function agentState(
  turn: Extract<Turn, { who: "agent" }>,
  open: boolean,
): "agent" | "agent-folded" | "agent-open" | "agent-working" | "agent-stopped" {
  if (turn.status === "working") return "agent-working";
  if (turn.status === "stopped") return "agent-stopped";
  if (turn.working.length === 0) return "agent";
  return open ? "agent-open" : "agent-folded";
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
  // Whether each agent turn (by position in `turns`) ended with a result.
  const ended = new Set<number>();

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
    if (result !== null) ended.add(turns.length);
    turns.push({
      who: "agent",
      reply,
      working: items.filter((_, i) => i !== replyAt).map((item) => item.line),
      waiting,
      status: "stopped",
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
  return withStatus(turns, ended, running);
}

/**
 * Each agent turn's status. The turn the agent is on is the last one when it
 * runs and has not ended it - and it exists as soon as the session starts,
 * before any text (an agent that is running after the person spoke, or after
 * nothing, is working). Any other turn is done when it replied, else stopped.
 */
function withStatus(
  turns: Turn[],
  ended: ReadonlySet<number>,
  running: boolean,
): Turn[] {
  const last = turns[turns.length - 1];
  const current = last?.who === "agent" && !ended.has(turns.length - 1);
  if (running && !current && (last === undefined || last.who === "you"))
    turns.push({
      who: "agent",
      reply: "",
      working: [],
      waiting: [],
      status: "working",
    });
  return turns.map((turn, at) => {
    if (turn.who === "you") return turn;
    const status: TurnStatus =
      running && at === turns.length - 1 && !ended.has(at)
        ? "working"
        : ended.has(at) || turn.reply !== ""
          ? "done"
          : "stopped";
    return { ...turn, status };
  });
}

/** The event types a session emits; the transcript's own lines (`session`, `fold-opened`) are not among them. */
const NOT_EVENTS = new Set(["session", "fold-opened"]);

/**
 * What the draft's transcript holds that the page is not already hearing live:
 * every event of the earlier sessions, and none of the session `sessionId`
 * the page is connected to (the session manager replays that one from its
 * start). With no such session, or one the transcript has not yet marked, all
 * of it.
 */
export function historyBefore(
  lines: readonly TranscriptLine[],
  sessionId: string | null,
): StartedEvent[] {
  const at = sessionId
    ? lines.findIndex((l) => l.type === "session" && l.id === sessionId)
    : -1;
  return (at >= 0 ? lines.slice(0, at) : lines).filter(
    (l): l is StartedEvent => !NOT_EVENTS.has(l.type),
  );
}
