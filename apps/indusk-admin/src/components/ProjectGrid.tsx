import { ProjectCard, type ProjectCardData } from "./ProjectCard";

export interface ProjectGridProps {
  projects: ProjectCardData[];
  /** Registered names whose path no longer exists — listed in a note, never as cards. */
  notFound?: string[];
}

/**
 * Homepage project grid. Shows one `<ProjectCard>` per registered project.
 * Empty state when the registry is empty — the user hasn't run `indusk init`
 * on any project yet, and the message has to point them at the right CLI.
 */
export function ProjectGrid({ projects, notFound = [] }: ProjectGridProps) {
  if (projects.length === 0 && notFound.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center text-center text-ink-faint"
        data-testid="project-grid-empty"
      >
        <h1 className="text-lg font-semibold text-ink-soft">
          No projects registered yet
        </h1>
        <p className="mt-2 max-w-md text-sm">
          Run{" "}
          <code className="rounded-md bg-idle-wash px-tight py-hair font-mono text-xs">
            indusk init
          </code>{" "}
          inside a project to register it. Already-registered projects move to
          the front via{" "}
          <code className="rounded-md bg-idle-wash px-tight py-hair font-mono text-xs">
            indusk update
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-2">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Projects</h1>
          <p className="text-sm text-ink-faint">
            Every project registered in{" "}
            <code className="font-mono text-xs">~/.indusk/projects.json</code>.
          </p>
        </div>
      </div>
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="project-grid"
      >
        {projects.map((p) => (
          <ProjectCard key={p.name} project={p} />
        ))}
      </div>
      {notFound.length > 0 ? (
        <details
          className="mt-4 text-xs text-ink-faint"
          data-testid="project-not-found"
        >
          <summary className="cursor-pointer">
            not found ({notFound.length}) — registered paths that no longer
            exist; <code className="font-mono">indusk ui prune</code> removes
            them
          </summary>
          <ul className="mt-1 flex flex-col gap-hair pl-4">
            {notFound.map((name) => (
              <li key={name} className="font-mono">
                {name}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
