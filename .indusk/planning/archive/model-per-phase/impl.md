---
title: "model-per-phase — each phase on its tier's model, each boundary a new session"
date: 2026-10-09
status: completed
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
accepted: 2026-10-09T17:10:04.136Z
accepted_by: person
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
| A1 | A phase whose plan names no tier is built on the model the config gives the work step's default tier | Build Phase 1 | Build Phase 1 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A2 | A phase whose plan names a tier is built on the model the config gives that tier | Build Phase 1 | Build Phase 1 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A3 | Changing a tier's model in the config changes the model the next phase is built on, with no plan edited | Build Phase 1 | Build Phase 1 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A4 | A project whose config names no tiers builds every phase on the session's own model, as today | Build Phase 1 | Build Phase 1 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A5 | Claude Code runs a phase handed to it on the named model, observed once against the real `claude` | Build Phase 2 | Build Phase 2 | passing | live check | a live check of Claude Code, not a unit: the model an Agent reports is recorded under Build Phase 2 (A1–A4 prove the promise in code) | .indusk/planning/model-per-phase/impl.md |
| A6 | An impl that gives a phase a tier other than its step's default, with no reason, is refused, naming the phase | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A7 | The same impl with a reason is accepted; a tier that is not one of strong, med, weak or baby is refused, naming it | Test Phase 1 | Build Phase 1 | passing | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A8 | A phase whose tests still fail after three attempts on `med` stops and names `strong` as the tier to run it on | Build Phase 1 | Build Phase 2 | passing | unit | promise: a-struggling-phase-asks-for-a-stronger-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A9 | A phase already on `strong` that fails three times stops as a blocker, as today, naming no higher tier | Build Phase 1 | Build Phase 2 | passing | unit | promise: a-struggling-phase-asks-for-a-stronger-model | apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A10 | Approving a plan ends by naming `/work <plan>` to run in a new session | Test Phase 1 | Build Phase 2 | passing | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/__tests__/plans-approve.test.ts |
| A11 | Closing a phase ends by naming the command for the next phase, or `/falsify` after the last build phase | Build Phase 2 | Build Phase 2 | passing | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/models/next-session.test.ts |
| A12 | A phase run on its own tier still records where it began, in the same shape Shape and verify read | Test Phase 1 | Test Phase 1 | passing | unit | promise: phase-boundary-record-never-malformed | apps/indusk-mcp/src/lib/shape/boundary.test.ts |
| A13 | An Edit that changes only a phase's `**Tier**:` line — no heading, no checklist item in the edit — is still held to the tier rule: a tier with no reason, or an unknown tier, is refused naming the phase | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A14 | A phase with two `**Tier**:` lines is refused naming the phase; `/work`'s escalation replaces the line rather than adding one, so the escalated tier is the one read | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-struggling-phase-asks-for-a-stronger-model | apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts, apps/indusk-mcp/src/lib/models/tiers.test.ts |
| A15 | A phase naming a tier the config gives no model for is refused naming the tier — by the validator, and by `plans model` — never answered `session` | Build Phase 3 | Build Phase 3 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/lib/models/tiers.test.ts, apps/indusk-mcp/src/__tests__/phase-tier-rule.test.ts |
| A16 | `plans model` on a project whose tier config is malformed (`workflow.tiers.huge`, `steps.work.tier: huge`) refuses with the key named, exit 1, never a stack trace; the validator refuses the same impl the same way | Build Phase 3 | Build Phase 3 | passing | unit | promise: each-phase-runs-on-its-model | apps/indusk-mcp/src/__tests__/plans-model.test.ts |
| A17 | The validator and `plans model` judge the same tier lines and the same config the same way: every case A6, A7 and A13–A16 send gives one answer from the hook's copy and the package's | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-model-override-says-why | apps/indusk-mcp/src/__tests__/phase-tier-parity.test.ts |
| A18 | The command a boundary names agrees with what the build decides next: a phase with a blocker names the blocker, not `/work`; a phase waiting on a person names the item; every phase closed with rows still open names those rows, not `/retrospective` | Build Phase 4 | Build Phase 4 | passing | unit | promise: a-plan-boundary-names-the-next-session | apps/indusk-mcp/src/lib/models/next-session.test.ts |

## Checklist

### Test Phase 1: The rule and the approval line, red over their boundaries

**Goal**: author the rows that reach their subject through a boundary today: the validator hook as a spawned process, and `plans approve`'s output. Register the rows whose subject is the new `lib/models/` module.

- [x] Create/confirm this plan's worktree (`indusk worktree create model-per-phase`; made by `indusk plans start` on 2026-10-09 at `dusk-worktrees/model-per-phase`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter
- [x] A6 and A7 in `phase-tier-rule.test.ts`: run `hooks/validate-impl-structure.js` on a Write of an impl in a temporary project whose config gives `work` the tier `weak`.
  - A phase with `**Tier**: strong` and no reason must be refused.
  - `**Tier**: strong — rewrites how commands run` must be accepted.
  - `**Tier**: huge — x` must be refused.
  - RED today, because the hook accepts all three.
- [x] A10 in `plans-approve.test.ts`: the approval message ends with `/work <plan>` in a new session. RED today, because it ends with "its build continues on its branch."
- [x] A12 in `boundary.test.ts`: a phase record written with a tier present reads back in today's shape (a regression guard)

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

- [x] A6, A7 and A10 are authored and each fails on its own assertion; A12 passes (`cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/phase-tier-rule.test.ts src/__tests__/plans-approve.test.ts src/lib/shape/boundary.test.ts`). The deferred bodies are reviewed: will they compile at the phase they name, and do they assert what they claim?

### Build Phase 1: Tiers in the config, a tier per phase, and the rule

**Goal**: the config maps tiers to models and gives each step a default; a phase can name its tier, with its reason; the package answers which model a phase runs on.

- [x] `config.ts` and `checks/steps.ts`:
  - `workflow.tiers`: `{ strong?, med?, weak?, baby? }`, each a model alias.
  - `workflow.steps.<plan|work|falsify|cleanup|retrospective>.tier`.
  - Anything else is refused, naming the key, as the existing step keys are.
- [x] `lib/models/tiers.ts`:
  - `readTiers(checkout)`.
  - `phaseTier(implBody, phase)`, which reads the `**Tier**: <tier> — <reason>` line under the phase heading.
  - `tierForPhase(config, step, phaseTier)` returns `{ tier, model } | null`.
  - `nextTier(tier, failures)` returns `"weak" | "med" | "strong" | "blocker" | null`, escalating after 3 failures.
- [x] The validator's tier rule in `validate-impl-structure.js`, through the same lib it uses for its other rules. It refuses, naming the phase, a tier that differs from the step's default with no reason, and any tier that isn't one of the four.
- [x] `indusk plans model <plan> --phase <ref>` prints `<tier> <model>`, or `session` when no tiers are configured.

#### Build Phase 1 Verification

- [x] A1–A4, A6, A7 pass; A8 and A9 are written and pass with `nextTier` (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models/tiers.test.ts src/__tests__/phase-tier-rule.test.ts && pnpm exec vitest related src/lib/config.ts src/lib/checks/steps.ts --run`); tsc and biome clean

- [x] Shape review of this phase's files (`lib/models/{tier-names,tiers,phase-model}.ts`, `hooks/_phase-tier.js`, the steps reader): nothing found. `tiers.ts` has one subject (which tier and model a phase runs on); the tier-line grammar is duplicated in `_phase-tier.js` by the hook rule (a hook cannot import TS) and noted in both headers.

#### Build Phase 1 Context

- [x] planning (`templates/planning/CLAUDE.md`, shipped): a phase may carry `**Tier**: <tier> — <reason>`; omit it for the step's default

#### Build Phase 1 Document

- [x] `reference/cli/plans.md`: `plans model`; the `workflow.tiers` and `steps.<step>.tier` keys, with an example config

### Build Phase 2: `/work` builds each phase on its model, and every boundary names the next session

**Goal**: nobody switches models or decides when to start a new session; the system does the first and says the second.

- [x] `lib/models/next-session.ts`: `nextSession(plan, implBody)` returns the next command. That's `/work <plan>` with the open phase's tier, or `/falsify`, `/cleanup` or `/retrospective` in the close-out order.
- [x] `indusk plans next-session <plan>` prints it, and the `plans approve` message ends with it
- [x] `skills/work.md`:
  - **Running a phase:** before each phase, run `indusk plans model <plan> --phase <ref>`. When it names a model, hand the phase to an Agent with that `model`, passing the plan path and the phase. When it says `session`, work in place, as today. The subagent records the phase start, as today.
  - **Three misses:** after three failed verification attempts, ask `nextTier`. When it names a tier, stop and name it. When it answers `blocker`, flag the blocker, as today.
  - **Closing a phase:** end by printing `indusk plans next-session <plan>`.
- [x] A5, a live check: `/work` hands one phase of a scratch plan to an Agent with `model: "haiku"`. Record the model the subagent reports. If it isn't honoured, change the skill to print the `/model` switch instead, and record that here.
  - **A5 result (2026-10-09):** an Agent called with `model: "haiku"` reported `claude-haiku-5-5`. The Agent's `model` is honoured, so the skill hands phases to a subagent and does not fall back to printing `/model`.
- [x] Run `indusk update` so `.claude/skills/work.md` takes the package's copy

#### Build Phase 2 Verification

- [x] A8–A11 pass and A5 is recorded (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models/ src/__tests__/plans-approve.test.ts`); tsc and biome clean

- [x] Shape review of this phase (`next-session.ts`): nothing found; `nextSession` is pure and `nextSessionForPlan` is the one place it meets the disk.

#### Build Phase 2 Context

- [x] root (Conventions): one line, "phases name a tier, the config names the model; start a new session at each boundary `plans next-session` names". It's always-on because it changes how every session starts and ends.

#### Build Phase 2 Document

- [x] `reference/skills/work.md`: a phase per subagent on its tier's model, the three-miss escalation, and the next-session line; changelog `[Unreleased]`

### Build Phase 3: Falsification — the tier line reached by the edits and configs the rule never saw

**Goal**: verify whether the attested state holds against four things Build Phase 1's tests never sent: an Edit that touches only the tier line, a phase that carries two tier lines, a tier the config has no model for, and a config the readers disagree about. Each row is one hypothesis; each item the fix it needs.

**Read, not run (A13):** `validate-impl-structure.js` exits 0 before any rule when the edit's `new_string` holds neither a phase heading nor an unchecked item ("if the edit doesn't touch phase structure, allow it"). An Edit that rewrites `**Tier**: strong — reason` to `**Tier**: huge`, or drops the reason, is such an edit. The promise says the impl is refused; the test phase sent a Write, which carries the whole document, and never an Edit.

**Read, not run (A14):** `phaseTier` is `.find` — the first line under the phase wins. The work skill's three-miss step says to *add* `**Tier**: strong — failed three times on med` under the heading; a phase that already named a tier now has two, and the next run reads the old one. The escalation is written and ignored.

**Read, not run (A15):** `tierForPhase` answers `null` when the named tier has no model in `workflow.tiers`, and `plans model` prints `session` for `null`. A phase that says `**Tier**: strong — security work` in a project whose tiers name only `med` is built on whatever the session has — the opposite of what the line asked — and nothing says so.

**Read, not run (A16):** three readers, three answers to a bad config. `readTiers` throws on `workflow.tiers.huge`; `plans model` runs it through `planVerb`, which rethrows anything that is not a `PlanCommandRefusal`, so the command dies with a stack trace. `nextSessionForPlan` swallows the throw. The hook's `workDefaultTier` returns undefined for `steps.work.tier: huge`, so an override with no reason is accepted there while `plans model` crashes on the same project.

**Not investigated further, and why:** the subagent hand-off itself (A5 observed the model once; whether a subagent's edits pass the gate hooks is the autopilot spike's, already verified); `nextSession`'s close-out order (reads `checkRetrospectiveReadiness`, which does not throw, and is covered by A11); the boundary record (A12 guards its shape and a tier is never written into it).

- [x] `validate-impl-structure.js`: the fast path also runs the rules when the edit's text contains `**Tier**:` (A13)
- [x] `tierRuleProblems` (TS and `_phase-tier.js` together): a phase with more than one tier line is refused naming the phase; `skills/work.md` three-miss step says *replace* the phase's tier line, or add one when there is none (A14)
- [x] `tierRuleProblems` takes the configured tiers: a tier line naming a tier with no model in `workflow.tiers` is refused naming the tier; `tierForPhase` keeps `null` only for "no tier named anywhere" and throws for a named tier with no model, which `plans model` reports as a refusal (A15)
- [x] `plansModel` and `plansNextSession` turn a config error into a `PlanCommandRefusal` (exit 1, message, no trace); `_phase-tier.js`'s `workDefaultTier` refuses an unknown `steps.work.tier` naming the key, as `readWorkflowSteps` does (A16)

#### Build Phase 3 Verification

- [x] A13–A16 pass; A1–A12 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models src/__tests__/phase-tier-rule.test.ts src/__tests__/plans-model.test.ts src/__tests__/plans-approve.test.ts src/__tests__/hook-shared-modules.test.ts`); tsc and biome clean

- [x] Shape review of this phase (`tiers.ts`, `_phase-tier.js`, the steps reader): nothing found. The tier-config error is one class (`TierConfigError`) that the command layer turns into a refusal, so a bug elsewhere is still not reported as one.

#### Build Phase 3 Context

- [x] `apps/indusk-mcp/hooks/CLAUDE.md`: the validator's fast path is a list of the edit shapes that carry structure (a heading, an item, a tier line) — a new rule over a new line shape adds its marker there, or an Edit of that line alone is never checked

#### Build Phase 3 Document

- [x] `reference/cli/plans.md`: a tier named by a phase must have a model in `workflow.tiers`, or the impl and `plans model` refuse; one tier line per phase

### Build Phase 4: Cleanup — one decision for what comes next, one reader for the impl, one tier rule in two languages

**Goal**: decompose what this plan grew beside existing code: a second copy of the build's next-step decision, a third copy of reading a plan's impl from its live copy, a hand-written phase label where a helper exists, and a hook port of the tier rule with nothing holding it to its source. Each item is a concrete consolidation or a reasoned leave-as-is.

- [x] `nextSession` maps `nextBuildStep`'s answer to a command instead of deciding again — `lib/build/next-step.ts` already decides open phase / blocker / judgement / falsify / cleanup / rows / review, and `next-session.ts` re-derives a subset with its own `isOpen`. `work` → `/work <plan>` with the phase's tier and model; `falsify` / `cleanup` → that command; `review` → `/retrospective <plan>`; `judgement` → the item a person must look at; `cannot-continue` → its reason. Delete next-session's `isOpen`. Basis: one definition of a decision; two copies have already diverged (A18). A11's test bodies change to the new signature; its `Asserts` text does not.
- [x] One reader for a plan's impl on disk: `readBuildPlan` (`lib/build/read-plan.ts`) also returns the raw `content`, and `phaseModel` (`models/phase-model.ts`) and `nextSessionForPlan` use it rather than each repeating `livePlanCopy` → `join(dir, "impl.md")` → `existsSync` → `readFileSync`. Basis: rule of three (`read-plan.ts`, `phase-model.ts`, `next-session.ts`). `nextSessionForPlan` keeps its fallback to `/work <plan>` for an unreadable plan.
- [x] `tiers.ts` and `next-session.ts` call `phaseLabel` (`impl-headings.ts`) instead of spelling `${kind === "test" ? "Test" : "Build"} Phase ${n}` — the helper exists for exactly this. (`_phase-tier.js` keeps its own spelling: hooks cannot import TS, and `_impl-headings.js` has no `phaseLabel`.)
- [x] Move `readTiers` from `lib/checks/steps.ts` to `lib/models/tiers.ts`, and drop the re-export. `checks/steps.ts` is the reader for the `checks` command's land and release steps; the tier map belongs with the module that answers which model runs. The steps reader keeps validating `steps.<step>.tier`, since that key lives in its section.
- [x] A17: a parity test feeding the same impl bodies and configs to `hooks/_phase-tier.js` (`tierRuleProblems`, `tierConfigProblems`) and to `lib/models/tiers.ts` (`tierRuleProblems`, `readTierConfig`'s refusals), asserting the same problems. Precedent: `test-levels-parity.test.ts`. Basis: the port exists because a hook cannot import TS; nothing yet notices when one copy changes and the other does not.
- [x] (reviewed `hooks/validate-impl-structure.js` — left as-is: 940 lines before this plan, which added one 15-line block that calls into `_phase-tier.js` and a one-line fast-path marker; splitting the validator is outside this plan's scope)
- [x] (reviewed `src/bin/cli.ts` and `src/bin/commands/plans.ts` — left as-is: two command registrations and two thin command functions in the file's existing one-per-verb pattern)
- [x] (reviewed `src/lib/config.ts` — left as-is: 13 lines of type declarations beside the existing `WorkflowSteps`)
- [x] (reviewed `skills/work.md`, `.claude/skills/work/SKILL.md`, the changelog and the docs pages — left as-is: prose; the installed skill is the package copy, held equal by `skill-sync-parity.test.ts`)

#### Build Phase 4 Verification

- [x] A17 and A18 pass; A1–A16 still do (`cd apps/indusk-mcp && pnpm exec vitest run src/lib/models src/__tests__/phase-tier-rule.test.ts src/__tests__/phase-tier-parity.test.ts src/__tests__/plans-model.test.ts src/__tests__/plans-approve.test.ts && pnpm exec vitest related src/lib/build/read-plan.ts src/lib/checks/steps.ts --run`); tsc and biome clean

- [x] Shape review of this phase (`next-session.ts`, `phase-model.ts`, `tiers.ts`, the parity test): nothing found. `readBuildPlan` now carries the raw impl text, and the three readers of a plan on disk share it; `_phase-tier.js` gained the unknown-step-key check the parity test found missing.

#### Build Phase 4 Context

- [x] `apps/indusk-mcp/hooks/CLAUDE.md`: add `_phase-tier.js` ← `lib/models/tiers.ts` to the list of `_`-prefixed ports that each mirror one `src/lib` module, held by `phase-tier-parity.test.ts`

#### Build Phase 4 Document

- [x] `reference/cli/plans.md`: a `plans next-session <name>` section — what it prints at each point in a plan's life (the next phase with its tier and model, `/falsify`, `/cleanup`, `/retrospective`, a blocker, an item waiting on a person), and that `plans approve` ends with it

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
