import Link from "next/link";
import type { ReactNode } from "react";

export interface ProjectCardProps {
  name: string;
  /** Where it lives, as the person knows it (`~/code/...`). */
  path: string;
  activePlanCount: number;
  /** Where it opens. */
  href: string;
  /** What the page adds beneath the count: a shape, an in-progress badge, when it was last seen. */
  extra?: ReactNode;
}

/**
 * One project on the home grid: its name, its path and how many plans are
 * active (the approved `project-card`). It is a link to the project; what a
 * page adds beneath the count goes in `extra` and is not part of the look.
 */
export function ProjectCard({
  name,
  path,
  activePlanCount,
  href,
  extra,
}: ProjectCardProps) {
  const label = activePlanCount === 1 ? "active plan" : "active plans";
  return (
    <Link
      href={href}
      data-component="project-card"
      data-state="default"
      data-project-name={name}
      className="grid gap-1 rounded-lg border border-line bg-surface p-5 transition-shadow hover:elevated focus:outline-2 focus:outline-dusk"
    >
      <h2 className="text-base leading-5 font-semibold">{name}</h2>
      <p className="font-mono text-xs leading-2 wrap-anywhere text-ink-faint">
        {path}
      </p>
      <p className="mt-2 text-sm leading-3 text-ink-soft">
        {activePlanCount} {label}
      </p>
      {extra}
    </Link>
  );
}
