/**
 * Session-ID resolution for the multi-agent presence bulletin.
 *
 * Primary source: `CLAUDE_CODE_SESSION_ID` — exported by Claude Code as a UUID
 * v4 (e.g., `2c87e7b6-702a-4dcd-876f-a31820e0df3e`). Inherited by every
 * subprocess spawned within the session, so multiple `indusk agent ...` calls
 * within one Claude Code session resolve to the same identifier.
 *
 * Verified 2026-06-25 by inspecting `env` output inside an active Claude Code
 * session (handoff-multi-agent Phase 1 spike). Variable name confirmed
 * specifically as `CLAUDE_CODE_SESSION_ID` (NOT the shorter `CLAUDE_SESSION_ID`
 * the brief originally guessed at).
 *
 * Fallback: `pid-<process.pid>`. Used when the env var is unset (running
 * outside Claude Code, or a stripped subprocess). The fallback identifier is
 * stable only within a single process — multiple subprocesses spawned from a
 * non-Claude shell will each get distinct identifiers. That is acceptable for
 * v1: non-Claude-Code use of `indusk agent` is rare, and the cost of a
 * fragmented bulletin is a few extra entries that age out via the stale TTL.
 *
 * If the env var name changes upstream (Claude Code SDK version 0.3.x at spike
 * time), update `CLAUDE_CODE_SESSION_ENV_VAR` only — the rest of this module
 * never inlines the string.
 */

export const CLAUDE_CODE_SESSION_ENV_VAR = "CLAUDE_CODE_SESSION_ID";

/**
 * Resolve a stable identifier for the current session.
 *
 * @param env - Environment to read from. Defaults to `process.env`. Tests
 *              override this to simulate the env-var-absent case.
 * @param pid - Process ID to use for the fallback. Defaults to `process.pid`.
 *              Tests override this to pin a deterministic fallback value.
 */
export function getSessionId(
	env: NodeJS.ProcessEnv = process.env,
	pid: number = process.pid,
): string {
	const fromEnv = env[CLAUDE_CODE_SESSION_ENV_VAR];
	if (fromEnv && fromEnv.trim().length > 0) {
		return fromEnv.trim();
	}
	return `pid-${pid}`;
}
