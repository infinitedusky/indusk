---
name: catchup
description: Get caught up on the project. Reads the handoff from the last session, then context, plans, lessons, extensions, and code graph. Run at the start of every new session.
---

You are starting a new session on this project. Before doing anything else, get caught up.

## Steps (execute in order)

### 1. Read Handoff
Check if `.claude/handoff.md` exists. If it does, read it first — this is the most recent context from the last session. It tells you:
- What was being worked on
- Where it stopped
- What's next
- Any warnings or open issues

If the handoff exists, present a brief summary to the user: "Last session was working on X, stopped at Y. Ready to pick up there?"

If no handoff exists, skip to step 2.

### 2. Read Lessons
Call `list_lessons`. Read every lesson. These are rules learned from past mistakes — not suggestions. Internalize them before touching any code.

### 3. Check Infrastructure
Call `check_health`. Verify FalkorDB and CGC are running. If unhealthy, tell the user what's down and how to fix it.

### 4. Read Project Context
Call `get_context` to read CLAUDE.md. This contains:
- **Architecture** — what the project is, how it's structured
- **Conventions** — rules to follow (commit style, no DB from Next.js, no fallback URLs, etc.)
- **Key Decisions** — ADRs that have been accepted (with links)
- **Known Gotchas** — things that will bite you if you don't know about them
- **Current State** — what's been built, what's working, what's in progress

Read it fully. Don't skim.

### 5. Check Active Plans
Call `list_plans`. This shows every plan and its status. Pay attention to:
- Plans with status `in-progress` — these are actively being worked on
- The current phase of each active plan — this is where `/work` will pick up
- Dependencies between plans — don't start a blocked plan

### 6. Check Extensions
Call `extensions_status` to see what extensions are enabled and their capabilities. This tells you what tools are integrated and what domain knowledge is available.

### 7. Check Code Graph
Call `get_repository_stats` to understand the codebase size and structure. This gives you a sense of what's indexed and queryable. If it fails, the CGC extension may not be enabled or FalkorDB may be down — check_health will have flagged this.

### 8. Summarize

After completing all steps, present a brief summary to the user:

```
**Caught up.**
- Handoff: [summary of last session's work, or "none"]
- Lessons: N loaded
- Infrastructure: [healthy / issues]
- Extensions: N enabled [list names]
- Active plans: [list with current phase]
- Codebase: [N files indexed]

Ready to pick up. What would you like to do?
```

## When to Use

- Start of every new Claude Code session
- When the user says "get caught up", "what's going on", "where are we", "catch up"
- When context was compressed and you need to re-orient
- `/catchup` explicitly

## Important

- Do NOT skip any step. Each one prevents a class of mistake.
- Do NOT start coding before completing onboarding. The lessons and context exist because of past failures.
- If CLAUDE.md seems outdated, flag it to the user — it may need a `/context` update.
- If a plan's impl has unchecked items from a previous session, that's where `/work` picks up. Don't re-do completed work.
