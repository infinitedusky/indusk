import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface NavProps {
  project: string;
  /** Under the project's name: "9 plans". */
  summary?: string;
  /** Folded to the rail: names and counts hidden, marks kept. */
  collapsed?: boolean;
  /** What the collapse button does and says to a test: its click, `aria-expanded`. */
  toggleProps?: ButtonHTMLAttributes<HTMLButtonElement> &
    Record<`data-${string}`, string>;
  /** Plan groups, plan rows and view links. */
  children: ReactNode;
  className?: string;
}

/**
 * The project's nav: its name, then its plans in groups by what they wait on,
 * then its views. Rows and links inside it read `collapsed` from this frame
 * (`data-collapsed`), so they fold without being told.
 */
export function Nav({
  project,
  summary,
  collapsed = false,
  toggleProps,
  children,
  className = "",
}: NavProps) {
  return (
    <nav
      aria-label="Plans"
      data-component="nav"
      data-collapsed={collapsed ? "true" : "false"}
      className={`flex flex-col gap-hair border-r border-line bg-surface pb-5 pt-4 px-snug ${className}`}
    >
      <div className="nav-head flex items-center justify-between gap-2 px-1 pb-2">
        <div className="nav-hide grid">
          <b className="font-display text-lg font-bold leading-5">{project}</b>
          {summary ? (
            <small className="text-xs leading-2 text-ink-faint">
              {summary}
            </small>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={collapsed ? "Expand" : "Collapse"}
          {...toggleProps}
          className={[
            "grid size-icon shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-soft",
            toggleProps?.className,
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={collapsed ? "rotate-180" : undefined}
          >
            <path
              d="M10 3 5 8l5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>
      </div>
      {children}
    </nav>
  );
}

/** A group's heading in the nav — "Needs you", "In flight" — with how many it holds. */
export function NavGroup({ label, count }: { label: string; count: number }) {
  return (
    <div className="mx-tight mb-1 mt-3 flex items-center justify-between text-2xs font-semibold uppercase leading-1 tracking-caps text-ink-faint nav-hide">
      <span>{label}</span>
      <span>{count}</span>
    </div>
  );
}
