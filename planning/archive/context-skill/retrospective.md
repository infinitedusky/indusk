---
title: "Context Skill"
date: 2026-03-24
---

# Context Skill — Retrospective

## What We Set Out to Do
Create a skill that maintains CLAUDE.md as living project memory with a fixed 6-section structure, updated at natural triggers (post-ADR, post-retro, corrections).

## What Actually Happened
Built as planned. CLAUDE.md has the 6-section structure (What This Is, Architecture, Conventions, Key Decisions, Known Gotchas, Current State). The context skill is pure markdown instructions, not MCP tools. Per-phase context updates are baked into the impl template.

## Getting to Done
Straightforward implementation. The main iteration was deciding that CLAUDE.md edits should be concrete items in impl checklists ("Add to Conventions: ...") rather than vague instructions.

## What We Learned
- Flat file context works for small projects but scales poorly — led to the context-graph research
- Making context updates part of the impl template ensures they happen, but enforcement requires hooks
- The 6-section structure is a good starting point but could be auto-generated from a graph

## What We'd Do Differently
- Would have considered graph-based context from the start instead of flat files

## Quality Ratchet
No new Biome rules needed.

## Metrics
- Sessions spent: 1
- Files touched: 3 (skill file, CLAUDE.md template, impl template)
