---
name: catchup
description: Get caught up on the project. Pure-read — registers presence, reads .indusk/current.md sections to surface other working agents + the project's operational state, then reads lessons and plans. Run at the start of every new session.
---

You are starting a new session on this project. Before doing anything else, get caught up.

`/catchup` is **pure-read** for every shared file. The only writes are (a) `indusk agent register` ensuring a section exists for the current session in `.indusk/current.md`, and (b) the implicit self-heartbeat in `indusk agent list` (refreshes your own section's `Last updated`). Neither write touches any other agent's section. Two sessions can run `/catchup` simultaneously on the same project without blocking or corrupting each other.

## Step 0. Wait for MCP Servers (BLOCKING)

Before running any catchup steps, verify that ALL required MCP servers are available. Catchup depends on these tools and **cannot proceed without them**.

**Required MCP servers:**
- **indusk** — `get_system_version` (provides lessons, health, context, plans, extensions)

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

If the user hasn't told you what they want to work on yet, use `--task "starting catchup"` and re-register with a meaningful task once the conversation makes it clear. The `task` field is free-text; later `register` calls overwrite the section's task (preserving its in-flight / open-questions / cursor bodies if any).

The session ID comes from `$CLAUDE_CODE_SESSION_ID` and is automatically inherited from this Claude Code session — no flag needed.

### 2. Read the Bulletin

```bash
indusk agent list
```

This prints every currently-fresh session in `.indusk/current.md` — i.e., other agents working on this project. Stale sections (older than `agents.stale_ttl_minutes`, default 60) are filtered out. If other agents are present, surface them in the catchup summary so the user knows who you're working alongside.

Empty output means you're the only agent currently active. That's fine — just note it.

Calling `agent list` also implicitly self-heartbeats your section (refreshes `Last updated`), so this is the canonical "I am still here" surface for long-running sessions.

### 3. Read Operational State (targeted — do NOT read the whole file)

**Do NOT read `.indusk/current.md` end-to-end.** The file accumulates every session's history between sweeps; a full read re-pays all of it every catchup (the pre-makeover cost was ~22k tokens). Read exactly two things:

1. **The `## Project (shared)` region only** — read from the top of the file to the first `---` delimiter (offset/limit read or head). This is the cross-cutting state.
2. **Live sessions' sections only** — `indusk agent list` (Step 2) already printed the fresh partition. For each live session it lists (other than yourself), Grep for its `## Session <short>` heading and read just that section. Skip every section `agent list` filtered out.

The two regions:

- **`## Project (shared)`** — cross-cutting state that's true for the whole project right now ("pre-launch crunch mode", "telemetry endpoint changed last week", "merge freeze through Thursday"). Any agent can edit this section. Read it to know the project-wide context.
- **Per-agent sections** (`## Session <short> — <task>`) — operational state from other working agents. Each section's `### In Flight`, `### Open Questions`, and `### Cursor` subsections tell you what other agents are doing in detail.

**Never surface a section that `agent list` filtered out as stale.** Sections from agents that ran `/handoff` but skipped `indusk agent done` linger in the file until the sweep archives them; targeted reads keyed off `agent list`'s fresh partition keep them out of your summary by construction.

**Do NOT edit `.indusk/current.md` during catchup.** Catchup is read-only for shared content. Your own section's content (in-flight / open-questions / cursor) is written via the [`mcp__indusk__update_current_section` MCP tool](apps/docs/src/reference/tools/indusk-mcp.md#agent-tools) — typically at `/handoff`, not during catchup. The `agent register` call in Step 1 only refreshes the heading + `Last updated`; it preserves any existing body content.

### 4. Sweep Check (dry-run)

```bash
indusk agent sweep --dry-run
```

Surface the count in your summary. If it reports more than a handful of sweepable sections, suggest the user let you run `indusk agent sweep` for real — decayed sections are exactly what makes Step 3's file expensive. (The `/handoff` ritual runs the real sweep automatically; this dry-run is the visibility layer.)

Then pull the hub channel:

```bash
indusk sync pull
```

Additive-only merge of the machine-global hub (`$INDUSK_HOME/hub/lessons/`) + the package's bundled community lessons into this project's `.claude/lessons/`. Surface "N new rules pulled" in the summary when non-zero. Local lessons always win on conflict — the pull can never clobber project knowledge.

### 5. Skim Lessons (Lazy-Load)

Call `list_lessons`. As of 1.31.5, the tool returns `title` + `path` per lesson — **not** the full content. Titles ARE the actionable rules in most cases.

**Skim every title.** Most lesson titles are written as the rule itself ("Never use String.includes for shell-command trigger detection — use anchored regex" / "Ground-truth-verify every 'X already works' claim in a brief before acceptance"). Internalize the titles. That's enough to act on for most work.

**Read the full body** (via the `Read` tool against the `path` field — not via a new MCP call) only when:
- The lesson's title bears on what the user is about to ask you to do (e.g., starting a brief → read `community-brief-author-bias-ground-truth-verification` in full; touching shell-triggered code → read `community-anchor-shell-trigger-patterns-no-substring` in full)
- An error, finding, or question mid-session matches a lesson title — read that one's body then
- The user explicitly asks about a topic a lesson covers

The shift from "read every lesson's full content" (status quo through 1.31.4) to "skim titles + read on demand" is a ~5–15× context-cost reduction per catchup without losing any lesson coverage — every lesson is still discoverable; you just defer the body load until it's relevant.

These are rules learned from past mistakes — not suggestions. Internalize the titles before touching any code; reach for full content when the work calls for it.

### 6. Check Infrastructure

Call `check_health`. It runs every enabled extension's health checks. If unhealthy, tell the user what's down and how to fix it.

### 7. Project Context — already loaded, do NOT re-fetch

CLAUDE.md is auto-injected into every session by Claude Code. **Do NOT call `get_context` and do NOT `Read` CLAUDE.md during catchup** — that duplicates content already in your context window (the single biggest line item in the pre-makeover ~55k catchup). You already have Architecture, Conventions, Key Decisions, Known Gotchas, and Current State. If (and only if) your context was compacted and the injected copy is genuinely absent, read it then.

### 8. Check Active Plans

Call `list_plans` with `{ active: true }` — this returns only genuinely in-motion plans (any doc accepted/approved/in-progress/proposed) plus a count of what was omitted. Do NOT list every draft. Pay attention to:
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
- Project (shared) state: [content from `.indusk/current.md`'s ## Project (shared) section, or "none"]
- Other agents currently working: [list from `indusk agent list`, with each agent's task, worktree, and branch — or "none"]
- Worktree collision: [if `indusk agent list` prints a `⚠ collision` warning — two or more live sessions sharing one worktree (typically the shared trunk) — surface it prominently; this is the exact class worktree-per-plan prevents]
- Notable in-flight from other agents: [if anyone's section is on something that might affect this session, surface it]
- Lessons: N titles skimmed
- Sweep: [N sections sweepable (dry-run) / clean]
- Infrastructure: [healthy / issues]
- Skills: N installed [list names]
- Extensions: N enabled [list names]
- Active plans: [list with current phase] (M inactive omitted)

Ready to pick up. What would you like to do?
```

## When to Use

- Start of every new Claude Code session
- When the user says "get caught up", "what's going on", "where are we", "catch up"
- When context was compressed and you need to re-orient
- `/catchup` explicitly

## Important

- Do NOT skip any step. Each one prevents a class of mistake.
- Do NOT mutate any shared file during catchup. The only writes are `indusk agent register` and the implicit self-heartbeat in `indusk agent list`, both touching only the current session's own section.
- Do NOT start coding before completing onboarding. The lessons and context exist because of past failures.
- If CLAUDE.md seems outdated, flag it to the user — it may need a `/context` update.
- If a plan's impl has unchecked items from a previous session, that's where `/work` picks up. Don't re-do completed work.
- If you see other agents in `indusk agent list` working on something that overlaps with what the user wants you to do, surface that explicitly before proceeding. The bulletin is visibility, not coordination — the working agent owns the "avoid stepping on each other" judgment. `agent list` now shows each session's **worktree** and **branch**, and prints a `⚠ collision` line to stderr when two live sessions share a worktree — read both when judging overlap.
