---
name: context
description: Maintain CLAUDE.md as living project memory. Update on triggers (post-retro, post-ADR, corrections). Shape impl documents to include per-phase context updates.
argument-hint: "learn \"lesson to remember\""
---

You know how to maintain project context in this project.

## What Context Does

Context ensures that project knowledge compounds across sessions. It does this in two ways:

1. **Maintains CLAUDE.md** — the living project memory file that Claude Code reads at session start. Context keeps it accurate through three update triggers.
2. **Shapes impl documents** — when writing an impl, every phase includes a Context section that specifies what CLAUDE.md updates that phase produces.

## CLAUDE.md Structure

CLAUDE.md has exactly six sections. This structure is fixed — never add, remove, or rename sections. Every section is always present, even if empty.

```markdown
# {Project Name} — Project Context

## What This Is
{1-2 sentences: what the project is and who it's for}

## Architecture
{Directory tree, key technologies, how things connect. Apps, packages, skills, and their relationships.}

## Conventions
{Patterns to follow, anti-patterns to avoid. Accumulated from corrections, retrospectives, and explicit decisions. Each entry is a concise one-liner.}

## Key Decisions
{One-liner per decision with a link to the source document. Format: "- {decision summary} — see planning/{plan}/adr.md"}

## Known Gotchas
{Things that went wrong before. Mistakes the agent made and was corrected on. Each entry is a concise one-liner explaining what NOT to do and why.}

## Current State
{What's in progress, recently completed, blocked. Active plans and their stages.}
```

### What goes in each section

- **What This Is** — Only changes when the project's fundamental purpose changes. Rarely updated.
- **Architecture** — Updated when apps, packages, or significant structural elements are added, removed, or reorganized. Include directory trees, key technologies, skill inventory.
- **Conventions** — Patterns to follow ("use Biome not ESLint"), anti-patterns to avoid ("never hardcode values in contract vars"). Sourced from corrections, retrospectives, and ADRs. Keep entries as concise one-liners.
- **Key Decisions** — Only added via the post-ADR trigger. Always links to the source ADR. Never duplicate the full rationale — that's what the ADR is for.
- **Known Gotchas** — Mistakes and surprises. "Tailwind 4 requires Node 22", "always run pnpm env:build before docker compose". Sourced from corrections and retrospectives.
- **Current State** — The most volatile section. Updated when plans change stage, work begins or completes, or blockers appear.

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

## The Three Triggers

### 1. Post-Retrospective

After writing a retrospective, read the "Insights Worth Carrying Forward" and "What We'd Do Differently" sections. For each item:

- If it's a pattern to follow or avoid → add to **Conventions**
- If it's a mistake that was made → add to **Known Gotchas**
- If it changes the project's architecture or structure → update **Architecture**
- Update **Current State** to reflect the plan's completion
- If the retrospective's "Quality Ratchet" section adds a new Biome rule, also add the enforced pattern to **Conventions**

Do this immediately after writing the retrospective, before moving on.

### 2. Post-ADR Acceptance

When an ADR's status changes to `accepted`, add a one-liner to **Key Decisions**:

```markdown
- {Concise decision summary} — see `planning/{plan-name}/adr.md`
```

Do not duplicate the ADR's rationale. The link is the documentation.

### 3. `context learn`

When invoked as `/context learn "lesson"`, or when you detect you've been corrected mid-session:

1. Categorize the lesson:
   - **Conventions** — patterns to follow or avoid ("use Biome not ESLint", "no default exports")
   - **Known Gotchas** — mistakes ("don't run npx ce, use pnpm ce", "always env:build before docker compose")
2. If ambiguous, default to **Known Gotchas** — better to over-capture than miss a lesson
3. Append a concise one-liner to the appropriate section
4. Never add to Key Decisions via `context learn` — that's only via the post-ADR trigger
5. Never add to Current State via `context learn` — that's updated by triggers or manually

**When you detect you've been corrected** — the user says "no, not that way" or "don't do X, do Y" — suggest running `context learn`. Don't wait to be told. Example:

> User: "No, use pnpm ce, not npx"
> Agent: *fixes the command* — "Should I capture this? `/context learn 'use pnpm ce, not npx — the skill doc specifies pnpm'`"

## Shaping Impl Documents

When an agent writes an impl document (via the plan skill), every phase should end with three sections:

```markdown
### Phase N: {Name}
- [ ] {implementation items}

#### Phase N Verification
- [ ] {prove this phase works — tests, type checks, commands}

#### Phase N Context
- [ ] {concrete CLAUDE.md edits this phase produces}
```

### What goes in Phase N Context

Context items are concrete, specific CLAUDE.md edits. Not "update CLAUDE.md" — that's too vague. Instead:

- `Add to Architecture: new-package exists at packages/new-package, provides X`
- `Add to Conventions: always use Y pattern when doing Z`
- `Update Current State: Phase N of {plan} complete`
- `Add to Known Gotchas: X doesn't work because of Y, use Z instead`

The agent writing the impl must answer: **"what does this phase change about how the project works, and what should future sessions know about it?"** If the answer is "nothing" — no context items needed. Not every phase produces context. But the question must be asked.

### Context items are blocking

During execution (via the work skill), context items are checked off alongside implementation and verification items. The per-phase completion order is:

```
implementation items → verification items → context items → advance to next phase
```

A phase is not complete until its context items are done.

## Important

- CLAUDE.md is an index, not an encyclopedia. Keep entries concise.
- Link, don't duplicate. If the full explanation lives in an ADR or research doc, link to it.
- The six-section structure is fixed. Never add new `##` sections.
- Trigger discipline matters. If you skip a post-retro or post-ADR update, knowledge is lost.
- When in doubt about where something goes, Known Gotchas is the safest default.
- **Use the code graph to enrich retrospectives.** Query `get_repository_stats` and `analyze_code_relationships` to compare what was actually touched vs what was planned. Structural data makes retrospectives factual, not anecdotal.
