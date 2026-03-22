# Onboard

The onboard skill is the session-start protocol. Run it at the beginning of every new Claude Code session to get the agent caught up on the project.

## Usage

```
/onboard
```

Or say: "get caught up", "what's going on", "where are we"

## What It Does

Executes six steps in order:

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `list_lessons` | Read all lessons (community + personal) |
| 2 | `check_health` | Verify FalkorDB and CGC are running |
| 3 | `get_context` | Read CLAUDE.md — architecture, conventions, decisions, gotchas |
| 4 | `list_plans` | See all plans and their current status |
| 5 | `get_repository_stats` | Understand codebase size and what's indexed |
| 6 | Summary | Present a status summary to the user |

## Output

After completing all steps, the agent presents:

```
Session ready.
- Lessons: 12 loaded (8 community, 4 personal)
- Infrastructure: healthy
- Active plans: poker-agent-runner-2 (Phase 3), enforce-plan-gates (completed)
- Codebase: 47 files indexed

Ready to work. What would you like to do?
```

## Why Every Step Matters

- **Lessons** prevent repeating past mistakes. They're not optional.
- **Health check** catches infrastructure issues before they cause confusing errors mid-work.
- **Context** provides the full project mental model — what's built, what's decided, what to avoid.
- **Plans** show where work left off — the agent picks up where the last session stopped.
- **Code graph** confirms structural intelligence is available for dependency queries.

## When to Re-run

- After context compression (long sessions where older messages are compacted)
- When switching between different areas of the project
- When the user says the agent seems confused or has lost context
