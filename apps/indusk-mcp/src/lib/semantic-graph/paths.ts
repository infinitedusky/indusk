/**
 * Path resolution for the semantic graph event log.
 *
 * The log is a per-project artifact living under `.indusk/graph/` in the
 * project root. In normal mode the developer decides whether to commit it;
 * in `indusk init --local` mode the existing `.git/info/exclude` entry for
 * `.indusk/` already hides it. Either way, this module just resolves paths —
 * it does not enforce visibility policy.
 */

import { join } from "node:path";

/** Directory holding semantic graph runtime state for a project. */
export function getGraphDir(projectRoot: string): string {
	return join(projectRoot, ".indusk", "graph");
}

/** Path to the canonical event log for a project. */
export function getLogPath(projectRoot: string): string {
	return join(getGraphDir(projectRoot), "semantic-graph.log");
}
