import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * The project registry: `~/.indusk/projects.json` (or `$INDUSK_HOME/projects.json`
 * if INDUSK_HOME is set — used by tests to redirect away from the real home).
 *
 * Mutations only happen via this module's exports. Reads are also funneled here
 * so the version bump path is single-sourced if the schema ever evolves.
 */

export interface ProjectEntry {
	name: string;
	path: string;
	registeredAt: string;
	lastSeenAt: string;
}

export interface Registry {
	version: 1;
	projects: ProjectEntry[];
}

function emptyRegistry(): Registry {
	return { version: 1, projects: [] };
}

function induskHome(): string {
	return process.env.INDUSK_HOME ?? join(homedir(), ".indusk");
}

function registryPath(): string {
	return join(induskHome(), "projects.json");
}

function ensureHome(): void {
	const home = induskHome();
	if (!existsSync(home)) mkdirSync(home, { recursive: true });
}

/**
 * Read the registry. Returns a fresh empty registry if the file doesn't exist.
 *
 * When the file exists but is malformed (unparseable JSON, or parseable but
 * wrong-shape), we QUARANTINE it: rename to `projects.json.corrupt.{ISO}.bak`
 * before returning `emptyRegistry()`. Any subsequent `writeRegistry` creates
 * a fresh `projects.json` without silently overwriting the damaged bytes.
 * The ISO timestamp in the filename prevents repeated corruption events from
 * overwriting each other's backups. A stderr warning names the quarantined
 * file so the user can recover (hand-fix the JSON, mv back).
 */
export function readRegistry(): Registry {
	const path = registryPath();
	if (!existsSync(path)) return emptyRegistry();
	let raw: string;
	try {
		raw = readFileSync(path, "utf-8");
	} catch {
		return emptyRegistry();
	}
	try {
		const parsed = JSON.parse(raw) as Registry;
		if (parsed.version !== 1 || !Array.isArray(parsed.projects)) {
			quarantine(path, raw);
			return emptyRegistry();
		}
		return parsed;
	} catch {
		quarantine(path, raw);
		return emptyRegistry();
	}
}

function quarantine(path: string, _raw: string): void {
	const iso = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = `${path}.corrupt.${iso}.bak`;
	try {
		renameSync(path, backupPath);
		process.stderr.write(
			`warning: quarantined malformed registry to ${backupPath}\n`,
		);
	} catch {
		// rename failed (permissions, race) — best effort; caller gets empty
		// registry and the damaged file stays in place. Next write would still
		// overwrite, but that's no worse than prior behavior.
	}
}

/**
 * Atomically write the registry. Writes to a temp file in the same dir, then
 * renames over the target — so a crash mid-write never leaves a corrupt
 * registry that later reads would fail to parse.
 */
function writeRegistry(reg: Registry): void {
	ensureHome();
	const path = registryPath();
	const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;
	writeFileSync(tmpPath, JSON.stringify(reg, null, 2));
	renameSync(tmpPath, path);
}

/**
 * Append a new project to the registry. Returns the entry that was created.
 *
 * Name resolution: basename of the path, with a numeric suffix (`-2`, `-3`, ...)
 * if the basename collides with an already-registered project. The path itself
 * is the deduplication key — registering the same path twice is a no-op
 * (returns the existing entry without modifying lastSeenAt).
 */
export function addProject(projectPath: string): ProjectEntry {
	const reg = readRegistry();

	const existing = reg.projects.find((p) => p.path === projectPath);
	if (existing) return existing;

	const baseName = basename(projectPath);
	let name = baseName;
	let suffix = 2;
	while (reg.projects.some((p) => p.name === name)) {
		name = `${baseName}-${suffix}`;
		suffix++;
	}

	const now = new Date().toISOString();
	const entry: ProjectEntry = {
		name,
		path: projectPath,
		registeredAt: now,
		lastSeenAt: now,
	};
	reg.projects.push(entry);
	writeRegistry(reg);
	return entry;
}

/**
 * Look up a project by name. Returns the entry plus a fresh `pathExists` check —
 * the registry isn't auto-pruned, so a registered name may point at a deleted
 * directory. Caller decides what to do with that signal (the admin UI shows
 * a "needs reconfiguration" failure page in that case).
 *
 * Throws if the name isn't in the registry at all (missing entries are a
 * different failure mode from stale-but-registered entries).
 */
export function validateProject(name: string): {
	entry: ProjectEntry;
	pathExists: boolean;
} {
	const reg = readRegistry();
	const entry = reg.projects.find((p) => p.name === name);
	if (!entry) {
		throw new Error(`No project named ${name} in registry`);
	}
	return { entry, pathExists: existsSync(entry.path) };
}

/**
 * Update a project's `lastSeenAt` to now. Idempotent — calling it on a
 * non-existent name is a no-op (no throw, just nothing happens).
 */
export function touchProject(name: string): void {
	const reg = readRegistry();
	const entry = reg.projects.find((p) => p.name === name);
	if (!entry) return;
	entry.lastSeenAt = new Date().toISOString();
	writeRegistry(reg);
}
