---
title: "Master Plan — Execution Order"
date: 2026-04-15
---

# Master Plan

Ordered execution pipeline. When an upstream plan changes, review and adjust all downstream plans.

## Pipeline

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 1 | [tests-first-planning](tests-first-planning/brief.md) | brief accepted | — | 2, 3, 4, 5, 6, 7, 8, 10 |
| 2 | [agent-roles](agent-roles/brief.md) | brief accepted | 1 | 3, 4, 5, 6, 7, 8, 10 |
| 3 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | 2 | — |
| 4 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | 2 | 10 |
| 5 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | 2 (soft: 4) | 6, 7, 8, 10 |
| 6 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 5 | 7 |
| 7 | [type-edges](type-edges/brief.md) | brief draft | 5, 6 | — |
| 8 | [context-migration](context-migration/brief.md) | brief draft | 4, 5 | — |

## Independent (no ordering constraint)

| Plan | Status | Notes |
|------|--------|-------|
| [agent-skills-format](agent-skills-format/brief.md) | brief draft | Can run anytime |
| [react-native-support](react-native-support/brief.md) | impl approved, parked | Parked — revisit with dusk-v2 |
| [dusk-v2](dusk-v2/research.md) | research in-progress, parked | Major rewrite — parked |

## Last (needs all infrastructure)

| # | Plan | Status | Depends On |
|---|------|--------|------------|
| 10 | [complementary-personas](complementary-personas/brief.md) | brief draft | 2, 4, 5 |

## Change Propagation

When a plan's brief or ADR changes materially:
1. Find it in the table above
2. Look at its "Blocks" column
3. Review each downstream plan's brief for impact
4. Update downstream briefs if assumptions changed
