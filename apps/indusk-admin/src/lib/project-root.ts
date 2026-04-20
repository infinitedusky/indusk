import { getProjectPath as lookup } from "./registry-client";

/**
 * Resolve the absolute filesystem path for a registered project by name.
 * Returns null when the name isn't registered — Phase 4's stale-project
 * failure page renders in that case (the path-exists check is a separate
 * concern handled by the per-project layout).
 *
 * Replaces the pre-1.27 `getProjectRoot()` which took no arguments and
 * resolved the single-project-per-daemon's root via `INDUSK_PROJECT_ROOT`.
 * Now that the daemon serves every registered project, there is no single
 * "root" — callers name which project they're asking about.
 */
export function getProjectPath(name: string): string | null {
	return lookup(name);
}
