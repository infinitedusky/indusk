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
| T1 | A hotfix plan's Ship phase, with verification+document sections written as `skip-reason:` under `gate_policy: auto`, is accepted (not blocked) at write time. | Phase 0 | Phase 1 | planned |
| T2 | The identical Ship-phase content is blocked, with an error naming the missing section, when `gate_policy` is `strict` or `ask`. | Phase 0 | Phase 1 | planned |
| T3 | With `workflow: hotfix`, content that has real (or skip-reasoned) verification+document sections but *omits* otel and context sections entirely is accepted — hotfix's own lighter required set, not feature's full set. | Phase 0 | Phase 1 | planned |
| T4 | A hotfix plan's Ship phase, with zero trajectory rows targeting it, can be closed/advanced past without any row needing to reach a terminal state. | Phase 0 | Phase 0 | planned |
| T5 | In a hotfix plan shaped Ship → Backfill → Close, checking Close's own (single) implementation item is blocked while Backfill's trajectory row remains unresolved (`planned`/`writable`/`written`), with an error naming the row — and is allowed once that row reaches `passing`. This is `check-gates.js`'s existing Gate B, triggered by Close's item-check; it does **not** fire merely from checking Backfill's own items (verified empirically — see Notes). | Phase 0 | Phase 0 | planned |
| T6 | Running `/falsify` and `/retrospective` against a completed hotfix plan works end-to-end with no special-casing in either skill. | Phase 3 | Phase 3 | planned |
| T7 | Following the documented hotfix flow produces a branch named `hotfix/{slug}` — not `fix/{slug}`, not a worktree. | Phase 3 | Phase 3 | planned |

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
- [ ] `check-gates.js`: add `hotfix` to the `detectWorkflow` regex (`/workflow:\s*(bugfix|refactor|feature|spike|hotfix)/`); add `hotfix: ["verification", "document"]` to `WORKFLOW_GATES_BASE` (no `"otel"` entry — matches `bugfix` exactly, unconditional exclusion, not filtered by `otelGateEnabled`).
- [ ] `validate-impl-structure.js`: same regex addition; add `hotfix: { verification: true, otel: false, context: false, document: true }` to its inline map.
- [ ] Confirm T1/T2/T3 now pass against the modified hooks.
- [x] Write T4 fixture (Ship phase, zero rows targeting it, closes freely) and T5 fixture (three-phase Ship→Backfill→Close shape; checking Close's item blocks while Backfill's row is unresolved, allows once `passing`) confirming `check-gates.js`'s existing Gate B behavior already holds for a `workflow: hotfix` fixture with no hotfix-specific hook code required — these should pass immediately, serving as regression coverage that the Phase 1 changes don't disturb this pre-existing mechanic. Confirmed passing on first run, both variants (blocked-while-written, allowed-once-passing).

#### Phase 1 Verification
- [ ] T1 passes (`pnpm turbo test --filter=indusk-mcp -- planner-hotfix-mode`)
- [ ] T2 passes
- [ ] T3 passes
- [ ] T4 passes (pre-existing behavior, confirmed unaffected)
- [ ] T5 passes (pre-existing behavior, confirmed unaffected)

#### Phase 1 Context
- [ ] Add a Known Gotchas entry noting the two hook files' independently-duplicated workflow-dispatch pattern now has a fifth entry in each — cross-reference for anyone touching either file next.

#### Phase 1 Document
- [ ] (none needed — Phase 1 is hook code only, no user-facing surface yet; docs land in Phase 2)

### Phase 2: Skill + branch + docs-site

- [ ] `planner.md`: add `hotfix` to the workflow dispatch table, `argument-hint`, and the parse rule (`bugfix`, `refactor`, `spike`, `feature`, `hotfix`).
- [ ] `planner.md`: add a numbered step (or sub-step of the existing impl-authoring step) describing the retroactive, three-phase hotfix flow — including the embedded `impl.md` skeleton (frontmatter: `workflow: hotfix`, `gate_policy: auto`, `trajectory: required`; Phase 1 Ship all-deferred; Phase 2 Backfill mandatory with real trajectory rows/gates; Phase 3 Close — a single trivial item, e.g. "confirm all Backfill trajectory rows are terminal" — explained as existing solely so Gate B's phase-transition check actually fires against Backfill's rows, not a real unit of work) and the `hotfix-shipped` highlight call (`mcp__indusk__highlight({ tag: "hotfix-shipped", level: "critical", note: "{slug}: {what broke + what shipped}" })`), fired when the plan folder is created.
- [ ] `git.md`: add `hotfix/{slug}` row to the branch naming table; short prose — stash or WIP safety-commit, branch off `main` in the current working directory, explicitly not a worktree.
- [ ] `apps/docs/src/reference/skills/plan.md`: add `hotfix` row to the Workflow Types table and a branch in the Mermaid decision diagram.
- [ ] Publish this ADR to `apps/docs/src/decisions/planner-hotfix-mode.md`.
- [ ] Changelog entry: "Added `hotfix` planner workflow — ship-first, backfill-mandatory fast path for production-down bugs."

#### Phase 2 Verification
- [ ] (no tests flip at this phase — reason: schema-only) — this phase is documentation/prose; T1–T5 already validate the underlying mechanism in Phase 1, T6/T7 validate the described flow in Phase 3.

#### Phase 2 Context
- [ ] Confirm the CLAUDE.md Key Decisions one-liner (added at ADR acceptance) still accurately reflects what Phase 1 actually shipped (in particular the otel-exclusion correction).

#### Phase 2 Document
- [ ] `apps/docs/src/reference/skills/plan.md` Workflow Types section + diagram updated (see checklist above — tracked here as the Document gate for this phase).

### Phase 3: Dogfood

- [ ] Identify one real, trivial, currently-true bug in this repo (or seed one deliberately, documented as such) suitable for a genuine hotfix dogfood.
- [ ] Run the full flow: `hotfix/{slug}` branch, fix, PR, retroactive plan folder + `impl.md` (Ship phase documented + skip-reasoned), confirm `hotfix-shipped` highlight appears in `.indusk/highlights.jsonl`.
- [ ] Complete Backfill for real (regression test authored + passing, verification/document gates filled in).
- [ ] Check off Close's single item — confirm this is genuinely blocked if attempted before Backfill's row reaches `passing`, then succeeds once it does (live confirmation of T5, not just the Phase 1 fixture).
- [ ] Run `/falsify` against the dogfood hotfix plan.
- [ ] Run `/retrospective` against the dogfood hotfix plan.

#### Phase 3 Verification
- [ ] T6 passes (manual smoke — the dogfood run itself)
- [ ] T7 passes (manual smoke — observe `hotfix/{slug}` branch name)

#### Phase 3 Context
- [ ] Add a Current State entry (or fold into this plan's own retrospective) noting hotfix mode is live, with a pointer to the dogfood plan as a worked example.

#### Phase 3 Document
- [ ] If the dogfood surfaces any gap in the `planner.md` hotfix section or `git.md` prose, fix it in place before closing this phase — the dogfood is the acceptance test for the documentation, not just the code.

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
