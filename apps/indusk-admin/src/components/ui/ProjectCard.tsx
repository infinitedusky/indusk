import Link from "next/link";
import { Badge } from "./Badge";

export interface ProjectCardProps {
  name: string;
  /** Where it lives, as the person knows it (`~/code/...`). */
  path: string;
  activePlanCount: number;
  /** Where it opens. */
  href: string;
  /** A workbench or a normal-mode project, when known. */
  shape?: "workbench" | "normal-mode";
  /** Whether any of its plans is being worked. */
  inProgress?: boolean;
  /** When it was last seen, in words (`6d ago`). */
  lastSeen: string;
}

/**
 * One project on the home grid: its name, its path, how many plans are
 * active, its shape, whether work is in progress and when it was last seen
 * (the approved `project-card`). It is a link to the project.
 */
export function ProjectCard({
  name,
  path,
  activePlanCount,
  href,
  shape,
  inProgress = false,
  lastSeen,
}: ProjectCardProps) {
  const label = activePlanCount === 1 ? "active plan" : "active plans";
  return (
    <Link
      href={href}
      data-component="project-card"
      data-state="default"
      data-project-name={name}
      className="grid content-start gap-1 rounded-lg border border-line bg-surface p-5 transition-shadow hover:elevated focus:outline-2 focus:outline-dusk"
    >
      <h2 className="text-base leading-5 font-semibold">{name}</h2>
      <p className="font-mono text-xs leading-2 wrap-anywhere text-ink-faint">
        {path}
      </p>
      <p className="mt-2 text-sm leading-3 text-ink-soft">
        {activePlanCount} {label}
      </p>
      <span className="mt-2 flex flex-wrap items-center gap-1 text-xs text-ink-faint">
        {shape ? (
          <Badge variant="neutral" data-testid="project-shape">
            {shape}
          </Badge>
        ) : null}
        {inProgress ? (
          <Badge variant="written" data-testid="in-progress-badge">
            in progress
          </Badge>
        ) : null}
        <span>last seen {lastSeen}</span>
      </span>
    </Link>
  );
}
