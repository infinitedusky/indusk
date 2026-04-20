---
title: "Falsify Phase Authoring — Impl"
date: 2026-04-20
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Falsify Phase Authoring — Impl

## Goal

Change `/falsify` from a test-running ritual into a phase-authoring action that appends a new phase to the plan's impl.md with hypothesis tests + fix items. Update the retrospective gate to accept "all impl phases terminal" as a pass condition alongside the legacy `isFalsificationComplete` path. Ships as indusk-mcp 1.27.4 so the three pending retros (admin-ui-hosting, indusk-admin-ui, eval-agent-mcp-access) can use the new flow.

## Scope

### In Scope

- Rewrite `apps/indusk-mcp/skills/falsify.md` to describe phase-authoring flow
- Sync to `.claude/skills/falsify/SKILL.md` (installed copy in this repo)
- Update `apps/indusk-docs/src/guide/falsification-ritual.md` user-facing guide
- Update `apps/indusk-mcp/skills/retrospective.md` Step 0 gate: accept "all impl phases terminal" in addition to existing `isFalsificationComplete` / `isFalsificationSkipped`
- Sync to `.claude/skills/retrospective/SKILL.md`
- Regression test proving legacy `falsification.md` gate path still works (A6)
- Version bump + changelog + publish as 1.27.4
- Dogfood on admin-ui-hosting (the first real use of the new flow)

### Out of Scope

- Deprecating `apps/indusk-mcp/src/lib/falsification/log.ts` (kept for legacy reads)
- `validate-impl-structure.js` changes (no new phase type)
- `check-gates.js` changes (phase-close rules unchanged)
- Admin-UI styling for falsification phases (future polish)
- Migrating archived plans' `falsification.md` files to phases (stay as-is)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Skill files rewritten (falsify.md + mirror), guide doc updated, retrospective gate tweaked (+ mirror), vitest regression test for legacy `falsification.md` path. | Existing skill + guide + retrospective gate code + the falsification/log.ts library (unchanged). |
| Phase 2 | Shipped 1.27.4 on npm + dogfooded on admin-ui-hosting (first use of the new flow). | Phase 1. |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Running `/falsify {plan}` on a plan with all prior phases terminal appends a new phase to impl.md (named with a recognizable falsification prefix) containing trajectory rows for hypothesis tests + implementation items for fixes + standard Verification / Context / Document gates. | Phase 0 | Phase 2 | planned |
| T2 | Running `/falsify {plan}` does NOT execute any tests — no vitest runs, no test-runner subprocess. The skill's output is the modified impl.md. | Phase 0 | Phase 2 | planned |
| T3 | After `/falsify` runs, the plan's impl status is still `in-progress` (not `completed`) because the newly authored phase is unchecked. | Phase 0 | Phase 2 | planned |
| T4 | `/work {plan}` picks up a falsification-authored phase like any other phase — authors writable-at-phase tests at phase start, runs items, flips trajectory states at phase close. | Phase 0 | Phase 2 | planned |
| T5 | `/retrospective {plan}` closes a plan whose impl has all phases terminal (including a falsification phase from the new flow) without requiring a `falsification.md` file in the plan folder. | Phase 0 | Phase 2 | planned |
| T6 | A legacy plan with a completed `falsification.md` file (archived falsification-ritual plan as fixture) still passes `/retrospective`'s Step 0 gate via `isFalsificationComplete` — no regression. | Phase 0 | Phase 1 | planned |

## Checklist

### Phase 1: Skill + guide + retrospective gate + regression test

**Goal**: the behavior change lands and the backwards-compat regression is locked in. After this phase, a hand-invoked `/falsify` on a plan authors a phase; `/retrospective` on a legacy plan with `falsification.md` still works.

- [x] Rewrite `apps/indusk-mcp/skills/falsify.md`:
  - Change "How to hunt" to end at "form a specific hypothesis" + "write the hypothesis as a trajectory row in a new Phase N+1" (not "write the test and run it")
  - Replace "Three outcomes per failing test" section with "What the new phase contains": (a) trajectory rows for hypothesis tests (`T-ID | Asserts | Writable at | Passes at | State`, one per hypothesis, Writable at = Phase 0 typically since tests can be authored against current behavior), (b) implementation items for the fixes under an `### Phase N+1: Falsification — {summary}` heading, (c) Verification / Context / Document gates referencing the trajectory rows
  - Replace "Loop exit (hybrid)" to terminate when no more in-scope hypotheses can be formed; call `markTerminated` replaced with "stop adding rows to the phase"
  - Replace "Output" section: the output is the modified impl.md with a new phase, not `falsification.md`
  - Keep "When to skip the ritual entirely" unchanged (`falsification: skipped` + reason stays a legitimate opt-out)
  - Update cross-references to `falsification.md`-based behavior
- [x] Mirror the rewritten skill to `.claude/skills/falsify/SKILL.md` (the installed copy in this repo). Verified byte-identical via `diff -q`.
- [x] Update `apps/indusk-docs/src/guide/falsification-ritual.md` user-facing guide:
  - Rewrite the "How to run" section to describe phase-authoring flow
  - Add a "Legacy plans (archived before 1.27.4)" section noting that plans with `falsification.md` files stay readable via the library but new plans use impl phases
  - Update any sequence diagram or code snippet that shows the old inline-test-running flow
- [ ] Update `apps/indusk-mcp/skills/retrospective.md` Step 0 gate:
  - Current logic: check `isFalsificationComplete(planRoot)` or `isFalsificationSkipped(implContent).skipped`. If neither, block.
  - New logic: check ONE of: (a) `isFalsificationComplete(planRoot)` — legacy path, (b) `isFalsificationSkipped(implContent).skipped` — explicit skip, (c) all impl phases terminal (via trajectory parser inspection of the impl) — new path.
  - Pseudocode: `if (isFalsificationComplete(planRoot) || isSkipped || allPhasesTerminal(impl)) { pass } else { block }`
- [ ] Mirror retrospective update to `.claude/skills/retrospective/SKILL.md`.
- [ ] Write regression test at `apps/indusk-mcp/src/__tests__/retrospective-gate-backcompat.test.ts`:
  - Set up a tmp plan folder with a `falsification.md` file whose content is a completed log (terminator entry present)
  - Import `isFalsificationComplete` from `apps/indusk-mcp/src/lib/falsification/log.ts`
  - Assert `isFalsificationComplete(planRoot) === true` for the legacy fixture
  - Set up a second fixture without `falsification.md` but with an impl whose phases are all terminal in state
  - Assert that an "all phases terminal" helper (new or existing) returns true for that fixture
  - The test demonstrates both branches pass the gate

#### Phase 1 Verification
- [ ] T6 passes: `pnpm --filter @infinitedusky/indusk-mcp test -- retrospective-gate-backcompat` runs green. Regression locked in.
- [ ] T1, T2, T3, T4, T5 written-red at Phase 0 intent: they are manual dogfood tests (not executable), procedural instructions captured in Phase 2's Verification block below. No test file to commit at Phase 1; Phase 2 runs the dogfood and flips states.

#### Phase 1 Context
- [ ] Append to CLAUDE.md "Conventions": "The `/falsify` skill authors a new phase in impl.md (not a separate `falsification.md` file) from 1.27.4 onward. Phase shape: `### Phase N: Falsification — {summary}` with trajectory rows for hypothesis tests + impl items for fixes + standard gates. `/retrospective` accepts 'all impl phases terminal' as an equivalent gate-pass to the legacy `isFalsificationComplete` path. Legacy plans with `falsification.md` files continue to work unchanged."

#### Phase 1 Document
- [ ] `apps/indusk-docs/src/guide/falsification-ritual.md` rewrite IS the Phase 1 docs — user-facing explainer of both the new phase-authoring flow and the legacy ritual (for anyone reading an archived plan's `falsification.md`).

### Phase 2: Ship 1.27.4 + dogfood on admin-ui-hosting

**Goal**: 1.27.4 lands on npm with the skill + guide + retrospective-gate changes; running `/falsify admin-ui-hosting` as the first dogfood authors a phase and doesn't run tests (closes T1/T2/T3); a subsequent `/work admin-ui-hosting` picks it up normally (T4); `/retrospective admin-ui-hosting` closes without a `falsification.md` (T5).

- [ ] Bump `apps/indusk-mcp/package.json` version → 1.27.4.
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` for 1.27.4 under "Changed": describe the `/falsify` behavior change, call out that it's a backwards-compatible shift (legacy plans continue to work), link to the updated `guide/falsification-ritual.md`.
- [ ] Build + publish: `cd apps/indusk-mcp && pnpm publish`. `prepublishOnly` runs existing build pipeline.
- [ ] User upgrades global: `npm i -g @infinitedusky/indusk-mcp@1.27.4 && indusk update` on dusk.
- [ ] Dogfood: run `/falsify admin-ui-hosting` — investigate the shipped 1.27.x daemon, author a Phase 8 in admin-ui-hosting's impl.md with whatever hypotheses surface. Observe: no test runs happen, a new phase appears, plan status stays `in-progress`. Closes T1, T2, T3.
- [ ] Dogfood: run `/work admin-ui-hosting` on the authored Phase 8 to completion. Observe normal phase behavior. Closes T4.
- [ ] Dogfood: run `/retrospective admin-ui-hosting` once Phase 8 (and any fix-in-scope phases it spawns) are terminal. Observe the gate passes without a `falsification.md`. Closes T5.

#### Phase 2 Verification
- [ ] T1 passes via dogfood — Phase 8 appears in admin-ui-hosting/impl.md after `/falsify` runs, with trajectory rows + fix items + gates.
- [ ] T2 passes via dogfood — no test-runner output during the `/falsify` session; the only change is the modified impl.md.
- [ ] T3 passes via dogfood — admin-ui-hosting's impl.md frontmatter status is still `in-progress` after `/falsify`.
- [ ] T4 passes via dogfood — `/work admin-ui-hosting` on Phase 8 closes normally (writable-at-phase tests authored, items checked off, trajectory states flipped).
- [ ] T5 passes via dogfood — `/retrospective admin-ui-hosting` completes without a `falsification.md` file in the plan folder.
- [ ] All Phase 1 tests still green (regression check).

#### Phase 2 Context
- [ ] Append to CLAUDE.md "Current State": "**`falsify-phase-authoring` shipped in indusk-mcp 1.27.4** — `/falsify` is now a phase-authoring action: investigates the plan, forms hypotheses, appends a new Phase N+1 to impl.md with trajectory rows for hypothesis tests + fix items + standard gates; no inline test execution; plan stays `in-progress` until `/work` picks up the phase. `/retrospective` accepts 'all impl phases terminal' as a gate-pass alongside the legacy `isFalsificationComplete` / skip paths. Backwards compatible — legacy plans with `falsification.md` files unchanged."

#### Phase 2 Document
- [ ] Changelog 1.27.4 entry IS the Phase 2 docs. Guide doc update from Phase 1 is the substantive user-facing explainer.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/skills/falsify.md` | Rewrite: "How to hunt" ends at hypothesis-forming; "What the phase contains" replaces "Three outcomes"; "Output" becomes "modified impl.md" instead of `falsification.md` |
| `.claude/skills/falsify/SKILL.md` | Mirror of the source skill file |
| `apps/indusk-docs/src/guide/falsification-ritual.md` | Rewrite "How to run" section + add "Legacy plans" section + update diagrams/snippets |
| `apps/indusk-mcp/skills/retrospective.md` | Step 0 gate: add "all impl phases terminal" as a third pass condition |
| `.claude/skills/retrospective/SKILL.md` | Mirror |
| `apps/indusk-mcp/src/__tests__/retrospective-gate-backcompat.test.ts` | NEW — regression test proving legacy `falsification.md` + new `all-phases-terminal` paths both pass the gate |
| `apps/indusk-mcp/package.json` | Version bump → 1.27.4 |
| `apps/indusk-docs/src/changelog.md` | 1.27.4 entry under "Changed" |
| `CLAUDE.md` | Conventions + Current State entries |

## Dependencies

- None. Pure skill + doc + retrospective-gate change. No API break, no library deprecation, no new infra.

## Notes

- **1.27.4 specifically** because the three pending retros (admin-ui-hosting, indusk-admin-ui, eval-agent-mcp-access) benefit immediately from the new flow. Bundling into 1.28.0 (local-telemetry) would delay by whatever time the spike takes.
- **No OTel gate sections in this impl** — dusk has `otel.role: library`.
- **Manual dogfood is the verification** for T1–T5 because the skill file is markdown instructions to the agent, not executable code. The first `/falsify` run on admin-ui-hosting is the test.
- **Phase-naming convention for the authored phase** (`### Phase N: Falsification — {summary}`) is free-form in v1 — the skill instructs the agent to use a recognizable prefix but no validator enforces it. If naming drift becomes a problem across many plans, a v2 adds a regex check.
- **If dogfood on admin-ui-hosting surfaces issues with the new flow**, the pattern is: fix-in-scope (add a Phase 3 to this plan) OR spawn a new plan. The same pattern the new flow teaches applies to the plan that authored the flow.
- **The `falsification.md` file library stays untouched** — backcompat for archived plans is important. We don't migrate existing files; we just stop producing new ones.
