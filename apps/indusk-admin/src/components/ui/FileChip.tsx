import type { HTMLAttributes } from "react";

export interface FileChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** The document's name, as the person gave it. */
  children: string;
}

/** An attached document, by name: a pill on the idle wash. */
export function FileChip({ className = "", children, ...rest }: FileChipProps) {
  return (
    <span
      data-component="file-chip"
      data-state="default"
      className={`inline-flex items-center gap-2 rounded-pill bg-idle-wash px-3 py-1 text-sm leading-3 text-ink-soft ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
