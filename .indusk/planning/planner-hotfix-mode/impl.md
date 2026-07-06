---
title: "Planner Hotfix Mode"
date: 2026-07-01
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Planner Hotfix Mode

## Goal

Add `hotfix` as a fifth planner workflow: fix ships first on its own `hotfix/{slug}` branch, plan folder created retroactively with a fixed three-phase `impl.md` (deferred-Ship + mandatory-Backfill + trivial-Close), zero new hook mechanism — reusing `gate_policy: auto` and the existing Gate B, with the Close phase existing solely so Gate B's phase-transition trigger actually fires against Backfill's rows (see Notes: Gate B does not inspect a phase's own rows when that phase is terminal — discovered and verified empirically during Phase 1).

## Scope

### In Scope
- `check-gates.js` and `validate-impl-structure.js`: recognize `workflow: hotfix`, gate requirements matching `bugfix` (verification + document required; otel and context unconditionally excluded).
- `planner.md`: new workflow row, `argument-hint` update, hotfix flow description + embedded three-phase impl template (Ship/Backfill/Close), `hotfix-shipped` highlight trigger.
- `git.md`: `hotfix/{slug}` branch pattern.
- `apps/docs/src/reference/skills/plan.md`: Workflow Types table + Mermaid diagram gain the fifth branch.
- This ADR published to `apps/docs/src/decisions/planner-hotfix-mode.md`.
- A live dogfood: a real (trivial) bug in this repo fixed via the new hotfix flow end-to-end.

### Out of Scope
- No new `gate_policy` value, no new trajectory mechanic, no CLI tracking surface, no worktree-extension integration.
- No fix to the pre-existing workflow-dispatch duplication across the two hook files (flagged in research, not resolved here).
- No fix to the pre-existing "a trajectory row can be marked `skipped` without justification" gap (systemic, not unique to hotfix).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `hotfix` recognized by both hooks (regex + gate-requirement map entries); subprocess test fixtures pinning the before/after behavior | Existing `check-gates.js` / `validate-impl-structure.js` structure; existing subprocess-test pattern (`rationale-baseline-parity.test.ts`) |
| Phase 2 | `planner.md` hotfix workflow section (flow description, embedded 3-phase Ship/Backfill/Close template, highlight trigger, argument-hint); `git.md` branch entry; docs-site Workflow Types update; ADR published to `decisions/` | Phase 1's recognized `hotfix` value — the skill prose must describe what the hooks actually enforce |
| Phase 3 | A real, completed hotfix plan in `.indusk/planning/` (or archive) proving the flow end-to-end, including its own `/falsify` + `/retrospective` | Phase 1 (hooks) + Phase 2 (skill instructions), both must exist to dogfood against |

## Test Trajectory

Note on phase references below: `Phase N` in this table always means *this plan's own* phase (1, 2, or 3). A hotfix plan's own three internal phases are referred to by name — **Ship**, **Backfill**, **Close** — never by number, specifically to avoid colliding with this plan's own Phase 1/2/3 numbering.

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | A hotfix plan's Ship phase, with verification+document sections written as `skip-reason:` under `gate_policy: auto`, is accepted (not blocked) at write time. | Phase 0 | Phase 1 | passing |
| T2 | The identical Ship-phase content is blocked, with an error naming the missing section, when `gate_policy` is `strict` or `ask`. | Phase 0 | Phase 1 | passing |
| T3 | With `workflow: hotfix`, content that has real (or skip-reasoned) verification+document sections but *omits* otel and context sections entirely is accepted — hotfix's own lighter required set, not feature's full set. | Phase 0 | Phase 1 | passing |
| T4 | A hotfix plan's Ship phase, with zero trajectory rows targeting it, can be closed/advanced past without any row needing to reach a terminal state. | Phase 0 | Phase 0 | passing |
| T5 | In a hotfix plan shaped Ship → Backfill → Close, checking Close's own (single) implementation item is blocked while Backfill's trajectory row remains unresolved (`planned`/`writable`/`written`), with an error naming the row — and is allowed once that row reaches `passing`. This is `check-gates.js`'s existing Gate B, triggered by Close's item-check; it does **not** fire merely from checking Backfill's own items (verified empirically — see Notes). | Phase 0 | Phase 0 | passing |
| T6 | Running `/falsify` and `/retrospective` against a completed hotfix plan works end-to-end with no special-casing in either skill. | Phase 3 | Phase 3 | passing |
| T7 | Following the documented hotfix flow produces a branch named `hotfix/{slug}` — not `fix/{slug}`, not a worktree. | Phase 3 | Phase 3 | passing |
| T8 | A plan whose real `workflow:` frontmatter key is `feature` (or any non-hotfix value), but whose `title` or other frontmatter field contains the literal substring `workflow: hotfix`, is NOT misdetected as `workflow: hotfix` by `check-gates.js` or `validate-impl-structure.js` — the real workflow value still governs gate requirements. | Phase 0 | Phase 4 | planned |

### Deferred Verification

- **`hotfix-shipped` highlight fires on retroactive plan-folder creation**
  - reason: skill behavior is prose interpreted by an agent, not code — no harness in this project runs a full Claude session against a skill prompt and asserts which MCP tools it called, for any skill.
  - would require: an agent-behavior eval harness capable of driving a skill end-to-end and inspecting tool calls, which doesn't exist generally in this project (not just for hotfix mode).
  - mitigation: Phase 3's dogfood is a real run-through of the skill — if the highlight call is missing, `.indusk/highlights.jsonl` will visibly lack it and this plan's own retrospective will catch it. Standing mitigation beyond that: the eval-agent's scorecard rubric is the general-purpose compensating control for "did the agent follow the skill's prescribed behavior," across all skills.

### Trajectory Rationale

- **T6** `Writable at: Phase 3` — Subject under test is the hotfix workflow's actual end-to-end behavior (branch → PR → retroactive plan → backfill → falsify → retrospective), which doesn't exist as a runnable capability until both Phase 1 (hooks recognize `hotfix`) and Phase 2 (skill instructions describe the flow) have landed. Authoring the dogfood procedure against a real invocation earlier would have nothing real to run against.
- **T7** `Writable at: Phase 3` — Same dependency as T6; branch-naming is observed as part of the same dogfood run, not a separate mechanism.

## Checklist

### Phase 1: Hook recognition

- [x] Write T1/T2/T3 subprocess test fixtures (mirroring `rationale-baseline-parity.test.ts`'s spawn-with-synthetic-event pattern) against the **current, unmodified** hooks first — confirm each fails for the expected reason (T1/T3: blocked because `workflow: hotfix` falls through to `feature`'s stricter set; T2: blocked because `gate_policy` isn't `auto` — this one may already pass today for an unrelated reason, note it either way). Confirmed via live run: T1/T3 fail today with `Impl structure incomplete (workflow: feature, policy: auto): Phase 1 (Ship) is missing: OTel, Context` — red for the right reason. T2 already passes (ask-mode opt-out restriction is pre-existing, workflow-independent).
- [x] `check-gates.js`: add `hotfix` to the `detectWorkflow` regex (`/workflow:\s*(bugfix|refactor|feature|spike|hotfix)/`); add `hotfix: ["verification", "document"]` to `WORKFLOW_GATES_BASE` (no `"otel"` entry — matches `bugfix` exactly, unconditional exclusion, not filtered by `otelGateEnabled`). Applied to both `apps/indusk-mcp/hooks/check-gates.js` (source) and `.claude/hooks/check-gates.js` (this repo's own installed copy — otherwise the change wouldn't be live for dusk's own dogfood sessions).
- [x] `validate-impl-structure.js`: same regex addition; add `hotfix: { verification: true, otel: false, context: false, document: true }` to its inline map. Same both-copies treatment (`apps/indusk-mcp/hooks/` + `.claude/hooks/`).
- [x] Confirm T1/T2/T3 now pass against the modified hooks. All 6 assertions in `planner-hotfix-mode.test.ts` pass (T1-T5, T2 has no separate before/after distinction). Also reran `rationale-baseline-parity.test.ts` + `init-globsync-hooks.test.ts` as a regression check on the two hook files — 7 tests, all passing, unaffected.
- [x] Write T4 fixture (Ship phase, zero rows targeting it, closes freely) and T5 fixture (three-phase Ship→Backfill→Close shape; checking Close's item blocks while Backfill's row is unresolved, allows once `passing`) confirming `check-gates.js`'s existing Gate B behavior already holds for a `workflow: hotfix` fixture with no hotfix-specific hook code required — these should pass immediately, serving as regression coverage that the Phase 1 changes don't disturb this pre-existing mechanic. Confirmed passing on first run, both variants (blocked-while-written, allowed-once-passing).

#### Phase 1 Verification
- [x] T1 passes (`npx vitest run src/__tests__/planner-hotfix-mode.test.ts` from `apps/indusk-mcp` — 6/6 passing)
- [x] T2 passes
- [x] T3 passes
- [x] T4 passes (pre-existing behavior, confirmed unaffected)
- [x] T5 passes (pre-existing behavior, confirmed unaffected)

#### Phase 1 Context
- [x] Add a Known Gotchas entry noting the two hook files' independently-duplicated workflow-dispatch pattern now has a fifth entry in each — cross-reference for anyone touching either file next.

#### Phase 1 Document
- [x] (none needed — Phase 1 is hook code only, no user-facing surface yet; docs land in Phase 2)

### Phase 2: Skill + branch + docs-site

- [x] `planner.md`: add `hotfix` to the workflow dispatch table, `argument-hint`, and the parse rule (`bugfix`, `refactor`, `spike`, `feature`, `hotfix`). Also added a row to the "Not every plan needs all six" guide table and a pointer from step 1 of "What to Do When Asked to Plan" diverting hotfix to the new section entirely.
- [x] `planner.md`: added a new `## Hotfix Workflow` top-level section (not a numbered sub-step — hotfix's flow is different enough from the document-first steps that it needed its own section) describing the retroactive, three-phase hotfix flow — full embedded `impl.md` skeleton (frontmatter: `workflow: hotfix`, `gate_policy: auto`, `trajectory: required`; Phase 1 Ship all-deferred; Phase 2 Backfill mandatory with real trajectory rows/gates; Phase 3 Close — a single trivial item, explained as existing solely so Gate B's phase-transition check actually fires against Backfill's rows, not a real unit of work) and the `hotfix-shipped` highlight call, fired when the plan folder is created.
- [x] `git.md`: added `hotfix/{slug}` row to the branch naming table + two prose paragraphs — why it's distinct from `fix/{slug}`, and why hotfix branches skip the worktree question entirely (plain branch, stash-or-safety-commit, current working directory).
- [x] `apps/docs/src/reference/skills/plan.md`: added `hotfix` row to the Workflow Types table (now "Five workflow types"), a `Q2b` branch in the Mermaid decision diagram, a new `## Hotfix Workflow` section, and an invocation example.
- [x] Publish this ADR to `apps/docs/src/decisions/planner-hotfix-mode.md`.
- [x] Changelog entry added under `## [Unreleased]` / `### Added`.

#### Phase 2 Verification
- [x] (no tests flip at this phase — reason: schema-only) — this phase is documentation/prose; T1–T5 already validate the underlying mechanism in Phase 1, T6/T7 validate the described flow in Phase 3.

#### Phase 2 Context
- [x] Confirmed the CLAUDE.md Key Decisions one-liner (added at ADR acceptance) still accurately reflects what Phase 1 actually shipped, including the otel-exclusion correction (it already said "unconditionally excluded," matching what shipped).

#### Phase 2 Document
- [x] `apps/docs/src/reference/skills/plan.md` Workflow Types section + diagram updated (see checklist above — tracked here as the Document gate for this phase).

### Phase 3: Dogfood

- [x] Identified a real bug: live agent-facing skill/extension files still referencing the pre-rename `apps/indusk-docs` path (20 in the initial scope, ~34 once the falsification-phase widening is counted). `.indusk/planning/stale-indusk-docs-path` dogfood plan (archived at `.indusk/planning/archive/stale-indusk-docs-path/`).
- [x] Ran the full flow: `hotfix/stale-indusk-docs-path` branch, fix, real PR (#11, https://github.com/infinitedusky/indusk/pull/11), retroactive plan folder + `impl.md` (Ship phase documented + `infra`-reasoned), `hotfix-shipped` highlight fired successfully.
- [x] Completed Backfill for real — 20-assertion regression test authored and passing, confirmed it would have failed pre-fix.
- [x] Checked off Close's single item — **live-confirmed T5's mechanism against a real plan, not just the Phase 1 fixture**: the edit was accepted once Backfill's row reached `passing` (blocked when hand-tested with the row left `written`, matching the Phase 1 fixture's behavior exactly).
- [x] Ran `/falsify` against the dogfood hotfix plan — found 3 confirmed, real gaps (not synthetic): the published npm package still shipped every broken file (verified via `npm pack`), 10 live docs-site reference pages carried the same staleness, and this repo's own `CLAUDE.md` architecture section was itself wrong. All fixed in a Phase 4 the ritual authored, except the actual `npm publish` (blocked on missing credentials in this environment — promoted to a Deferred Verification row with a `scheduled-review` mitigation).
- [x] Ran `/retrospective` against the dogfood hotfix plan — archived, 2 lessons captured (`hotfix-content-fix-must-reach-distribution-channel`, `trajectory-no-tests-phrase-is-fixed-vocabulary`), lessons page published.

#### Phase 3 Verification
- [x] T6 passes (manual smoke — the full dogfood run, including a real PR and a real falsification cycle)
- [x] T7 passes (manual smoke — `hotfix/stale-indusk-docs-path` branch, confirmed distinct from `fix/{slug}`, not a worktree)

#### Phase 3 Context
- [x] CLAUDE.md Current State entry added in the dogfood plan's own commit, pointing at the archived dogfood plan as a worked example; this plan's own retrospective adds the `planner-hotfix-mode` entry itself.

#### Phase 3 Document
- [x] The dogfood surfaced two real gaps in `planner.md`'s hotfix section, both fixed in place: (1) the embedded template's Ship/Close Verification phrasing (a generic, freeform reason for having no tests at that phase) didn't satisfy the trajectory validator's cross-reference-integrity rule — corrected to the required `no tests flip at this phase` phrasing with an `infra` reason, plus an explanatory note so it's not a magic incantation; (2) the Backfill step now explicitly prompts "does this fix need to be published/deployed to reach consumers?" for fixes to distributed content, since the dogfood's own Ship phase missed exactly this and only caught it via `/falsify`.

### Phase 4: Falsification — unanchored workflow-detection regex misdetects on frontmatter substrings

**Goal**: verify whether `check-gates.js` and `validate-impl-structure.js` correctly detect a plan's `workflow:` value, or whether — like the previously-fixed `rationale_baseline` substring bug — an unanchored regex lets a *different* frontmatter field's text (most plausibly a `title` mentioning "workflow: hotfix", exactly the kind of title a plan *about* hotfix mode would have) silently override the real value. Confirmed by direct reproduction: a frontmatter block with `title: "Document explaining workflow: hotfix behavior"` followed by the real `workflow: feature` line returns `hotfix` as the first regex match, not `feature`. This makes misdetection strictly more dangerous than before this plan: silently landing on `hotfix` (the most permissive workflow, gates deferrable under `auto`) instead of the safe `feature` default is a worse failure than the pre-existing risk for the other four values.

- [ ] Anchor `check-gates.js`'s `detectWorkflow` regex to `/^workflow:\s*(bugfix|refactor|feature|spike|hotfix)/m` (line-anchored — same fix shape as the `rationale_baseline` precedent).
- [ ] Anchor `validate-impl-structure.js`'s equivalent regex the same way.

#### Phase 4 Verification
- [ ] T8: the substring-in-title case no longer misdetects; the real `workflow:` YAML key (at start of line, as YAML requires) still correctly detects the true value — before/after pair, same shape as the `rationale_baseline` regression fixture.

#### Phase 4 Context
- [ ] Add a CLAUDE.md Known Gotcha (or extend the existing workflow-dispatch-duplication one) noting both `workflow:` regexes are now line-anchored, and why — cross-reference the `rationale_baseline` precedent as the established pattern for this class of bug.

#### Phase 4 Document
- [ ] The CLAUDE.md Known Gotcha added in the Context item above doubles as the user-facing documentation for this fix — it's the mechanism by which a future plan author (or hook maintainer) learns that both `workflow:` regexes are line-anchored and why. No separate docs-site page — this is an internal hook-correctness fix, not a new capability.

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-mcp/hooks/check-gates.js` | `detectWorkflow` regex + `WORKFLOW_GATES_BASE` gain `hotfix` |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | workflow regex + inline requirements map gain `hotfix` |
| `apps/indusk-mcp/skills/planner.md` | workflow table, argument-hint, new flow-description step, embedded template, highlight trigger |
| `apps/indusk-mcp/skills/git.md` | `hotfix/{slug}` branch pattern |
| `apps/docs/src/reference/skills/plan.md` | Workflow Types table + diagram |
| `apps/docs/src/decisions/planner-hotfix-mode.md` | new — published ADR |
| new subprocess test file under `apps/indusk-mcp/src/__tests__/` | T1–T5 fixtures |
| `.indusk/planning/{dogfood-slug}/` | new — the Phase 3 dogfood plan itself |

## Dependencies
- None blocking. Touches the same two hook files as `tests-first-planning` and `rationale-baseline-frontmatter` (adjacent, no active conflict).

## Notes
- Known, accepted, out-of-scope limitation carried from the test plan: nothing stops a bad-faith Backfill trajectory row being marked `skipped` without real justification. Not addressed here.
- If Phase 3's dogfood surfaces a real gap in the mechanism itself (not just docs), reopen this impl rather than patching around it in the dogfood plan.
- **Design correction made during Phase 1 (2026-07-04):** the original brief/ADR/test-plan described a two-phase hotfix shape (Ship, Backfill-as-terminal), with T5 claiming Gate B would block Backfill from closing while unresolved. Empirical testing against the live `check-gates.js` (before writing any hook code) showed this was false: Gate B only inspects a phase's `Passes at` rows when a *later* phase's implementation item is checked — a terminal phase's own rows are never inspected. This is a real, previously-undocumented gap affecting every plan's terminal phase in this system, not unique to hotfix. Fixed by reshaping to three phases (Ship → Backfill → Close), where Close's single trivial item is what triggers Gate B's existing (correct, for non-terminal phases) inspection of Backfill's rows — verified both directions (blocks when unresolved, allows when `passing`) before finalizing the docs. `research.md`, `brief.md`, `adr.md`, and `test-plan.md` were all corrected in place rather than left describing the disproven two-phase design. A corresponding CLAUDE.md Known Gotcha records the general Gate B finding for future plans.
