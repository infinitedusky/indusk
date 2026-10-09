---
title: "model-per-phase — each phase on its tier's model, each boundary a new session"
date: 2026-10-09
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
---

# model-per-phase — each phase on its tier's model, each boundary a new session

## Goal

Build each phase on the model its tier names in the config, without anyone switching models by hand. Escalate a phase that keeps failing to the next tier up. End every plan boundary by naming the command for a new session.

## Scope

### In Scope
- The config:
  - `workflow.tiers` maps `strong`, `med`, `weak` and `baby` to a model alias that Claude Code's Agent `model` accepts (`opus`, `sonnet`, `haiku`, `fable`).
  - `workflow.steps.<step>.tier` gives each step's default tier: plan, work, falsify, cleanup, retrospective.
- A phase's tier line in the impl: `**Tier**: <tier> — <reason>`. The validator refuses an override with no reason, and refuses an unknown tier.
- `indusk plans model <plan> --phase <ref>`, which prints the phase's tier and model.
- `/work` runs each phase as a subagent on that model, and escalates after three misses.
- `indusk plans next-session <plan>` names the next command. Approval prints it, and so does each phase close.

### Out of Scope
- The admin's Build button passing the model, which is a follow-up.
- Which model each tier is in this repo's own config. Sandy sets that, and it isn't promised.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A6, A7 and A10 red over their boundaries (the hook's process and the CLI); A12 as a regression guard | today's hook and `plans approve` |
| Build Phase 1 | `lib/models/tiers.ts` (`readTiers`, `tierForPhase`, `nextTier`); the validator's tier rule; `indusk plans model` | `readWorkflowSteps`, `impl-headings` |
| Build Phase 2 | `/work` runs each phase as a subagent on `plans model`'s answer, and escalates; `lib/models/next-session.ts`; the line printed by `plans approve` and `plans next-session` | Build Phase 1's `tierForPhase` and `nextTier` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A phase whose plan names no tier is built on the model the config gives the work step's default tier | Build Phase 1 | Build Phase 1 | planned | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A2 | A phase whose plan names a tier is built on the model the config gives that tier | Build Phase 1 | Build Phase 1 | planned | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A3 | Changing a tier's model in the config changes the model the next phase is built on, with no plan edited | Build Phase 1 | Build Phase 1 | planned | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A4 | A project whose config names no tiers builds every phase on the session's own model, as today | Build Phase 1 | Build Phase 1 | planned | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A5 | Claude Code runs a phase handed to it on the named model, observed once against the real `claude` | Build Phase 2 | Build Phase 2 | planned | live check | promise: each-phase-runs-on-its-model | .indusk/planning/model-per-phase/impl.md (the result, recorded under Build Phase 2) |
| A6 | An impl that gives a phase a tier other than its step's default, with no reason, is refused, naming the phase | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A7 | The same impl with a reason is accepted; a tier that is not one of strong, med, weak or baby is refused, naming it | Test Phase 1 | Build Phase 1 | planned | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A8 | A phase whose tests still fail after three attempts on `med` stops and names `strong` as the tier to run it on | Build Phase 1 | Build Phase 2 | planned | unit | promise: a-struggling-phase-asks-for-a-stronger-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A9 | A phase already on `strong` that fails three times stops as a blocker, as today, naming no higher tier | Build Phase 1 | Build Phase 2 | planned | unit | promise: a-struggling-phase-asks-for-a-stronger-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A10 | Approving a plan ends by naming `/work <plan>` to run in a new session | Test Phase 1 | Build Phase 2 | planned | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A11 | Closing a phase ends by naming the command for the next phase, or `/falsify` after the last build phase | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/models/next-session.test.ts |
| A12 | A phase run on its own tier still records where it began, in the same shape Shape and verify read | Test Phase 1 | Test Phase 1 | planned | unit | promise: phase-boundary-record-never-malformed | apps/indusk-mcp/src/lib/shape/boundary.test.ts |

## Checklist

### Test Phase 1: The rule and the approval line, red over their boundaries

**Goal**: author the rows that reach their subject through a boundary today: the validator hook as a spawned process, and `plans approve`'s output. Register the rows whose subject is the new `lib/models/` module.

- [ ] Create/confirm this plan's worktree (`indusk worktree create model-per-phase`; made by `indusk plans start` on 2026-10-09 at `dusk-worktrees/model-per-phase`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [ ] A6 and A7 in `phase-tier-rule.test.ts`: run `hooks/validate-impl-structure.js` on a Write of an impl in a temporary project whose config gives `work` the tier `weak`.
  - A phase with `**Tier**: strong` and no reason must be refused.
  - `**Tier**: strong — rewrites how commands run` must be accepted.
  - `**Tier**: huge — x` must be refused.
  - RED today, because the hook accepts all three.
- [ ] A10 in `plans-approve.test.ts`: the approval message ends with `/work <plan>` in a new session. RED today, because it ends with "its build continues on its branch."
- [ ] A12 in `boundary.test.ts`: a phase record written with a tier present reads back in today's shape (a regression guard)

#### Deferred to Build Phase 1

- **A1, A2, A3, A4, A8, A9**: their subject is `lib/models/tiers.ts`, which Build Phase 1 introduces, so the file would fail to load rather than fail an assertion. Bodies:

  ```typescript
  // tiers.test.ts — promise: each-phase-runs-on-its-model
  const config = { tiers: { strong: "opus", med: "sonnet", weak: "haiku", baby: "haiku" }, steps: { work: "med" } };
  // tierForPhase(config, "work", undefined)                 → { tier: "med", model: "sonnet" }         (A1)
  // tierForPhase(config, "work", { tier: "strong", reason }) → { tier: "strong", model: "opus" }       (A2)
  // same phase, config.tiers.med = "fable"                   → model "fable"                           (A3)
  // tierForPhase({}, "work", undefined)                      → null: the session's own model           (A4)
  // promise: a-struggling-phase-asks-for-a-stronger-model
  // nextTier("med", 3) → "strong"; nextTier("med", 2) → null (keep going)                              (A8)
  // nextTier("strong", 3) → "blocker"                                                                  (A9)
  ```

#### Deferred to Build Phase 2

- **A5**: a live check of Claude Code, recorded once against the real `claude` when `/work` first hands it a phase.
- **A11**: its subject is `lib/models/next-session.ts`. Body:

  ```typescript
  // next-session.test.ts — promise: a-plan-boundary-names-the-next-session
  // nextSession(impl with Build Phase 1 closed, Build Phase 2 open) → "/work <plan>" naming Build Phase 2's tier
  // nextSession(impl with every build phase closed)                 → "/falsify <plan>"
  ```

#### Regression Guards

- **A12**: the phase-boundary record must keep its shape with a tier present. It passes when written and guards the existing promise.

#### Test Phase 1 Verification

- [ ] A6, A7 and A10 are authored and each fails on its own assertion; A12 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-tier-rule.test.ts src/__tests__/plans-approve.test.ts src/lib/shape/boundary.test.ts`). The deferred bodies are reviewed: will they compile at the phase they name, and do they assert what they claim?

### Build Phase 1: Tiers in the config, a tier per phase, and the rule

**Goal**: the config maps tiers to models and gives each step a default; a phase can name its tier, with its reason; the package answers which model a phase runs on.

- [ ] `config.ts` and `checks/steps.ts`:
  - `workflow.tiers`: `{ strong?, med?, weak?, baby? }`, each a model alias.
  - `workflow.steps.<plan|work|falsify|cleanup|retrospective>.tier`.
  - Anything else is refused, naming the key, as the existing step keys are.
- [ ] `lib/models/tiers.ts`:
  - `readTiers(checkout)`.
  - `phaseTier(implBody, phase)`, which reads the `**Tier**: <tier> — <reason>` line under the phase heading.
  - `tierForPhase(config, step, phaseTier)` returns `{ tier, model } | null`.
  - `nextTier(tier, failures)` returns `"weak" | "med" | "strong" | "blocker" | null`, escalating after 3 failures.
- [ ] The validator's tier rule in `validate-impl-structure.js`, through the same lib it uses for its other rules. It refuses, naming the phase, a tier that differs from the step's default with no reason, and any tier that isn't one of the four.
- [ ] `indusk plans model <plan> --phase <ref>` prints `<tier> <model>`, or `session` when no tiers are configured.

#### Build Phase 1 Verification

- [ ] A1–A4, A6, A7 pass; A8 and A9 are written and pass with `nextTier` (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models/tiers.test.ts src/__tests__/phase-tier-rule.test.ts && pnpm exec vitest related src/lib/config.ts src/lib/checks/steps.ts --run`); tsc and biome clean

#### Build Phase 1 Context

- [ ] planning (`templates/planning/CLAUDE.md`, shipped): a phase may carry `**Tier**: <tier> — <reason>`; omit it for the step's default

#### Build Phase 1 Document

- [ ] `reference/cli/plans.md`: `plans model`; the `workflow.tiers` and `steps.<step>.tier` keys, with an example config

### Build Phase 2: `/work` builds each phase on its model, and every boundary names the next session

**Goal**: nobody switches models or decides when to start a new session; the system does the first and says the second.

- [ ] `lib/models/next-session.ts`: `nextSession(plan, implBody)` returns the next command. That's `/work <plan>` with the open phase's tier, or `/falsify`, `/cleanup` or `/retrospective` in the close-out order.
- [ ] `indusk plans next-session <plan>` prints it, and the `plans approve` message ends with it
- [ ] `skills/work.md`:
  - **Running a phase:** before each phase, run `indusk plans model <plan> --phase <ref>`. When it names a model, hand the phase to an Agent with that `model`, passing the plan path and the phase. When it says `session`, work in place, as today. The subagent records the phase start, as today.
  - **Three misses:** after three failed verification attempts, ask `nextTier`. When it names a tier, stop and name it. When it answers `blocker`, flag the blocker, as today.
  - **Closing a phase:** end by printing `indusk plans next-session <plan>`.
- [ ] A5, a live check: `/work` hands one phase of a scratch plan to an Agent with `model: "haiku"`. Record the model the subagent reports. If it isn't honoured, change the skill to print the `/model` switch instead, and record that here.
- [ ] Run `indusk update` so `.claude/skills/work.md` takes the package's copy

#### Build Phase 2 Verification

- [ ] A8–A11 pass and A5 is recorded (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models/ src/__tests__/plans-approve.test.ts`); tsc and biome clean

#### Build Phase 2 Context

- [ ] root (Conventions): one line, "phases name a tier, the config names the model; start a new session at each boundary `plans next-session` names". It's always-on because it changes how every session starts and ends.

#### Build Phase 2 Document

- [ ] `reference/skills/work.md`: a phase per subagent on its tier's model, the three-miss escalation, and the next-session line; changelog `[Unreleased]`

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/config.ts`, `src/lib/checks/steps.ts` | `workflow.tiers`, `steps.<step>.tier` |
| `apps/indusk-mcp/src/lib/models/{tiers,next-session}.ts` | new |
| `apps/indusk-mcp/hooks/validate-impl-structure.js` | the tier rule |
| `apps/indusk-mcp/src/bin/commands/plans.ts` | `plans model`, `plans next-session`, the approval line |
| `apps/indusk-mcp/skills/work.md` | phases as subagents on their model; escalation; the next-session line |

## Dependencies
- None.

## Notes
- Tier aliases are the ones Claude Code's Agent `model` accepts today (`opus`, `sonnet`, `haiku`, `fable`). A full model ID works only if A5 shows it does.
