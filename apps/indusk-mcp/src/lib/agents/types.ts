/**
 * Shape of a single presence-bulletin file at `.indusk/agents/{sessionId}.md`.
 *
 * Each Claude Code session writes one of these on `indusk agent register` and
 * deletes it on `indusk agent done`. Other agents glob the directory to see who
 * is currently working. Files older than `agents.stale_ttl_minutes` (default 60)
 * are filtered from `indusk agent list` output.
 *
 * The file format is YAML frontmatter + markdown body for legibility, but the
 * structured contract is this type.
 */
export interface PresenceFile {
	/** Stable identifier for the session; see `session.ts` for resolution rules. */
	sessionId: string;
	/** One-line description of what this agent is working on. */
	task: string;
	/** Branch the agent is working on, if any. Null for detached HEAD or unknown. */
	branch: string | null;
	/** Absolute path to the worktree the agent is working in. */
	worktree: string;
	/** ISO timestamp captured at register time. */
	startedAt: string;
}
