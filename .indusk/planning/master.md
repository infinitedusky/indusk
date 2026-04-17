---
title: "Master Plan — Execution Order"
date: 2026-04-15
---

# Master Plan

Ordered execution pipeline. When an upstream plan changes, review and adjust all downstream plans.

## Pipeline

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 0 | [eval-agent-mcp-access](eval-agent-mcp-access/brief.md) | brief accepted (straight-to-impl micro-plan) | — | (unblocks eval agent's Graphiti-writing ability — prerequisite for downstream plans that depend on stored episodes) |
| 2 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | — | — |
| 3 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | — | 8 |
| 4 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | (soft: 3) | 5, 6, 7, 8 |
| 5 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 4 | 6 |
| 6 | [type-edges](type-edges/brief.md) | brief draft | 4, 5 | — |
| 7 | [context-migration](context-migration/brief.md) | brief draft | 3, 4 | — |

## Archived

- **agent-roles** (2026-04-18) — three-tier agent split (working agent / eval agent / infrastructure) + highlights queue + `/highlight` command + handoff-trigger + role docs. Shipped in indusk-mcp 1.17.0. Falsification on Phase 3 smoke exposed the eval-judge silent failure — spawned improvement-eval-agent-open-telemetry + bug-fix-eval-agent. Second falsification round exposed MCP-access gap in the spawned subprocess — spawned eval-agent-mcp-access. Architecture shipped correctly; operational end-to-end (eval agent actually processes highlights) deferred to the downstream plan. See `archive/agent-roles/` and `apps/indusk-docs/src/lessons/agent-roles.md`.
- **improvement-eval-agent-open-telemetry** (2026-04-18) — opt-in OTel traces + logs for the eval agent. 5 phases, 4 publish cycles, Dash0 "agent" dataset routing. Shipped in indusk-mcp 1.19.0. Falsification found the hook ESM-require bug → spawned `bug-fix-eval-agent`. See `archive/improvement-eval-agent-open-telemetry/` and `apps/indusk-docs/src/lessons/eval-agent-otel.md`.
- **bug-fix-eval-agent** (2026-04-18) — fixed hook-spawn silent crash (CJS `require()` in ESM scope) via 4 phases in ~90 min. Shipped in indusk-mcp 1.19.1. Silent-exits-become-loud hardening added. Falsification found regression regex too narrow → fix-in-scope broadened it. See `archive/bug-fix-eval-agent/` and `apps/indusk-docs/src/lessons/eval-agent-bug-fix.md`.
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
