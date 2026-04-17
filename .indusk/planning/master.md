---
title: "Master Plan — Execution Order"
date: 2026-04-15
---

# Master Plan

Ordered execution pipeline. When an upstream plan changes, review and adjust all downstream plans.

## Pipeline

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 1 | [agent-roles](agent-roles/brief.md) | brief accepted, impl retrofitted | — | 2, 3, 4, 5, 6, 7, 9 |
| 2 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | 1 | — |
| 3 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | 1 | 9 |
| 4 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | 1 (soft: 3) | 5, 6, 7, 9 |
| 5 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 4 | 6 |
| 6 | [type-edges](type-edges/brief.md) | brief draft | 4, 5 | — |
| 7 | [context-migration](context-migration/brief.md) | brief draft | 3, 4 | — |

## Archived

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
| 9 | [complementary-personas](complementary-personas/brief.md) | brief draft | 1, 3, 4 |

## Change Propagation

When a plan's brief or ADR changes materially:
1. Find it in the table above
2. Look at its "Blocks" column
3. Review each downstream plan's brief for impact
4. Update downstream briefs if assumptions changed
