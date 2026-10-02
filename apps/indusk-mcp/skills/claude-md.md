---
name: claude-md
description: Maintain CLAUDE.md as living project memory. Update on triggers (post-retro, post-ADR, corrections). Shape impl documents to include per-phase context updates.
argument-hint: "learn \"lesson to remember\""
---

You know how to maintain project context in this project.

(This skill was named `context`. Claude Code ships a built-in `/context` command — the context-window usage view — and a built-in shadows any skill of the same name, so `/context learn "…"` opened the token chart instead of running this. Nothing else changed.)

## What It Does

Context ensures that project knowledge compounds across sessions. It does this in two ways:

1. **Maintains CLAUDE.md** — the living project memory file that Claude Code reads at session start. Context keeps it accurate through three update triggers.
2. **Shapes impl documents** — when writing an impl, every phase includes a Context gate that specifies what CLAUDE.md updates that phase produces.

## CLAUDE.md Structure

CLAUDE.md has exactly five sections. This structure is fixed — never add, remove, or rename sections. Every section is always present, even if empty. Operational state — what is in flight, blocked, or next — is never a root section: it lives in `.indusk/current.md`'s Project (shared) region.

```markdown
# {Project Name} — Project Context

## What This Is
{1-2 sentences: what the project is and who it's for}

## Architecture
{Directory tree, key technologies, how things connect. Apps, packages, skills, and their relationships.}

## Conventions
{Patterns to follow, anti-patterns to avoid. Accumulated from corrections, retrospectives, and explicit decisions. Each entry is a concise one-liner.}

## Key Decisions
{One-liner per decision with a link to the source document. Format: "- {decision summary} — see .indusk/planning/{plan}/adr.md"}

## Known Gotchas
{Things that went wrong before. Mistakes the agent made and was corrected on. Each entry is a concise one-liner explaining what NOT to do and why.}
```

### What goes in each section

- **What This Is** — Only changes when the project's fundamental purpose changes. Rarely updated.
- **Architecture** — Updated when apps, packages, or significant structural elements are added, removed, or reorganized. Include directory trees, key technologies, skill inventory.
- **Conventions** — Patterns to follow ("use Biome not ESLint"), anti-patterns to avoid ("never hardcode values in contract vars"). Sourced from corrections, retrospectives, and ADRs. Keep entries as concise one-liners.
- **Key Decisions** — Only added via the post-ADR trigger. Always links to the source ADR. Never duplicate the full rationale — that's what the ADR is for.
- **Known Gotchas** — Mistakes and surprises. "Tailwind 4 requires Node 22", "always run pnpm env:build before docker compose". Sourced from corrections and retrospectives.
- There is no Current State section. What is in progress, recently completed or blocked is operational state and goes to `.indusk/current.md`'s Project (shared) region, written through `mcp__indusk__update_current_section` or edited there directly — never into the root file.

### What stays OUT of CLAUDE.md

- Code patterns derivable from reading the source (the code is the documentation)
- Git history or recent changes (use `git log`)
- Debugging solutions (the fix is in the code; the commit message has the context)
- Ephemeral task state (use tasks/todos for the current conversation)
- Anything already fully documented in a planning document (link to it instead of duplicating)
- Content longer than a few lines per entry (CLAUDE.md is an index, not an encyclopedia)

### Empty section convention

If a section has no content yet, use a placeholder:

```markdown
## Known Gotchas

(None yet — will be populated as the agent makes mistakes)
```

## Where a rule goes — the tiers

The root `CLAUDE.md` is the last destination, not the first. Every rule is routed by tier, in this order, and the choice names its destination:

| Tier | When | Destination |
|------|------|-------------|
| **enforcer** | a test or hook can catch the rule being broken | the enforcer, whose failure message opens with `lesson: <name>`; the lesson file holds the why; nothing in any `CLAUDE.md` |
| **directory** | the rule applies only when working in one area | that area's `CLAUDE.md` — `.indusk/planning/` (via the package template `templates/planning/CLAUDE.md`), or an app's or package's own |
| **operational** | it is in flight, blocked, or next | `.indusk/current.md`, Project (shared) |
| **root** | design intent or a cross-cutting convention with no enforcer and no home directory | the root `CLAUDE.md`, as rule + pointer, **with the reason it must be always-on** |

When an enforcer holds only part of a rule, the unenforced remainder goes to the next tier down — never to the root by default. A root entry that a later plan makes enforceable moves out: that is the periodic pass at every plan close. — see `/guide/context-tiers`

## The Three Triggers

### 1. Post-Retrospective

After writing a retrospective, read the "Insights Worth Carrying Forward" and "What We'd Do Differently" sections. Route each item by the tier table above; within the root, sections still apply:

- If it's a pattern to follow or avoid → an enforcer if one can catch it, else the area's file, else **Conventions**
- If it's a mistake that was made → the same order, ending at **Known Gotchas**
- If it changes the project's architecture or structure → update **Architecture**
- Update `.indusk/current.md`'s Project (shared) region to reflect the plan's completion
- If the retrospective's "Quality Ratchet" section adds a new Biome rule, also add the enforced pattern to **Conventions**
- **Grep the affected modules** to verify Architecture still reflects reality after the plan's changes.

Do this immediately after writing the retrospective, before moving on.

### 2. Post-ADR Acceptance

When an ADR's status changes to `accepted`, add a one-liner to **Key Decisions**:

```markdown
- {Concise decision summary} — see `.indusk/planning/{plan-name}/adr.md`
```

Do not duplicate the ADR's rationale. The link is the documentation.

### 3. `claude-md learn`

When invoked as `/claude-md learn "lesson"`, or when you detect you've been corrected mid-session:

1. Categorize the lesson:
   - **Conventions** — patterns to follow or avoid ("use Biome not ESLint", "no default exports")
   - **Known Gotchas** — mistakes ("don't run npx ce, use pnpm ce", "always env:build before docker compose")
2. If ambiguous, default to **Known Gotchas** — better to over-capture than miss a lesson
3. Append a concise one-liner to the appropriate section
4. Never add to Key Decisions via `claude-md learn` — that's only via the post-ADR trigger
5. Never write operational state via `claude-md learn` — it belongs in `.indusk/current.md`, not the root file

**When you detect you've been corrected** — the user says "no, not that way" or "don't do X, do Y" — suggest running `claude-md learn`. Don't wait to be told. Example:

> User: "No, use pnpm ce, not npx"
> Agent: *fixes the command* — "Should I capture this? `/claude-md learn 'use pnpm ce, not npx — the skill doc specifies pnpm'`"

## Shaping Impl Documents

Every impl phase includes a `#### Phase N Context` gate. Each item names its **tier and destination**, so the routing is reviewable at the gate rather than decided at close:

- `guard: src/__tests__/x.test.ts carries lesson: one-x-definition — the pin that refuses a second X`
- `planning: a deferral carries its test body as a fenced block`
- `mcp: lib/tokens.ts is the one token grammar`
- `current.md: Phase N of {plan} complete`
- `root (Architecture): new-package exists at packages/new-package, provides X — always-on because every session must know the package exists`

An item aimed at the root states **why it must be always-on**. An item that cannot say why belongs at a lower tier.

Ask: **"What does this phase change about how the project works?"** If nothing — no context items needed. But the question must be asked.

### Forward Intelligence

At the end of each phase's context items, write a **Forward Intelligence** block:

```markdown
#### Phase N Forward Intelligence
- **Fragile**: {file or module that was tricky during this phase, and why}
- **Watch out**: {downstream risk the next phase should be aware of}
- **Assumption**: {something that's true now but could change — e.g., "parser assumes all phases have verification sections"}
```

This is not a CLAUDE.md update — it lives in the impl doc itself, after the context items. The work skill reads it before starting the next phase so the agent knows what landmines exist.

Not every phase produces forward intelligence. Only write it when something is genuinely fragile, risky, or assumption-dependent. Skip the section entirely if there's nothing worth flagging.

### Context gate is blocking

Context items block phase advancement. See work skill "Per-phase completion order" for the full gate cycle. Context items are blocking because CLAUDE.md is the next session's only memory — incomplete context means the next agent starts from scratch.

## Important

- CLAUDE.md is an index, not an encyclopedia. Keep entries concise.
- Link, don't duplicate. If the full explanation lives in an ADR or research doc, link to it.
- The five-section structure is fixed. Never add new `##` sections.
- Trigger discipline matters. If you skip a post-retro or post-ADR update, knowledge is lost.
- When in doubt about where something goes, Known Gotchas is the safest default.
- **Use `git diff --stat` against the plan branch to enrich retrospectives.** Compare what was actually touched vs what was planned. Structural data makes retrospectives factual, not anecdotal.
