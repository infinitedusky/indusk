---
title: "Master Plan — Execution Order"
date: 2026-04-19
---

# Master Plan

The pipeline is organized into three arcs. Each arc has an internal goal; arcs are mostly independent except where noted. The discipline that keeps Arc 1 and Arc 2 from colliding: **Arc 1 surfaces must not display evaluator-written structured data until Arc 2 has settled the schema** (otherwise the display layer gets rewritten when the graph shape changes). Test-run capture and runtime spans are inherently safe; UI is the surface to be careful with.

## Arc 1 — Working-agent observability + UI (the demo arc)

**Goal**: visible, demoable surface for the working-agent's flow (plans, phases, test runs, runtime spans). Sales asset + real dev tool. Independent of the evaluator's output format.

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 0.5 | [rationale-baseline-frontmatter](rationale-baseline-frontmatter/brief.md) | brief draft (~30 min upstream hook fix; URGENT — blocks Numero's next 3 plans from clean authoring) | — | (unblocks Numero's restart-recovery / coc4-verification-debt-audit / drop-compat-views and any future schema-migration plan) |
| 1 | [indusk-admin-ui](indusk-admin-ui/brief.md) | impl in-progress (Phase 1 done; dogfoods the test-plan flow) | — | 2, 3 (UI consumes their data) |
| 1.5 | playwright-auth-pattern | not yet created (~1 day; ships right after admin-ui — solves the "can't test logged-in screens" pain on Numero and any future project) | — | (unblocks e2e testing of auth-gated UI for any project) |
| 2 | test-run-history | not yet created | — | (deepens admin-ui timeline view) |
| 3 | [local-telemetry](local-telemetry/brief.md) | brief accepted + test-plan draft (new extension + machine-global daemon following admin-UI 1.27.x pattern: Jaeger + OTel Collector + SQLite log sink in one container, managed by `indusk telemetry start/stop/restart/status`; MCP tool surface `get_recent_spans`/`get_trace`/`tail_logs`; dev traces local, staging/prod stay Dash0; foundation for autonomous-dev watcher pattern) | — | 3.6 (watcher consumes the buffer), 3.7 (test-strategy diagnosis UX) |
| 3.6 | telemetry-watcher-agent | not yet created (~2 days; async-observer daemon tailing the local telemetry buffer, surfaces anomalies via highlights — same three-tier pattern as eval agent) | 3 | (continuous dev-loop signal: "I saw an error come through") |
| 3.7 | test-strategy-convention | not yet created (~1 week; formalizes `{test-package}/` layout + Part 2 test/reality-drift controls from .indusk/research/test-strategy/induskbrief.md: shared client lib, branded opaque types, adversarial fixtures, E2E smoke, retroactive audits) | 3 (benefits from local span inspection during integration/E2E) | (unblocks reliable cross-service testing on every project) |

**Discipline**: Admin UI v1 displays plan files (`.indusk/planning/`) and trajectory state. v2 adds the timeline view of test-runs + telemetry spans. NEITHER VERSION displays evaluator-written graph data — that surface comes in Arc 3 once Arc 2's schema is settled.

## Arc 2 — Evaluator becomes a structured-knowledge writer (the real eval arc)

**Goal**: stop dumping prose blobs into Graphiti. Make the eval agent build typed, navigable, queryable knowledge as work happens. Sequential — each plan depends on the previous.

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 3.5 | [evaluator-structured-scorecard-output](evaluator-structured-scorecard-output/brief.md) | brief draft (the strategic fix for scorecard schema drift — same root cause as #4 but narrower scope, ships first) | — | 4 (validates the structured-output approach before we apply it to graph episodes); admin-ui v2 (canonical scorecards across projects) |
| 4 | [graph-knowledge-architecture](graph-knowledge-architecture/brief.md) | impl draft | 0 | 5, 6, 7, 8 (the architectural pivot) |
| 5 | [lsp-structural-indexing](lsp-structural-indexing/brief.md) | brief draft | 4 | 6 |
| 6 | [type-edges](type-edges/brief.md) | brief draft | 4, 5 | — |
| 7 | [context-migration](context-migration/brief.md) | brief draft | 4 (and beam validation) | — |

**The pivot**: graph-knowledge-architecture removes `graph_capture`/`add_memory` calls from planner/work/retrospective skills and makes the eval agent the **sole graph writer**. Custom Pydantic entity types + relationship models give Graphiti the typed ontology it needs. Everything downstream (lsp-structural-indexing's structural writes, type-edges' typed edges, context-migration's load-bearing on the graph) requires this pivot first.

**Why graph-knowledge-architecture isn't #1**: the JSON-mixed-prose scorecard parse error (#0) blocks reading anything the evaluator emits. Fix the output format before redesigning what the output contains.

## Arc 3 — New surfaces enabled by the structured graph (long-term)

**Goal**: capabilities that need the typed knowledge graph to be useful, OR that are independent surfaces that can land anytime but conceptually fit alongside Arc 2.

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 8 | [hermes-inspired-improvements](hermes-inspired-improvements/brief.md) | brief accepted | — (independent; could land anytime) | 10 |
| 9 | [mcp-orchestration-layer](mcp-orchestration-layer/brief.md) | brief draft | — (independent) | — |
| 10 | falsify-spawn-pattern | not yet created (independent; precursor to 11) | — | 11 |
| 11 | [complementary-personas](complementary-personas/brief.md) | brief draft | 4, 8, 10 (needs typed graph + transcript search + spawn pattern for persona memory) | — |
| 12 | indusk-admin-ui v2 (knowledge-graph viewer) | not yet a separate plan; folded into #1's v2 scope | 4 (must wait for graph schema) | — |

### `falsify-spawn-pattern` (#10) — context

Surfaced 2026-04-19 during eval-scorecard-format-fix's falsification: the current `/falsify` ritual has a structural flaw — it's "same agent, goal-flipped," but the agent who built the thing has the worst perspective for finding its own gaps. Same assumptions, same blind spots, same things considered out-of-scope. When asked to confirm, I admitted the ritual found a bug we already knew about (cheat-sheet effect) and likely would NOT have found it cold. The fix: refactor `/falsify` to spawn a fresh background Claude session (same architecture as the eval agent) with zero prior session context, given only the plan files + codebase + a single mission ("find a test that would fail that should pass"). The contract stays identical (hypothesize → write test → pick outcome) — only the executor changes. This is the foundational primitive for `complementary-personas` (#11): the "skeptic" persona is exactly this design generalized.

## Archived

- **eval-scorecard-format-fix** (2026-04-19) — eval scorecard parser tolerates prose-prefixed/fenced/wrapped JSON output via 3-strategy `extractScorecardJson` with balanced-brace scan; FINAL REMINDER prompt section + JSON example for output discipline; wrapper overrides `scorecard.timestamp` (model was rounding to 5-min marks); `ingestScorecard` tolerates malformed-shape scorecards via `Array.isArray` guard (found by /falsify, fixed in scope as Phase 4); work skill defaults to per-item commits with explicit describe-then-do anti-pattern callout. Shipped 1.24.0 → 1.24.4 across 5 publish cycles. **Surfaced the structural cheat-sheet effect in `/falsify` when run in-session** — queued as plan #10 `falsify-spawn-pattern`. First plan to dogfood the test-plan flow on a bugfix workflow — confirmed the discipline works at small scale. See `.indusk/planning/archive/eval-scorecard-format-fix/` and `apps/indusk-docs/src/lessons/eval-scorecard-format-fix.md`.
- **eval-agent-mcp-access** (2026-04-19) — restored MCP tool access in the spawned `claude --print` subprocess. Took 3 publish cycles to land: 1.23.0 had the TS fix but shipped stale dist (no `pnpm build` before publish); 1.23.1 added `prepublishOnly` hook + rebuilt with `--mcp-config .mcp.json` + `--permission-mode acceptEdits`; 1.23.2 corrected to `--permission-mode bypassPermissions` after smoke verified `acceptEdits` only auto-accepts file edits, not MCP tool calls. **Verification**: `.indusk/highlights-processed.jsonl` populated with 3 entries (all `action: wrote-episode`) on smoke 4 — proves the spawned evaluator can now read highlights, write Graphiti episodes, and mark them processed. Falsification surfaced a separate downstream issue (evaluator scorecard JSON parse error from prose-mixed output) — captured as plan #0 (eval-scorecard-format-fix). Pending retrospective + falsification + archive moves.
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

## Recommended Sequence

1. `/planner bugfix eval-scorecard-format-fix` — micro-plan (~30 min). Unblocks clean scorecard reading.
2. `/planner indusk-admin-ui` — Arc 1 starts. Dogfoods the test-plan flow (1.22.0). UI v1 = plan-file display only.
3. `test-run-history` → `local-telemetry` — parallel-safe; deepen UI v1 over time.
4. `/planner graph-knowledge-architecture` — Arc 2 starts. **The architectural pivot.**
5. `lsp-structural-indexing` → `type-edges` → `context-migration` — Arc 2 wraps.
6. Arc 3 surfaces parallel/late: `hermes-inspired-improvements` + `mcp-orchestration-layer` could land anywhere. `complementary-personas` is genuinely last.

## Cross-Arc Discipline

The single rule that keeps Arc 1 and Arc 2 from colliding:

> **No surface in Arc 1 displays evaluator-written graph data.** UI v1 shows plan files. v2 shows test-runs + telemetry spans (capture pipelines, not graph shape). The "view what the eval agent wrote to Graphiti" surface is Arc 3 (admin-ui v2 with knowledge-graph viewer) and explicitly waits for graph-knowledge-architecture to settle the schema.

This means everything in Arc 1 is safe to detour through. Nothing built will be thrown away when Arc 2 redesigns the graph.

## Change Propagation

When a plan's brief or ADR changes materially:
1. Find it in the table above
2. Look at its "Blocks" column
3. Review each downstream plan's brief for impact
4. Update downstream briefs if assumptions changed
