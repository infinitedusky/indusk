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

const MAX_SESSION_ID_LENGTH = 128;

/**
 * Reject session IDs that could escape the agents directory via `path.join`
 * normalization. Authored as the Phase 6 falsification fix for the
 * handoff-multi-agent plan after `/falsify` surfaced T12: an unvalidated
 * `$CLAUDE_CODE_SESSION_ID` or `--session-id` flag could traverse outside
 * `<projectRoot>/.indusk/agents/` via `..` segments.
 *
 * Rules:
 *   - Reject `..`, `/`, `\` anywhere in the ID (path-segment escape)
 *   - Reject leading `.` (hidden-file shenanigans + dotdot prefix)
 *   - Reject trimmed length > 128 (avoids absurd filenames; UUIDs and PIDs both
 *     fit comfortably)
 *   - Reject empty / whitespace-only IDs
 *
 * Throws a TypeError on any rejection. Callers in the CLI catch and surface as
 * a non-zero exit; library consumers get a normal exception for try/catch.
 *
 * IMPORTANT: this is the single chokepoint. Any code path that constructs a
 * presence file path from external input — env var, CLI flag, or a future
 * consumer — MUST route through this helper.
 */
export function sanitizeSessionId(raw: string): string {
	const trimmed = (raw ?? "").trim();
	if (trimmed.length === 0) {
		throw new TypeError("Invalid session id: empty");
	}
	if (trimmed.length > MAX_SESSION_ID_LENGTH) {
		throw new TypeError(`Invalid session id: exceeds ${MAX_SESSION_ID_LENGTH} characters`);
	}
	if (trimmed.startsWith(".")) {
		throw new TypeError("Invalid session id: leading '.' is not allowed");
	}
	if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) {
		throw new TypeError(
			"Invalid session id: path-traversal characters ('..', '/', '\\\\') are not allowed",
		);
	}
	// T17 (handoff-multi-agent-section-shape Phase 6 falsification fix): reject
	// control characters. A session ID containing `\n` corrupts the `## Session
	// <short> — <task>` heading line on serialize, then fails the section regex
	// on read and silently drops the section. Reject anything with code point
	// below 0x20 (covers \n, \r, \t, null, bell, etc.).
	for (let i = 0; i < trimmed.length; i++) {
		const cp = trimmed.charCodeAt(i);
		if (cp < 0x20) {
			throw new TypeError(
				`Invalid session id: control character at position ${i} (code point 0x${cp.toString(16).padStart(2, "0")}) is not allowed`,
			);
		}
	}
	return trimmed;
}

/**
 * Resolve a stable identifier for the current session.
 *
 * Routes through `sanitizeSessionId` so the env-var path can never inject
 * path-traversal characters into the presence-file path. If the env-var value
 * is unsafe, throws a TypeError — callers catch and surface as non-zero exit.
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
		return sanitizeSessionId(fromEnv);
	}
	return sanitizeSessionId(`pid-${pid}`);
}
