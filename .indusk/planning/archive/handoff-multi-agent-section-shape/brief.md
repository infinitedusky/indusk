---
title: "handoff-multi-agent section shape — Brief"
date: 2026-06-26
status: accepted
audience: indusk-mcp maintainers + Sandy
supersedes_in_part: .indusk/planning/handoff-multi-agent/
---

# handoff-multi-agent section shape — Brief

## Problem

The shape we shipped in `handoff-multi-agent` doesn't match Sandy's actual mental model and produces a write-side gap.

Two specific failures:

1. **`current.md` has no write surface.** The doc/guide oversold "working agents edit it continuously" as if that were automatic. Today nothing prompts the agent to update `current.md` — no MCP tool, no skill instruction, no hook. The default trajectory is "the file stays at the empty template forever." Surfaced in conversation 2026-06-26.

2. **The split between `current.md` and `.indusk/agents/` is the wrong factoring.** Sandy's model: a single file represents the context for the entire project. Each agent owns a section. `/handoff` overwrites the agent's own section (identified by session ID). `/catchup` reads every section. There's no separate presence directory because presence IS your section being fresh. What we shipped factored presence into `.indusk/agents/{sessionId}.md` and state into `current.md` — two surfaces where Sandy wanted one.

The original ADR's Goal — "concurrent Claude Code sessions on one project no longer collide" — is still right. The mechanism for it (per-agent sections in one file, identified by session ID, git-mediated merge) is also still right. We shipped a structurally race-free design; we shipped the wrong shape.

The work this rewrite supersedes is recent (today) and unpublished (branch `plan/handoff-multi-agent-phase-1`, not in npm). The world hasn't seen the wrong shape yet — fix it before 1.29.0 publishes.

## Proposed Direction

**One file. Per-agent sections. The agent owns its section.**

`.indusk/current.md` becomes:

```markdown
# Operational State

## Project (shared)
_Anyone can edit. Cross-cutting state that doesn't belong to a single session._

(empty)

---

## Session 2c87e7b6 — auth refactor
**Last updated**: 2026-06-26T14:30:00Z

### In Flight
- working on auth middleware refactor in apps/backend/src/auth/
- blocked on: deciding whether to use jwt or session cookies

### Open Questions
- should we kill the old refresh-token endpoint?

### Cursor
- apps/backend/src/auth/middleware.ts:42

---

## Session f0a99b21 — telemetry spike
**Last updated**: 2026-06-26T11:30:00Z

### In Flight
- ...
```

The shape rules:

- **Section heading carries `Session <short-id> — <task>`.** The session ID prefix lets the agent find its own section deterministically. The short ID (first 8 chars) is human-readable; full UUID lives in a `**Session ID**:` line inside the section if we need it for unambiguous matching.
- **Per-agent ownership.** When `/handoff` runs, it finds the section whose `Session <short-id>` matches the current `$CLAUDE_CODE_SESSION_ID`. If found, it overwrites that section. If not found, it appends a new one.
- **`Project (shared)`** is a special anchor section at the top. Nobody owns it; any agent can edit it. Used for cross-cutting state that isn't tied to a single session ("project is in pre-launch crunch", "telemetry endpoint changed last week").
- **Aging.** Sections older than `agents.stale_ttl_minutes` are not deleted by reads. `indusk agent prune` (renamed/repurposed) removes them. `/catchup` filters them from the visible bulletin but doesn't touch the file.
- **Catchup is still pure-read.** It reads `current.md` and surfaces a summary. It does not register or write anywhere — registration happens via `/handoff` writing the agent's section the first time work meaningfully accumulates.

### What changes vs what stays

**Changes:**
- `current.md` template (fixed sections → per-agent sections).
- `/handoff` skill (deprecation page → real four-step ritual with section-overwrite as step 1).
- `/catchup` skill (read fixed sections + glob agents/ → read sections in `current.md` and present them as the bulletin).
- ADR: alternatives section needs to acknowledge per-agent sections as the chosen option, and the `current.md`/`agents/` split as the rejected version.
- New MCP tool `update_current_section` (or equivalent) — the explicit write surface I shipped without.
- Docs: multi-agent guide, ADR publish, changelog entry.

**Stays (most of the work I just did):**
- `apps/indusk-mcp/src/lib/agents/{session,paths,types}.ts` — session ID resolution, path safety, types.
- `sanitizeSessionId` and all the Phase 6 path-traversal hardening.
- The `indusk agent` CLI — repurposed: `register` becomes a thin wrapper over the new MCP write, `done` removes the agent's section, `list` shows fresh sections in `current.md`, `prune` removes stale ones. The CLI surface stays the same; the storage shape under it changes.
- `init`/`update` scaffolding for `current.md` from template + `agents.stale_ttl_minutes` config default. The template content changes; the scaffolding mechanism stays.
- Gitignore for `.indusk/agents/` — kept as a precaution even if the directory is mostly unused, in case some interim version writes there.
- Worktree extension, doppler extension, everything else.

### Concurrency story

Same as the original ADR: git mediates. Two agents in different worktrees both edit `current.md` on their own branches. They merge to main. Different sections → no merge conflict (different lines). Same section → real merge conflict (rare; only happens if two agents share a session ID, which they shouldn't). No in-process locking, no distributed primitives, no state machine. Atomic file-create/delete is no longer relevant because we're back to file-edit-and-merge.

## Context

- The parent plan `.indusk/planning/handoff-multi-agent/` is impl-complete (status: `completed`) but not retrospected. Branch `plan/handoff-multi-agent-phase-1` is local-only, 1.29.0 not yet published.
- Sandy's conversation 2026-06-26 surfaced both (a) the write-side gap and (b) the per-agent-sections model. This brief is the codification of that conversation.
- This plan does NOT supersede the parent plan's other deliverables — session ID resolution, path-safety sanitization, the heartbeat-via-list pattern, init/update scaffolding, the `indusk agent` CLI surface, the gitignore entry. Those all stay.
- This plan DOES supersede:
  - `current.md` template shape
  - `/catchup` skill (the operational-state read step)
  - `/handoff` skill (currently deprecation page; becomes a real ritual)
  - The ADR's rejected-alternatives section (one of the rejections was wrong)

## Scope

### In Scope

- Rewrite `apps/indusk-mcp/templates/current.md` to the per-agent-section shape with `Project (shared)` anchor.
- Rewrite `apps/indusk-mcp/skills/catchup.md` to read sections from `current.md` instead of fixed sections + presence directory. Stay pure-read for shared content; the bulletin is now derived from section headings in `current.md`.
- Rewrite `apps/indusk-mcp/skills/handoff.md` from deprecation pointer back to a real session-end ritual: identify own section by session ID, overwrite with In Flight / Open Questions / Cursor, commit, fire eval-trigger.
- New MCP tool to write/overwrite the agent's section in `current.md` programmatically — exposed at `mcp__indusk__update_current_section` (or similar). Takes `{ sessionId, task, sections: { in_flight, open_questions, cursor } }` and rewrites the section atomically (read-modify-write the file).
- Repurpose `indusk agent` CLI: `register` becomes "ensure a section exists for this session" (essentially a write with empty content), `done` removes the section, `list` reads section headings + freshness, `prune` removes sections older than TTL.
- Update the parent plan's ADR's `Alternatives Considered` and `Decision` sections to reflect the actual chosen shape. Add a note that the per-agent-sections shape replaces the original `current.md` + `.indusk/agents/` split.
- Update CLAUDE.md Conventions + Architecture + Current State entries that reference the old shape.
- Update docs: `apps/docs/src/guide/multi-agent.md`, `apps/docs/src/reference/cli/agent.md`, `apps/docs/src/reference/skills/{catchup,handoff}.md`, `apps/docs/src/decisions/multi-agent-coordination.md`, `apps/docs/src/changelog.md`.
- Update tests: `multi-agent-cli.test.ts`, `multi-agent-skills.test.ts`, `multi-agent-init.test.ts`, `multi-agent-e2e.test.ts` to assert the new shape.
- Add new tests for the section-overwrite invariant (handoff only touches the calling agent's section).

### Out of Scope

- Cross-machine coordination (still v2; same reason as parent plan).
- Per-section ACLs or signed sections (overkill for single-machine, low-trust environment).
- Auto-prompting the agent to update its section mid-session (a separate piece of skill work; this plan ships the write surface, not the trigger discipline). May surface as a small follow-up if dogfood shows the trigger gap bites.
- The forced-reflection prompt at session end (Sandy can choose to bake checklist questions into `/handoff` later; first version is "agent fills out free-form what's in flight / open questions / cursor").

## Success Criteria

- A single `.indusk/current.md` file represents the operational state for the whole project, with per-agent sections.
- `/handoff` finds the agent's section by session ID and overwrites only that section; other agents' sections survive untouched.
- `/catchup` produces the same bulletin output the original plan delivered ("here are the other agents working on this project"), now derived from `current.md` section headings rather than a separate directory.
- Two concurrent `/handoff` invocations from agents in different worktrees both succeed: each on its own branch, merging to main produces no conflict because each touched a different section.
- The handoff write surface exists as an explicit MCP tool — the working agent has a clear API to call, not a "remember to edit a file" instruction.
- The parent plan's ADR is updated to reflect the actual shape; the changelog calls out the change so no one in the future thinks the original shape ever shipped.

## Depends On

- `.indusk/planning/handoff-multi-agent/` (impl complete; this plan reshapes parts of it).
- F1 (worktree extension) — substrate; already shipped.

## Blocks

- 1.29.0 publish of indusk-mcp. We hold the publish until this plan ships, so the world never sees the wrong shape.

## Resolved Decisions

Resolved 2026-06-26 in conversation with Sandy:

1. **Section heading format**: `## Session <short-8> — <task>` with the full UUID stored as a `**Session ID**: <uuid>` line inside the section body. Heading reads cleanly for humans; full ID matching is unambiguous.
2. **`.indusk/agents/` directory removed entirely.** Sections in `current.md` are the single source of truth. The CLI (`register`/`done`/`list`/`prune`) is repurposed to read/write sections in `current.md`. Gitignore entry for `.indusk/agents/` stays as a precaution in case some interim version writes there.
3. **Write surface is an MCP tool**: `mcp__indusk__update_current_section` takes `{ sessionId, task, sections: { in_flight, open_questions, cursor } }` and atomically rewrites the agent's section. Discoverable alongside other indusk MCP tools; structured, not free-form file edits.
4. **Branch strategy**: new branch `plan/handoff-multi-agent-section-shape` off `plan/handoff-multi-agent-phase-1`. Keeps the rework diff cleanly separable from the original phase work.

## Notes

- This is a refactor in the InDusk lifecycle sense (brief + test-plan + impl, no separate ADR — the parent ADR gets edited in place).
