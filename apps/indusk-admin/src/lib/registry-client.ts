import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Server-component-side reader of `~/.indusk/projects.json`. This mirrors
 * `apps/indusk-mcp/src/lib/admin/registry.ts`'s shape but is read-only — the
 * admin UI never mutates the registry (writes belong to `indusk init` /
 * `indusk update` / the daemon, not the UI). Duplicating the type + reader
 * here keeps `apps/indusk-admin/` free of a runtime dependency on the
 * indusk-mcp package's internals (even though both apps live in the same
 * workspace, the admin app's deployment surface is the Next.js bundle).
 */

export interface ProjectEntry {
	name: string;
	path: string;
	registeredAt: string;
	lastSeenAt: string;
}

interface Registry {
	version: 1;
	projects: ProjectEntry[];
}

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function registryPath(): string {
	return join(induskHome(), "projects.json");
}

/**
 * Read the project registry. Returns an empty list if the file is absent or
 * malformed — the admin UI treats both cases identically (nothing to show).
 */
export function readRegistryProjects(): ProjectEntry[] {
	const path = registryPath();
	if (!existsSync(path)) return [];
	try {
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as Registry;
		if (parsed.version !== 1 || !Array.isArray(parsed.projects)) return [];
		return parsed.projects;
	} catch {
		return [];
	}
}

/**
 * Resolve a registered project's absolute path by name. Returns null if the
 * name isn't registered — callers (the per-project layout) render a
 * "needs reconfiguration" failure page in that case (Phase 4).
 *
 * Does NOT check whether the path exists on disk; that's a separate concern
 * handled by the failure-page branch in the layout.
 */
export function getProjectPath(name: string): string | null {
	const projects = readRegistryProjects();
	return projects.find((p) => p.name === name)?.path ?? null;
}
