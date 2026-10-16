"use client";

import { useState } from "react";

export interface WorktreeMarkProps {
  /** The worktree's name, shown when open and always in the label. */
  name: string;
  /** Where it is, for the title: "Read from the worktree at <path> (<branch>)". */
  title?: string;
  /** Opened by a click from the start: for a story. */
  open?: boolean;
}

/**
 * The worktree a plan is read from, as a small ⎇ beside the plan's stage. It
 * widens in place to the worktree's name while the pointer is on it or after a
 * click, and a name too long for the row ends in an ellipsis. A control of its
 * own: it sits outside the row's link and never opens the plan.
 */
export function WorktreeMark({
  name,
  title,
  open: startsOpen = false,
}: WorktreeMarkProps) {
  const [pinned, setPinned] = useState(startsOpen);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;
  return (
    <button
      type="button"
      data-component="worktree-mark"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      aria-label={`Worktree ${name}`}
      title={title}
      onClick={() => {
        setPinned((p) => !p);
        setHovered(false);
      }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={`inline-flex h-(--leading-2) min-w-0 shrink items-center gap-1 rounded-md border bg-surface px-1 text-2xs leading-1 ${
        open ? "border-dusk text-dusk" : "border-line text-ink-soft"
      }`}
    >
      <span aria-hidden="true">⎇</span>
      {open && (
        <span className="truncate font-mono text-2xs leading-1">{name}</span>
      )}
    </button>
  );
}
