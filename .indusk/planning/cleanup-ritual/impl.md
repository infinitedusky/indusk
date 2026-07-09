---
title: "Cleanup Ritual"
date: 2026-07-06
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Cleanup Ritual

## Goal

Ship `/cleanup {plan}` — the plan-close decomposition ritual twinning `/falsify`. It investigates a plan's changed files, applies the enabled domain extensions' best practices, and authors a `### Phase N: Cleanup` into the plan's `impl.md` that `/work` executes and `/retrospective` gates on. No fifth gate type, no hook changes, no mechanical LOC ratchet — a Cleanup Phase is a normal phase; enforcement is a skill + an `isCleanupComplete` helper on the retrospective Step 0 gate.

> Trajectory IDs **T1–T13** map 1:1 by number to the test-plan's assertions **A1–A13** (`test-plan.md`); **T14–T16** cover the Phase 0 validator change. The table below is ordered by phase, not by number.
>
> **Phase 0** (bolted on per user request 2026-07-06) is a separate concern — it teaches the trajectory validator to accept `A`-prefixed test IDs in addition to `T` — landed first so the rest of the plan (and future plans) can use `A`. Commits stay siloed at phase granularity.

## Scope

### In Scope
- **(Phase 0, separate concern)** trajectory validator accepts `A`-prefixed test IDs alongside `T` — TS + JS port + parity test
- `cleanup` config block + TS reader with defaults; `init` scaffolds; `update` migrates idempotently
- File-flagging lib (changed-files-vs-merge-base + per-scope threshold) + optional thin CLI/lib helper
- `isCleanupComplete(planRoot)` + skip-check; retrospective Step 0 gate extension composed with falsification
- `/cleanup` skill (`cleanup.md`) as `falsify.md`'s twin; work/planner/falsify cross-references; skill sync
- Docs (ritual guide, skill reference, changelog, ADR-to-docs, Mermaid); dogfood on dusk

### Out of Scope
- Any new gate type / hook edit / mechanical LOC verdict (explicitly dropped — see ADR)
- Per-phase accretion nudge (deferred)
- Biome rule distribution; auto-refactoring codemods

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| 0 | trajectory validator accepts `[TA]\d+` IDs (cross-reference + rationale) — TS `validator.ts` + JS `validate-impl-structure.js` port + parity test | `trajectory/validator.ts`; the rationale-baseline-parity test pattern |
| 1 | `cleanup` config block + `getCleanupConfig()`/threshold reader (defaults in reader); init scaffold; update migration | `lib/config.ts` reader patterns; `init.ts` step 12; `update.ts` step 7c idiom |
| 2 | `lib/cleanup/oversized.ts` — `listOversizedChangedFiles(planRoot, baseRef)` returning `{path, loc, cap, scope}[]`; optional `indusk cleanup list` CLI | Phase 1 reader; preflight `git merge-base` + diff-union mechanics |
| 3 | `isCleanupComplete(planRoot)` + `isCleanupSkipped(implContent)` helpers; retrospective Step 0 gate extended to require cleanup AND falsification | falsification helpers as clone template |
| 4 | `apps/indusk-mcp/skills/cleanup.md`; work/planner/falsify cross-refs; init+update skill sync picks it up | Phases 1–3; `falsify.md` template; `extensions/{nextjs,react}/skill.md` |
| 5 | Docs guide + skill reference + changelog + `decisions/cleanup-ritual.md` + Mermaid; dusk dogfood | all prior phases |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | Kind | State |
|----|---------|-------------|-----------|------|-------|
| T5 | A hand-authored `### Phase N: Cleanup` phase (normal Verification/Context/Document gates) passes the existing `validate-impl-structure.js` and `check-gates.js` unchanged — proving no hook change is needed | Phase 0 | Phase 0 | vitest subprocess | planned |
| T7 | The config reader returns the built-in default threshold when no `cleanup` block is present | Phase 1 | Phase 1 | vitest unit | planned |
| T12 | `indusk update` adds `cleanup` config defaults idempotently (adds first run, reports already-set on re-run) without disturbing user content | Phase 0 | Phase 1 | vitest integration (subprocess) | planned |
| T6 | A 300-line changed file under a `components/**` scope (cap 200) is flagged; the same file outside every scope (global 400) is not | Phase 2 | Phase 2 | vitest integration (git fixture) | planned |
| T8 | Only files changed vs the merge-base are considered; an over-threshold untouched legacy file is never flagged | Phase 2 | Phase 2 | vitest integration (git fixture) | planned |
| T2 | A plan with an unrun Cleanup Phase and no skip frontmatter fails the retrospective Step 0 gate | Phase 3 | Phase 3 | vitest unit | planned |
| T3 | A plan with a terminal Cleanup Phase passes the retrospective Step 0 gate | Phase 3 | Phase 3 | vitest unit | planned |
| T4 | `cleanup: skipped` + non-empty `cleanup_reason` passes the gate; `cleanup: skipped` with no/empty reason still blocks | Phase 3 | Phase 3 | vitest unit | planned |
| T13 | The retrospective Step 0 gate passes only when BOTH falsification AND cleanup are satisfied (terminal-or-skipped); satisfying one alone still blocks | Phase 3 | Phase 3 | vitest unit | planned |
| T9 | The `cleanup` skill directs the agent to the enabled domain extensions' skills for "what to extract" (references domain skills, not a hardcoded framework) | Phase 0 | Phase 4 | vitest source-grep | planned |
| T1 | Running `/cleanup` on a plan that grew a file past its scope threshold authors a `### Phase N: Cleanup` naming the file and one+ recommended extractions/refactors | Phase 4 | Phase 4 | manual smoke | planned |
| T10 | numero's ≤200 + test-sibling convention on `packages/game-ui/src/components/**` is expressible entirely by editing numero's `cleanup` config block | Phase 4 | Phase 5 | manual smoke | planned |
| T11 | On dusk, running the ritual on a plan touching a >400-LOC source file authors a Cleanup Phase whose execution lands the file decomposed | Phase 4 | Phase 5 | manual smoke | planned |
| T14 | An impl whose trajectory table, Verification references, and rationale entries all use `A`-prefixed IDs validates with zero cross-reference/rationale errors (fails today; passes after the regex loosens) | Phase 0 | Phase 0 | vitest unit | planned |
| T15 | The TS validator and the JS hook port produce identical verdicts on an `A`-prefixed fixture (no TS↔JS drift) | Phase 0 | Phase 0 | vitest subprocess parity | planned |
| T16 | A Verification block referencing an `A`-ID that is absent from the trajectory table still errors — the prefix is broadened, the existence check is not disabled | Phase 0 | Phase 0 | vitest unit | planned |

### Deferred Verification

- **U1 — recommendation quality (right units extracted, no over-extraction)**
  - reason: decomposition quality is a judgment call with no mechanical oracle — the same reason `/falsify`'s hunt quality is not unit-tested.
  - would require: a ground-truth corpus of "correct" decompositions per codebase, which does not exist and would itself be subjective.
  - mitigation: the recommendations are authored into a phase a human reviews (accept/edit/reject) before `/work` runs it; the eval agent scores the authored phase per commit; best practices are sourced from the enabled domain extensions rather than invented. (feedback-signal + scheduled-review.)
- **U2 — "leave as-is" decisions are genuinely reasoned, not a rubber stamp**
  - reason: distinguishing sound restraint from work-avoidance requires judging intent; no mechanical test.
  - would require: intent inspection beyond static analysis.
  - mitigation: the decision + reasoning is recorded in the reviewable phase (or `cleanup_reason` frontmatter), visible in the retrospective audit and eval-scored — the `cleanup: skipped` confession is deliberately visible, like `falsification: skipped`. (feedback-signal.)

### Trajectory Rationale

- **T7** `Writable at: Phase 1` — the test imports the new config reader symbol authored in Phase 1; the import line is a compile error against today's stack.
- **T6** `Writable at: Phase 2` — the test imports `listOversizedChangedFiles` authored in Phase 2; no such export exists today.
- **T8** `Writable at: Phase 2` — same subject as T6 (the file-flagging lib authored in Phase 2).
- **T2** `Writable at: Phase 3` — the test imports `isCleanupComplete`, authored in Phase 3; compile error today.
- **T3** `Writable at: Phase 3` — same subject (`isCleanupComplete`, Phase 3).
- **T4** `Writable at: Phase 3` — the test imports `isCleanupSkipped`, authored in Phase 3.
- **T13** `Writable at: Phase 3` — the test exercises the composed retrospective gate wiring authored in Phase 3.
- **T1** `Writable at: Phase 4` — a manual smoke that runs `/cleanup`; the ritual skill it exercises is authored in Phase 4, so the procedure cannot be executed before then.
- **T10** `Writable at: Phase 4` — manual smoke running the ritual against numero; requires the Phase 4 skill to exist.
- **T11** `Writable at: Phase 4` — manual smoke running the ritual against a dusk plan; requires the Phase 4 skill to exist.

(T5, T12, T9 are `Writable at: Phase 0` — T5 asserts existing hooks already accept a Cleanup Phase; T12 runs today's `indusk update` and fails red because it does not yet add the block; T9 greps a skill file that is absent today. None need rationale.)

## Checklist

### Phase 0: Allow A-prefix trajectory IDs

- [ ] Loosen the two `T`-specific ID regexes in `apps/indusk-mcp/src/lib/trajectory/validator.ts`: line ~40 `TEST_ID_PATTERN = /\bT\d+\b/g` → `/\b[TA]\d+\b/g`, and line ~324 `/^-\s+\*\*(T\d+)\*\*/` → `/^-\s+\*\*([TA]\d+)\*\*/`. Keep it `[TA]` (not `[A-Z]`) so `H`/`P` refs don't false-match.
- [ ] Mirror both changes in the JS hook port `apps/indusk-mcp/hooks/validate-impl-structure.js` (lines ~511, ~703); sync to `.claude/hooks/` (run `indusk update` or copy) so the change is live in this repo. `check-gates.js` needs no change (it matches rows by phase number, reading IDs verbatim).
- [ ] Note the allowance in the trajectory guide + the planner skill's trajectory template comment (T is still the recommended default; A is accepted for acceptance-style IDs).

#### Phase 0 Verification
- [ ] T14 passes — unit test: an `A`-prefixed fixture validates clean (authored red against today's `T`-only regex, goes green here).
- [ ] T15 passes — TS↔JS parity test on an `A`-prefixed fixture (clone the `rationale-baseline-parity.test.ts` shape).
- [ ] T16 passes — unit test: an unknown `A`-ID referenced but absent from the table still errors.

#### Phase 0 Context
- [ ] Add to CLAUDE.md Known Gotchas: the trajectory validator accepts `[TA]\d+` IDs (cross-reference + rationale); `check-gates.js` is unaffected (reads IDs verbatim); keep the change in lockstep across TS + JS port.

#### Phase 0 Document
- [ ] Update the Test Trajectory guide (`apps/docs/src/guide/test-trajectory.md`) to state that `A`-prefixed IDs are accepted alongside `T`.

### Phase 1: Config block + reader

- [ ] Add a `cleanup` block to the `InduskConfig` documentary interface in `apps/indusk-mcp/src/lib/config.ts`: `cleanup?: { max_file_loc?: number; scopes?: { include: string; max_file_loc?: number; test_sibling?: boolean }[] }`.
- [ ] Add `getCleanupConfig(projectRoot)` + `resolveCapForPath(path, config)` readers with module-level default constants (`DEFAULT_MAX_FILE_LOC = 400`), following the `getEvalModel`/`getStaleTtlMinutes` type-guard-at-read pattern. Absence of the block → defaults; absence of a matching scope → global default.
  ```typescript
  const DEFAULT_MAX_FILE_LOC = 400;
  function resolveCapForPath(path: string, cfg: CleanupConfig): { cap: number; scope?: string; testSibling: boolean }
  ```
- [ ] `init.ts` step 12: scaffold a default `cleanup: { max_file_loc: 400, scopes: [] }` into the config object literal (unconditional, like `agents.stale_ttl_minutes`).
- [ ] `update.ts` (new step alongside 7c): read-check-spread-write — if `config.cleanup` is missing, add the default block and print `add: cleanup.max_file_loc: 400`; if present print `ok: cleanup (already set)`. Idempotent.

#### Phase 1 Verification
- [ ] T7 passes — `pnpm turbo test --filter=indusk-mcp -- cleanup-config` (reader returns default when block absent).
- [ ] T12 passes — subprocess `indusk update` test adds the block on first run, reports already-set on second, preserves user content. (T12 was authored red at Phase 0; it goes green here.)

#### Phase 1 Context
- [ ] Add to CLAUDE.md Conventions: the `cleanup` config block shape + that the threshold is attention-focus (not a blocking cap), read by the `/cleanup` skill.

#### Phase 1 Document
- [ ] Add the `cleanup` block to the config reference doc (the same page that documents `otel.role`, `eval.*`, `agents.*`) — fields, defaults, scope semantics.

### Phase 2: File-flagging lib

- [ ] Author `apps/indusk-mcp/src/lib/cleanup/oversized.ts` exporting `listOversizedChangedFiles(planRoot, baseRef?)`: compute changed files as the sort-u union of `git diff --name-only <merge-base>..HEAD` + `--cached` + unstaged (the preflight mechanics), filter to extant source files, count LOC, and return `{ path, loc, cap, scope, isNew }[]` for those over their resolved cap. Base-ref resolution defaults to the configured base branch → `git merge-base`, with the preflight fallback for remote-less dev.
- [ ] Optional: a thin `indusk cleanup list` CLI subcommand wrapping the lib (for the eval agent + manual use). Non-blocking.

#### Phase 2 Verification
- [ ] T6 passes — git-fixture test: scoped 300-line file flagged inside `components/**`, not outside.
- [ ] T8 passes — git-fixture test: untouched over-threshold file never flagged; only merge-base-diff files considered.

#### Phase 2 Context
- [ ] Add to CLAUDE.md Known Gotchas: the file-flagging lib reuses the preflight `git merge-base` + three-way-diff-union; base-ref resolution + the empty-set fast path.

#### Phase 2 Document
- [ ] Reference the `oversized` lib / `indusk cleanup list` in the CLI reference (inputs, output shape).

### Phase 3: Retrospective gate helpers

- [ ] Author `isCleanupComplete(planRoot)` + `isCleanupSkipped(implContent)` as near-clones of the falsification helpers (same lib module family), returning the terminal/skip verdicts.
- [ ] Extend the retrospective skill's Step 0 gate so it requires cleanup AND falsification: pass iff `(isFalsificationComplete || falsificationSkipped)` AND `(isCleanupComplete || cleanupSkipped)`. Compose additively — coordinate with any `documentation-phase-gate` change to the same gate.

#### Phase 3 Verification
- [ ] T2, T3, T4 pass — unit tests on `isCleanupComplete`/`isCleanupSkipped` (unrun blocks; terminal passes; skip-with-reason passes; skip-without-reason blocks).
- [ ] T13 passes — composed-gate unit test (both required; one-alone blocks).

#### Phase 3 Context
- [ ] Add to CLAUDE.md Conventions: `/retrospective` Step 0 now hard-blocks without cleanup as well as falsification; the `isCleanupComplete` + `cleanup: skipped`/`cleanup_reason` shapes.

#### Phase 3 Document
- [ ] Update the retrospective skill reference doc: Step 0 gate now requires both rituals; document the cleanup skip frontmatter.

### Phase 4: The /cleanup skill

- [ ] Author `apps/indusk-mcp/skills/cleanup.md` as `falsify.md`'s twin: read changed files (via the Phase 2 lib), flag over-threshold files, direct the agent to the **enabled domain extensions' skills** for what-to-extract, and author `### Phase N: Cleanup — {summary}` (extractions as checklist items, new units as trajectory rows) OR set `cleanup: skipped` + `cleanup_reason`. Include the "leave as-is is a first-class recorded decision" and "recommend only what best practices warrant (no over-extraction)" guidance.
- [ ] Cross-reference the ritual order in `work.md` (close-out sequence: falsify → work → cleanup → work → retro), `planner.md` (lifecycle), and `falsify.md` (points to cleanup as the next ritual).
- [ ] Confirm `init.ts` + `update.ts` `globSync("*.md")` skill sync picks up `cleanup.md` (both sides — the hardcoded-vs-glob lesson).

#### Phase 4 Verification
- [ ] T9 passes — source-grep test: `cleanup.md` references the enabled domain extensions' skills for extraction guidance (not a hardcoded framework).
- [ ] T1 passes — manual smoke: `/cleanup` on a fixture plan that grew a file authors a Cleanup Phase naming the file + recommendations.

#### Phase 4 Context
- [ ] Add to CLAUDE.md Conventions/Current State: `/cleanup` skill live; the ritual order; skill lives at `apps/indusk-mcp/skills/cleanup.md` (edit there, sync via update).

#### Phase 4 Document
- [ ] Write the skill reference page `apps/docs/src/reference/skills/cleanup.md`.

### Phase 5: Docs + dogfood

- [ ] Write `apps/docs/src/guide/cleanup-ritual.md` (twin of the falsification-ritual guide) with a Mermaid sequence of the close-out flow `work → falsify → work → cleanup → work → retrospective`.
- [ ] Publish the ADR to `apps/docs/src/decisions/cleanup-ritual.md`; add both new pages to the docs sidebar.
- [ ] Changelog entry. Update any "plan lifecycle" page to insert cleanup after falsification.
- [ ] Dogfood: run `/cleanup` on a dusk plan that touched a >400-LOC source file; execute the authored Cleanup Phase.

#### Phase 5 Verification
- [ ] T10 passes — manual smoke: numero E-PNM-1 expressible via config alone.
- [ ] T11 passes — manual smoke: dusk dogfood decomposes a real >400-LOC file via an authored Cleanup Phase.

#### Phase 5 Context
- [ ] Update CLAUDE.md Current State: cleanup-ritual shipped; note the docs pages and the dogfood result.

#### Phase 5 Document
- [ ] Ensure the changelog + guide + ADR + skill reference are all cross-linked and in the sidebar (the add-to-sidebar lesson).

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/trajectory/validator.ts` | Phase 0 — loosen the two ID regexes to `[TA]\d+` |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` (+ `.claude/hooks/` sync) | Phase 0 — mirror the `[TA]\d+` loosening in the JS port |
| `apps/indusk-mcp/src/lib/config.ts` | `cleanup` block in interface + `getCleanupConfig`/`resolveCapForPath` readers |
| `apps/indusk-mcp/src/bin/commands/init.ts` | scaffold default `cleanup` block (step 12) |
| `apps/indusk-mcp/src/bin/commands/update.ts` | idempotent `cleanup` migration step |
| `apps/indusk-mcp/src/lib/cleanup/oversized.ts` | new — file-flagging lib |
| `apps/indusk-mcp/src/bin/commands/cleanup.ts` (opt.) | thin `indusk cleanup list` CLI |
| `apps/indusk-mcp/src/lib/**` (falsification helper family) | `isCleanupComplete` + `isCleanupSkipped` |
| retrospective skill Step 0 gate | require cleanup AND falsification |
| `apps/indusk-mcp/skills/cleanup.md` | new — the ritual skill |
| `apps/indusk-mcp/skills/{work,planner,falsify}.md` | cross-reference the ritual order |
| `apps/docs/src/{guide/cleanup-ritual,reference/skills/cleanup,decisions/cleanup-ritual}.md` | new docs + sidebar |
| `apps/docs/src/changelog.md` | entry |

## Dependencies
- `apps/indusk-mcp/skills/falsify.md` (the template) and the falsification helper module (the clone source) must exist — they do.
- Loosely coordinate with `.indusk/planning/documentation-phase-gate/` on the retrospective Step 0 composition.

## Notes
- **T5 is the design's proof-of-claim** — verify it FIRST (Phase 0, before any code): a hand-authored Cleanup Phase must pass the existing hooks unchanged. If it doesn't, the "no gate-machinery cost" premise is wrong and the plan must be reconsidered.
- The optional CLI (Phase 2) and trajectory-rows-per-extraction (skill authoring detail) are the two soft calls; default to pure-lib + let the skill decide per-extraction whether a new test is warranted.
