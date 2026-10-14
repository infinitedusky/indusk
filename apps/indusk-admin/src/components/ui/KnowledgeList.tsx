import type { HTMLAttributes } from "react";

/** Where one thing the agent needs stands: settled, being asked now, or not yet reached. */
export type KnowledgeState = "settled" | "asking" | "open";

export interface KnowledgeItem {
  label: string;
  state: KnowledgeState;
}

export interface KnowledgeListProps extends HTMLAttributes<HTMLUListElement> {
  items: readonly KnowledgeItem[];
}

const DOT: Record<KnowledgeState, string> = {
  settled: "bg-ok",
  asking: "bg-dusk",
  open: "bg-idle",
};

/**
 * What the agent knows so far - why, what, how and where, name and place - one
 * line each with a dot: green settled, the dusk colour asking now, grey open.
 */
export function KnowledgeList({
  items,
  className = "",
  ...rest
}: KnowledgeListProps) {
  return (
    <ul
      data-component="knowledge-list"
      data-state="default"
      className={`grid gap-2 ${className}`}
      {...rest}
    >
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-2 text-sm leading-3"
        >
          <span
            className={`size-dot flex-none rounded-pill ${DOT[item.state]}`}
          />
          <span className={item.state === "open" ? "text-ink-faint" : ""}>
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
