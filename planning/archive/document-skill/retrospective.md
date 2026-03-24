---
title: "Document & Retrospective Skills"
date: 2026-03-24
---

# Document & Retrospective Skills — Retrospective

## What We Set Out to Do
Create per-phase documentation gates during impl execution and a structured retrospective skill for knowledge handoff.

## What Actually Happened
Document skill created with VitePress guidance, Mermaid diagram patterns, sidebar configuration reminders. Retrospective skill handles structured audit and archival. Document sections added to impl template as a fourth gate type alongside verification and context.

## Getting to Done
The most common failure was forgetting to add new pages to the VitePress sidebar. This became a community lesson (community-add-to-sidebar.md). Mermaid diagrams needed strict security mode and default theme — custom colors break rendering.

## What We Learned
- Documentation gates are easily skipped without enforcement — led to enforce-impl-structure plan
- The purpose of documentation is an encyclopedia for the project, not just data preservation
- Workflow-specific documentation rules help — features need full docs, bugfixes just update existing pages
- Teach mode should generate parallel learning journals alongside standard docs

## What We'd Do Differently
- Would have enforced documentation gates from the start (hooks came later)
- Would have been clearer that documentation serves human understanding, not just data completeness

## Quality Ratchet
Added community lesson: community-add-to-sidebar.md

## Metrics
- Sessions spent: 2
- Files touched: 5 (document skill, retrospective skill, impl template, VitePress config guidance)
