import { upsertJaegerEntry } from "../mcp-config.js";
import { mcpPortOf } from "./daemon-address.js";
import { realDaemonReads } from "./daemon-reads.js";
import { daemonState } from "./daemon-state.js";
import { registerProject } from "./registry.js";
import { type EnsureResult, ensureDaemon, type SpawnDaemon, startReport } from "./start-plan.js";
import { induskHome } from "./status.js";

/**
 * Registering a project with the daemon: take over or start the one daemon and
 * write only this project's MCP entry, at the stored MCP port, and only when
 * it differs. Enabling the extension, `init` and `update` all run it.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

import type { DaemonReads } from "./daemon-reads.js";

export interface RegisterDeps {
	/** The machine; left out, this home as the operating system shows it, started for real. */
	reads?: DaemonReads;
	home?: string;
	spawn?: SpawnDaemon;
}

export interface RegisterResult {
	daemon: "found" | "started" | "refused" | "skipped";
	lines: string[];
	code: number;
}

async function ensureOne(
	deps: RegisterDeps,
	reads: DaemonReads,
	home: string,
): Promise<EnsureResult> {
	if (deps.spawn !== undefined) return ensureDaemon("register", reads, home, deps.spawn);
	const { startDaemon } = await import("./daemon.js");
	return startDaemon("register");
}

export async function registerWithDaemon(
	projectPath: string,
	deps: RegisterDeps = {},
): Promise<RegisterResult> {
	const home = deps.home ?? induskHome();
	const reads = deps.reads ?? realDaemonReads(home);
	const entry = registerProject(projectPath);
	const lines = [`Registered project: ${entry.name} (${entry.path})`];

	const present = daemonState(reads, home).kind;
	if (
		present !== "running" &&
		present !== "found" &&
		process.env.INDUSK_SKIP_TELEMETRY_AUTOSTART === "1"
	) {
		// The test suites set this (test-daemons-never-leak): every test that ran
		// `init` against a temporary home started a detached pair here and nothing
		// stopped it — 860 found running on 2026-10-03. Registration still
		// happens; only the opportunistic start is skipped.
		lines.push("Daemon not running — not starting it (INDUSK_SKIP_TELEMETRY_AUTOSTART=1).");
		return { daemon: "skipped", lines, code: 0 };
	}

	let result: EnsureResult;
	try {
		result = await ensureOne(deps, reads, home);
	} catch (err) {
		lines.push(`Project registered but daemon failed to start: ${(err as Error).message}`);
		return { daemon: "refused", lines, code: 1 };
	}
	if (result.kind === "refused") {
		lines.push(`Project registered but the daemon was not started.`, result.text);
		return { daemon: "refused", lines, code: 1 };
	}
	if (result.kind !== "running") lines.push(startReport(result).text);

	const port = mcpPortOf(reads);
	if (port !== null) {
		lines.push(
			upsertJaegerEntry(projectPath, port)
				? `  .mcp.json: wired jaeger MCP server at http://localhost:${port}/mcp`
				: "  .mcp.json: jaeger MCP server current",
		);
	}
	return { daemon: result.kind === "started" ? "started" : "found", lines, code: 0 };
}
