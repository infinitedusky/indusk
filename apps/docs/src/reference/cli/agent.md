# `indusk agent` — multi-agent presence bulletin

The `agent` subcommand group manages a per-session presence bulletin so that two or more Claude Code sessions running on the same InDusk project can see each other.

It is the runtime surface introduced by the [`handoff-multi-agent` plan](../../decisions/multi-agent-coordination.md) (shipped in indusk-mcp 1.29+). Each session writes one small file on `register`, deletes it on `done`, and `list` glob-reads the directory. There is no shared mutation surface across agents.

## Subcommands

| Command | Purpose |
|---------|---------|
| `agent register --task "<what>"` | Write the current session's presence file. |
| `agent done` | Remove the current session's presence file. |
| `agent list` | Print the bulletin of currently-registered agents (stale-filtered). |
| `agent prune` | Remove every stale presence file unconditionally. |

### `agent register`

```bash
indusk agent register --task "auth refactor" [--branch feat/auth] [--worktree ./worktrees/auth]
```

| Flag | Purpose | Default |
|------|---------|---------|
| `--task <description>` | One-line description of what this agent is working on. | _required_ |
| `--branch <branch>` | Override detected git branch. | Detected via `git rev-parse --abbrev-ref HEAD`. |
| `--worktree <path>` | Override the recorded worktree path. | `process.cwd()` |

Writes `<projectRoot>/.indusk/agents/<sessionId>.md` with YAML frontmatter (`sessionId`, `task`, `branch`, `worktree`, `startedAt`) and a small human-readable body.

The session ID comes from `$CLAUDE_CODE_SESSION_ID` (a UUID exposed by Claude Code SDK 0.3.187+, inherited by every subprocess). When the env var is unset, falls back to `pid-<process.pid>`. See the [session ID gotcha in CLAUDE.md](../../../../../CLAUDE.md) for the rationale.

### `agent done`

```bash
indusk agent done [--session-id <id>]
```

| Flag | Purpose | Default |
|------|---------|---------|
| `--session-id <id>` | Mark a specific session done instead of the current one. | Current session (`getSessionId()`). |

Silent no-op when the file is already gone. Prints `Agent <id> already done (no presence file).` in that case.

### `agent list`

```bash
indusk agent list
```

Reads every `*.md` file under `<projectRoot>/.indusk/agents/`, filters out any whose mtime is older than `agents.stale_ttl_minutes` from `.indusk/config.json` (default `60`), and prints a compact table:

```
SESSION   TASK            BRANCH    STARTED
--------  --------------  --------  -------------------
2c87e7b6  auth refactor   feat/auth 2026-06-25 21:43:50
f0a99b21  telemetry spike main      2026-06-25 22:01:15
```

When the directory is empty (or every entry is stale), prints `(no agents currently registered)`.

### `agent prune`

```bash
indusk agent prune
```

Removes every presence file whose mtime is older than `agents.stale_ttl_minutes`. Prints `Pruned N stale presence file(s).` (or `No stale presence files to prune.`).

## Heartbeat

`indusk agent list` is also an **implicit heartbeat** for the caller — before the staleness filter runs, the caller's own presence file mtime is refreshed via `utimesSync`. The act of asking "who's around" implicitly says "I am still here."

In practice this means:

- A long-running session that runs `/catchup` or `indusk agent list` periodically stays visible indefinitely — no manual TTL tuning, no explicit heartbeat subcommand.
- Only sessions that go truly idle (no `indusk agent` CLI activity for longer than `agents.stale_ttl_minutes`) age out.
- Other agents asking "is session A still around?" cannot observe their own staleness — staleness is always observed from a different session's perspective. If you need to assert "session A has aged out," do it from session B.

The heartbeat is idempotent and silent — `agent list` still prints exactly what's in the bulletin; the mtime touch is a side effect only.

## Path safety

Every session ID flows through `sanitizeSessionId()` in `apps/indusk-mcp/src/lib/agents/session.ts` before it reaches any file path:

- Rejects `..`, `/`, `\` anywhere in the id (path-segment escape)
- Rejects leading `.` (hidden-file shenanigans)
- Rejects empty / whitespace-only ids
- Rejects ids longer than 128 characters (UUIDs and `pid-<N>` both fit comfortably)

Reject means: the CLI exits non-zero with `Error: Invalid session id: ... (rejected by sanitizer)`. A poisoned `$CLAUDE_CODE_SESSION_ID` cannot cause `agent register` to write outside `.indusk/agents/`, and `--session-id ../../config` cannot cause `agent done` to delete arbitrary files.

## Configuration

The stale TTL is controlled by `agents.stale_ttl_minutes` in `.indusk/config.json`:

```json
{
  "agents": {
    "stale_ttl_minutes": 60
  }
}
```

If the field is absent, the CLI defaults to 60 minutes. See the [Heartbeat](#heartbeat) section for how active sessions stay visible without manual tuning.

## File shape

Each presence file at `<projectRoot>/.indusk/agents/<sessionId>.md` looks like:

```markdown
---
sessionId: 2c87e7b6-702a-4dcd-876f-a31820e0df3e
task: auth refactor
branch: feat/auth
worktree: /Users/sandy/code/workbench/auth
startedAt: 2026-06-25T21:43:50.123Z
---

# Agent presence — 2c87e7b6-702a-4dcd-876f-a31820e0df3e

**Task:** auth refactor
**Branch:** feat/auth
**Worktree:** /Users/sandy/code/workbench/auth
**Started:** 2026-06-25T21:43:50.123Z
```

The frontmatter is the structured contract (parsed by `list`/`prune`); the body is for humans glancing at the file directly.

## Where the bulletin lives

`getAgentsDir()` resolves to `<inDuskRoot>/.indusk/agents/`, where `inDuskRoot` is the nearest ancestor directory containing `.indusk/config.json`. In single-repo projects that's the project root. In workbench-shaped projects (worktree extension enabled), that's the workbench root — the same `.indusk/agents/` directory is naturally shared across all worktrees, which is what makes the bulletin visible across concurrent agents on different branches.

## Concurrency

Each agent's `register` and `done` only ever touches its own file (named after its session ID). `list` and `prune` are read-side or remove-only. The directory listing is the only shared surface, and POSIX file create/delete is atomic — concurrent `register` calls cannot interleave their writes.

See the [multi-agent coordination ADR](../../decisions/multi-agent-coordination.md) for the full rationale, including the rejected alternatives (lock-and-snapshot state machine, in-repo bulletin committed to main, distributed locks).
