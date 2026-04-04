---
title: "Context Skill"
date: 2026-03-19
status: accepted
---

# Context Skill

## Y-Statement
In the context of **AI-assisted development where each session starts with no memory**,
facing **accumulated planning artifacts that the agent never reads unless told to**,
we decided for **a Claude Code skill that maintains CLAUDE.md as a living project memory with three update triggers (post-retro, post-ADR, corrections)**
and against **MCP-based context tools, automatic correction detection, and a separate context refresh command**,
to achieve **session-start orientation in under 30 seconds with compounding project knowledge**,
accepting **manual invocation of `context learn` for corrections and reliance on trigger discipline rather than automation**,
because **the simplest approach that works is a markdown skill that instructs the agent how and when to update CLAUDE.md, and we can add MCP tooling later once the skill behavior is proven**.

## Context

The plan and work skills define how features get planned and executed. But each session starts cold — the agent re-discovers the codebase every time. Planning artifacts (research, briefs, ADRs, retrospectives) capture lessons that never flow back into the agent's working memory.

CLAUDE.md already exists in this repo and is read automatically by Claude Code at session start. The context skill formalizes how it gets maintained so it stays accurate and grows over time.

See `planning/context-skill/brief.md` for the full problem statement and scope.

## Decision

### The skill is a markdown file, not code

The context skill lives at `.claude/skills/context/skill.md`. It instructs the agent on:
- The structure of CLAUDE.md (what sections exist and what goes in each)
- When to update CLAUDE.md (the three triggers)
- How to use `context learn` to capture corrections
- What NOT to put in CLAUDE.md (ephemeral state, things derivable from code)

No MCP tools, no scripts, no automation. The agent reads the skill and follows the instructions. MCP exposure comes later as a separate effort when plan, work, and context are all proven.

### CLAUDE.md has a fixed section structure

```markdown
# {Project Name} — Project Context

## What This Is
{1-2 sentences: what the project is and who it's for}

## Architecture
{Directory tree, key technologies, how things connect}

## Conventions
{Patterns to follow, anti-patterns to avoid — accumulated from corrections}

## Key Decisions
{One-liner per ADR with link to the full document}

## Known Gotchas
{Things the agent got wrong before — accumulated from corrections and retros}

## Current State
{What's in progress, recently completed, blocked}
```

Sections are always present even if empty (with a `(None yet)` placeholder). This makes it predictable for both the agent and the human to find information.

### Three update triggers, no automation

1. **Post-retrospective**: After writing a retrospective, the agent reads "Insights Worth Carrying Forward" and "What We'd Do Differently" and merges relevant items into Conventions and Known Gotchas.

2. **Post-ADR acceptance**: When an ADR status changes to `accepted`, the agent adds a one-liner to Key Decisions with a link: `- {decision summary} — see planning/{plan}/adr.md`

3. **`context learn`**: A skill invocation (`/context learn "lesson"`) that the agent or human can call mid-session. It appends the lesson to the appropriate section (Conventions for patterns, Known Gotchas for mistakes). The skill instructs the agent to suggest this when it detects it's been corrected.

### `context learn` routing logic

The skill instructs the agent to categorize lessons:
- **Conventions** — patterns to follow or avoid ("use Biome not ESLint", "no default exports")
- **Known Gotchas** — mistakes that were made ("don't run npx ce, use pnpm ce", "always env:build before docker compose")
- **Key Decisions** — only via post-ADR trigger, not via `context learn`
- **Current State** — only via post-retro trigger or manual update, not via `context learn`

If ambiguous, default to Known Gotchas — it's better to over-capture than miss a lesson.

### What stays OUT of CLAUDE.md

- Code patterns derivable from reading the source
- Git history or recent changes (use `git log`)
- Debugging solutions (the fix is in the code)
- Ephemeral task state (use tasks/todos for that)
- Anything already in a planning document (link to it instead)

## Alternatives Considered

### MCP-based context tools
Context tools in the MCP server that programmatically read/write CLAUDE.md sections. Rejected for v1 because it adds code complexity before we've validated the approach. The skill-as-instructions pattern is simpler and sufficient — the agent can read and write files natively.

### Automatic correction detection
Having the agent detect when it's been corrected and auto-capture the lesson. Rejected because reliable detection is hard and false positives would erode trust. Starting with explicit `context learn` and letting the agent *suggest* it is a better starting point.

### `context refresh` command
A command to re-scan the codebase and update CLAUDE.md. Rejected because if the three triggers are working, CLAUDE.md stays current. A refresh command would mask trigger failures rather than exposing them.

## Consequences

### Positive
- Every session starts with full project awareness via CLAUDE.md
- Knowledge compounds across sessions — corrections stick
- No new code required — the skill is pure instructions
- Compatible with future MCP exposure without rework

### Negative
- Depends on trigger discipline — if the agent skips a post-retro update, knowledge is lost
- `context learn` requires manual invocation or the agent remembering to suggest it
- CLAUDE.md could grow unwieldy over time without pruning

### Risks
- **CLAUDE.md bloat** — Mitigate by keeping entries concise (one-liners) and periodically reviewing for stale items
- **Trigger skipping** — Mitigate by having the work skill reference the context skill when completing retros and ADRs
- **Stale state** — If Current State drifts, a human or agent can update it directly. If this becomes a recurring problem, revisit the `context refresh` idea

## References
- `planning/context-skill/brief.md`
- `.claude/skills/plan/skill.md` (plan lifecycle that context integrates with)
- `.claude/skills/work/skill.md` (work execution that triggers context updates)
