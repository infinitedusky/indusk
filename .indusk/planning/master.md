---
title: "Master Plan — Execution Order"
date: 2026-04-19
---

# Master Plan

Ordered execution pipeline. When an upstream plan changes, review and adjust all downstream plans.

## Pipeline

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 0 | [eval-agent-mcp-access](eval-agent-mcp-access/impl.md) | impl in-progress (Phase 1 done; Phase 2 fix applied, awaiting 1.23.0 publish for T1 verification + Phase 3 smoke) | — | (unblocks eval agent's Graphiti-writing ability — prerequisite for downstream plans that depend on stored episodes) |
| 1 | indusk-admin-ui | not yet created (next — dogfoods the test-plan flow) | 0 | 2, 3 (UI consumes their data) |
| 2 | test-run-history | not yet created | 0 | (deepens admin-ui timeline view) |
| 3 | local-telemetry | not yet created | 0 | (debug surface in admin-ui) |
| 4 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | — | — |
| 5 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | — | 10 |
| 6 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | (soft: 5) | 7, 8, 9, 10 |
| 7 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 6 | 8 |
| 8 | [type-edges](type-edges/brief.md) | brief draft | 6, 7 | — |
| 9 | [context-migration](context-migration/brief.md) | brief draft | 5, 6 | — |

## New plan triad (1–3) — fast-tracked sales-demo arc

Three independent plans, sequenced together because the admin UI is the most compelling sales asset in the dusk pipeline and the data sources deepen what it can show.

- **`indusk-admin-ui` (1)** — Next.js + React standalone app served via `indusk ui`. v1: list plans, click into plan → see phases + trajectory table with color-coded States + falsification log. Reads `.indusk/planning/` directly; no new data sources. v2 (after plans 2 + 3 land): timeline view of test runs per phase + debug panel for runtime telemetry. **Dogfoods the test-plan flow** (1.22.0's new doc type) since it's the next feature plan post-eval-agent-mcp-access.
- **`test-run-history` (2)** — captures vitest results into `.indusk/test-runs.jsonl` tagged with plan/phase/testId/result. Powers the admin-ui timeline view: "watch T37 stay red through Phases 1-8, flip green at Phase 9 — that's the tripwire firing." This is the *unique* Dusk story (trajectory discipline made visible).
- **`local-telemetry` (3)** — runtime observability for the working agent. Captures spans/logs from any running code into `.indusk/spans.jsonl` (or per-changeId files). Becomes a "what just happened?" debug panel in admin-ui. Serves the original frustration: "something broke, I want to ask the agent and have it check telemetry rather than guess." Open access — eval agent, future agents, manual user inspection all welcome.

## Archived

- **eval-agent-mcp-access** *(pending — will move here on retrospective)* — restored MCP tool access in the spawned `claude --print` subprocess. Phase 1 diagnosis confirmed H2 (`--mcp-config .mcp.json` not auto-discovered by `--print`); fix applied to all 4 spawn sites in `persistent-evaluator.ts` + `evaluator-runner.ts`; ships in indusk-mcp 1.23.0.
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
| 10 | [complementary-personas](complementary-personas/brief.md) | brief draft | 4, 5, 6 |

## Change Propagation

When a plan's brief or ADR changes materially:
1. Find it in the table above
2. Look at its "Blocks" column
3. Review each downstream plan's brief for impact
4. Update downstream briefs if assumptions changed
