import { readConfig, writeConfig } from "../config.js";

/**
 * Ensure the `promises` block exists, the way `ensurePapersConfig` ensures
 * `papers`: keyed on block PRESENCE, never on its contents, so a project that
 * already declares domains is never touched (day-promises ADR D5). Domains are
 * decided in planning; `update` only makes the key exist so there is one
 * place to declare them. Returns what it did.
 */
export function ensurePromisesConfig(projectRoot: string): "added" | "already-set" | "no-config" {
	const config = readConfig(projectRoot);
	if (!config) return "no-config";
	const existing = (config as { promises?: unknown }).promises;
	if (existing !== null && typeof existing === "object") return "already-set";
	writeConfig(projectRoot, { ...config, promises: { domains: [] } });
	return "added";
}
