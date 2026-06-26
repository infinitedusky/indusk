# Catchup

The catchup skill gets a fresh Claude Code session oriented on a project. As of [handoff-multi-agent](/decisions/multi-agent-coordination), it is **pure-read** for every shared file — the only side effect is the agent's own presence file at `.indusk/agents/<sessionId>.md`, written via [`indusk agent register`](/reference/cli/agent#agent-register).

This makes concurrent catchup runs structurally race-free: two sessions can run `/catchup` at the same time on the same project and neither can corrupt the other's view or block the other from finishing.

## What It Does

Given a fresh session, catchup:

1. **Waits for required MCP servers** (`indusk`) to be available, blocking up to 30 seconds. Refuses to proceed without them — a partial catchup is worse than no catchup.
2. **Registers the current session's presence** via `indusk agent register --task "..."`. The session ID comes from `$CLAUDE_CODE_SESSION_ID`; the file lands at `<projectRoot>/.indusk/agents/<sessionId>.md`.
3. **Reads the bulletin** via `indusk agent list`. Surfaces other agents currently working on this project so the working agent knows who else is around and can avoid stepping on their in-flight work.
4. **Reads operational state** from `.indusk/current.md` (the "what is happening NOW" layer). Strictly read-only — catchup never edits it.
5. **Reads lessons** via `list_lessons` — past mistakes turned into rules.
6. **Checks infrastructure** via `check_health` — FalkorDB + Graphiti reachable.
7. **Reads project context** from CLAUDE.md (architecture, conventions, key decisions, gotchas, current state).
8. **Recalls from Graphiti** via `search_nodes` — the temporal layer of project memory; decisions, corrections, retrospective insights as they happened.
9. **Lists active plans** — which plans are in-progress and where `/work` would pick up.
10. **Reviews installed skills and enabled extensions**.
11. **Summarizes** to the user with the active plan list, other agents present, current state, and Graphiti recall highlights.

## Pure-Read Invariant

The skill body explicitly names the invariant: catchup does not mutate any file other than the current session's own `.indusk/agents/<sessionId>.md`. No checkbox state machine, no shared markdown edits, no plan-doc mutations. This is the structural guarantee that makes concurrent agent operation safe.

If a catchup step *would* require a write to a shared file, that step has been moved to a different skill (working agent's normal commit flow, `/retrospective`, or `/context`). Catchup itself stays pure-read forever.

## When to Use

- The start of every new Claude Code session
- Whenever the user says "get caught up", "what's going on", "where are we", "catch up"
- After context compression, to re-orient
- `/catchup` explicitly

## Source

The canonical skill lives at `apps/indusk-mcp/skills/catchup.md`. The auto-sync `globSync("*.md")` in `init.ts` and `update.ts` distributes it to consumer projects' `.claude/skills/catchup/SKILL.md`.

## See also

- [Multi-Agent Coordination ADR](/decisions/multi-agent-coordination) — the full rationale for the pure-read design
- [`indusk agent` CLI reference](/reference/cli/agent) — the four subcommands the bulletin uses
- [Handoff skill](/reference/skills/handoff) — the deprecated session-end skill, retained as a pointer page
