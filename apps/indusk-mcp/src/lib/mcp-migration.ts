/**
 * Migration surface for retired MCP servers (indusk-makeover Phase 8 cleanup).
 *
 * `init` and `update` both need to strip stale registrations of servers
 * InDusk no longer ships (graphiti, codegraphcontext). This is the single
 * implementation — future retirements extend `LEGACY_MCP_SERVERS`, never
 * hand-roll another removal loop in a command file.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Servers retired by indusk-makeover. Extend on future retirements. */
export const LEGACY_MCP_SERVERS: readonly string[] = ["codegraphcontext", "graphiti"];

export interface RemoveLegacyResult {
	/** Legacy servers found in .mcp.json and successfully removed. */
	removed: string[];
	/** Legacy servers found but whose `claude mcp remove` invocation failed. */
	failed: string[];
}

export interface RemoveLegacyOptions {
	/** Injectable command runner (tests). Must throw on failure. */
	run?: (command: string) => void;
	/** Override the legacy list (tests). */
	servers?: readonly string[];
}

/**
 * Remove every retired MCP server still registered in the project's
 * `.mcp.json`. Missing or unparseable `.mcp.json` → nothing to do (empty
 * result) — never throws for absent state.
 */
export function removeLegacyMcpServers(
	projectRoot: string,
	opts: RemoveLegacyOptions = {},
): RemoveLegacyResult {
	const servers = opts.servers ?? LEGACY_MCP_SERVERS;
	const run =
		opts.run ??
		((command: string) => {
			execSync(command, { cwd: projectRoot, stdio: "pipe", timeout: 10000 });
		});

	const result: RemoveLegacyResult = { removed: [], failed: [] };

	const mcpJsonPath = join(projectRoot, ".mcp.json");
	if (!existsSync(mcpJsonPath)) return result;
	let registered: Record<string, unknown>;
	try {
		registered = JSON.parse(readFileSync(mcpJsonPath, "utf-8")).mcpServers ?? {};
	} catch {
		return result;
	}

	for (const name of servers) {
		if (!(name in registered)) continue;
		try {
			run(`claude mcp remove -s project ${name}`);
			result.removed.push(name);
		} catch {
			result.failed.push(name);
		}
	}

	return result;
}
