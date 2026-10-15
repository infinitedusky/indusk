import type { HTMLAttributes, ReactNode } from "react";

export interface BoxProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** The box's heading. */
  title?: string;
  children: ReactNode;
}

/**
 * A titled panel: the surface, a line, a heading and what the page puts under
 * it — a table, a list of facts, a timeline.
 */
export function Box({ title, className = "", children, ...rest }: BoxProps) {
  return (
    <section
      data-component="box"
      className={`grid min-w-0 gap-3 rounded-xl border border-line bg-surface px-5 py-4 ${className}`}
      {...rest}
    >
      {title ? (
        <h3 className="font-display text-lg font-bold leading-4">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
