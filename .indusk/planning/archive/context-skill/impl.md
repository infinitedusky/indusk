---
title: "Context Skill"
date: 2026-03-19
status: completed
---

# Context Skill

## Goal

Create a Claude Code skill that maintains CLAUDE.md as a living project memory. The skill has two roles:

1. **Shape how impls are written** — when an agent writes an impl document, context tells it to include specific CLAUDE.md updates per phase. What architecture changed? What conventions were established? What gotchas were discovered? These are checklist items, not afterthoughts.

2. **Maintain CLAUDE.md through triggers** — post-retro, post-ADR, and corrections via `context learn`.

The skill is a markdown instruction file — no code, no MCP tools. It teaches the agent when and how to update CLAUDE.md so project knowledge compounds across sessions.

## Scope

### In Scope
- The context skill file (`.claude/skills/context/skill.md`)
- CLAUDE.md aligned to the fixed section structure from the ADR
- Per-phase context updates as a first-class part of impl documents (peer to verification)
- Trigger integration: update plan and work skills to reference context
- `context learn` as a skill invocation

### Out of Scope
- MCP tools (deferred to MCP server plan)
- `context refresh` command
- `research/index.md` maintenance
- Automatic correction detection

## Checklist

### Phase 1: Write the context skill

- [x] Create `.claude/skills/context/skill.md` with:
  - Frontmatter: name, description, argument-hint for `context learn`
  - CLAUDE.md section structure (What This Is, Architecture, Conventions, Key Decisions, Known Gotchas, Current State)
  - Rules for what goes in each section (concise one-liners, links not duplication)
  - Rules for what stays OUT (code patterns, git history, debugging solutions, ephemeral state, anything already in a planning doc)
  - The three triggers with specific instructions for each:
    1. Post-retro: read "Insights Worth Carrying Forward" and "What We'd Do Differently", merge into Conventions and Known Gotchas
    2. Post-ADR: add one-liner to Key Decisions with link to `planning/{plan}/adr.md`
    3. `context learn "lesson"`: append to Conventions (patterns) or Known Gotchas (mistakes), default to Known Gotchas if ambiguous
  - Instructions for shaping impl documents:
    - Every impl phase should end with a "Phase N Context" section alongside "Phase N Verification"
    - Context items are concrete CLAUDE.md edits: "Add to Architecture: ...", "Add to Conventions: ...", "Update Current State: ..."
    - The agent writing the impl must answer: "what does this phase change about how the project works, and what should future sessions know about it?"
    - Context items are checked off by work just like implementation and verification items
  - Instruction for agent to suggest `context learn` when it detects it's been corrected
  - Empty section placeholder convention: `(None yet — will be populated as {description})`

#### Phase 1 Verification
- [x] Skill file exists at `.claude/skills/context/skill.md` and has valid frontmatter
- [x] Invoke `/context learn "test lesson"` and confirm the agent knows what to do (reads the skill, proposes an edit to CLAUDE.md) — skill is loaded and routing logic confirmed

#### Phase 1 Context
- [x] Add to Architecture in CLAUDE.md: context skill exists at `.claude/skills/context/skill.md`
- [x] Update Skill Inventory: context status from `planned` to `stable`

### Phase 2: Align CLAUDE.md to the fixed structure

- [x] Review current CLAUDE.md against the ADR's 6-section structure
- [x] Restructure CLAUDE.md to match:
  - `## What This Is`
  - `## Architecture`
  - `## Conventions`
  - `## Key Decisions`
  - `## Known Gotchas`
  - `## Current State`
- [x] Fold existing extra sections into the appropriate standard sections:
  - Apps details → Architecture
  - Three Layers of Defense → Conventions (as a convention pattern)
  - Skill Inventory → Architecture
  - Active Plans → Current State
- [x] Ensure every section has content or the `(None yet)` placeholder

#### Phase 2 Verification
- [x] CLAUDE.md has exactly 6 `##` sections matching the ADR structure
- [x] No information was lost in the restructure — all content is present, just reorganized
- [x] CLAUDE.md reads cleanly as a session-start orientation document

#### Phase 2 Context
- [x] The restructured CLAUDE.md is itself the context update — no additional edits needed, the file is now the source of truth in its final form

### Phase 3: Wire triggers into plan and work skills

- [x] Update `.claude/skills/plan/skill.md`:
  - In the retrospective instructions: "After writing the retrospective, update CLAUDE.md per the context skill — extract insights into Conventions and Known Gotchas"
  - In the ADR instructions: "After the ADR is accepted, add a one-liner to CLAUDE.md's Key Decisions section per the context skill"
  - In the impl template: add `#### Phase N Context` section alongside `### Verification`, with guidance that context items are concrete CLAUDE.md edits
- [x] Update `.claude/skills/work/skill.md`:
  - Add context items as a peer to verification items — checked off during phase execution, not deferred to the end
  - In the completion step: "If this plan included an ADR or retrospective, confirm CLAUDE.md was updated per the context skill"
  - Add a note about suggesting `context learn` when the agent is corrected mid-work
  - Clarify the per-phase completion order: implementation items → verification items → context items → advance to next phase

#### Phase 3 Verification
- [x] Plan skill references context triggers for retro and ADR stages
- [x] Plan skill's impl template includes Phase N Context sections
- [x] Work skill treats context items as blocking (same as verification)
- [x] Work skill's per-phase flow is: implement → verify → context → advance
- [x] Cross-read all three skills (plan, work, context) and confirm they reference each other without contradiction

#### Phase 3 Context
- [x] Add to Key Decisions in CLAUDE.md: "Impl documents have three per-phase sections: implementation, verification, context — see `planning/context-skill/adr.md`" — already present from Phase 2 restructure
- [x] Add to Conventions: "Every impl phase ends with verification (prove it works) and context (capture what changed) before advancing" — already present from Phase 2 restructure

## Files Affected

| File | Change |
|------|--------|
| `.claude/skills/context/skill.md` | Create — the skill itself |
| `CLAUDE.md` | Restructure to fixed 6-section format |
| `.claude/skills/plan/skill.md` | Add context trigger references, add Phase N Context to impl template |
| `.claude/skills/work/skill.md` | Add context items as peer to verification, update per-phase completion flow |

## Dependencies
- Plan skill exists (it does)
- Work skill exists (it does)
- CLAUDE.md exists (it does)
- Context ADR accepted (pending — must be accepted before this impl starts)

## Notes
- The context skill is pure markdown instructions. If it doesn't change agent behavior effectively, the next step is MCP tools — but we try this first.
- CLAUDE.md restructuring should be conservative — reorganize, don't delete. Every piece of current content should land somewhere in the new structure.
- This impl itself demonstrates the pattern: each phase has its own context items that get checked off before advancing. We're dogfooding the approach while building it.
