import { type EnsureResult, ensureConfigBlock } from "../config.js";

/**
 * Ensure the `promises` block exists, keyed on block PRESENCE, never on its
 * contents, so a project that already declares domains is never touched
 * (day-promises ADR D5). Domains are decided in planning; `update` only makes
 * the key exist so there is one place to declare them. One of the three
 * callers of the shared ensure (A32).
 */
export function ensurePromisesConfig(projectRoot: string): EnsureResult {
	return ensureConfigBlock(projectRoot, "promises", { domains: [] });
}
