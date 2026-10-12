export interface StaleProjectFailurePageProps {
  projectName: string;
  /**
   * The path the registry has on file for this project. Omit when the
   * project name isn't registered at all (the failure mode is the same
   * from the user's perspective — needs reconfiguration — so the page
   * handles both).
   */
  projectPath?: string;
}

/**
 * Renders when the admin UI can't resolve a project's `.indusk/planning/`
 * because the registry entry is stale (path deleted from disk) OR because
 * the requested project isn't in the registry at all. Both cases surface
 * the same "needs reconfiguration" affordance — the user recovers by
 * running `indusk update` from the new location OR by hand-editing
 * `~/.indusk/projects.json`.
 *
 * Discipline (from ADR Consequences → Risks section): the registry is
 * never auto-pruned. No UI affordance to remove an entry. Registry
 * mutations happen only via CLI commands, where the user is paying
 * attention.
 */
export function StaleProjectFailurePage({
  projectName,
  projectPath,
}: StaleProjectFailurePageProps) {
  const isStale = typeof projectPath === "string";
  const heading = isStale
    ? "This project needs to be reconfigured"
    : "Project not registered";

  return (
    <div
      className="flex h-full items-center justify-center p-6"
      data-testid="stale-project-failure"
    >
      <div className="flex max-w-2xl flex-col gap-4 rounded-lg border border-warn bg-warn-wash p-6 text-sm text-ink">
        <h1 className="text-lg font-semibold text-warn">{heading}</h1>
        <dl className="grid stale-facts gap-x-4 gap-y-1 text-xs">
          <dt className="font-semibold uppercase tracking-caps text-ink-faint">
            Name
          </dt>
          <dd className="font-mono text-ink">{projectName}</dd>
          {isStale ? (
            <>
              <dt className="font-semibold uppercase tracking-caps text-ink-faint">
                Registered path
              </dt>
              <dd className="break-all font-mono text-ink">{projectPath}</dd>
            </>
          ) : null}
        </dl>

        <p className="text-sm text-ink-soft">
          {isStale
            ? "The registered path no longer exists on disk. The admin UI doesn't auto-prune the registry — recovery happens via CLI."
            : "No registered project with this name. Either the URL has a typo, or the registry entry was removed."}
        </p>

        <section className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-caps text-ink-faint">
            To fix
          </h2>
          <ol className="ml-4 list-decimal text-sm text-ink-soft">
            <li>
              <code className="rounded-md bg-idle-wash px-1 font-mono text-xs">
                cd
              </code>{" "}
              into the project's current location on disk.
            </li>
            <li>
              Run{" "}
              <code className="rounded-md bg-idle-wash px-1 font-mono text-xs">
                indusk update
              </code>{" "}
              to re-register the project at its new path.
            </li>
            <li>Refresh this page.</li>
          </ol>
          <p className="text-xs text-ink-faint">
            Or edit{" "}
            <code className="rounded-md bg-idle-wash px-1 font-mono text-xs">
              ~/.indusk/projects.json
            </code>{" "}
            directly and remove or repoint the entry.
          </p>
        </section>
      </div>
    </div>
  );
}
