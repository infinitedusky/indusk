import { readConfig, writeConfig } from "../config.js";

/**
 * Ensure the `papers` block exists, the way `ensureCleanupConfig` ensures
 * `cleanup`: keyed on block PRESENCE, never on its contents, so a project
 * that already declares destinations is never touched. Returns what it did.
 */
export function ensurePapersConfig(projectRoot: string): "added" | "already-set" | "no-config" {
	const config = readConfig(projectRoot);
	if (!config) return "no-config";
	const existing = (config as { papers?: unknown }).papers;
	if (existing !== null && typeof existing === "object") return "already-set";
	writeConfig(projectRoot, { ...config, papers: { destinations: [] } });
	return "added";
}
