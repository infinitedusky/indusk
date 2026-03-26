import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { join } from "node:path";

// --- Manifest Types ---

export interface DetectRule {
	file?: string;
	file_pattern?: string;
	dependency?: string;
	devDependency?: string;
	mcp_server?: string;
}

export interface HealthCheck {
	name: string;
	command: string;
}

export interface VerificationEntry {
	name: string;
	command: string;
	detect?: DetectRule;
}

export interface ExtensionManifest {
	name: string;
	description: string;
	version?: string;
	_source?: string;
	provides: {
		skill?: boolean;
		networking?: { env_file?: string; command?: string; description?: string };
		services?: { command?: string; description?: string };
		health_checks?: HealthCheck[];
		verification?: VerificationEntry[];
		env_vars?: Record<string, string> | { source: string; files?: string[] };
	};
	hooks?: {
		on_init?: string;
		on_update?: string;
		on_post_update?: string;
		on_health_check?: string;
		on_onboard?: string;
	};
	detect?: DetectRule;
	mcp_server?: {
		type?: string;
		url?: string;
		command?: string;
		args?: string[];
		headers?: Record<string, string>;
		env?: Record<string, string>;
		env_from_shell?: string[];
		setup_instructions?: string[];
	};
}

export interface LoadedExtension {
	manifest: ExtensionManifest;
	path: string;
	enabled: boolean;
}

// --- Directory Management ---

const EXTENSIONS_DIR = ".indusk/extensions";
const DISABLED_DIR = ".indusk/extensions/.disabled";

export function extensionsDir(projectRoot: string): string {
	return join(projectRoot, EXTENSIONS_DIR);
}

export function disabledDir(projectRoot: string): string {
	return join(projectRoot, DISABLED_DIR);
}

export function ensureExtensionsDirs(projectRoot: string): void {
	mkdirSync(extensionsDir(projectRoot), { recursive: true });
	mkdirSync(disabledDir(projectRoot), { recursive: true });
}

// --- Loading ---

export function loadExtension(manifestPath: string): ExtensionManifest | null {
	try {
		const content = readFileSync(manifestPath, "utf-8");
		const manifest = JSON.parse(content) as ExtensionManifest;
		if (!manifest.name || !manifest.provides) return null;
		return manifest;
	} catch {
		return null;
	}
}

/**
 * Resolve the manifest path for an extension.
 * Supports both directory format ({name}/manifest.json) and legacy flat format ({name}.json).
 * Returns the path if found, null otherwise.
 */
export function resolveManifestPath(baseDir: string, name: string): string | null {
	// Directory format first (preferred)
	const dirPath = join(baseDir, name, "manifest.json");
	if (existsSync(dirPath)) return dirPath;

	// Legacy flat file
	const flatPath = join(baseDir, `${name}.json`);
	if (existsSync(flatPath)) return flatPath;

	return null;
}

/**
 * Get the directory path for an extension (creates if needed).
 * This is where manifest.json, .env, and other extension files live.
 */
export function extensionConfigDir(projectRoot: string, name: string): string {
	return join(extensionsDir(projectRoot), name);
}

/**
 * Migrate a flat file extension to directory format.
 * Moves {name}.json → {name}/manifest.json
 */
export function migrateToDirectory(baseDir: string, name: string): void {
	const flatPath = join(baseDir, `${name}.json`);
	const dirPath = join(baseDir, name);
	const newPath = join(dirPath, "manifest.json");

	if (existsSync(flatPath) && !existsSync(newPath)) {
		mkdirSync(dirPath, { recursive: true });
		renameSync(flatPath, newPath);
	}
}

function loadFromDir(baseDir: string, enabled: boolean): LoadedExtension[] {
	const extensions: LoadedExtension[] = [];
	if (!existsSync(baseDir)) return extensions;

	const entries = readdirSync(baseDir, { withFileTypes: true });

	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;

		let manifestPath: string | null = null;

		if (entry.isDirectory()) {
			// Directory format: {name}/manifest.json
			manifestPath = join(baseDir, entry.name, "manifest.json");
			if (!existsSync(manifestPath)) continue;
		} else if (entry.isFile() && entry.name.endsWith(".json")) {
			// Legacy flat format: {name}.json — auto-migrate
			const name = entry.name.replace(".json", "");
			migrateToDirectory(baseDir, name);
			manifestPath = join(baseDir, name, "manifest.json");
			if (!existsSync(manifestPath)) {
				// Migration failed, read from flat file
				manifestPath = join(baseDir, entry.name);
			}
		} else {
			continue;
		}

		const manifest = loadExtension(manifestPath);
		if (manifest) {
			extensions.push({ manifest, path: manifestPath, enabled });
		}
	}

	return extensions;
}

export function loadExtensions(projectRoot: string): LoadedExtension[] {
	const dir = extensionsDir(projectRoot);
	const disDir = disabledDir(projectRoot);

	return [
		...loadFromDir(dir, true),
		...loadFromDir(disDir, false),
	];
}

export function getEnabledExtensions(projectRoot: string): LoadedExtension[] {
	return loadExtensions(projectRoot).filter((e) => e.enabled);
}

// --- Enable / Disable ---

export function enableExtension(projectRoot: string, name: string): boolean {
	const enDir = join(extensionsDir(projectRoot), name);
	const enManifest = join(enDir, "manifest.json");

	// Already enabled (directory format)
	if (existsSync(enManifest)) return true;

	// Already enabled (legacy flat — migrate first)
	const enFlat = join(extensionsDir(projectRoot), `${name}.json`);
	if (existsSync(enFlat)) {
		migrateToDirectory(extensionsDir(projectRoot), name);
		return true;
	}

	// Check disabled — directory format
	const disDir = join(disabledDir(projectRoot), name);
	if (existsSync(join(disDir, "manifest.json"))) {
		renameSync(disDir, enDir);
		return true;
	}

	// Check disabled — legacy flat
	const disFlat = join(disabledDir(projectRoot), `${name}.json`);
	if (existsSync(disFlat)) {
		mkdirSync(enDir, { recursive: true });
		renameSync(disFlat, enManifest);
		return true;
	}

	return false; // Not found
}

export function disableExtension(projectRoot: string, name: string): boolean {
	const enDir = join(extensionsDir(projectRoot), name);
	const disDir = join(disabledDir(projectRoot), name);

	if (existsSync(join(enDir, "manifest.json"))) {
		ensureExtensionsDirs(projectRoot);
		renameSync(enDir, disDir);
		return true;
	}

	// Legacy flat
	const enFlat = join(extensionsDir(projectRoot), `${name}.json`);
	if (existsSync(enFlat)) {
		ensureExtensionsDirs(projectRoot);
		mkdirSync(disDir, { recursive: true });
		renameSync(enFlat, join(disDir, "manifest.json"));
		return true;
	}

	return false;
}

// --- Query ---

export function isEnabled(projectRoot: string, name: string): boolean {
	return (
		existsSync(join(extensionsDir(projectRoot), name, "manifest.json")) ||
		existsSync(join(extensionsDir(projectRoot), `${name}.json`))
	);
}

export function getExtension(projectRoot: string, name: string): LoadedExtension | null {
	const enPath = resolveManifestPath(extensionsDir(projectRoot), name);
	if (enPath) {
		const manifest = loadExtension(enPath);
		return manifest ? { manifest, path: enPath, enabled: true } : null;
	}

	const disPath = resolveManifestPath(disabledDir(projectRoot), name);
	if (disPath) {
		const manifest = loadExtension(disPath);
		return manifest ? { manifest, path: disPath, enabled: false } : null;
	}

	return null;
}
