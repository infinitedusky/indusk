import type { HTMLAttributes, ReactNode } from "react";
import { FileChip } from "./FileChip";

export type MessageState = "you" | "agent";

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  /** Whose words: the person's, set to the right on a wash, or the agent's, on a surface. */
  state: MessageState;
  /** The words: paragraphs, and a numbered list when the agent asks. */
  children: ReactNode;
  /** The documents that came with it, by name. */
  documents?: readonly string[];
}

const SHAPE: Record<MessageState, string> = {
  you: "justify-self-end bg-dusk-wash",
  agent: "border border-line bg-surface",
};

const WHO: Record<MessageState, string> = { you: "You", agent: "Agent" };

/**
 * One message in a project conversation: who said it, what they said, and the
 * documents that came with it. The person's sits to the right; the agent's
 * open questions are a numbered list.
 */
export function Message({
  state,
  children,
  documents = [],
  className = "",
  ...rest
}: MessageProps) {
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
      {children}
      {documents.map((name) => (
        <FileChip key={name}>{name}</FileChip>
      ))}
    </div>
  );
}
