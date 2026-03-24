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

export function loadExtensions(projectRoot: string): LoadedExtension[] {
	const extensions: LoadedExtension[] = [];
	const dir = extensionsDir(projectRoot);

	if (!existsSync(dir)) return extensions;

	// Load enabled extensions
	const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
	for (const file of files) {
		const path = join(dir, file);
		const manifest = loadExtension(path);
		if (manifest) {
			extensions.push({ manifest, path, enabled: true });
		}
	}

	// Load disabled extensions
	const disDir = disabledDir(projectRoot);
	if (existsSync(disDir)) {
		const disabledFiles = readdirSync(disDir).filter((f) => f.endsWith(".json"));
		for (const file of disabledFiles) {
			const path = join(disDir, file);
			const manifest = loadExtension(path);
			if (manifest) {
				extensions.push({ manifest, path, enabled: false });
			}
		}
	}

	return extensions;
}

export function getEnabledExtensions(projectRoot: string): LoadedExtension[] {
	return loadExtensions(projectRoot).filter((e) => e.enabled);
}

// --- Enable / Disable ---

export function enableExtension(projectRoot: string, name: string): boolean {
	const disPath = join(disabledDir(projectRoot), `${name}.json`);
	const enPath = join(extensionsDir(projectRoot), `${name}.json`);

	if (existsSync(enPath)) return true; // Already enabled

	if (existsSync(disPath)) {
		renameSync(disPath, enPath);
		return true;
	}

	return false; // Not found
}

export function disableExtension(projectRoot: string, name: string): boolean {
	const enPath = join(extensionsDir(projectRoot), `${name}.json`);
	const disPath = join(disabledDir(projectRoot), `${name}.json`);

	if (!existsSync(enPath)) return false;

	ensureExtensionsDirs(projectRoot);
	renameSync(enPath, disPath);
	return true;
}

// --- Query ---

export function isEnabled(projectRoot: string, name: string): boolean {
	return existsSync(join(extensionsDir(projectRoot), `${name}.json`));
}

export function getExtension(projectRoot: string, name: string): LoadedExtension | null {
	const enPath = join(extensionsDir(projectRoot), `${name}.json`);
	const disPath = join(disabledDir(projectRoot), `${name}.json`);

	if (existsSync(enPath)) {
		const manifest = loadExtension(enPath);
		return manifest ? { manifest, path: enPath, enabled: true } : null;
	}

	if (existsSync(disPath)) {
		const manifest = loadExtension(disPath);
		return manifest ? { manifest, path: disPath, enabled: false } : null;
	}

	return null;
}
