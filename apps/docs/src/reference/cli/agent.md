# `indusk agent` — multi-agent presence (sections in current.md)

The `agent` subcommand group manages the per-session presence bulletin for multi-agent coordination on an InDusk project.

After the [section-shape rework](/decisions/multi-agent-coordination) (shipped in indusk-mcp 1.29+), the bulletin lives as **per-agent sections inside `.indusk/current.md`** — there is no separate `.indusk/agents/` directory. Each session owns its section, identified by the full session ID. The MCP write surface is [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools); the CLI subcommands below wrap the same lib helpers for shell-driven use.

## Subcommands

| Command | Purpose |
|---------|---------|
| `agent register --task "<what>"` | Ensure a section exists for the current session in `current.md`. Refreshes `Last updated` + task; preserves any existing section bodies. |
| `agent done` | Remove the current session's section. |
| `agent list` | Print the bulletin of currently-fresh sections (stale-filtered). Also self-heartbeats the caller's section. |
| `agent prune` | Remove every section whose `Last updated` is older than `agents.stale_ttl_minutes`. |

### `agent register`

```bash
indusk agent register --task "auth refactor" [--branch feat/auth] [--worktree ./worktrees/auth]
```

| Flag | Purpose | Default |
|------|---------|---------|
| `--task <description>` | One-line description of what this session is working on. Appears in the section heading. | _required_ |
| `--branch <branch>` | Override detected git branch. | Detected via `git rev-parse --abbrev-ref HEAD`. |
| `--worktree <path>` | Override the recorded worktree path. | `process.cwd()` |

Reads `.indusk/current.md`, calls `upsertSection` with the agent's section, writes back atomically (tmp + rename). If a section for the session already exists, the existing in-flight / open-questions / cursor bodies are preserved — only the `Last updated` timestamp and task change. Use the [MCP tool](/reference/tools/indusk-mcp#agent-tools) to update those bodies.

The session ID comes from `$CLAUDE_CODE_SESSION_ID` (UUID v4 exposed by Claude Code SDK 0.3.187+, inherited by every subprocess). When unset, falls back to `pid-<process.pid>`.

### `agent done`

```bash
indusk agent done [--session-id <id>]
```

| Flag | Purpose | Default |
|------|---------|---------|
| `--session-id <id>` | Mark a specific session done instead of the current one. | Current session. |

Calls `removeSection`. Silent no-op when no matching section exists: prints `Agent <id> already done (no section in current.md).`

### `agent list`

```bash
indusk agent list
```

Reads `.indusk/current.md`, partitions sections by `Last updated` vs `agents.stale_ttl_minutes` (default 60), prints the fresh partition as a compact table:

```
SESSION   TASK             WORKTREE  BRANCH            LAST UPDATED
--------  ---------------  --------  ----------------  -------------------
2c87e7b6  auth refactor    repo      plan/auth-phase-1 2026-06-26 21:43:50
f0a99b21  telemetry spike  wtb       plan/telemetry    2026-06-26 22:01:15
```

The `WORKTREE` column shows the basename of the session's git worktree toplevel (`—` when the cwd is not a git repo); `BRANCH` shows the current branch. When the file is empty or every entry is stale, prints `(no agents currently registered)`.

**Worktree/branch are recomputed live.** `register` seeds a session's worktree + branch from its cwd, but the `list` self-heartbeat **recomputes** them from the caller's current cwd each time — so the board reflects where an agent is *now*, not where it registered. An agent that moves from the trunk into a worktree mid-session shows its new worktree/branch on the next `list`.

**Same-tree collision flag.** When two or more fresh sessions resolve to the same worktree toplevel — the real case being two agents both editing the shared trunk — `list` prints a warning to stderr before the table:

```
⚠ collision: 2 sessions share worktree /path/to/repo (2c87e7b6, f0a99b21)
```

Sessions in separate worktrees do not collide. Non-git cwds (no resolvable worktree) are excluded from the check. The flag is visibility, not enforcement — it surfaces the collision class that worktree-per-plan is designed to prevent.

**Self-heartbeat**: before printing the table, `list` refreshes the calling session's own section's `Last updated` (if a section exists for the caller) — and, as above, its worktree/branch. The act of asking who's around implicitly says "I am still here." Long-running sessions that periodically run `/catchup` (which calls `list`) stay visible indefinitely without manual TTL tuning. Sessions that go truly idle (no `agent` CLI activity for > TTL) age out.

### `agent prune`

```bash
indusk agent prune
```

Removes every section whose `Last updated` is older than `agents.stale_ttl_minutes`. Prints `Pruned N stale section(s).` (or `No stale sections to prune.`).

## Configuration

The stale TTL is controlled by `agents.stale_ttl_minutes` in `.indusk/config.json`:

```json
{
  "agents": {
    "stale_ttl_minutes": 60
  }
}
```

If the field is absent, the CLI defaults to 60 minutes.

## Path safety

Every session ID flows through `sanitizeSessionId()` in `apps/indusk-mcp/src/lib/agents/session.ts` before it reaches any file write or section mutation:

- Rejects `..`, `/`, `\` anywhere in the id (path-segment escape)
- Rejects leading `.` (hidden-file shenanigans)
- Rejects empty / whitespace-only ids
- Rejects ids longer than 128 characters

Reject means the CLI exits non-zero with `Error: Invalid session id: ... (rejected by sanitizer)`. A poisoned `$CLAUDE_CODE_SESSION_ID` cannot cause `agent register` to write outside the section's scope inside `.indusk/current.md`; `--session-id ../whatever` cannot cause `agent done` to delete anything.

## Section shape

Each section inside `.indusk/current.md` looks like:

```markdown
## Session 2c87e7b6 — auth refactor

**Session ID**: 2c87e7b6-702a-4dcd-876f-a31820e0df3e
**Last updated**: 2026-06-26T21:43:50.123Z
**Branch**: plan/auth-phase-1
**Worktree**: /Users/dev/code/myproject-workbench/repo

### In Flight

working on middleware refactor

### Open Questions

jwt vs session cookies?

### Cursor

apps/backend/src/auth/middleware.ts:42
```

The heading carries the short 8-char session ID for human legibility; the `**Session ID**:` line carries the full UUID and drives unambiguous matching. The `**Branch**:` / `**Worktree**:` lines are optional — emitted only when the session's cwd resolves inside a git repo, and omitted (round-tripping to empty) otherwise. The three `### Subsection` bodies hold the operational state — agents write these via [`mcp__indusk__update_current_section`](/reference/tools/indusk-mcp#agent-tools).

## Concurrency

CLI subprocesses on the same workbench can race on the write step; the atomic tmp + rename pattern means readers never see a half-written file. Cross-branch concurrent edits — two real Claude Code sessions in two worktrees on two branches — are handled by git: different sections in `current.md` produce no merge conflict because they touch different lines.

See the [multi-agent coordination ADR](/decisions/multi-agent-coordination) for the full rationale, including the rejected alternatives.
