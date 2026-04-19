---
title: "Rationale Baseline Frontmatter"
date: 2026-04-19
status: in-progress
workflow: bugfix
trajectory: required
rationale: required
gate_policy: ask
---

# Rationale Baseline Frontmatter

## Goal

Add a `rationale_baseline: N` frontmatter key (integer, default `0`) that lets a plan declare its writable baseline. Trajectory rows with `Writable at <= baseline` are exempt from the `### Trajectory Rationale` subsection. Default behavior preserves today's exact behavior; refactor / schema-migration / scaffolding plans that have Phase 1 as their enabling work can set `rationale_baseline: 1` and stop tripping the hook on every legitimate edit.

After this ships: Numero's three queued plans (`restart-recovery`, `coc4-verification-debt-audit`, `drop-compat-views`) can be authored cleanly with the new key. The heredoc-bypass workaround pattern that table-lifecycle-unification taught the agent stops being necessary. The "hooks are optional when inconvenient" precedent is removed before it calcifies.

## Scope

### In Scope
- `apps/indusk-mcp/src/lib/trajectory/validator.ts` — extend `ValidateTrajectoryOptions` with `rationaleBaseline?: number`; thread baseline through `validateRationaleCompleteness`
- `apps/indusk-mcp/hooks/validate-impl-structure.js` (and `.claude/hooks/` mirror) — parse `rationale_baseline` from frontmatter, pass through; baseline-aware error messages
- New TS unit tests in `apps/indusk-mcp/src/lib/trajectory/validator.test.ts` covering A1–A5 (baseline-honored pass, baseline-aware error naming, regression for default behavior, dynamic phase number in messages, TS↔JS parity)
- Documentation: trajectory frontmatter doc page (likely `apps/indusk-docs/src/guide/test-trajectory.md` or `apps/indusk-docs/src/reference/trajectory/parser.md` — verify in impl) gains a paragraph naming the new key
- Bump indusk-mcp version + publish + smoke on Numero (A6 generalization)

### Out of Scope
- Multi-phase baselines (`rationale_baseline: [1, 3]`) — one integer is sufficient, brief Out of Scope already names this
- Per-row override of the rationale-exempt status — if a row needs an exception, it should have a real rationale entry (existing escape hatch)
- Migrating existing plans to use the new key — that's consumer-side follow-up in each plan's own authoring
- Linting heredoc-bypass patterns — separate small follow-up plan worth considering, not this one
- Other validator rules (cross-reference-integrity, temporal-coherence, deferred-completeness) — out of scope; only `rationale-completeness` changes

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | TS source (`validator.ts`) gains `rationaleBaseline` option + filter logic + dynamic error messages. JS hook port (`validate-impl-structure.js` ×2 — package + project) gets the same parsing + filter logic. Unit tests covering A1–A5 (incl. parity check). All tests pass. | (existing trajectory parser, no new deps) |
| Phase 2 | Indusk docs page documenting the new frontmatter key (default, when to use, example). A7 passes. | Phase 1 (the doc references the implemented feature, not vice versa) |
| Phase 3 | Bump indusk-mcp version → 1.25.0; publish; user upgrades global on dusk + Numero; manual smoke on Numero authoring an impl.md with the new key (A6 passes). | Phase 1 (the fix being live in global install), Phase 2 (the doc is reference-able) |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | When impl.md frontmatter has `rationale_baseline: 1` and every trajectory row is `Writable at: Phase 1` or earlier, and `### Trajectory Rationale` is empty (or absent), the validator passes with no error. | Phase 0 | Phase 1 | passing |
| T2 | When impl.md frontmatter has `rationale_baseline: 1` and one trajectory row is `Writable at: Phase 3` and `### Trajectory Rationale` is empty, the validator fails with an error message naming the single Phase-3 row's T-ID. | Phase 0 | Phase 1 | passing |
| T3 | When impl.md frontmatter omits `rationale_baseline`, validator behavior matches today's exactly: rows at `Writable at > Phase 0` need rationale; rows at `Writable at: Phase 0` don't. (Backward compat regression.) | Phase 0 | Phase 1 | passing |
| T4 | The error message for a baseline-aware plan reads "later than Phase {baseline}" (dynamic phase number), not hardcoded "Phase 0". | Phase 0 | Phase 1 | passing |
| T5 | The TS source (`validator.ts`) and the JS hook port (`validate-impl-structure.js`) produce identical pass/fail decisions for the same impl.md content across a shared fixture set. (Parity check — load-bearing per CLAUDE.md gotcha about JS-port-mirrors-TS.) | Phase 0 | Phase 1 | passing |
| T6 | After upgrading global indusk-mcp on Numero, an impl.md with `rationale_baseline: 1` and rows all at `Writable at: Phase 1` can be edited freely without the hook rejecting the edit (live smoke on the real Claude Code Edit pipeline). | Phase 0 | Phase 3 | planned |
| T7 | Indusk docs (the trajectory-frontmatter reference page) names the new `rationale_baseline` key, gives its default (`0`), and explains when to use a higher value. | Phase 0 | Phase 2 | passing |

(All rows are Phase-0-writable per the rationale-quality discipline. The current TS source / JS port / doc page exist today; tests can be authored against them and will fail red until the fix lands. No `### Trajectory Rationale` subsection needed below — every row is Phase 0.)

## Checklist

### Phase 1: Validator change + parity tests

- [x] (write red) Add 5 unit tests to `apps/indusk-mcp/src/lib/trajectory/validator.test.ts` covering T1–T5. Each asserts the expected behavior post-fix; all 5 should fail red against current source.
- [x] Extend `ValidateTrajectoryOptions` in `apps/indusk-mcp/src/lib/trajectory/validator.ts` with optional `rationaleBaseline?: number` (default `0`).
- [x] Update `validateRationaleCompleteness(body, trajectory, baseline)` (or thread baseline through `validateTrajectory(body, options)` → internal call) so the row filter uses `r.writableAt > baseline` instead of `r.writableAt > 0`.
- [x] Update both error messages in `validateRationaleCompleteness` to use the dynamic baseline value: `"later than Phase ${baseline}"` instead of hardcoded "Phase 0". Wording per the brief (and per A4).
- [x] Mirror the same change in the JS hook port at `apps/indusk-mcp/hooks/validate-impl-structure.js`: parse `rationale_baseline` from frontmatter (extend the existing frontmatter-regex parsing), thread to `validateRationaleCompleteness`, update error messages.
- [x] Sync to `.claude/hooks/validate-impl-structure.js` (the project-installed mirror) — `cp` from package source.
- [x] Audit `apps/indusk-mcp/hooks/check-gates.js` and `gate-reminder.js` for any duplicate rationale-baseline-relevant logic. If present, sync; if not, note that the rule is centralized in `validate-impl-structure.js` only. (Confirmed: rule is centralized in `validate-impl-structure.js`; the other two hooks only read `writableAt` for unrelated gate-flip logic.)
- [x] Run all trajectory tests; T1–T5 all pass.

#### Phase 1 Verification
- [x] T1, T2, T3, T4, T5 pass (`pnpm vitest run src/lib/trajectory/validator.test.ts`)
- [x] Existing trajectory tests (74 prior passing per latest run) still all pass — no regression in unrelated rules (82 total pass: 74 prior + 5 new + 3 others)

#### Phase 1 Context
- [x] Add to CLAUDE.md Key Decisions: "**Trajectory `rationale_baseline` frontmatter key** — plans can declare their writable baseline via `rationale_baseline: N` frontmatter (integer, default 0). Rows with `Writable at <= baseline` are exempt from the `### Trajectory Rationale` subsection. Use when Phase 1 IS the enabling work (refactor / schema migration / scaffolding) and tests can't be written against the pre-Phase-1 stack. Default 0 preserves all existing plan behavior. See `.indusk/planning/rationale-baseline-frontmatter/`."

#### Phase 1 Document
- [x] (folded into Phase 2 — the indusk docs page covers this)

### Phase 2: Documentation

- [x] Identify the existing trajectory-frontmatter doc page (`apps/indusk-docs/src/guide/test-trajectory.md` or `apps/indusk-docs/src/reference/trajectory/parser.md` — read both, pick the right home for frontmatter-key documentation). If neither covers frontmatter keys explicitly, add a "Frontmatter keys" section to the guide. (Picked `guide/test-trajectory.md`; `parser.md` is technical reference and didn't mention `rationale: required` either — added there.)
- [x] Add a section / paragraph documenting `rationale_baseline`: name, type (integer), default (`0`), what it means, when to use it (refactor / schema-migration / scaffolding plans where Phase 1 IS the enabling work), example frontmatter snippet. (Added new "## Trajectory Rationale and the `rationale_baseline` key" section + frontmatter key reference table; also documented the previously-undocumented `rationale: required` opt-in and bumped "four validator rules" → five.)
- [x] Add a small example showing a plan that uses `rationale_baseline: 1` (e.g., a hypothetical migration plan with rows all at `Writable at: Phase 1`). (Inline frontmatter snippet using table-lifecycle-unification as the canonical case study.)
- [x] Verify the doc renders cleanly via `pnpm turbo dev --filter=indusk-docs` or static grep — A7 passes. (Static grep: 6 occurrences of `rationale_baseline`, default `0` documented in key-reference table, scaffolding/migration use cases named.)

#### Phase 2 Verification
- [x] T7 passes (the documented page contains `rationale_baseline`, names default `0`, names the use case)

#### Phase 2 Context
- [x] (none needed — Phase 1 covered the CLAUDE.md update)

#### Phase 2 Document
- [x] (this phase IS the document phase)

### Phase 3: Ship + Numero smoke

- [ ] Bump `apps/indusk-mcp/package.json` version → 1.25.0 (small feature addition, user-visible new frontmatter key — minor bump appropriate).
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` describing the new key, the default, and the immediate consumer benefit (Numero's blocked plans can author cleanly).
- [ ] Build + publish + upgrade global (user action). `prepublishOnly` hook from 1.23.1 will rebuild dist automatically.
- [ ] (T6 verification) Author one of Numero's queued plans (`restart-recovery` or whichever is most ready) using `rationale_baseline: 1` in its impl frontmatter. Edit the impl.md repeatedly with rows at `Writable at: Phase 1` only and an empty Rationale subsection. Observe: zero hook rejections. T6 passes.
- [ ] Confirm dusk's existing plans (which omit the key) continue to behave identically — edit any current impl.md and confirm the validator's behavior is unchanged. Backward compat smoke.

#### Phase 3 Verification
- [ ] T6 passes on Numero (manual smoke; confirmed by editing an impl.md with the new key, observing no hook rejection)
- [ ] dusk regression smoke: existing plans without the key still validate exactly as before

#### Phase 3 Context
- [ ] Update CLAUDE.md "Current State" with one sentence: "rationale-baseline-frontmatter shipped (1.25.0) — plans can declare `rationale_baseline: N` to exempt rows at or below that phase from the Trajectory Rationale subsection. Refactor / migration / scaffolding plans no longer trip the hook on legitimate Phase-1-baseline authoring."

#### Phase 3 Document
- [ ] (folded into Phase 2's docs page, plus the changelog entry above)

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/trajectory/validator.ts` | `ValidateTrajectoryOptions.rationaleBaseline?: number`; thread through `validateRationaleCompleteness`; baseline-aware error messages |
| `apps/indusk-mcp/src/lib/trajectory/validator.test.ts` | 5 new tests (T1–T5) |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | Parse `rationale_baseline` from frontmatter; thread to validator; baseline-aware error messages (mirror TS source) |
| `.claude/hooks/validate-impl-structure.js` | `cp` from package source (project-installed mirror) |
| `apps/indusk-mcp/package.json` | Version bump 1.24.5 → 1.25.0 |
| `apps/indusk-docs/src/changelog.md` | New 1.25.0 entry |
| `apps/indusk-docs/src/guide/test-trajectory.md` (or `apps/indusk-docs/src/reference/trajectory/parser.md`) | New section / paragraph documenting `rationale_baseline` |
| `CLAUDE.md` | Key Decisions entry + Current State one-liner |

## Dependencies

None at code level. Depends on the existing trajectory validator infrastructure being in place (it is — 74 tests passing per latest run).

## Notes

- **Recursive dogfood opportunity** (note, not action): once shipped, this plan's OWN impl could declare `rationale_baseline: 0` (the default) — which is what it currently does implicitly. So no migration of this plan's own frontmatter needed. The dogfood instances are Numero's three queued plans.
- **Single source of truth**: per CLAUDE.md gotcha, the JS port is a MINIMAL mirror of the TS source. T5 (parity check) is structurally important — without it, drift between the two implementations is the most likely future bug class.
- **Why this is a feature bump (1.25.0) not a patch (1.24.6)**: it adds a user-visible frontmatter key with documented behavior. Feature in scope, even though the implementation is small. Patch versioning is for bug fixes that don't add API surface.
- **Numero's three queued plans** are the canonical consumer-side validation. After 1.25.0 ships and Numero upgrades, those plans should be authored with `rationale_baseline: 1` from day one. That's not in this plan's scope (each plan owns its own frontmatter), but it IS the proof of value.
