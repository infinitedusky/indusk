# SUPERSEDED

**Archived 2026-06-28.** The impl shipped, but the design it implemented was reshaped mid-flight by [handoff-multi-agent-section-shape](../archive/handoff-multi-agent-section-shape/). What landed in production is the section-shape design, not what this plan's ADR describes. This plan's ADR carries a supersession banner; this note is the index-level equivalent for `master.md` readers who don't open the ADR.

## What this plan committed to

Two structural artifacts, separately addressed:

1. `.indusk/current.md` — durable operational state with **fixed `In Flight` / `Open Questions` / `Cursor` sections at the top level**, any agent can edit
2. `.indusk/agents/{session-id}.md` — **per-session presence files** in a shared bulletin directory, written on `indusk agent register`, removed on `indusk agent done`

## What actually shipped

The section-shape plan replaced both with a single artifact:

- `.indusk/current.md` containing both `## Project (shared)` (any agent can edit) AND per-agent `## Session <short> — <task>` blocks (each session owns its own block, contains its own `### In Flight` / `### Open Questions` / `### Cursor` subsections)
- `.indusk/agents/` directory dropped (gitignore line kept as a precaution)
- New MCP tool `mcp__indusk__update_current_section` as the explicit write surface
- `/handoff` un-deprecated as a real four-step session-end ritual (MCP tool call → commit → `agent done` → eval-trigger)
- `/catchup` rewritten to be pure-read of `current.md` plus self-heartbeat

See [archive/handoff-multi-agent-section-shape/retrospective.md](../archive/handoff-multi-agent-section-shape/retrospective.md) for the actual shipped design.

## What was preserved from this plan

Not all work was discarded — the section-shape spinoff inherited several pieces of substrate authored under this plan:

- **Session ID resolution** — `getSessionId()` reading `CLAUDE_CODE_SESSION_ID` with PID fallback (`apps/indusk-mcp/src/lib/agents/session.ts`)
- **Sanitizer hardening** — `sanitizeSessionId()` rejecting path traversal characters and control bytes (Phase 6 falsification fix)
- **init/update scaffolding** — `templates/current.md`, gitignore entries, `agents.stale_ttl_minutes: 60` config default
- **CLI surface** — `indusk agent register | done | list | prune` subcommands (repurposed for sections rather than separate files, but the CLI structure persisted)
- **The ADR's Y-statement framing** — context, goal, alternatives considered. The section-shape ADR built on this rather than re-deriving from scratch.

## Why archived without a separate retrospective

The section-shape retrospective comprehensively covers what shipped, why the parent plan's split was wrong, and what was learned. A retro on this plan would mostly duplicate it. Two trails serve the same purpose: this `SUPERSEDED.md` for the parent's index entry, the section-shape retro for the actual learning.

## Lessons (terse — see section-shape retro for full discussion)

1. **Design pivots mid-impl are sometimes the right move.** The parent plan was halfway shipped when Sandy surfaced the structural objection ("two files where one would do, no explicit write surface"). The right response was to pivot, not finish the wrong design. The section-shape plan landed before 1.29.0 published, so users never saw the parent plan's shape.
2. **Plans that ship substrate but get reshaped at the top level should be archived, not retro'd separately.** The substrate work is preserved by the successor plan; the retrospective belongs with the successor.
3. **ADR supersession banners + index-level archive notes** are the right tool for tracking parent-supersedes-child relationships. A reader hitting either surface gets the full picture.
