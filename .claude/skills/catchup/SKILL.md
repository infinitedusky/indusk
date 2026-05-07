---
name: catchup
description: Get caught up on the project. Reads the handoff from the last session, then context, plans, lessons, and extensions. Run at the start of every new session.
---

You are starting a new session on this project. Before doing anything else, get caught up.

## Step 0. Wait for MCP Servers (BLOCKING)

Before running any catchup steps, verify that ALL required MCP servers are available. Catchup depends on these tools and **cannot proceed without them**.

**Required MCP servers:**
- **indusk** — `get_system_version` (provides lessons, health, context, plans, extensions, graph tools)

**How to check:** Call `get_system_version`. If the tool is not available or errors, wait 5 seconds and retry. Retry up to 6 times (30 seconds total).

- If indusk becomes available: check off `- [x] mcp-ready` in the handoff, then proceed with catchup.
- If indusk is still unavailable after 30 seconds: **STOP. Do not proceed.** Tell the user: "InDusk MCP server not available — check `.mcp.json` config or restart Claude Code. Catchup cannot continue. Fix the issue and run `/catchup` again."

**This step is enforced by a hook.** The `check-catchup.js` hook verifies that FalkorDB (port 6379) and Graphiti (port 8100) are reachable before allowing `mcp-ready` to be checked off. The agent cannot bypass this.

**Do NOT skip steps. Do NOT fall back to shell commands. Do NOT proceed with partial functionality.** A half-completed catchup is worse than no catchup — it creates the illusion that the system is ready when it isn't.

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
Call `check_health`. Verify FalkorDB and Graphiti are running. If unhealthy, tell the user what's down and how to fix it.

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

### 4.5. Recall from Graphiti

CLAUDE.md is the stable, slow-changing layer of project memory. Graphiti is the fast, temporal layer — it captures decisions, corrections, and retrospective insights as they happen. Catchup pulls both layers so the agent starts the session with full context.

**Recall recent decisions and lessons:**

First, fetch the project's Graphiti group via the InDusk MCP (do NOT guess from project basename — InDusk applies sanitization rules):

```
mcp__indusk__get_project_info()
// returns { project_group: "<sanitized>", scm: ..., ... }
```

Then query Graphiti with that group plus `"shared"` for cross-project knowledge:

```
mcp__graphiti__search_nodes({
  query: "recent decisions and lessons",
  group_ids: [<project_group from get_project_info>, "shared"],
  max_nodes: 8
})
```

**Why the explicit group lookup matters**: hyphen-containing group IDs (`dawn-fde-toolkit`) hit a RediSearch syntax error and silently return empty. Omitting `group_ids` entirely also returns empty — Graphiti does NOT scan all groups by default. Both failure modes look identical to "graph empty," so always pass the sanitized `project_group` value plus `"shared"` explicitly. See the `community-graphiti-group-id-underscores` lesson for the full pattern.

**Surface contradictions:** look at the returned nodes for any whose `attributes` reference recently invalidated facts (Graphiti marks superseded facts with `invalid_at`). If a recently invalidated fact relates to an active plan or current code area, flag it to the user — those are places where assumptions changed.

**Output format:** include a "Graphiti recall" section in the catchup summary with the most relevant 3-5 nodes by name + summary. Don't dump everything — surface what's actionable.

**Graceful degradation:** If `mcp__graphiti__search_nodes` is unavailable (Graphiti container down, transport error), skip this step silently and add a note to the catchup summary: `Graphiti: unavailable (run \`indusk infra start\` to recall episodic memory)`. Catchup should not fail if Graphiti is down — the rest of the layers are still valid.

**After completing recall, edit the handoff to check off:** `- [x] graphiti` (added to the catchup status box section)

### 5. Check Active Plans
Call `list_plans`. This shows every plan and its status. Pay attention to:
- Plans with status `in-progress` — these are actively being worked on
- The current phase of each active plan — this is where `/work` will pick up
- Dependencies between plans — don't start a blocked plan

**After checking, edit the handoff to check off:** `- [x] plans`

### 6. Review Skills and Extensions
Call `extensions_status` to see what extensions are enabled and their capabilities.

Call `get_skill_summaries` to load the name, description, and type of every installed skill. This returns a compact summary — you do NOT need to read each skill file individually. The full skill content loads automatically when the user invokes a slash command.

Skill types:
- **process** — workflow skills with slash commands (planner, work, verify, context, document, retrospective)
- **extension** — tool integrations (cgc, composable-env, excalidraw, etc.)
- **domain** — technology-specific best practices (typescript, testing, etc.)

Understand what each skill does and when to use it. You should be able to answer: "What slash commands are available and what do they do?"

**After reviewing, edit the handoff to check off:** `- [x] skills` and `- [x] extensions`

### 7. Summarize

After completing all steps, present a brief summary to the user:

```
**Caught up.**
- Handoff: [summary of last session's work, or "none"]
- Lessons: N loaded
- Infrastructure: [healthy / issues]
- Skills: N installed [list names]
- Extensions: N enabled [list names]
- Active plans: [list with current phase]
- Graphiti recall: [3-5 most relevant nodes by name + summary, or "unavailable" if Graphiti is down]

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
