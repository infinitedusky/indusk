import type { HTMLAttributes, ReactNode } from "react";
import { FileChip } from "./FileChip";

export type MessageState = "you" | "agent" | "agent-folded" | "agent-open";

export interface MessageProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onToggle"> {
  /**
   * Whose words: the person's, set to the right on a wash, or the agent's, on
   * a surface. An agent's reply with working behind it is `agent-folded` (the
   * working hidden behind "See more ›") or `agent-open` (the working shown
   * above the reply, "See less" to hide it).
   */
  state: MessageState;
  /** The words: paragraphs, and a numbered list when the agent asks. */
  children: ReactNode;
  /** The documents that came with it, by name. */
  documents?: readonly string[];
  /** What the agent did before it replied: one line each; shown only when open. */
  working?: readonly string[];
  /** The fold button was pressed; the page flips `state` between folded and open. */
  onToggle?: () => void;
}

const SHAPE: Record<MessageState, string> = {
  you: "justify-self-end bg-dusk-wash",
  agent: "border border-line bg-surface",
  "agent-folded": "border border-line bg-surface",
  "agent-open": "border border-line bg-surface",
};

const WHO: Record<MessageState, string> = {
  you: "You",
  agent: "Agent",
  "agent-folded": "Agent",
  "agent-open": "Agent",
};

/**
 * One message in a project conversation: who said it, what they said, and the
 * documents that came with it. The person's sits to the right; the agent's
 * open questions are a numbered list; an agent's working is folded behind
 * "See more ›" and shown above the reply when open.
 */
export function Message({
  state,
  children,
  documents = [],
  working = [],
  onToggle,
  className = "",
  ...rest
}: MessageProps) {
  const open = state === "agent-open";
  const folds = state === "agent-folded" || open;
  return (
    <div
      data-component="message"
      data-state={state}
      className={`grid measure-message gap-2 rounded-xl px-4 py-3 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-1 [&_ol]:pl-5 ${SHAPE[state]} ${className}`}
      {...rest}
    >
      <span className="text-2xs leading-1 font-semibold tracking-caps text-ink-faint uppercase">
        {WHO[state]}
      </span>
      {folds ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="justify-self-start text-sm leading-3 font-medium text-ink-faint"
        >
          {open ? "See less" : "See more ›"}
        </button>
      ) : null}
      {open ? (
        <ul className="grid gap-1 border-b border-line pb-2">
          {working.map((line, i) => (
            <li
              // The working is an append-only record: position is identity.
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
              key={i}
              className="font-mono text-xs leading-2 break-words text-ink-faint [overflow-wrap:anywhere] whitespace-pre-wrap"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {children}
      {documents.map((name) => (
        <FileChip key={name}>{name}</FileChip>
      ))}
    </div>
  );
}
