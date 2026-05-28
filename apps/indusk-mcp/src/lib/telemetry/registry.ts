import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

/**
 * Normalize a project path for registry key-matching. Resolves symlinks
 * (macOS `/var` → `/private/var`) so registrations via absolute paths and
 * registrations via shell `$(pwd)` — which the extension's on_enable hook
 * uses — produce the same key. If the path doesn't exist yet, returns the
 * path unchanged rather than throwing.
 */
export function normalizeProjectPath(p: string): string {
	try {
		return realpathSync(p);
	} catch {
		return p;
	}
}

/**
 * Telemetry project registry — `~/.indusk/telemetry/projects.json`.
 *
 * Tracks which projects have `local-telemetry` enabled so the daemon
 * knows when to auto-start (first enable) and when to graceful-stop
 * (last disable). Mutations only happen via this module's exports.
 *
 * Shape mirrors admin-ui-hosting's `lib/admin/registry.ts` — same
 * atomic-write pattern, same quarantine-on-malformed pattern (admin-UI
 * Phase 7 lesson carried forward: silent-data-loss hazards hide in
 * return-empty-on-error paths).
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

function telemetryDir(): string {
	return join(induskHome(), "telemetry");
}

function registryPath(): string {
	return join(telemetryDir(), "projects.json");
}

function ensureDir(): void {
	const d = telemetryDir();
	if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function quarantine(path: string): void {
	const iso = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = `${path}.corrupt.${iso}.bak`;
	try {
		renameSync(path, backupPath);
		process.stderr.write(`warning: quarantined malformed telemetry registry to ${backupPath}\n`);
	} catch {
		// best-effort; caller gets empty registry regardless
	}
}

/**
 * Read the registry. Returns empty if absent. If the file exists but is
 * malformed (JSON parse failure OR wrong shape), quarantine-renames it to
 * `.corrupt.{ISO}.bak` before returning empty — prevents silent data loss
 * when a subsequent write would otherwise clobber the damaged bytes.
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
			quarantine(path);
			return emptyRegistry();
		}
		return parsed;
	} catch {
		quarantine(path);
		return emptyRegistry();
	}
}

function writeRegistry(reg: Registry): void {
	ensureDir();
	const path = registryPath();
	const tmpPath = `${path}.tmp.${process.pid}.${Date.now()}`;
	writeFileSync(tmpPath, JSON.stringify(reg, null, 2));
	renameSync(tmpPath, path);
}

/**
 * Register a project with the telemetry daemon. Idempotent — if the path
 * is already registered, returns the existing entry without modifying
 * lastSeenAt. Name-collision resolution uses basename + `-N` suffix
 * (same scheme as admin-UI registry).
 */
export function registerProject(projectPath: string): ProjectEntry {
	const reg = readRegistry();
	const normalized = normalizeProjectPath(projectPath);

	const existing = reg.projects.find((p) => normalizeProjectPath(p.path) === normalized);
	if (existing) return existing;

	const baseName = basename(normalized);
	let name = baseName;
	let suffix = 2;
	while (reg.projects.some((p) => p.name === name)) {
		name = `${baseName}-${suffix}`;
		suffix++;
	}

	const now = new Date().toISOString();
	const entry: ProjectEntry = {
		name,
		path: normalized,
		registeredAt: now,
		lastSeenAt: now,
	};
	reg.projects.push(entry);
	writeRegistry(reg);
	return entry;
}

/**
 * Deregister a project by path. Idempotent — if the path isn't registered,
 * returns false without modifying the registry. Returns true on successful
 * removal.
 */
export function deregisterProject(projectPath: string): boolean {
	const reg = readRegistry();
	const normalized = normalizeProjectPath(projectPath);
	const before = reg.projects.length;
	reg.projects = reg.projects.filter((p) => normalizeProjectPath(p.path) !== normalized);
	if (reg.projects.length === before) return false;
	writeRegistry(reg);
	return true;
}

/**
 * Update lastSeenAt for a project. Used by init/update to refresh activity
 * timestamps when a project is re-scaffolded or upgraded. Idempotent — no
 * throw if the project isn't registered.
 */
export function touchProject(projectPath: string): void {
	const reg = readRegistry();
	const normalized = normalizeProjectPath(projectPath);
	const entry = reg.projects.find((p) => normalizeProjectPath(p.path) === normalized);
	if (!entry) return;
	entry.lastSeenAt = new Date().toISOString();
	writeRegistry(reg);
}
