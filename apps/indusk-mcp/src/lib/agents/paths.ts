/**
 * Filesystem paths for the multi-agent presence bulletin.
 *
 * The bulletin lives at `<projectRoot>/.indusk/agents/`, where `projectRoot` is
 * resolved via the existing `resolveProjectRoot()` walk-up from `lib/config.ts`
 * (looks for `.indusk/config.json`). In workbench-shaped projects (worktree
 * extension enabled), this naturally lands at the workbench root because the
 * workbench is where `.indusk/` lives — every worktree's walk-up surfaces the
 * same shared bulletin directory. In single-repo projects, it lands at the
 * project root.
 *
 * This module does NOT create the directory or write to it — it is a pure
 * path-resolution helper. The agent CLI (Phase 2) owns the mutation surface.
 */

import { join } from "node:path";

export { resolveProjectRoot } from "../config.js";

/**
 * Return the absolute path to the presence-bulletin directory for a given
 * project root. The directory may not exist yet — the agent CLI creates it
 * lazily on first `agent register` call.
 */
export function getAgentsDir(projectRoot: string): string {
	return join(projectRoot, ".indusk/agents");
}

/**
 * Return the absolute path to the presence file for a given session ID under a
 * given project root.
 */
export function getPresenceFilePath(projectRoot: string, sessionId: string): string {
	return join(getAgentsDir(projectRoot), `${sessionId}.md`);
}
