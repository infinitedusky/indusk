import type { DaemonReads } from "./daemon-reads.js";
import type { SpawnDaemon } from "./start-plan.js";

/**
 * Registering a project with the daemon: take over or start the one daemon and
 * write only this project's MCP entry, at the stored MCP port, and only when
 * it differs. Enabling the extension, `init` and `update` all run it.
 *
 * promise: the-daemon-readers-follow-is-the-one-running
 */

export interface RegisterDeps {
	reads?: DaemonReads;
	home?: string;
	spawn?: SpawnDaemon;
}

export interface RegisterResult {
	daemon: "found" | "started" | "refused" | "skipped";
	lines: string[];
	code: number;
}

export async function registerWithDaemon(
	_projectPath: string,
	_deps: RegisterDeps = {},
): Promise<RegisterResult> {
	return { daemon: "refused", lines: [], code: 1 };
}
