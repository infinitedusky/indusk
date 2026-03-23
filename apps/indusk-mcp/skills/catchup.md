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

**After reading, edit the handoff to check off:** `- [x] handoff`

If no handoff exists, create one with all catchup status boxes unchecked, then check off handoff.

### 2. Read Lessons
Call `list_lessons`. Read every lesson. These are rules learned from past mistakes — not suggestions. Internalize them before touching any code.

**After reading, edit the handoff to check off:** `- [x] lessons`

### 3. Check Infrastructure
Call `check_health`. Verify FalkorDB and CGC are running. If unhealthy, tell the user what's down and how to fix it.

**After checking, edit the handoff to check off:** `- [x] health`

### 4. Read Project Context
Call `get_context` to read CLAUDE.md. This contains:
- **Architecture** — what the project is, how it's structured
- **Conventions** — rules to follow (commit style, no DB from Next.js, no fallback URLs, etc.)
- **Key Decisions** — ADRs that have been accepted (with links)
- **Known Gotchas** — things that will bite you if you don't know about them
- **Current State** — what's been built, what's working, what's in progress

Read it fully. Don't skim.

**After reading, edit the handoff to check off:** `- [x] context`

### 5. Check Active Plans
Call `list_plans`. This shows every plan and its status. Pay attention to:
- Plans with status `in-progress` — these are actively being worked on
- The current phase of each active plan — this is where `/work` will pick up
- Dependencies between plans — don't start a blocked plan

**After checking, edit the handoff to check off:** `- [x] plans`

### 6. Review Skills and Extensions
Call `extensions_status` to see what extensions are enabled and their capabilities.

Then read all installed skill files in `.claude/skills/*/SKILL.md`. These define your workflows:
- **Process skills** (plan, work, verify, context, document, retrospective) — how you build things
- **Domain skills** (typescript, nextjs, etc.) — technology-specific best practices
- **Extension skills** (cgc, composable-env, etc.) — tool integrations and when to use them
- **Utility skills** (catchup, handoff, toolbelt) — operational skills

Understand what each skill does and when to use it. You should be able to answer: "What slash commands are available and what do they do?"

**After reviewing, edit the handoff to check off:** `- [x] skills` and `- [x] extensions`

### 7. Check Code Graph
Call `graph_ensure` to validate the entire code graph stack: FalkorDB container, CGC connection, repo indexing. This tool auto-repairs common issues (starts stopped containers, detects the right host). If it reports errors it couldn't fix, tell the user what's wrong and how to fix it. If the repo isn't indexed, call `index_project`.

**After checking, edit the handoff to check off:** `- [x] graph`

### 8. Summarize

After completing all steps, present a brief summary to the user:

```
**Caught up.**
- Handoff: [summary of last session's work, or "none"]
- Lessons: N loaded
- Infrastructure: [healthy / issues]
- Skills: N installed [list names]
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
