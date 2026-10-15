import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { ProjectCard, type ProjectCardData } from "./ProjectCard";

export interface ProjectGridProps {
  projects: ProjectCardData[];
  /** Registered names whose path no longer exists — listed in a note, never as cards. */
  notFound?: string[];
}

/** New project: opens the conversation that makes one (new-project-flow). */
function NewProjectLink() {
  return (
    <Link
      href="/new"
      data-testid="new-project-link"
      className={buttonClasses("primary")}
    >
      New project
    </Link>
  );
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
        <div className="mt-4">
          <NewProjectLink />
        </div>
        <p className="mt-2 max-w-md text-sm">
          Or run{" "}
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
    <div
      className="mx-auto grid max-w-content gap-5 px-4 pt-6 pb-16"
      data-look-state="home.default project-card.default"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-7 font-bold">
            Projects
          </h1>
          <p className="text-sm leading-3 text-ink-faint">
            Every project registered on this machine.
          </p>
        </div>
        <NewProjectLink />
      </header>
      <div className="cols-project-grid grid gap-4" data-testid="project-grid">
        {projects.map((p) => (
          <ProjectCard key={p.name} project={p} />
        ))}
      </div>
      {notFound.length > 0 ? (
        <details
          className="text-xs text-ink-faint"
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
