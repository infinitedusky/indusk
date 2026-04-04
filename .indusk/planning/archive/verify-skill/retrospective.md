---
title: "Verify Skill"
date: 2026-03-24
---

# Verify Skill — Retrospective

## What We Set Out to Do
Create a skill that gates work execution with automated checks (typecheck, lint, test, build) and shapes impl documents to include per-phase verification with specific runnable commands.

## What Actually Happened
Built as planned. Verification items in impls must be specific runnable commands with expected output. The skill defines skip logic (when to skip typecheck, lint, etc.) and a 3-attempt retry before flagging blockers.

## Getting to Done
The key insight was that `passWithNoTests: true` must be set in each app's vitest.config.ts, not just root. This became a Known Gotcha.

## What We Learned
- Verification commands must be specific — "verify it works" is not a verification item
- Auto-discovery of verification commands (later added in GSD improvements) was the natural evolution
- The 3-attempt limit prevents infinite retry loops

## What We'd Do Differently
- Would have included auto-discovery from the start

## Quality Ratchet
No new Biome rules needed.

## Metrics
- Sessions spent: 1
- Files touched: 2 (skill file, impl template)
