---
name: catchup
description: Get caught up on the project. Pure-read — registers presence, surfaces other working agents, then reads operational state, lessons, plans, and Graphiti. Run at the start of every new session.
---

You are starting a new session on this project. Before doing anything else, get caught up.

`/catchup` is **pure-read** for everything other than the agent's own presence file. It does not mutate any shared file, does not check off any state machine, and does not interfere with other agents currently working on the project. The only side effect is `indusk agent register`, which writes the current session's own presence file under `.indusk/agents/`.

## Step 0. Wait for MCP Servers (BLOCKING)

Before running any catchup steps, verify that ALL required MCP servers are available. Catchup depends on these tools and **cannot proceed without them**.

**Required MCP servers:**
- **indusk** — `get_system_version` (provides lessons, health, context, plans, extensions, graph tools)

**How to check:** Call `get_system_version`. If the tool is not available or errors, wait 5 seconds and retry. Retry up to 6 times (30 seconds total).

- If indusk becomes available: proceed with catchup.
- If indusk is still unavailable after 30 seconds: **STOP. Do not proceed.** Tell the user: "InDusk MCP server not available — check `.mcp.json` config or restart Claude Code. Catchup cannot continue. Fix the issue and run `/catchup` again."

**Do NOT skip steps. Do NOT fall back to shell commands. Do NOT proceed with partial functionality.**

## Steps (execute in order)

### 1. Register Presence

Run this first, before reading anything else, so other concurrent agents can see you the moment they call `indusk agent list`:

```bash
indusk agent register --task "<one-line description of what this session is about>"
```

If the user hasn't told you what they want to work on yet, use `--task "starting catchup"` and re-register with a meaningful task once the conversation makes it clear. The `task` field is free-text; later `register` calls overwrite the previous file for the same session.

The session ID comes from `$CLAUDE_CODE_SESSION_ID` and is automatically inherited from this Claude Code session — no flag needed.

### 2. Read the Bulletin

```bash
indusk agent list
```

This prints every currently-registered agent on this project (stale entries older than `agents.stale_ttl_minutes` are filtered out, default 60). If other agents are present, surface them in the catchup summary so you know who you're working alongside — and so you can avoid stepping on their in-flight work.

Empty output means you're the only agent currently active. That's fine — just note it.

### 3. Read Operational State

Check if `.indusk/current.md` exists. If it does, read it — this is the operational layer: in-flight work, open questions, cursor positions. It is continuously maintained by working agents during sessions and is the durable answer to "what is happening on this project right now."

If `.indusk/current.md` doesn't exist yet (project initialized before Phase 4 of handoff-multi-agent shipped, or freshly initialized), skip silently. CLAUDE.md and active plans will cover the gap.

**Do NOT edit `.indusk/current.md` during catchup.** Catchup is read-only for shared files. Working agents update it as state solidifies; catchup just reads it.

### 4. Read Lessons

Call `list_lessons`. Read every lesson. These are rules learned from past mistakes — not suggestions. Internalize them before touching any code.

### 5. Check Infrastructure

Call `check_health`. Verify FalkorDB and Graphiti are running. If unhealthy, tell the user what's down and how to fix it.

### 6. Read Project Context

Call `get_context` to read CLAUDE.md. This contains:
- **Architecture** — what the project is, how it's structured
- **Conventions** — rules to follow (commit style, no DB from Next.js, no fallback URLs, etc.)
- **Key Decisions** — ADRs that have been accepted (with links)
- **Known Gotchas** — things that will bite you if you don't know about them
- **Current State** — what's been built, what's working, what's in progress

Read it fully. Don't skim.

### 7. Recall from Graphiti

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

### 8. Check Active Plans

Call `list_plans`. This shows every plan and its status. Pay attention to:
- Plans with status `in-progress` — these are actively being worked on
- The current phase of each active plan — this is where `/work` will pick up
- Dependencies between plans — don't start a blocked plan

### 9. Review Skills and Extensions

Call `extensions_status` to see what extensions are enabled and their capabilities.

Call `get_skill_summaries` to load the name, description, and type of every installed skill. This returns a compact summary — you do NOT need to read each skill file individually. The full skill content loads automatically when the user invokes a slash command.

Skill types:
- **process** — workflow skills with slash commands (planner, work, verify, context, document, retrospective)
- **extension** — tool integrations (cgc, composable-env, excalidraw, etc.)
- **domain** — technology-specific best practices (typescript, testing, etc.)

Understand what each skill does and when to use it. You should be able to answer: "What slash commands are available and what do they do?"

### 10. Summarize

After completing all steps, present a brief summary to the user:

```
**Caught up.**
- Session: registered as <session-id-short> on <branch>
- Other agents currently working: [list from `indusk agent list`, or "none"]
- Operational state: [summary from .indusk/current.md, or "no current.md yet"]
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
- Do NOT mutate shared files during catchup. The only write is the current session's own presence file via `indusk agent register`.
- Do NOT start coding before completing onboarding. The lessons and context exist because of past failures.
- If CLAUDE.md seems outdated, flag it to the user — it may need a `/context` update.
- If a plan's impl has unchecked items from a previous session, that's where `/work` picks up. Don't re-do completed work.
- If you see other agents in `indusk agent list`, be aware of what they're working on. Avoid editing files they're likely to touch; if you must, surface it explicitly so the user can coordinate.
