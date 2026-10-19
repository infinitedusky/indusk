---
title: "Approval waits for the planning run — Impl"
date: 2026-10-19
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
---

# Approval waits for the planning run — Impl

## Goal

A plan written by the unattended planning run is not offered for approval (under Needs you, with Approve) until that run has ended. Today the offer is withheld only while a session's turn is open; between a planning step's session ending and the next one starting, nothing is open and the draft impl alone reads as ready. After this plan, the admin tells the package's waiting rule which plans have a planning run still going, and the rule withholds approval for them.

## Decisions made while writing this plan

Unattended run (`INDUSK_GATE_POLICY=auto`); nobody could be asked. Each decision and why:

1. **"The run has stopped" is read from the run's `running` flag, not from its recorded stop step.** The admin already holds each planning run's state (`planningState(project, plan)` in `build-host.ts`, with `running` cleared in a `finally` on every way the run ends). Reading `running` means any end — ready for approval, a blocker, a failed session, a crash — stops hiding approval, which is what the test plan's A6 requires. Rejected: reading `stop.step === "ready-for-approval"`; a run that crashed would then hide a finished plan forever. (The test plan left this open for the ADR; a bugfix has no ADR, so it is settled here.)
2. **A crashed or abandoned run shows approval, not something else.** After a run ends with `cannot-continue`, the plan reads as it does for a hand-written plan: if the draft impl is complete, Approve is offered. Showing a different card for a crashed run is a separate feature (the brief's "Not promised" names the activity work as a later plan). Reason: hiding a finished plan is worse than offering it, and the person reads the plan before approving anyway.
3. **The new input is optional and absence means "no run".** `WaitingInput` gains `plannings?: ReadonlyArray<{ plan: string; running: boolean }>`, defaulting to none, like `builds` and `amendments`. A plan no run has touched, or a daemon restarted mid-run (state is in memory and gone), shows approval as today (test plan A13). Reason: the new condition must not become "no run found means wait".
4. **A planning run is matched to a plan by plan name only** (A14), exactly as sessions and builds are.
5. **The question and amendment cards are not touched.** The planning run's session asking a question still outranks approval whether or not the run is going (A9); only the approval branch gains the condition.
6. **A5 and A11 are unit rows, not contract rows.** The test plan named them `contract`, but both run over fakes (`readWaiting` with the admin's session and build hosts mocked; `runPlanning` with a fake step runner) and nothing they touch is owned by someone else. The plan's own rule is the smallest level that proves the fact. Reason: a `contract` row would be put in the slow tier for no extra proof.
7. **A7 and A12 are live checks, recorded in this plan and never blocking.** They need a daemon and a `claude` binary (`pnpm e2e`). Build Phase 1's last verification item runs them if the machine has both and records the result under Notes; if not, it records "not run — no daemon/claude" rather than skipping silently. Per the standing rule, the slow tier never blocks landing.
8. **The rows' test files carry `promise: approval-waits-for-a-finished-plan`.** The brief does not state clauses (`clauses: required` is absent), so rows name the promise, not a clause; the test plan's three clause names are signals for reading, not registry entries.
9. **No OTel gates.** `.indusk/config.json` has `otel.role: "library"`, so the OTel gate does not apply.
10. **No ADR and no Key Decisions line at the root.** The workflow is `bugfix` (brief + test plan + impl). The fix is one more input to an existing rule; the root's Key Decisions already cite `plan-cockpit` for what a plan waits on.

## Scope

### In Scope
- `planWaiting` takes the planning runs and withholds approval while one for the plan is running.
- The admin's `readWaiting` passes each plan's planning-run state.
- The existing admin test that mocks `build-host` gains the new export it now needs.
- The promise's sentence changes to the brief's (`indusk promises change`).
- The admin-UI reference page's approval row says it.

### Out of Scope
- Showing which planning step is running on the plan page (the brief's "Not promised").
- Any change to the planning runner, to when it starts or stops, or to the approve route.
- A different card for a crashed run (decision 2).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test of the plan, authored: A3 and A5 red on their assertions, the rest recorded as regression guards | the existing `planWaiting`, `readWaiting`, `runPlanning` |
| Build Phase 1 | `WaitingInput.plannings`, the approval condition in `planWaiting`, `readWaiting` passing `planningState`, the changed promise sentence, the docs row | the tests from Test Phase 1; `planningState` from `build-host.ts` |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A plan whose impl is absent, or whose brief, test plan or adr is not accepted, is not under Needs you for approval, whatever else is true of it | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A2 | A finished plan with a session whose turn is open shows no Approve; once the turn ends and nothing else runs, it shows Approve | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A3 | A finished plan with a planning run still going and no session turn open shows no Approve and is not under Needs you | Test Phase 1 | Build Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A4 | The same plan, once its planning run has ended ready for approval, shows Approve with the approval decision | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A5 | A plan whose planning run is on its plan-review step (its state running), with no plan-review.md yet, shows no Approve through the admin's reader; after the run ends it does | Test Phase 1 | Build Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.planning.test.ts |
| A6 | A planning run that ended any other way (error, blocker) does not hide approval of a finished plan | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A7 | In a live planning run of a bugfix plan, Needs you shows no Approve at any moment until the run ends, including the gap between steps; at the end it shows Approve | Build Phase 1 | Build Phase 1 | planned | live check | live check recorded in this plan's Notes; slow tier, never blocks landing | manual: pnpm e2e |
| A8 | A planning run ended ready for approval, with the draft impl complete, lists the plan under Needs you once, as approval, with Approve and "Not yet — keep planning" | Test Phase 1 | Test Phase 1 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A9 | A question asked by the planning run's session still shows as the plan's one decision and outranks approval, whether or not the run is going | Test Phase 1 | Test Phase 1 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A10 | A plan at review or with an amendment waiting is listed as before; a running planning run hides neither | Test Phase 1 | Test Phase 1 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A11 | An accepted brief's planning run still writes the remaining documents without asking and still ends ready for approval; waiting does not stop or restart it | Test Phase 1 | Test Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/build/planning-runner.test.ts |
| A12 | After the run ends, Approve is offered once (A8), so the run's end is the only change in when the offer appears | Build Phase 1 | Build Phase 1 | planned | live check | live check recorded in this plan's Notes; slow tier, never blocks landing | manual: pnpm e2e |
| A13 | A plan no planning run has touched, with a finished draft impl and no open session, still shows Approve | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: the new condition must be absent-safe, not "no run found means wait" | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A14 | A running planning run for a different plan does not hide this plan's approval | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard against matching a run by anything but the plan name | apps/indusk-mcp/src/lib/plans/waiting.test.ts |

### Deferred Verification

- **A7 and A12, the live checks**
  - reason: they need a running admin daemon and a `claude` binary to run a real planning run end to end; neither exists in the everyday suite.
  - would require: `pnpm e2e` on a machine with `claude` and a daemon (the slow tier).
  - mitigation: the rule they exercise is held by A3, A4 and A5 at the unit level; the live result is recorded in Notes, and a break reaches the person as the promise `approval-waits-for-a-finished-plan` reading broken, never as a blocked landing.

## Checklist

### Test Phase 1: Author every test, red where it can be

**Tier**: med — the work step's default

This phase writes all the plan's tests before any fix. Most of them pass today, because the rule's other conditions already hold; they are recorded as guards so a later change cannot quietly break them. Two fail today for the right reason: a finished plan with a planning run going is offered approval, both in the rule and through the admin's reader. The phase hands the build phase a fixed target: those two go green when the rule gains the new condition.

- [ ] Create or confirm this plan's own worktree, as every plan does.
  <details><summary>Technical</summary>

  `indusk worktree create approval-waits-for-the-planning-run` records the assignment so the admin and plan tools read the plan from it (a worktree made another way needs `indusk worktree assign <plan> <path>`) — worktree-per-plan default; skip only if `worktree: none` in frontmatter. The plan was started with `indusk plans start`, so `plan/approval-waits-for-the-planning-run` and its worktree exist; confirm with `git rev-parse --abbrev-ref HEAD` and `pwd` before any edit. Use absolute paths in every command.

  </details>
- [ ] Add the tests of the rule itself to the package's waiting test file, so the planning run is an input that is not there yet.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/plans/waiting.test.ts`, add `// promise: approval-waits-for-a-finished-plan` beside the existing token, then a `describe("approval-waits-for-the-planning-run")` holding A1, A2, A3, A4, A6, A8, A9, A10, A13, A14. Reuse the file's `approval` plan and `asking`/`review` fixtures. The new input is passed as `plannings: [{ plan: "awaiting-approval", running: true }]` (TypeScript will not compile it until Build Phase 1, but vitest does not typecheck, so the file loads and A3 fails on its assertion). Sketch of A3:

  ```typescript
  it("A3 a finished plan with a planning run going and no session turn open is not under approval", () => {
  	const w = planWaiting({
  		sessions: [],
  		plans: [approval],
  		plannings: [{ plan: approval.name, running: true }],
  	} as never);
  	expect(w).toEqual([]);
  });
  ```

  Use `as never` on the input only where the field is not in the type yet; Build Phase 1 removes it.

  </details>
- [ ] Add a new test of the admin's reader that holds a planning run in progress, so what the reader hands the rule is checked.
  <details><summary>Technical</summary>

  New file `apps/indusk-admin/src/lib/decisions-reader.planning.test.ts` (A5), modelled on `decisions-reader.amendments.test.ts`: mock `./session-host` (`sessionManager: () => ({ running: () => [], pendingQuestion: () => null })`) and `./build-host` with `buildState: () => null` and `planningState: () => ({ started: true, running, step: "plan-review", stop: null })` where `running` is a mutable the test flips. Write a plan whose `impl.md` is a draft and whose other documents are accepted into a temp checkout (the amendments test's `writePlan` shows the shape). Assert: `running = true` gives no approval entry; `running = false` gives one. Carry `// promise: approval-waits-for-a-finished-plan`.

  </details>
- [ ] Confirm the planning runner's own test already holds the run's stop at ready for approval, and add a guard there if it does not.
  <details><summary>Technical</summary>

  Read `apps/indusk-mcp/src/lib/build/planning-runner.test.ts` (A11). If a case already drives `runPlanning` with a fake runner to a `ready-for-approval` stop without asking anything, add `// promise: an-accepted-brief-is-planned-unasked` to it if missing and name that case in A11's notes; otherwise add one.

  </details>
- [ ] Run the new tests and check that only the two meant to fail do, and each on its own assertion.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/waiting.test.ts src/lib/build/planning-runner.test.ts` and `pnpm --filter indusk-admin exec vitest run src/lib/decisions-reader.planning.test.ts`. Expected red: A3 and A5, each "expected [] / no approval, received an approval entry". Everything else passes. If the admin package's name differs, use `pnpm -r exec` with the same paths.

  </details>

#### Deferred to Build Phase 1

- **A7** and **A12** — live checks of the whole story against a running daemon and `claude`; they cannot be authored as everyday tests, and run only in the slow tier. They are recorded in Notes by Build Phase 1's last verification item, not written as files. Body: none (a run of `pnpm e2e`, not code).

#### Regression Guards

- **A1** — the impl-written conditions already hold today (the existing `awaitingApproval`); the row pins them so the new condition cannot loosen them.
- **A2** — the open-turn rule already holds today (cockpit-audit-fixes rows 8 and 12); pinned the same way.
- **A4** — with no run going, approval is offered today; pins that the end of a run restores it.
- **A6** — a run that is not running hides nothing today; pins that no kind of end hides approval for good.
- **A8** — the promise `decisions-wait-in-one-place` holds today for an approval card; pinned so the new condition leaves a ready plan listed once with its two answers.
- **A9** — a question outranks approval today; pinned so the new condition does not touch the question card.
- **A10** — the review and amendment cards are listed today; pinned so the new condition does not hide either.
- **A11** — the planning runner is not changed by this plan; the row pins that it still stops ready for approval.
- **A13** — absent-safety of the new input: a plan no run touched shows approval today; it stays green until the condition is written as "no run found means wait".
- **A14** — name-matching of the new input: another plan's run hides nothing today; it stays green until the condition is written to match by anything but the plan name.

#### Test Phase 1 Verification

- [ ] The tests this plan writes exist, and exactly two fail today, each on its own assertion.
  <details><summary>Technical</summary>

  A3 and A5 are red with an assertion failure (an approval entry present where none is expected), not an import error; every other new test passes. Commit the red state on the plan's branch.

  </details>
- [ ] Every guard named above passes today for the reason it gives.
  <details><summary>Technical</summary>

  A1, A2, A4, A6, A8, A9, A10, A11, A13, A14 are green against the unchanged rule; none is `.skip`ped.

  </details>

#### Test Phase 1 Context

- (none needed — this phase writes tests only and changes no convention or rule about how the project works)

#### Test Phase 1 Document

- (none needed — tests carry the promise tokens that point at the rule; the docs row is Build Phase 1's, written with the change it describes)

### Build Phase 1: Withhold approval while the planning run is going

**Tier**: med — the work step's default

This phase makes the two red tests green. The package's waiting rule learns about planning runs as an input and withholds the approval card while one is going for the plan; the admin's reader hands it each plan's run state. It also brings the registered promise's sentence and the docs row up to the same words, and records the two live checks. Nothing else about the planning run, the cards or the approve action changes.

- [ ] Make the waiting rule take the planning runs that are going, and withhold approval for a plan that has one.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/waiting.ts`: add

  ```typescript
  export interface WaitingPlanning {
  	plan: string;
  	/** The plan's planning run has not ended (between its steps counts as going). */
  	running: boolean;
  }
  ```

  Add `plannings?: ReadonlyArray<WaitingPlanning>` to `WaitingInput` and default it to `[]` in `planWaiting`. In the last branch of the `??` chain, change the condition to `awaitingApproval(plan) && !beingWritten(plan, sessions) && !planningRuns(plan.name, plannings)`, where `planningRuns` is `plannings.some((p) => p.plan === plan.name && p.running)`. Tag it `promise: approval-waits-for-a-finished-plan` beside `beingWritten`, and extend the header comment's "approval" bullet with "and no planning run for it is still going". Remove the `as never` casts from the tests. Absent input must read as no run (decision 3).

  </details>
- [ ] Make the admin's reader pass each plan's planning-run state to the rule.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions-reader.ts`: import `planningState` from `./build-host` and pass `plannings: plans.map((p) => ({ plan: p.name, running: planningState(project, p.name)?.running ?? false }))` to `planWaiting`. Extend the file's header comment by one sentence naming it.

  </details>
- [ ] Update the existing admin tests that replace the build host so they still run.
  <details><summary>Technical</summary>

  `rg -l 'vi.mock\("(\./|@/lib/)?build-host"' apps/indusk-admin/src` — every mock that is reached by `readWaiting` (at least `decisions-reader.amendments.test.ts`) gains `planningState: () => null`. Mocks of modules that never reach the reader (`build-host.test.ts`, the route tests) are left as they are; run the admin's suite for the files found to be sure.

  </details>
- [ ] Change the registered promise's sentence to the brief's, now that the rule says it.
  <details><summary>Technical</summary>

  `indusk promises change approval-waits-for-a-finished-plan --plan approval-waits-for-the-planning-run --statement "A plan is listed as waiting for approval only when its impl is written, no session is still writing it, and any planning run for it has stopped ready for approval." --reason "the rule now withholds approval while a planning run for the plan is going"`. Add `apps/indusk-admin/src/lib/decisions-reader.ts` to the promise's `sites` if the command does not (check `.indusk/promises/approval-waits-for-a-finished-plan.md` afterwards). Never edit the promise file by hand.

  </details>

#### Build Phase 1 Verification

- [ ] The two tests that failed now pass, and no test written in Test Phase 1 fails.
  <details><summary>Technical</summary>

  A3 and A5 go green; A1, A2, A4, A6, A8, A9, A10, A11, A13, A14 stay green. `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/waiting.test.ts src/lib/build/planning-runner.test.ts && pnpm --filter indusk-admin exec vitest run src/lib/decisions-reader.planning.test.ts src/lib/decisions-reader.amendments.test.ts && pnpm exec vitest related apps/indusk-mcp/src/lib/plans/waiting.ts apps/indusk-admin/src/lib/decisions-reader.ts` — the whole suite runs at landing, not here.

  </details>
- [ ] The packages still type-check and pass the lint rules.
  <details><summary>Technical</summary>

  `pnpm check` and `pnpm exec tsc --noEmit -p apps/indusk-mcp` and `pnpm exec tsc --noEmit -p apps/indusk-admin` exit 0 (no `as never` left in the new tests).

  </details>
- [ ] The promise's recorded sentence matches the brief.
  <details><summary>Technical</summary>

  `indusk promises contract approval-waits-for-the-planning-run` exits 0, and `.indusk/promises/approval-waits-for-a-finished-plan.md` carries the new sentence with a history line for this plan.

  </details>
- [ ] The two live checks are run if this machine can run them, and their result is written down either way.
  <details><summary>Technical</summary>

  A7 and A12: with a daemon and `claude` present, run `pnpm e2e` (or start a planning run of a throwaway bugfix plan through the admin and watch Needs you every few seconds until the run ends). Write under this impl's Notes: "A7: <result>", "A12: <result>", with the date. With neither present, write "not run — no daemon/claude on this machine" for each. Never block on it, and never mark either row passing without a result written.

  </details>

#### Build Phase 1 Context

- (none needed — the rule is held by the tests that carry its promise token (`promise: approval-waits-for-a-finished-plan`); no new convention, lesson or area rule is produced, and a root Key Decisions line is not written for a bugfix with no ADR)

#### Build Phase 1 Document

- [ ] Say on the admin-UI sessions reference page that approval also waits for the planning run to end.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/sessions.md` line 71, the **approval** row of the waiting table: after "(its turn open, nothing asked)" add "and no planning run for the plan is still going (between its steps counts as going; a run that ended any way, including a failure, no longer holds it back)". Keep the rest of the row.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | `plannings` input; approval withheld while a planning run for the plan is going |
| `apps/indusk-mcp/src/lib/plans/waiting.test.ts` | A1, A2, A3, A4, A6, A8, A9, A10, A13, A14 |
| `apps/indusk-mcp/src/lib/build/planning-runner.test.ts` | A11 (token, or one guard case) |
| `apps/indusk-admin/src/lib/decisions-reader.ts` | pass each plan's `planningState(...).running` |
| `apps/indusk-admin/src/lib/decisions-reader.planning.test.ts` | new: A5 |
| `apps/indusk-admin/src/lib/decisions-reader.amendments.test.ts` | its `build-host` mock gains `planningState` |
| `.indusk/promises/approval-waits-for-a-finished-plan.md` | sentence changed by `indusk promises change` |
| `apps/docs/src/reference/admin-ui/sessions.md` | approval row says it |

## Dependencies

- `approval-waits-for-a-finished-plan` (cockpit-audit-fixes) and `decisions-wait-in-one-place` (plan-cockpit) are in force and held by the existing rows.
- The admin's `planningState` in `build-host.ts` (a-brief-is-planned-unasked) already exists; no change to it.

## Notes

- The reader sees only the admin's in-memory planning state. A daemon restarted mid-run loses it and shows approval as before; the brief does not ask for more (decision 3).
- Live check results (A7, A12) go here when Build Phase 1 runs them.
