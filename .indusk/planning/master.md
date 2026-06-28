---
title: "Master Plan — Execution Order"
date: 2026-04-19
updated: 2026-05-25
---

# Master Plan

The pipeline is organized into three arcs plus an Immediate queue and a substrate-refactor arc (Midnight) that lands before Arc 2 starts. The discipline that keeps Arc 1 and Arc 2 from colliding: **Arc 1 surfaces must not display evaluator-written structured data until Arc 2 has settled the schema** (otherwise the display layer gets rewritten when the graph shape changes). Test-run capture and runtime spans are inherently safe; UI is the surface to be careful with.

## Immediate (this week)

Three plans queued ahead of arc work because each is small, ready-or-near-ready, and one blocks the user right now. Promoted into this section from their previous arc positions; cross-references kept below so the arc tables stay readable.

| # | Plan | Status | Why now |
|---|------|--------|---------|
| I.1 | ~~handoff-multi-agent~~ → shipped via [handoff-multi-agent-section-shape](archive/handoff-multi-agent-section-shape/) | shipped 2026-06-27 (archived) | DONE — concurrent Claude sessions on one project no longer collide. Per-agent sections inside one `.indusk/current.md` + `mcp__indusk__update_current_section` MCP write tool + `/handoff` as a real four-step ritual. Falsification surfaced 4 real bugs (body injection / register race / catchup TTL gap / control-char session ID) — all fixed in Phase 6. Parent plan ADR carries supersession banner. |
| I.2 | [indusk-worktree-extension](indusk-worktree-extension/brief.md) | brief accepted + test-plan draft (~2–3 days) | Multi-agent fix (I.1) depends on this. Independent quality-of-life win for FDE work even without I.1. Previously F1 in the FDE bucket. |
| I.3 | [code-reviewer-agent](code-reviewer-agent/impl.md) | **parked 2026-06-28** — impl draft, fresh-eyes pass complete + validator-green (~1 week elapsed when resumed) | Deferred until Dawn design partner named. The 7-week dormancy was itself a value signal: no emergency. Shipping now optimizes for "tool Sandy wants on his own daily commits" — legitimate but strictly personal. Integration thesis (CLAUDE.md-anchored review beats generic) is unfalsifiable when measured only by the plan author on the plan author's own conventions; cheat-sheet effect applies. Resume when design partner from `apps/indusk-docs/src/dawn/who.md` becomes a named person — then the MVP has a real user #2 and the petal-validation becomes leverage for Dawn. |

**Direction note (under consideration, no plan yet):** jj substrate deprecation. Sandy 2026-05-25 leaning toward dropping jj support — the dual-substrate complexity in `apps/indusk-mcp/src/lib/scm/`, the jj-only semantic-graph features, and the SCM-aware skill prose all become single-path. Existing `git-or-jj-substrate` plan stays archived; a future `jj-deprecation` plan would remove rather than abstract. Not blocking anything; flagged here so the next planner pass picks it up.

## Arc 0 — Midnight (substrate refactor)

**Goal**: refactor InDusk so failures earn tests, not specifications. Production-driven test authority + bloat audit + lean substrate. 8 phases, ~2 weeks distributed across normal feature work. See [midnight/brief.md](midnight/brief.md).

**Why Arc 0**: Midnight reframes what Arc 2 should be building. If Arc 2 (graph-knowledge-architecture and downstream) ships before Midnight Phase 8 (bloat audit), Arc 2 builds typed-graph machinery for surfaces Phase 8 may flag as unused. Phases 1–3 are quick (~3 days total) and produce the convention + code annotations + telemetry-contract extension that Arc 2 will then build on top of.

| # | Phase | Effort | What |
|---|-------|--------|------|
| 0.1 | Convention + seeded example | ~3h | `.indusk/subsystems/` pattern README. Convert state-persistence (from Numero's bulletproof-persistence) into the Dawn-shape doc with 2 expectations + 2 known-issues. `/catchup` learns the new directory. |
| 0.2 | Code annotation convention | ~1d | Greppable `E-N` comments at enforcement sites. Span attribute `expectations.enforced` / `expectations.violated`. Lint: every E-N has ≥1 code site OR test. |
| 0.3 | Telemetry contract extension | ~1d | `telemetry-contract.ts` entries declare `expectations:` field. Typecheck rejects E-IDs not in the relevant subsystem. |
| 0.4 | `expectTraceShape` helper | ~2d | Trace-pattern assertion library. Each pattern names the E-N it validates. CI failure messages reference the expectation. **This is the test-writing primitive going forward.** |
| 0.5 | Collapse-signal query | ~2d | `pnpm midnight:check <subsystem>` shows expectation violations over a window from Dash0 + local telemetry. Collapse signal becomes a number. |
| 0.6 | Skill updates | ~1d | `/planner` recognizes subsystem-shaped work and appends phases. `/retrospective` distinguishes archive-eligible feature plans vs live subsystems. `/falsify` runs against the expectation list. |
| 0.7 | Production-to-corpus loop | ~2d | Dash0 alert → checks F-corpus → pages with "this is F-N, here's the fix path" or opens a new F-N. |
| 0.8 | **InDusk bloat audit + drop** | ~2d | Inventory every extension, skill, hook, tool. Mark each: load-bearing / superseded / unused / unknown. Drop superseded + unused. cgc + Graphiti get specific scrutiny. **Phase 8 may flag parts of Arc 1/2/3 inventory as drop-eligible — Arc 2 start is gated on Phase 8 completing.** |

**Phase 0.1–0.3** ship right after the Immediate queue (week of 2026-06-01ish). **Phases 0.4–0.7** distribute across Numero feature work. **Phase 0.8 (bloat audit) must land before Arc 2 starts** — that's the gate.

## Arc 1 — Working-agent observability + UI (the demo arc)

**Goal**: visible, demoable surface for the working-agent's flow (plans, phases, test runs, runtime spans). Sales asset + real dev tool. Independent of the evaluator's output format.

| # | Plan | Status | Depends On | Blocks |
|---|------|--------|------------|--------|
| 0.5 | [rationale-baseline-frontmatter](rationale-baseline-frontmatter/brief.md) | brief draft (~30 min upstream hook fix; URGENT — blocks Numero's next 3 plans from clean authoring) | — | (unblocks Numero's restart-recovery / coc4-verification-debt-audit / drop-compat-views and any future schema-migration plan) |
| 1 | [indusk-admin-ui](indusk-admin-ui/brief.md) | impl in-progress (Phase 1 done; dogfoods the test-plan flow) | — | 2, 3 (UI consumes their data) |
| 1.5 | playwright-auth-pattern | not yet created (~1 day; ships right after admin-ui — solves the "can't test logged-in screens" pain on Numero and any future project) | — | (unblocks e2e testing of auth-gated UI for any project) |
| 2 | test-run-history | not yet created | — | (deepens admin-ui timeline view) |
| 3 | [local-telemetry](local-telemetry/brief.md) | brief accepted + test-plan draft (new extension + machine-global daemon following admin-UI 1.27.x pattern: Jaeger + OTel Collector + SQLite log sink in one container, managed by `indusk telemetry start/stop/restart/status`; MCP tool surface `get_recent_spans`/`get_trace`/`tail_logs`; dev traces local, staging/prod stay Dash0; foundation for autonomous-dev watcher pattern) | — | 3.6 (watcher consumes the buffer), 3.7 (test-strategy diagnosis UX) |
| 3.6 | telemetry-watcher-agent | not yet created (~2 days; async-observer daemon **watching ONLY the local telemetry buffer** — not Dash0, not cross-backend. Reads jaeger_mcp + `tail_logs` directly, surfaces anomalies via highlights, same three-tier pattern as eval agent. Strictly local-only; the unified cross-backend interface is a separate later plan.) | 3 | (continuous dev-loop signal: "I saw an error come through") |
| 3.7 | test-strategy-convention | not yet created (~1 week; formalizes `{test-package}/` layout + Part 2 test/reality-drift controls from .indusk/research/test-strategy/induskbrief.md: shared client lib, branded opaque types, adversarial fixtures, E2E smoke, retroactive audits) | 3 (benefits from local span inspection during integration/E2E) | (unblocks reliable cross-service testing on every project) |
| 3.8 | [code-reviewer-agent](code-reviewer-agent/impl.md) | **PROMOTED → see Immediate I.3, now PARKED 2026-06-28** (impl draft, validator-green; deferred until Dawn design partner named) | Dawn design partner named | (additional commit-time signal source; Dawn-petal candidate) |

**Discipline**: Admin UI v1 displays plan files (`.indusk/planning/`) and trajectory state. v2 adds the timeline view of test-runs + telemetry spans. NEITHER VERSION displays evaluator-written graph data — that surface comes in Arc 3 once Arc 2's schema is settled.

## Arc 2 — Evaluator becomes a structured-knowledge writer (the real eval arc)

**Goal**: stop dumping prose blobs into Graphiti. Make the eval agent build typed, navigable, queryable knowledge as work happens. Sequential — each plan depends on the previous.

**Hard gate**: Arc 2 does not start until Midnight Phase 0.8 (bloat audit) completes. Reason — Phase 0.8 may flag parts of the planned Arc 2 inventory (cgc, certain Graphiti integrations) as drop-eligible. Building typed-graph machinery for surfaces about to be dropped is wasted motion.

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

## FDE Workflow Promotion (sibling-repo backport)

**Goal**: promote durable patterns from `~/code/lazer/dawn-fde-toolkit` into dusk canon so future FDEs (and adjacent client-facing roles) inherit scaffolding instead of re-inventing per engagement. Counter-audit landed 2026-05-20 against a 7-item inventory; framing splits into two buckets — technical scaffolding (F1/F2/F4, independent) and counterpart intelligence (F3, folds into Arc 2 via Graphiti as substrate).

### Bucket: Technical scaffolding

| # | Plan | Status | Depends On | Notes |
|---|------|--------|------------|-------|
| F1 | [indusk-worktree-extension](indusk-worktree-extension/brief.md) | **PROMOTED → see Immediate I.2** (brief accepted + test-plan; counter-audit applied 2026-05-20; multi-agent coordination depends on this) | — | Worktree scripts + FDE-overrides composable.env pattern + preflight scoped-diff + `apply_commits[]`/skip-worktree overlay (the load-bearing piece the original audit understated) |
| F2 | vitepress-content-tools | not yet created | — | `:::copyable` markdown-it plugin + CopyPageButton + CopyableMessage + OpenAPI viewer wiring + env-gated INTERNAL docs section (one plan, lands as additions to existing `vitepress` extension) |
| F4 | setup-dns-promotion | not yet created (smallest; possibly a skill recipe instead of full plan) | — | Bake `scripts/dev/setup-dns.sh` into composable-env extension or expose as `indusk env setup-dns` |

### Bucket: Counterpart intelligence (folds into Arc 2)

| # | Plan | Status | Depends On | Notes |
|---|------|--------|------------|-------|
| F3 | counterpart-intelligence-extension | not yet created | 4 (graph-knowledge-architecture — needs typed-entity infra before `Counterpart` entities can land cleanly) | InDusk extension at `apps/indusk-mcp/extensions/counterpart-intelligence/` providing `meeting-notes` / `pre-call-catchup` / `weekly-prep` skills + a **living Graphiti-backed `Counterpart` entity** that auto-updates after every interaction. Substrate: Graphiti entity + episodes. Surface: extension with skills (no new MCP). Scope: humans Sandy works with directly (counterparts, teammates). Reframed 2026-05-20 from a thin "three skills + storage folder" promotion into a relational-memory pattern — the living profile is the spine, the three skills hang off it. |

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
| unified-telemetry-query | not yet created (~2–3 days; **later, user-facing** translation layer so any agent — not just the watcher — sees ONE interface across local (Jaeger + `tail_logs`) + Dash0. Same tool names, same input shapes, backend chosen by signal type + profile. Zod-schema'd inputs, MCP-to-MCP forwarding chokepoint, response-size caps, cursor support, schema versioning. Independent from the watcher agent — the watcher is explicitly local-only and does NOT depend on this. Brief-draft deferred until 1.28.x has one dogfood session of direct jaeger_mcp use to surface the real bumbling patterns the wrapper must structurally prevent.) | Later — no downstream blockers |
| [react-native-support](react-native-support/brief.md) | impl approved, parked | Parked — revisit with dusk-v2 |
| [dusk-v2](dusk-v2/research.md) | research in-progress, parked | Major rewrite — parked |

## Recommended Sequence

Updated 2026-05-25. The pre-2026-05-25 sequence (eval-scorecard-format-fix → indusk-admin-ui → ...) is mostly shipped through Arc 1 mid-list; the new starting point is the Immediate queue.

1. **Immediate** (this week):
   - `/work handoff-multi-agent` (I.1) — concurrent with F1, since multi-agent fix consumes worktrees
   - `/work indusk-worktree-extension` (I.2) — composes with I.1
   - ~~`/work code-reviewer-agent` (I.3)~~ — **parked 2026-06-28** until Dawn design partner named
2. **Arc 0 — Midnight Phases 0.1–0.3** (~3 days) — convention + code annotations + telemetry contract extension. Reshapes test-writing discipline for everything after.
3. **Arc 0 — Midnight Phases 0.4–0.7** (~1 week, distributed) — `expectTraceShape` helper, collapse-signal query, skill updates, production-to-corpus loop. Lands across Numero feature work.
4. **Arc 0 — Midnight Phase 0.8** (~2 days) — bloat audit. **Gates Arc 2.**
5. **Arc 1 remaining** (parallel-safe with Arc 0): `test-run-history` (#2) → `local-telemetry` (#3) → `telemetry-watcher-agent` (#3.6) → `test-strategy-convention` (#3.7). Independent of Midnight; any can land in parallel.
6. **Arc 2 starts post-Phase-0.8**: `/planner graph-knowledge-architecture` (#4) — the architectural pivot, now shaped by Midnight primitives + scoped by what Phase 0.8 kept.
7. **Arc 2 wraps**: `lsp-structural-indexing` (#5) → `type-edges` (#6) → `context-migration` (#7).
8. **Arc 3 parallel/late**: `hermes-inspired-improvements` (#8) + `mcp-orchestration-layer` (#9) any time. `complementary-personas` (#11) is genuinely last (depends on Arc 2 + #8 + #10).
9. **FDE bucket leftovers**: F2 (vitepress-content-tools) + F4 (setup-dns-promotion) any time, independent. F3 (counterpart-intelligence) waits on Arc 2 #4.

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
