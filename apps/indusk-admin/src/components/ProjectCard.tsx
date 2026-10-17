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
 * The home grid's card for a registered project: the approved `project-card`
 * given the registry's facts, with when it was last seen put in words.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  return (
    <ProjectCardView
      name={project.name}
      path={project.path}
      activePlanCount={project.activePlanCount}
      href={`/p/${project.name}/`}
      shape={project.shape}
      inProgress={project.hasInProgress}
      lastSeen={formatRelative(project.lastSeenAt)}
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
