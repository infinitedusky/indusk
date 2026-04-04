---
title: "Enforce Impl Structure"
date: 2026-03-24
---

# Enforce Impl Structure — Retrospective

## What We Set Out to Do
Validate that every impl phase has all four gate sections (implementation, verification, context, document) at write time, not just at execution time.

## What Actually Happened
validate-impl-structure.js hook added to PreToolUse on Edit|Write. Detects workflow type from frontmatter (feature requires all 4, bugfix requires verification only, etc.). Blocks edits that add phases without required sections.

## Getting to Done
Straightforward — the parser logic was similar to impl-parser.ts. The workflow-aware gate requirements were the main design decision.

## What We Learned
- Workflow-specific requirements prevent false positives — a bugfix doesn't need a Document section
- The gate_policy frontmatter field ties enforcement to the plan, not globally
- Document skill guidance varies by workflow — features need full docs, bugfixes update existing pages

## What We'd Do Differently
- Nothing — this was a focused, clean implementation

## Quality Ratchet
Fixed unused variable (isOptedOut) in the hook — caught by Biome noUnusedVariables.

## Metrics
- Sessions spent: 1
- Files touched: 4 (hook script, init.ts, document skill, plan skill)
