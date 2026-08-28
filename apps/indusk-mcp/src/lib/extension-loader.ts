import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";

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
	/** Set when a `manifest.local.json` was merged over this manifest. */
	_localOverride?: string;
	/**
	 * `required: true` means the extension is enabled-by-default on every
	 * project unless listed in `.indusk/config.json`'s `disabled_extensions`
	 * array. Required-by-default extensions ship as essential substrate
	 * (e.g., local-telemetry) that the rest of the dev system assumes.
	 * Opt-out is explicit; opt-in is implicit.
	 */
	required?: boolean;
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
		on_enable?: string;
		on_disable?: string;
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
		add_command?: string;
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

/**
 * Names every extension whose `manifest.local.json` could not be parsed.
 *
 * A malformed override must be LOUD but must not be CATASTROPHIC. Throwing all
 * the way out of `indusk update` took the whole command down with a stack trace
 * over one bad file — which stops the other twenty extensions from updating and
 * buries the actual message. Callers that enumerate extensions collect here,
 * report clearly, and still fail their exit code so nothing is silent.
 */
export const localOverrideErrors: string[] = [];

/**
 * Load a manifest, tolerating a broken local override.
 *
 * Returns the built-in manifest and records the error, so one bad override
 * degrades that extension rather than the command.
 */
export function loadExtensionTolerant(manifestPath: string): ExtensionManifest | null {
	try {
		return loadExtension(manifestPath);
	} catch (e) {
		localOverrideErrors.push(e instanceof Error ? e.message : String(e));
		return loadExtensionRaw(manifestPath);
	}
}

/** The built-in manifest, with no override applied. */
function loadExtensionRaw(manifestPath: string): ExtensionManifest | null {
	try {
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as ExtensionManifest;
		return manifest.name && manifest.provides ? manifest : null;
	} catch {
		return null;
	}
}

export function loadExtension(manifestPath: string): ExtensionManifest | null {
	let manifest: ExtensionManifest;
	try {
		const content = readFileSync(manifestPath, "utf-8");
		manifest = JSON.parse(content) as ExtensionManifest;
		if (!manifest.name || !manifest.provides) return null;
	} catch {
		return null;
	}
	return applyLocalOverride(manifestPath, manifest);
}

/**
 * Merge `manifest.local.json` over a built-in manifest, if one exists.
 *
 * `.indusk/extensions/` is package-owned: `update` flat-copies the built-in over
 * it whenever hashes differ, with no merge and no local-preserve path. A project
 * that hand-edits a manifest has parked a fork inside a directory whose purpose
 * is to be replaced, and every update silently reverts it.
 *
 * The tempting fix — teach `update` to preserve local edits — is worse. It pins
 * the project to a stale fork and hides upstream improvements behind it
 * indefinitely, trading a loud-once problem for a silent-forever one. So the
 * override lives in a SEPARATE file that update never writes: upstream keeps
 * arriving for everything not overridden, and the local change keeps applying.
 *
 * Health checks merge BY NAME — an entry replaces the built-in of the same name
 * and a new name is appended — so overriding one check does not fork the rest.
 *
 * A malformed override THROWS rather than degrading to the built-in. Silently
 * ignoring it would restore exactly the silence this exists to remove.
 */
function applyLocalOverride(manifestPath: string, manifest: ExtensionManifest): ExtensionManifest {
	const localPath = join(dirname(manifestPath), "manifest.local.json");
	if (!existsSync(localPath)) return manifest;

	let local: Partial<ExtensionManifest>;
	try {
		local = JSON.parse(readFileSync(localPath, "utf-8")) as Partial<ExtensionManifest>;
	} catch (e) {
		throw new Error(
			`${localPath}: manifest.local.json is not valid JSON — ${e instanceof Error ? e.message : String(e)}`,
		);
	}

	const merged: ExtensionManifest = { ...manifest, ...local, provides: { ...manifest.provides } };
	if (local.provides) {
		merged.provides = { ...manifest.provides, ...local.provides };
		const localChecks = local.provides.health_checks;
		if (localChecks) {
			const byName = new Map((manifest.provides.health_checks ?? []).map((c) => [c.name, c]));
			for (const c of localChecks) byName.set(c.name, c);
			merged.provides.health_checks = [...byName.values()];
		}
	}
	merged._localOverride = localPath;
	return merged;
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

	return [...loadFromDir(dir, true), ...loadFromDir(disDir, false)];
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
