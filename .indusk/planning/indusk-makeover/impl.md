---
title: "InDusk Makeover — Implementation"
date: 2026-07-23
status: approved
trajectory: required
rationale: required
gate_policy: ask
---

# InDusk Makeover — Implementation

## Goal

Cut session-start fixed context ~123k → ~18k tokens and catchup ~55k → ≤15k by shipping budgets (60 KB CLAUDE.md write-time hook), decay (current.md sweep, dead-draft auto-archive, compaction ritual), removal (Graphiti + CGC, rail retargeted to lessons), and hub push/pull rule distribution — as reusable InDusk features, then migrating this workbench as the first consumer.

## Scope

### In Scope
- Upstream mechanisms in `apps/indusk-mcp`: sweep, plan auto-archive, CLAUDE.md budget hook, catchup rewrite, eval-rail retarget, `indusk sync` promote/pull
- This repo's migration: CLAUDE.md compression, MCP config diet, current.md + dead-draft backfill, indusk-infra retirement

### Out of Scope
- numero-workbench consuming-side migration (driven from that workbench's copy of this plan)
- Model/effort tuning; docs-site rewrites; planning lifecycle/gate changes
- versioned-workbench sync loop (sequenced after; composes with Phase 5's pull flow)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `lib/agents/sweep.ts` (`sweepStaleSections`), `indusk agent sweep`, `indusk plans archive-dead`, archive file format | `lib/agents/current-md.ts` parser + lock, `agents.stale_ttl_minutes`, plan frontmatter/status |
| Phase 2 | `hooks/claude-md-budget.js`, `context.claude_md_budget_bytes` config key, pointer-walker script | hook install pattern (globSync both sides), `lib/config.ts` readers |
| Phase 3 | Graphiti/CGC-free init/update/extensions/health, eval Step 4 retargeted to lessons | `buildHighlightsInstructions`, `add_lesson` tool, extensions disable flow |
| Phase 4 | Dieted catchup skill, `list_plans` status filter, sweep wired into catchup/handoff | Phase 1 sweep CLI, Phase 3 Graphiti-free catchup path |
| Phase 5 | `indusk sync promote` / `indusk sync pull`, hub channel format | `community-*` lessons channel, `get_skill_versions` concept |
| Phase 6 | Compressed CLAUDE.md, final MCP configs, backfilled workbench, retrospective compaction step | Phases 1–5 mechanisms |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | Project CLAUDE.md is ≤ 60 KB on disk (`wc -c` gate script) | Phase 0 | Phase 6 | written |
| A2 | Editing CLAUDE.md past budget produces a visible warn/block at write time | Phase 2 | Phase 2 | planned |
| A3 | Every compressed entry's pointer resolves to an existing docs page or archived doc (link walker) | Phase 0 | Phase 6 | written |
| A4 | 15 randomly sampled pre-compression entries have their operative rule still stated post-compression | Phase 6 | Phase 6 | planned |
| A5 | Fresh `/catchup` completes with ≤ ~15k tokens of tool-result content (chars/4) | Phase 0 | Phase 6 | written |
| A6 | `/catchup` performs no Graphiti query and no duplicate CLAUDE.md fetch, completing without error | Phase 0 | Phase 4 | written |
| A7 | Graphiti and codegraphcontext appear in no project MCP config or enabled extension; `check_health` passes without them | Phase 0 | Phase 3 | written |
| A8 | A highlight written in a session is processed by the eval agent into a lesson at commit time, with Graphiti gone, without error | Phase 3 | Phase 3 | planned |
| A9 | Sweep archives sections older than the stale TTL; archived content is retrievable from the archive file | Phase 1 | Phase 1 | planned |
| A10 | Sweep never touches the Project (shared) section or a live session's section (adversarial fixtures) | Phase 1 | Phase 1 | planned |
| A11 | Plan list shows only genuinely active plans; dead drafts are in `archive/` with documents intact | Phase 0 | Phase 6 | written |
| A12 | Project MCP config is exactly indusk/dash0/posthog/jaeger; global is playwright only | Phase 0 | Phase 6 | written |
| A13 | A rule promoted from this project is received by a second project via the pull flow, with provenance | Phase 5 | Phase 5 | planned |
| A14 | Pulling twice changes nothing the second time; local (personal) lessons are never overwritten | Phase 5 | Phase 5 | planned |
| A15 | A plan close produces a compact CLAUDE.md entry (rule + pointer), via the wired ritual — verified by dry-run diff | Phase 6 | Phase 6 | planned |

### Deferred Verification

- **Compressed CLAUDE.md effectiveness (U1)**
  - reason: whether future sessions repeat mistakes the old narratives prevented is only observable over weeks of real sessions
  - would require: several weeks of normal multi-session use post-compression
  - mitigation: A4's 15-entry sample gate now, plus a scheduled 2-week review greping new-session mistakes against archived entries; any repeat-bug traced to a compressed entry strengthens its rule sentence in place
- **Quota burn drops proportionally (U2)**
  - reason: depends on Anthropic-side caching/limit mechanics, not directly observable per-session
  - would require: instrumented before/after quota telemetry from the provider
  - mitigation: before/after comparison of sessions-per-limit-window over a normal week of use; user reports

### Trajectory Rationale

- **A2** `Writable at: Phase 2` — the subject is `hooks/claude-md-budget.js`, authored in Phase 2; a hook-fire test cannot target a hook file that does not exist.
- **A4** `Writable at: Phase 6` — the sample gate judges Phase 6's compressed CLAUDE.md output; before the compression there is no post-state to sample against.
- **A8** `Writable at: Phase 3` — the assertion's subject is the Graphiti-free rail (eval Step 4 writing lessons); before Phase 3 the rail routes through `graph_capture` and the retargeted path doesn't exist to exercise.
- **A9** `Writable at: Phase 1` — subject is the `sweepStaleSections` export authored in Phase 1; the test's import line is a compile error today.
- **A10** `Writable at: Phase 1` — same subject as A9; adversarial fixtures target the Phase 1 sweep implementation.
- **A13** `Writable at: Phase 5` — subject is the `indusk sync` promote/pull surface authored in Phase 5; no command exists to invoke earlier.
- **A14** `Writable at: Phase 5` — same subject as A13; idempotency fixtures target the Phase 5 pull implementation.
- **A15** `Writable at: Phase 6` — the dry-run diff exercises the retrospective skill's compaction step, which is wired in Phase 6.

## Checklist

### Phase 0: Baseline measurement scripts (red tripwires)
- [x] Create/confirm this plan's worktree (`git worktree` branch `plan/indusk-makeover`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] Author `scripts/makeover-gates.sh` in the plan folder (or `apps/indusk-mcp/scripts/`): A1 `wc -c` gate (CLAUDE.md ≤ 61440 bytes), A7 config grep (graphiti/codegraphcontext absent from `.mcp.json` + `.indusk/extensions/`), A11 active-plan count vs frontmatter status, A12 keep-list diff for project + global MCP configs — each printing PASS/FAIL
- [x] Author A3 pointer-walker (scan CLAUDE.md for `.indusk/`/`apps/docs/` path references; verify each resolves on disk) — `scripts/check-pointers.sh`; red at 38/142 dead
- [x] Author A5/A6 measurement procedure as a checked-in doc: run `/catchup`, sum tool-result chars/4, grep transcript for Graphiti calls + duplicate CLAUDE.md reads — `scripts/catchup-measurement.md`
- [x] Run all of the above; record the red baseline numbers in this plan folder (`baseline.md`) — dusk: 142,653 B CLAUDE.md, 38 dead pointers, 23 plan dirs, both MCP configs off keep-list; A5/A6 red provisional from research.md (dusk-specific cold-session number pending — see baseline.md notes)

#### Phase 0 Verification
- [x] A1, A3, A7, A11, A12 scripts run and FAIL red against today's state (write red); A5/A6 measured red (~55k, Graphiti query present) — all red confirmed 2026-07-23, outputs in baseline.md; A5/A6 provisional from research.md pending a cold-session run

#### Phase 0 Context
- [x] Add one line to CLAUDE.md Current State: indusk-makeover in-flight, baseline measured (numbers + pointer to `baseline.md`)

#### Phase 0 Document
- [x] Record baseline table in `baseline.md` in the plan folder (feeds the retrospective's before/after metrics)

### Phase 1: Decay mechanisms — current.md sweep + dead-draft auto-archive
- [x] `apps/indusk-mcp/src/lib/agents/sweep.ts`: `sweepStaleSections(projectRoot, opts?)` — parses via `parseCurrentMd`, moves session sections whose `Last updated` exceeds `agents.stale_ttl_minutes` (separate, longer `agents.sweep_ttl_minutes` default 7 days — display-TTL ≠ sweep-TTL) into `.indusk/archive/current-md-archive.md` (append, with sweep timestamp header); never touches Project (shared) or fresh sections; malformed `lastUpdated` KEPT (existing prune convention); runs inside `withLock` — archive-before-rewrite ordering so a crash duplicates rather than loses; `serializeSectionBlock` exported from current-md.ts
- [x] CLI `indusk agent sweep [--dry-run]` in `commands/agent.ts`, printing what moved/would move
- [x] `apps/indusk-mcp/src/lib/planning/archive-dead.ts`: dead-draft detector — plan is dead when no doc has status beyond `draft` AND newest file mtime older than `planning.dead_draft_days` (default 30); `indusk plans archive-dead [--dry-run]` moves folder to `.indusk/planning/archive/`, never deletes, skips plans referenced as in-progress in master.md — master protection rule: linked name on a non-"draft" line; unparseable frontmatter blocks (conservative); abandoned is archive-eligible
- [x] Config keys `agents.sweep_ttl_minutes` + `planning.dead_draft_days` read via `lib/config.ts` (defaults in reader, presence-keyed migration per `ensureCleanupConfig` precedent) — `ensureDecayConfig` wired into update.ts after the cleanup block
- [x] Vitest: A9 (expired section archived + retrievable), A10 (adversarial fixtures: Project shared with stale-looking body, live section at TTL boundary, malformed timestamp, injected `## Session` text in a body) + dry-run and lock-contention supporting cases — 10 sweep + 9 archive-dead tests

#### Phase 1 Verification
- [ ] A9 passes (`pnpm turbo test --filter=indusk-mcp -- sweep`)
- [ ] A10 passes (same suite, adversarial fixtures)

#### Phase 1 Context
- [ ] Add CLAUDE.md Conventions one-liner: sweep + archive-dead commands, the display-TTL vs sweep-TTL distinction, archive-never-delete invariant — pointer to this plan

#### Phase 1 Document
- [ ] New section in `apps/docs/src/reference/cli/agent.md` for `agent sweep`; new `apps/docs/src/reference/cli/plans.md` for `plans archive-dead`

### Phase 2: CLAUDE.md size-budget hook + pointer walker productized
- [ ] `apps/indusk-mcp/hooks/claude-md-budget.js` (PreToolUse on Edit/Write targeting `CLAUDE.md`): computes post-edit size; > budget → block with message naming the compaction ritual; > 90% → warn; budget from `context.claude_md_budget_bytes` (default 61440) via inlined config reader (hook precedent)
- [ ] Hook registered in init/update settings template; confirm globSync (both sides) picks it up — the eval-trigger lesson
- [ ] Productize the pointer walker as `indusk context check-pointers` (walks CLAUDE.md path references, reports dead ones)
- [ ] Vitest: hook unit (under/at/over budget, warn band, non-CLAUDE.md files untouched) + walker unit

#### Phase 2 Verification
- [ ] A2 passes: manual hook-fire test — attempt an over-budget CLAUDE.md edit in a scratch project, observe block message; vitest hook unit green

#### Phase 2 Context
- [ ] Add CLAUDE.md Conventions one-liner: the 60 KB budget, hook name, config key, how to raise the budget deliberately — pointer to `guide/context-budget.md`

#### Phase 2 Document
- [ ] Write `apps/docs/src/guide/context-budget.md`: budget rationale, hook behavior, compaction ritual, decay-loop Mermaid diagram

### Phase 3: Graphiti + CGC removal, rail retargeted to lessons
- [ ] Retarget eval Step 4: `buildHighlightsInstructions` writes lessons (via `add_lesson`) instead of `graph_capture`/`mcp__graphiti__*`; keep the CRITICAL preamble + `already_processed` STOP path byte-intact; update the resume-prompt regression test's expectations
- [ ] Remove graphiti + codegraphcontext registration from init/update `.mcp.json` upsert; extensions: disable/remove `graphiti` extension flow (on_disable fires — 1.28.0 symmetry rule); remove catchup/planner/work/retrospective skill references to Graphiti recall + CGC blast-radius queries (Grep/tests guidance replaces CGC)
- [ ] `check_health` stops probing FalkorDB/Graphiti; `rail-check` skill updated to verify highlight→eval→**lessons** (not episodes)
- [ ] Remove graphiti + codegraphcontext entries from **this repo's** `.mcp.json`; disable both extensions here (A7 target — full keep-list finalization stays Phase 6)
- [ ] Grep-gone check: no live-code references to `GraphitiClient`/`graph_capture` outside archived docs + changelog

#### Phase 3 Verification
- [ ] A7 script flips green (graphiti/CGC absent, `check_health` passes)
- [ ] A8 manual smoke: write a highlight, `git commit`, observe eval agent produce a lesson entry and mark the highlight processed, zero errors in `.indusk/eval/results.log`
- [ ] Full suite green (`pnpm test`) — the eval-resume-prompt + rail regression tests updated, not deleted

#### Phase 3 Context
- [ ] Update CLAUDE.md: Architecture MCP-server list loses graphiti/codegraphcontext; Conventions eval-rail entry retargeted to lessons — one-liners + pointer

#### Phase 3 Document
- [ ] Removal notices on Graphiti/CGC guide pages (what replaced them: lessons rail, Grep); changelog entry

### Phase 4: Catchup diet + sweep wiring
- [ ] Rewrite `apps/indusk-mcp/skills/catchup.md`: drop Graphiti step, drop duplicate CLAUDE.md fetch, read Project (shared) + live sections only (via `indusk agent list` fresh partition), plans via status-filtered listing; keep lessons titles-hot pattern
- [ ] `list_plans` (tool + CLI) gains `--active` filter (frontmatter status ∈ in-progress set) used by catchup
- [ ] Wire sweep into rhythm: catchup runs `indusk agent sweep --dry-run` and surfaces the count; handoff runs the real sweep after `agent done`
- [ ] Resync installed `.claude/skills/` copies (skill-sync-parity test pins byte-equality)

#### Phase 4 Verification
- [ ] A6 passes: fresh `/catchup` transcript shows zero Graphiti calls, single CLAUDE.md ingestion, completes clean
- [ ] A5 re-measured and recorded (expected still red on this workbench until Phase 6 backfill — the diet mechanism is verified, the local win lands with the sweep)

#### Phase 4 Context
- [ ] Update CLAUDE.md Conventions catchup entry to the dieted read-set one-liner + pointer

#### Phase 4 Document
- [ ] Update `apps/docs/src/reference/skills/catchup.md` to the new read set + sweep wiring

### Phase 5: Hub push/pull rule distribution
- [ ] Promote flow: `indusk sync promote <lesson-id>` copies a project lesson into the InDusk package's shared channel (`apps/indusk-mcp/lessons/community/`), stamping provenance (source project, date); refuses non-existent/already-promoted ids
- [ ] Pull flow: `indusk sync pull` merges hub channel into the project's lessons — additive only, never overwrites a local lesson, idempotent (content-hash comparison); catchup runs it (surfacing "N new rules")
- [ ] Version surface: hub channel carries a monotonically bumped manifest consumed by `get_skill_versions`-style check so pull can short-circuit on no-change
- [ ] Vitest: A14 (pull-twice no-op; local-lesson collision preserved; provenance stamped) + promote-refusal cases

#### Phase 5 Verification
- [ ] A14 passes (`pnpm turbo test --filter=indusk-mcp -- sync`)
- [ ] A13 e2e smoke: promote a rule from this project, run `indusk sync pull` in a second project (scratch or chitin-sportsbook), rule file present there with provenance

#### Phase 5 Context
- [ ] Add CLAUDE.md Conventions one-liner: promote/pull flow, catchup cadence, additive-only invariant — pointer to `reference/cli/sync.md`

#### Phase 5 Document
- [ ] Write `apps/docs/src/reference/cli/sync.md` with promote/pull Mermaid flow diagram

### Phase 6: Workbench migration, compaction ritual, backfill
- [ ] Wire compaction into `/retrospective` skill: plan-close step demotes the plan's Current State narrative to one line + pointer and compresses any Conventions entries it authored; document the periodic pass
- [ ] A15 dry-run: run the compaction step against a sample archived plan's entries; review the diff shape (rule + pointer, not narrative)
- [ ] Compress this repo's CLAUDE.md to ≤ 60 KB: Conventions → 1–3-line rule + pointer; Current State → live/unmerged only, shipped plans one line + pointer; preserve the operative rule sentence of every entry (A4's subject)
- [ ] A4 sample gate: randomly sample 15 pre-compression entries (from git history), verify each operative rule still stated; record the sample in the plan folder
- [ ] Backfill: run `indusk agent sweep` (real) on this workbench's current.md; run `indusk plans archive-dead` (review `--dry-run` list first — master.md-referenced plans protected)
- [ ] Final MCP diet: project `.mcp.json` → exactly indusk/dash0/posthog/jaeger; global `~/.claude.json` → playwright only; **move the dash0 bearer token out of the committed `.mcp.json` into env/local config while editing it** (side finding, 2026-07-23)
- [ ] Retire indusk-infra: `docker stop`; docs note on data retention (FalkorDB volume kept until manually removed)

#### Phase 6 Verification
- [ ] A1 green (`wc -c` gate), A3 green (pointer walker), A4 sample recorded green, A11 green (plan list + archive intact), A12 green (keep-list diff), A15 dry-run diff reviewed
- [ ] A5 green: fresh `/catchup` measured ≤ ~15k tokens; numbers recorded against `baseline.md`

#### Phase 6 Context
- [ ] Rewrite CLAUDE.md Current State entry for this plan to the shipped one-liner (the compaction ritual eating its own dogfood)

#### Phase 6 Document
- [ ] Publish ADR to `apps/docs/src/decisions/indusk-makeover.md` (+ supersession note on context-budget references); changelog entry; before/after numbers into the context-budget guide

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/agents/sweep.ts` | new — stale-section sweep |
| `apps/indusk-mcp/src/lib/planning/archive-dead.ts` | new — dead-draft detector + archiver |
| `apps/indusk-mcp/src/bin/commands/agent.ts` | `sweep` subcommand |
| `apps/indusk-mcp/src/bin/commands/` (plans/sync) | `plans archive-dead`, `sync promote/pull` |
| `apps/indusk-mcp/hooks/claude-md-budget.js` | new — write-time budget hook |
| `apps/indusk-mcp/src/lib/eval/` (prompt builder) | Step 4 retarget to lessons |
| `apps/indusk-mcp/src/bin/commands/{init,update,extensions}.ts` | graphiti/CGC removal, hook + config scaffolding |
| `apps/indusk-mcp/skills/{catchup,handoff,retrospective,rail-check,planner,work}.md` | diet, sweep wiring, compaction, rail retarget |
| `CLAUDE.md`, `.mcp.json`, `.indusk/current.md`, `.indusk/planning/` | this-workbench migration + backfill |
| `apps/docs/src/` | guide/context-budget, reference/cli/{agent,plans,sync}, decisions/indusk-makeover, removal notices |

## Dependencies
- Coordinate Phase 6's CLAUDE.md churn with any concurrent session mid-merge (check `indusk agent list` first)
- Phase 3's rail smoke needs the `claude` CLI + eval hook operational (rail-check green before starting)

## Notes
- numero-workbench runs its consuming-side migration from its own plan copy after Phases 1–5 publish; keep decision changes synced both ways (brief's canonical-home note)
- Publish cadence: Phases 1–5 are upstream indusk-mcp work and should ship as one version (or two: mechanisms then removal) — do NOT publish mid-phase-3 with the rail half-retargeted (the 1.31.2/1.31.3 lesson)
- versioned-workbench (I.7) starts after this plan closes; its brief carries the cross-plan note about the semantic-graph piece
