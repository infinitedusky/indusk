---
title: "Enforce Plan Execution Gates"
date: 2026-03-24
---

# Enforce Plan Execution Gates — Retrospective

## What We Set Out to Do
Prevent the agent from skipping verification, context, and documentation gates during /work execution. Born from a real incident where all 7 phases were executed without calling advance_plan once.

## What Actually Happened
Three hooks installed via PreToolUse/PostToolUse:
- check-gates.js: blocks impl.md edits when gates are incomplete
- gate-reminder.js: nudges after any impl.md edit
- validate-impl-structure.js: blocks writing impls with missing gate sections

Gate policy system added: strict (no skipping), ask (default — agent asks before skipping), auto (agent can skip with reason).

## Getting to Done
The key insight was that instructions to an agent are suggestions, not constraints. The only way to enforce behavior is hooks that block tool calls. The lighter alternative (mandatory advance_plan output) was considered but rejected — same problem, agent can skip it.

## What We Learned
- Agent instructions are opt-in — enforcement requires system-level hooks
- Three enforcement levels (strict/ask/auto) give flexibility without removing the safety net
- skip-reason: and (none needed) are valid overrides that leave a paper trail
- Hook enforcement at write time (validate-impl-structure) catches problems earlier than execution time (check-gates)

## What We'd Do Differently
- Would have built hooks from day 1 instead of relying on skill instructions

## Quality Ratchet
No new Biome rules — this IS the quality ratchet for process.

## Metrics
- Sessions spent: 2
- Files touched: 8 (3 hook scripts, init.ts, settings.json merge, skills)
