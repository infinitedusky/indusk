# Catchup

The catchup skill gets a fresh Claude Code session oriented on a project. After the [section-shape rework](/decisions/multi-agent-coordination), it reads operational state from per-agent sections inside `.indusk/current.md` and surfaces other working agents from the same file.

It is **pure-read** for every shared file. The only writes are (a) [`indusk agent register`](/reference/cli/agent#agent-register) ensuring a section exists for the current session, and (b) the implicit self-heartbeat in [`indusk agent list`](/reference/cli/agent#agent-list) refreshing the caller's own section's `Last updated`. Neither write touches any other agent's section. Two sessions can run `/catchup` simultaneously on the same project without blocking or corrupting each other.

## What It Does

Given a fresh session, catchup:

1. **Waits for required MCP servers** (`indusk`) to be available, blocking up to 30 seconds. Refuses to proceed without them.
2. **Registers presence** via `indusk agent register --task "..."`. The session ID comes from `$CLAUDE_CODE_SESSION_ID`; the section lands in `.indusk/current.md`.
3. **Reads the bulletin** via `indusk agent list`. Surfaces other agents currently working on the project. Self-heartbeats the caller's own section.
4. **Reads operational state — targeted, never the whole file.** From `.indusk/current.md`: the `## Project (shared)` anchor region (top of file to the first `---`) plus only the live sessions' `## Session` blocks keyed off `agent list`'s fresh partition. Stale sections are never read or surfaced.
5. **Sweep check** via `indusk agent sweep --dry-run` — surfaces how many decayed sections are archivable. (`/handoff` runs the real sweep.)
6. **Skims lesson titles** via `list_lessons` — titles are the rules; bodies load on demand.
7. **Checks infrastructure** via `check_health`.
8. **Does NOT re-read CLAUDE.md.** It's auto-injected into every session; re-fetching it was the single biggest line item of the pre-makeover catchup (~30k tokens of pure duplication).
9. **Lists active plans** via `list_plans { active: true }` — in-motion plans only, plus a count of what was omitted.
10. **Reviews installed skills and enabled extensions**.
11. **Summarizes** to the user with the active plan list, other agents present, project (shared) state, and the sweep count.

The dieted read-set (indusk-makeover) measures ~8k tokens of tool results per catchup, down from ~55k.

## Pure-Read Invariant

Catchup never edits any shared file. Per-agent sections inside `current.md` are owned by their session — only that session writes them, and the canonical way to do so is via the [`mcp__indusk__update_current_section` MCP tool](/reference/tools/indusk-mcp#agent-tools) at `/handoff`. The `## Project (shared)` anchor section can be edited by any agent at any time, but catchup itself does not edit it.

## When to Use

- The start of every new Claude Code session
- Whenever the user says "get caught up", "what's going on", "where are we", "catch up"
- After context compression, to re-orient
- `/catchup` explicitly

## Source

The canonical skill lives at `apps/indusk-mcp/skills/catchup.md`. The auto-sync `globSync("*.md")` in `init.ts` and `update.ts` distributes it to consumer projects' `.claude/skills/catchup/SKILL.md`.

## See also

- [Multi-Agent Coordination ADR](/decisions/multi-agent-coordination) — the full rationale for the section shape
- [`indusk agent` CLI reference](/reference/cli/agent) — the four subcommands the bulletin uses
- [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools) — the write surface
- [Handoff skill](/reference/skills/handoff) — the session-end ritual
