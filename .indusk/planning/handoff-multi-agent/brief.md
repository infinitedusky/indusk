---
title: Multi-Agent Coordination — Brief
date: 2026-05-25
status: brief draft
audience: indusk-mcp maintainers + Sandy
---

# Multi-Agent Coordination — Brief

## Why

Today's `/handoff` and `/catchup` skills assume one agent per project. With two concurrent Claude Code sessions on the same project, Sandy hit two failure modes (2026-05-25):

1. **Catchup-write blocks the other agent.** `/catchup` mutates `.claude/handoff.md` (checkbox state machine). While one agent is mid-catchup, the other agent's gate hook sees a partially-checked handoff and either freezes or behaves inconsistently.

2. **Handoff overwrites the other agent's handoff.** `/handoff` writes to a single shared `.claude/handoff.md`. If Sandy hands off from session A and then later from session B, B's handoff destroys A's. The skill literally documents this: "Overwrite the previous handoff. There's only one."

No mechanism today gives Sandy visibility into what each agent is doing at any moment.

## The shape we're committing to

Two structural changes that compose. Each is small individually; the value comes from combining them.

### 1. Worktrees per agent (hard dependency on F1)

Each Claude Code session works in its own `git worktree`, on its own branch, at its own filesystem path. No file-collision possible because no two agents share a working tree. This is the existing F1 plan ([indusk-worktree-extension](../indusk-worktree-extension/brief.md)). Multi-agent coordination is a hard dependency on F1 — landing this brief's work without worktrees would leave the file-collision problem unsolved.

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

## Open questions

1. **Location of `current.md`.** Three candidates:
   - Project root (most discoverable, lives next to CLAUDE.md)
   - `.indusk/current.md` (matches other indusk state)
   - A new `## Current Session State` section in CLAUDE.md (reuses the context skill's existing triggers; no new file)
   
   I lean toward a CLAUDE.md section, because the context skill already maintains CLAUDE.md on real triggers and the "what's happening now" + "what is this project" boundary is fuzzier than it sounds. If it grows past a single section, split out later.

2. **Session ID source.** Claude Code's `CLAUDE_SESSION_ID` (or equivalent) needs to be confirmed stable enough to use as a filename suffix across the session's lifetime. Fallback: PID at start.

3. **Stale presence files.** If an agent crashes without running `indusk agent done`, the file lingers. Mitigations:
   - TTL via mtime — `indusk agent list` ignores files older than N hours
   - Explicit `indusk agent prune` CLI
   - Accept the cost; rare in practice
   
   I lean toward TTL (1 hour default).

4. **CLAUDE.md vs current.md if they're separate files.** CLAUDE.md is durable project memory. `current.md` is "what's happening now." If they're separate, are they actually different? Or is `current.md` just the operational layer that gets distilled into CLAUDE.md on a slower cadence by `/retrospective`? The latter feels right — but it makes the case for "just use a CLAUDE.md section" stronger.

## Out of scope

- **Cross-machine coordination** (Sandy laptop + Sandy desktop). Worktrees + `git push/pull` handle the durable layer; presence bulletins are local-only unless we add a push step. v1 is single-machine.
- **Inter-agent messaging.** Bulletins are read-only signals, not chat. If agents need to coordinate beyond visibility, that's a separate plan.
- **jj substrate**. Sandy is moving toward deprecating jj. This brief is git-only — no event-log substrate, no change-ID tracking, no `jj describe` triggers. If jj users remain, they'll get the same behavior via the SCM abstraction layer (`apps/indusk-mcp/src/lib/scm/`).

## Effort

~1 day, contingent on F1 (worktree extension) being either landed or ready to land concurrently. The CLI surface is small, the skill updates are surgical, the design is settled.
