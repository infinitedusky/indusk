---
title: "Master Plan — Execution Order"
date: 2026-04-15
---

# Master Plan

Ordered execution pipeline. When an upstream plan changes, review and adjust all downstream plans.

## Pipeline

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 0a | [improvement-eval-agent-open-telemetry](improvement-eval-agent-open-telemetry/brief.md) | impl approved (straight-to-impl micro-plan) | — | 0b, 1 |
| 0b | [bug-fix-eval-agent](bug-fix-eval-agent/brief.md) | impl approved (straight-to-impl micro-plan) | 0a | 1 |
| 1 | [agent-roles](agent-roles/brief.md) | impl in-progress, Phase 1-4 code shipped, Phase 3 Deferred Verification blocked on 0a + 0b | 0a, 0b | 2, 3, 4, 5, 6, 7, 8 |
| 2 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | 1 | — |
| 3 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | 1 | 8 |
| 4 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | 1 (soft: 3) | 5, 6, 7, 8 |
| 5 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 4 | 6 |
| 6 | [type-edges](type-edges/brief.md) | brief draft | 4, 5 | — |
| 7 | [context-migration](context-migration/brief.md) | brief draft | 3, 4 | — |

## Archived

- **falsification-ritual** (2026-04-17) — `/falsify` skill between `/work` and `/retrospective`, same-agent goal-flip bounty-hunting loop, three outcomes per failing test, retrospective Step 0 gate. Plan dogfooded itself and found 2 real bugs in its own library (LF and CR/LS/PS line-separator truncation). Shipped in indusk-mcp 1.16.0. CLI walk-up + sub-app cleanup in 1.16.1. See `archive/falsification-ritual/` and `apps/indusk-docs/src/decisions/falsification-ritual.md`.
- **tests-first-planning** (2026-04-16) — Test Trajectory shape, four validator rules, structural phase-close enforcement, retrospective mitigation audit. Shipped in indusk-mcp 1.15.0. Hook-sync fix in 1.15.1. See `archive/tests-first-planning/` and `apps/indusk-docs/src/decisions/tests-first-planning.md`.

## Independent (no ordering constraint)

| Plan | Status | Notes |
|------|--------|-------|
| [agent-skills-format](agent-skills-format/brief.md) | brief draft | Can run anytime |
| [react-native-support](react-native-support/brief.md) | impl approved, parked | Parked — revisit with dusk-v2 |
| [dusk-v2](dusk-v2/research.md) | research in-progress, parked | Major rewrite — parked |

## Last (needs all infrastructure)

| # | Plan | Status | Depends On |
|---|------|--------|------------|
| 8 | [complementary-personas](complementary-personas/brief.md) | brief draft | 1, 3, 4 |

## Change Propagation

When a plan's brief or ADR changes materially:
1. Find it in the table above
2. Look at its "Blocks" column
3. Review each downstream plan's brief for impact
4. Update downstream briefs if assumptions changed
