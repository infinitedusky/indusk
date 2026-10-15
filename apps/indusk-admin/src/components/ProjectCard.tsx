import { Badge } from "@/components/ui/Badge";
import { ProjectCard as ProjectCardView } from "@/components/ui/ProjectCard";

export interface ProjectCardData {
  name: string;
  path: string;
  lastSeenAt: string;
  activePlanCount: number;
  hasInProgress: boolean;
  /** `workbench` (declares repos) or `normal-mode`; absent for callers that do not know. */
  shape?: "workbench" | "normal-mode";
}

/**
 * The home grid's card for a registered project. Links to `/p/{name}/`, and
 * beneath the approved look adds the project's shape, an in-progress badge when
 * any plan is mid-flight, and when it was last seen.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <ProjectCardView
      name={project.name}
      path={project.path}
      activePlanCount={project.activePlanCount}
      href={`/p/${project.name}/`}
      extra={
        <span className="mt-2 flex flex-wrap items-center gap-1 text-xs text-ink-faint">
          {project.shape ? (
            <Badge variant="neutral" data-testid="project-shape">
              {project.shape}
            </Badge>
          ) : null}
          {project.hasInProgress ? (
            <Badge variant="written" data-testid="in-progress-badge">
              in progress
            </Badge>
          ) : null}
          <span>last seen {formatRelative(project.lastSeenAt)}</span>
        </span>
      }
    />
  );
}

/**
 * Minimal relative-time formatting. No library dependency — the admin UI
 * only needs "5m ago" / "3h ago" / "2d ago" granularity. Precision isn't
 * important; the value is "recently-seen" vs "stale" at a glance.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const delta = Date.now() - then;
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
