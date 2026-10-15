import { Children, type ReactNode } from "react";

export interface RailGroupProps {
  title: string;
  /** The group's standing in a chip: "done", "now". */
  chip?: ReactNode;
  /** The group the plan is in. */
  current?: boolean;
  /** The group's steps. */
  children: ReactNode;
  className?: string;
}

/**
 * A stage of a plan's lifecycle in its rail — Planning, Build, Release —
 * holding that stage's steps, with the current stage's line in the dusk
 * colour.
 */
export function RailGroup({
  title,
  chip,
  current = false,
  children,
  className = "",
}: RailGroupProps) {
  return (
    <section
      data-component="rail-group"
      className={`grid gap-tight rounded-xl border bg-surface px-3 pb-2 pt-3 ${
        current ? "border-dusk" : "border-line"
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-tight">
        <h3 className="font-display text-lg font-bold leading-4">{title}</h3>
        {chip}
      </div>
      <ol className="mt-tight list-none">
        {Children.map(children, (child) => (
          <li>{child}</li>
        ))}
      </ol>
    </section>
  );
}
