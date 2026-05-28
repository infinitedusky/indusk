import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export interface ProjectCardData {
  name: string;
  path: string;
  lastSeenAt: string;
  activePlanCount: number;
  hasInProgress: boolean;
}

/**
 * One card on the homepage's `<ProjectGrid>`. Links to `/p/{name}/` and
 * surfaces the project's active-plan count + last-seen-at + an in-progress
 * badge when any of its plans are mid-flight.
 *
 * Layout is deliberately modest — the card's job is "let the user pick a
 * project at a glance," not "summarize every plan." Deeper per-project
 * signal lives inside `/p/{name}/`.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  const label = project.activePlanCount === 1 ? "active plan" : "active plans";
  return (
    <Link
      href={`/p/${project.name}/`}
      data-project-name={project.name}
      className="block rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-gray-900">
            {project.name}
          </h2>
          <p className="mt-1 truncate text-xs text-gray-500">{project.path}</p>
        </div>
        {project.hasInProgress ? (
          <Badge variant="written" data-testid="in-progress-badge">
            in progress
          </Badge>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
        <span>
          {project.activePlanCount} {label}
        </span>
        <span className="text-xs text-gray-400">
          last seen {formatRelative(project.lastSeenAt)}
        </span>
      </div>
    </Link>
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
