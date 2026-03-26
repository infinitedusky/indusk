---
name: handoff
description: Write a handoff file before ending a session. Captures what was worked on, where it stopped, what's next, and any warnings for the next agent.
---

You are ending a session or handing off to another agent. Write a handoff file so the next session can pick up exactly where you left off.

## What to Write

Create or overwrite `.claude/handoff.md` with:

```markdown
# Handoff

**Date:** {YYYY-MM-DD}
**Session:** {brief description of what this session focused on}

## What Was Being Worked On
{Plan name, phase, specific checklist item. Be precise — "Phase 3 of extension-system, item 4: refactor check_health" not "working on extensions."}

## Where It Stopped
{Last thing completed. First thing that needs doing next. If mid-item, explain exactly where.}

## What's Next
{The immediate next step. Then the next 2-3 steps after that. This is the pickup point for /catchup.}

## Open Issues
{Anything broken, failing, or weird. Tests that don't pass. Errors being investigated. Things that worked before but don't now.}

## Decisions Made This Session
{Any decisions that aren't captured in CLAUDE.md or an ADR yet. These need to be formalized — they're here so they don't get lost between sessions.}

## Watch Out For
{Gotchas the next agent should know. "The FalkorDB graph needs reindexing." "The hooks aren't published yet — version 1.0.3 has them." "Don't touch init.ts until the extension system PR is merged."}

## Catchup Status
- [ ] handoff
- [ ] lessons
- [ ] skills
- [ ] health
- [ ] context
- [ ] plans
- [ ] extensions
- [ ] graph
```

## When to Write a Handoff

- Before ending any session where work was done
- When the user says "let's stop here", "wrap up", "hand off"
- When you're about to run out of context
- `/handoff` explicitly

## Rules

- **Be specific.** "Working on Phase 3" is useless. "Phase 3, item 4: refactored check_health to use extensions. extensions_status MCP tool created. Next: refactor init to remove hardcoded FalkorDB/CGC." is useful.
- **Include the ugly parts.** If something is broken, say so. The next agent needs to know.
- **Decisions that aren't saved anywhere else MUST go here.** They'll be lost otherwise.
- **Overwrite the previous handoff.** There's only one — the most recent session's. Old handoffs are consumed by /catchup and don't need to persist.
- **Keep it short.** This isn't a retrospective. It's a sticky note for the next person.
- **Always include the Catchup Status section** with all boxes unchecked. This is enforced by a hook — the next session cannot edit or write code until `/catchup` checks off every box. Each step in catchup marks its box when completed.
