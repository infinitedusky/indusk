# Multi-Agent Coordination — Manual Smoke Procedure

**Plan:** `.indusk/planning/handoff-multi-agent/`
**Trajectory row:** T10 (Phase 5 unlock)
**Status:** SKELETON — fully populated in Phase 5 once Phases 1-4 land

## Purpose

T10 asserts: *Two agents in different worktrees on the same workbench can each edit their own branches without their changes appearing in each other's working trees mid-session.*

This is a manual smoke because the only honest test is two real Claude Code sessions running in parallel on a real workbench. Vitest integration tests in `multi-agent-e2e.test.ts` cover the spawn-two-subprocesses case; this procedure covers the human-in-the-loop case where the agents are reasoning about each other's presence via `indusk agent list`.

## Prerequisites

- Worktree extension enabled on a test workbench (`indusk extensions enable worktree`).
- Phases 1-4 of this plan landed and `indusk update` run against the workbench.
- Two Claude Code session windows available — laptop OK, desktop OK, both work.

## Procedure

> Filled in during Phase 5. Skeleton below.

### Setup

1. From workbench root: `indusk worktree create smoke-A` and `indusk worktree create smoke-B`.
2. Open Claude Code session #1 in `smoke-A/`. Open Claude Code session #2 in `smoke-B/`.
3. In each session: `/catchup` — record what each agent sees about the other.

### Mid-session edits don't leak

1. In session #1: edit a file under `apps/<some app>/` and save it (no commit yet).
2. In session #2: `git status` should show clean. The edit must not be visible.
3. In session #1: commit on branch.
4. In session #2: `git status` still clean. The commit must not be visible until pulled.

### Bulletin visibility

1. In session #1: confirm `indusk agent list` shows both agents with their tasks.
2. In session #2: same.
3. In session #1: end the session (close Claude Code or run `indusk agent done`).
4. In session #2: `indusk agent list` should show only session #2 within ~5s.

### Stale TTL behavior

1. Crash session #1 (force quit Claude Code without `indusk agent done`).
2. In session #2: `indusk agent list` shows session #1 as still present.
3. Wait `agents.stale_ttl_minutes` (default 60 — for smoke, override to 1 in config).
4. In session #2: `indusk agent list` no longer shows session #1.

## Pass criteria

- Mid-session edits in one worktree never appear in the other before commit + pull.
- Bulletin reflects both agents during steady state.
- Clean exit removes self from bulletin within 5s on the other agent's view.
- Stale TTL hides crashed agents at the configured threshold.

## Pass log

| Date | Operator | Result | Notes |
|------|----------|--------|-------|
| TBD  | Sandy    | TBD    | First T10 attempt after Phase 5 lands |
