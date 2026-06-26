# Multi-Agent Coordination — Manual Smoke Procedure

**Plans:** `.indusk/planning/handoff-multi-agent/` (original) + `.indusk/planning/handoff-multi-agent-section-shape/` (final shape).
**Status:** Pending Sandy's first run after 1.29.0 publishes.

> **Note (2026-06-26):** the original parent plan shipped `.indusk/current.md` with fixed `In Flight / Open Questions / Cursor` sections + separate `.indusk/agents/<sessionId>.md` presence files. The section-shape rework replaced that with per-agent sections inside one `current.md` (each session owns a `## Session <short> — <task>` block; presence is the block's freshness). The CLI shape (`agent register/done/list/prune`) is unchanged from the user's perspective; behavior under the hood operates on sections. Update procedure steps below if you run this against an install that still has the old shape — `indusk update` SHA-detects the empty old template and migrates.

## Purpose

T10 asserts: *Two agents in different worktrees on the same workbench can each edit their own branches without their changes appearing in each other's working trees mid-session.*

This is a manual smoke because the only honest test is two real Claude Code sessions running in parallel on a real workbench. The vitest e2e at `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts` exercises the CLI-level concurrency by faking two sessions via `CLAUDE_CODE_SESSION_ID` env var; this procedure covers the human-in-the-loop case where the agents are reasoning about each other's presence and reading each other's `current.md` edits via git.

## Prerequisites

- Worktree extension enabled on a test workbench (`indusk extensions enable worktree`).
- indusk-mcp ≥ 1.29 published or installed locally — verify `indusk agent list` is available.
- `.indusk/config.json` carries `agents.stale_ttl_minutes` (default 60). For this smoke, optionally override to `2` so the stale-TTL step finishes quickly.
- Two Claude Code session windows available — same machine, different desktops/windows.

## Procedure

### Setup (one-time)

```bash
cd <test-workbench-root>
indusk worktree create smoke-A
indusk worktree create smoke-B
```

Open two Claude Code sessions:
- **Session 1** in `<workbench>/smoke-A/`
- **Session 2** in `<workbench>/smoke-B/`

In each session, run `/catchup`. Note:
- Each catchup output should name its own session under "Registered as ...".
- Each catchup output should surface the other agent under "Other agents currently working".
- Neither catchup should hang or block.

### Step 1 — Mid-session edits don't leak

In **Session 1** (smoke-A): pick an arbitrary file under `apps/<some app>/` and modify it. Save. **Do NOT commit yet.**

In **Session 2** (smoke-B): run `git status` in the worktree. **Expected:** clean. The edit must not be visible.

In **Session 1**: `git add -p && git commit -m "smoke: WIP edit"`.

In **Session 2**: `git status` again. **Expected:** still clean. Commits on the other branch are not visible until pulled.

### Step 2 — Bulletin visibility

In either session: `indusk agent list`. **Expected:** both agents present with their distinct task descriptions and branches.

### Step 3 — Clean exit

In **Session 1**: `indusk agent done`.

In **Session 2**: `indusk agent list` immediately. **Expected:** only Session 2 shown. Should appear within a few seconds (no caching).

### Step 4 — Stale TTL behavior

Re-register Session 1: `indusk agent register --task "stale test"`.

Crash Session 1 by force-quitting the Claude Code app (or `kill -9 $CLAUDE_PID`).

In **Session 2**: `indusk agent list`. **Expected:** Session 1 still shown (it didn't get a chance to call `agent done`).

Wait `agents.stale_ttl_minutes` minutes (for the smoke, override the config to `2`).

In **Session 2**: `indusk agent list` again. **Expected:** Session 1 no longer shown — TTL filter dropped it.

Optionally: `indusk agent prune` to remove the stale file from disk; verify with `ls <workbench>/.indusk/agents/`.

### Step 5 — `current.md` commit visibility

In **Session 2** (since Session 1 is dead): edit `<workbench>/.indusk/current.md`'s `## In Flight` section to record something distinctive (e.g., "smoke test run 2026-MM-DD"). Save. **Do NOT commit yet.**

Open **Session 3** in `<workbench>/smoke-A/` (Session 1 is gone). Run `/catchup`. **Expected:** the distinctive text from Session 2's `current.md` edit is NOT in the catchup output — `current.md` is committed-state-only.

In **Session 2**: `git add .indusk/current.md && git commit -m "smoke: current.md update"`. From **Session 3**'s worktree: `git pull` (or refresh whichever way the worktree's branch tracks).

Open **Session 4** in `<workbench>/smoke-A/` (fresh). Run `/catchup`. **Expected:** the distinctive text appears in the catchup summary's "Operational state" section.

## Pass criteria

- Mid-session uncommitted edits in one worktree never appear in the other.
- Bulletin reflects both agents during steady state; clean exit removes self from bulletin within ~5s on the other agent's view.
- Stale TTL hides crashed agents at the configured threshold.
- `current.md` changes propagate via commit + pull, not via uncommitted edits.

## Pass log

| Date | Operator | Result | Notes |
|------|----------|--------|-------|
| TBD  | Sandy    | TBD    | First T10 attempt after 1.29 publish |
