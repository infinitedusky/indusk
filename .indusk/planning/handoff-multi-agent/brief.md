---
title: Multi-Agent Coordination — Brief
date: 2026-05-25
last_updated: 2026-06-25
status: accepted
audience: indusk-mcp maintainers + Sandy
---

> **Status update (2026-06-25):** Sandy re-derived the same problem and direction in a fresh session. Two material updates landed below: (1) F1 worktree extension is no longer a pending dependency — Phases 2-7 shipped 2026-05-28 → 2026-05-30. (2) jj deprecation is now active, not just "moving toward." The four open questions at the bottom still need answers before acceptance.

# Multi-Agent Coordination — Brief

## Why

Today's `/handoff` and `/catchup` skills assume one agent per project. With two concurrent Claude Code sessions on the same project, Sandy hit two failure modes (2026-05-25):

1. **Catchup-write blocks the other agent.** `/catchup` mutates `.claude/handoff.md` (checkbox state machine). While one agent is mid-catchup, the other agent's gate hook sees a partially-checked handoff and either freezes or behaves inconsistently.

2. **Handoff overwrites the other agent's handoff.** `/handoff` writes to a single shared `.claude/handoff.md`. If Sandy hands off from session A and then later from session B, B's handoff destroys A's. The skill literally documents this: "Overwrite the previous handoff. There's only one."

No mechanism today gives Sandy visibility into what each agent is doing at any moment.

## The shape we're committing to

Two structural changes that compose. Each is small individually; the value comes from combining them.

### 1. Worktrees per agent (F1 shipped — substrate ready)

Each Claude Code session works in its own `git worktree`, on its own branch, at its own filesystem path. No file-collision possible because no two agents share a working tree. F1 ([indusk-worktree-extension](../indusk-worktree-extension/brief.md)) shipped Phases 2-7 between 2026-05-28 and 2026-05-30 — extension is live, `indusk worktree create | refresh | list | preflight` CLI verified against the demo workbench, dual-workbench parity tests passing. This brief now builds *on top of* that substrate rather than waiting for it.

### 2. Shared `current.md` + per-agent presence files

**`current.md` on the main branch** is the single durable source of truth for "what is this project right now." Working agents update it via normal commits when something is durable enough to promote (same shape as how CLAUDE.md evolves today, just operational rather than architectural). Read freely by anyone. Mutated only via commit, so git's existing concurrency model resolves any race.

**`.indusk/agents/{session-id}.md`** is a small per-agent presence file. Each agent writes one on session start ("I'm working on X, branch Y, started Z"). Each deletes its own on session end. Other agents glob `.indusk/agents/` to see who's around right now.

### Lifecycle in concrete terms

| Event | Today | New |
|---|---|---|
| Session start | `/catchup` reads + mutates `.claude/handoff.md` | `/catchup` reads `current.md` + lists `.indusk/agents/` (pure read). Writes `.indusk/agents/{session-id}.md` recording presence. |
| During work | (nothing structural — handoff is end-only) | Working agent edits `current.md` in-place when something durable solidifies. Commits like any other file. |
| Session end | `/handoff` overwrites `.claude/handoff.md` + fires eval-trigger | `/handoff` deprecated. Closing a session deletes `.indusk/agents/{session-id}.md`. (Eval-trigger still fires on commits.) |
| Concurrent agent appears | Frozen by gate, or overwrites | Reads `current.md` + sees other agents' presence files. Picks a branch, starts a worktree, registers own presence. |

## What changes in indusk-mcp

- **New CLI** at `apps/indusk-mcp/src/bin/commands/agent.ts`:
  - `indusk agent register --task "<what>"` — writes `.indusk/agents/{id}.md`
  - `indusk agent done` — removes the current session's file
  - `indusk agent list` — prints the bulletin board (used by `/catchup` too)
- **Skill updates** at `apps/indusk-mcp/skills/`:
  - `catchup.md` — strip checkbox-mutation language; become pure read
  - `handoff.md` — either deprecate entirely or rewrite as "commit your `current.md` changes + run `indusk agent done`"
- **File-convention scaffold** in `indusk init` and `indusk update`:
  - Create `.indusk/agents/` directory (gitignored)
  - Create `current.md` placeholder (location TBD — see open questions)

## Resolved Decisions

Resolved 2026-06-25 in conversation with Sandy.

1. **`current.md` lives at `.indusk/current.md`.** Distinct file, separate from CLAUDE.md. Operational state belongs alongside other `.indusk/` state, not in the project root and not inside the durable architectural memory file.

2. **Session ID source: `$CLAUDE_SESSION_ID` env var, fallback to start-time PID.** Verify the env var name during impl Phase 1 spike; if Claude Code exposes it under a different name or doesn't expose it at all, document the actual mechanism and fall back to PID. Stable enough for filenames across the session's lifetime in either case.

3. **Stale presence files: TTL via mtime, 1 hour default.** `indusk agent list` ignores files with mtime older than the TTL. TTL configurable via `.indusk/config.json` (`agents.stale_ttl_minutes`, default 60). Self-healing; no explicit prune required, though an `indusk agent prune` CLI for the impatient is cheap to add.

4. **CLAUDE.md ↔ current.md relationship.** `current.md` is the operational layer ("what's happening NOW" — in-flight work, open threads, cursor position). CLAUDE.md is the architectural layer ("what this project IS" — architecture, conventions, key decisions). `/retrospective` is the existing cadence where operational state gets distilled into architectural memory — same mechanism as today, just with `current.md` as a richer input. No new ceremony needed.

## Out of scope

- **Cross-machine coordination** (Sandy laptop + Sandy desktop). Worktrees + `git push/pull` handle the durable layer; presence bulletins are local-only unless we add a push step. v1 is single-machine.
- **Inter-agent messaging.** Bulletins are read-only signals, not chat. If agents need to coordinate beyond visibility, that's a separate plan.
- **jj substrate**. Sandy is deprecating jj (confirmed 2026-06-25). This brief is git-only — no event-log substrate, no change-ID tracking, no `jj describe` triggers. The SCM abstraction layer (`apps/indusk-mcp/src/lib/scm/`) already covers any jj-mode projects that linger; new convention is git-native.

## Effort

~1 day. F1 worktree extension is shipped — no longer a blocker. CLI surface is small (one new `agent.ts` command with register/done/list subcommands), skill updates are surgical (catchup pure-read, handoff deprecated), design is settled pending the four open questions below.
