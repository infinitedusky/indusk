---
title: "Document & Retrospective Skills"
date: 2026-03-20
status: accepted
---

# Document & Retrospective Skills — Brief

## Problem

The plan/work lifecycle has no documentation gate. Features ship without user-facing docs. The retrospective is a template with no enforcement — no audit of docs accuracy, test coverage, or quality ratchet. Knowledge stays locked in planning artifacts that get archived and forgotten. Two skills are needed: one for writing docs during execution, one for auditing and handing off knowledge at the end.

## Proposed Direction

Build two new Claude Code skills under one plan:

### Document Skill (execution phase)

A per-phase gate in impl documents, alongside verify and context. The impl template gains a fourth section:

```
implement → verify → context → document → advance
```

The document gate asks: "Does this phase change something a user or developer needs to know?" If yes, the agent writes or updates the relevant docs page. If not, the gate is skipped for that phase.

Documentation lives in a VitePress site at `docs/` in the repo root, using a simplified Diataxis structure:
- **Reference** — skills, tools, API, configuration
- **How-to** — task-oriented guides
- **Decisions** — surfaced from ADRs (populated during archival, not during impl)

### Retrospective Skill (closing phase)

A standalone skill that enforces the retrospective as a structured audit and knowledge handoff:

1. **Docs audit** — review all docs written during impl. Do they match what was actually built?
2. **Test audit** — review test coverage. Are there gaps? Edge cases missed?
3. **Quality audit** — should new Biome rules be added? Feed the quality ratchet.
4. **Context audit** — is CLAUDE.md still accurate?
5. **Knowledge handoff** — distill ADR decisions into the docs "Decisions" section. Extract retrospective insights into relevant docs pages.
6. **Archival** — move planning artifacts to `planning/archive/`. The docs site now holds the published knowledge; the archive holds the process history.

The retrospective skill produces a checklist the agent works through, similar to how the work skill works through impl items.

## Context

The existing plan lifecycle ends with a retrospective template that captures lessons but doesn't enforce auditing or knowledge handoff. See `planning/document-skill/research.md` for analysis of documentation methodologies (Diataxis chosen), tooling (VitePress chosen), and the retrospective-as-audit concept.

## Scope

### In Scope
- Document skill as a per-phase gate in impl execution
- Retrospective skill as a closing audit and knowledge handoff
- VitePress docs site scaffolding at `docs/`
- Simplified Diataxis structure (Reference, How-to, Decisions)
- Updated impl template to include Phase N Document section
- Updated plan skill to invoke retrospective skill instead of raw template
- Archival process that moves planning to archive and knowledge to docs
- `.vscode/settings.json` generation as part of init (Biome configuration)

### Out of Scope
- Tutorials section (v2 — when external users exist)
- Automated docs deployment (deploy skill, separate plan)
- Per-app VitePress sites (single site at root for now)
- Test coverage threshold enforcement (track as open question for retrospective skill v2)

## Success Criteria

- Every impl phase has a Document section that asks the right question and produces docs when needed
- The retrospective skill produces a structured audit checklist that covers docs, tests, quality, and context
- Archival moves planning to archive and distills ADR decisions + retro insights into the docs site
- The docs site builds and serves locally via `pnpm docs:dev`
- A new developer can understand the system by browsing the docs site without reading planning artifacts

## Depends On

- `planning/context-skill/` (completed — context gate is the model for document gate)
- `planning/verify-skill/` (completed — verify gate is the model for document gate)
- `planning/code-quality-system/` (completed — quality ratchet feeds into retrospective audit)

## Blocks

- `planning/mcp-dev-system/` (MCP init should generate docs scaffolding)
