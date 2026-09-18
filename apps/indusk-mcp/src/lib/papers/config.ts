import { type EnsureResult, ensureConfigBlock } from "../config.js";

/**
 * Ensure the `papers` block exists, keyed on block PRESENCE, never on its
 * contents, so a project that already declares destinations is never
 * touched. One of the three callers of the shared ensure (A32).
 */
export function ensurePapersConfig(projectRoot: string): EnsureResult {
	return ensureConfigBlock(projectRoot, "papers", { destinations: [] });
}
