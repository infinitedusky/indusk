import type { HTMLAttributes } from "react";

export interface LayoutTreeProps extends HTMLAttributes<HTMLPreElement> {
  /** The tree as text: one line per folder, indented, a note after the name. */
  children: string;
}

/**
 * The project's directory layout as it will be created - the workbench, the
 * repository inside it, the worktrees folder beside it - in mono on the
 * ground wash.
 */
export function LayoutTree({
  className = "",
  children,
  ...rest
}: LayoutTreeProps) {
  return (
    <pre
      data-component="layout-tree"
      data-state="default"
      className={`m-0 overflow-x-auto rounded-lg bg-ground p-3 font-mono text-xs leading-2 whitespace-pre text-ink-soft ${className}`}
      {...rest}
    >
      {children}
    </pre>
  );
}
