---
title: "A brief is planned unasked"
date: 2026-10-18
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "53b690d8bf5e5c2a13414285dc38539bd29046a1c0676437c9baf58707902e1b"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T00:31:06.047Z"
---

# A brief is planned unasked

## Goal

Accepting a brief whose looks are approved starts an unattended run that writes the test plan, the ADR when the workflow has one, and the impl, each checked before the next, and stops for the person's approval; approving starts the build. Decisions in [adr.md](adr.md); assertions in [test-plan.md](test-plan.md).

## Scope

### In Scope
- The admin's interface narrowed to what draws.
- `indusk plans accept-brief`; the planner skill calling it.
- `nextPlanningStep`, the planning steps' prompts, `runPlanning`.
- The admin starting a planning run (acceptance, last look approved) and starting the build on approval; the refusals inside a planning step.

### Out of Scope
- A CLI start of the loop; showing the run (`activity-and-graph`); questions with a cost (`decisions-as-questions`).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Build Phase 1 | admin `screens.json` `sources` + `exclude`; `interfaceFilesAmong` honouring `exclude`; route lookup for an app-folder source | `lib/promises/interface-files.ts`, `lib/looks/touched.ts` |
| Build Phase 2 | `lib/plans/accept-brief.ts` `acceptBrief`, CLI `plans accept-brief`; refusals inside a planning step | the contract check, `refuseInsideBuildStep`, `currentBuildStep` |
| Build Phase 3 | `lib/build/next-planning-step.ts`, the planning prompts in `build-session.ts`, `lib/build/planning-runner.ts` `runPlanning` | `workflow-types`, `unapprovedMockups`, `runStepSession` |
| Build Phase 4 | admin `startPlanning` + `POST /api/plans/plan`; accept-brief and look approval asking it; the approve route starting the build | `build-host.ts`, Build Phases 2–3 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | Accepting a brief whose contract passes marks it accepted, and is refused, naming the problem, when the contract check fails | Build Phase 2 | Build Phase 2 | planned | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-mcp/src/lib/plans/accept-brief.test.ts |
| T2 | A planning run starts for an accepted brief whose looks are all approved, waits while one is not, and starts when the last is approved | Build Phase 4 | Build Phase 4 | planned | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T3 | A plan whose test plan, ADR and impl already exist, or whose impl is approved, starts no planning run | Build Phase 3 | Build Phase 3 | planned | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| T4 | The run's next step is the first missing document the workflow needs — test plan, then ADR when the workflow has one, then impl — and a step whose document fails its check is the same step again | Build Phase 3 | Build Phase 3 | planned | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| T5 | Each planning step is told to write only that document, from the plan's brief and research, to the planner's rules, unattended | Build Phase 3 | Build Phase 3 | planned | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/build-session.test.ts |
| T6 | Approving a plan, approving a look and starting a build are refused from inside a planning step, naming the step | Test Phase 1 | Build Phase 2 | written | unit | clause: an-accepted-brief-is-planned-unasked/never-approves | apps/indusk-mcp/src/lib/plans/planning-step-refusals.test.ts |
| T7 | A planning run ends when the impl passes its check, waiting for approval; a step that writes a blocker, or two steps without progress, end it with that reason | Build Phase 3 | Build Phase 3 | planned | unit | clause: an-accepted-brief-is-planned-unasked/decides-and-records | apps/indusk-mcp/src/lib/build/planning-runner.test.ts |
| T8 | Approving a plan from the admin starts its build, and an approval refused for any reason starts nothing | Build Phase 4 | Build Phase 4 | planned | unit | clause: an-accepted-brief-is-planned-unasked/approval-starts-the-build | apps/indusk-admin/src/app/api/plans/approve/route.test.ts |
| T9 | An accepted brief is planned end to end once on a real plan: the three documents written, each check passing, the run stopped for approval | Build Phase 4 | Build Phase 4 | planned | live check | a rehearsal of the brief's expectation on a real plan, recorded once | manual: accept a small plan's brief from the CLI with the admin running; watch the planning run write its documents and stop for approval |
| T10 | A change to the admin's server code (its `lib` and API routes) is not an interface change, a change to a page or component still is, and narrowing the admin's sources leaves every look's closure readable | Test Phase 1 | Build Phase 1 | written | unit | a regression guard: the admin's interface is what draws, so this plan's server changes can be accepted with no look | apps/indusk-mcp/src/lib/promises/interface-files.test.ts |

## Checklist

### Test Phase 1: Write the failing tests against today's code

**Tier**: med — the work step's default

This phase writes the two tests whose subjects exist today: that the admin's server code is not counted as interface, and that approving, approving a look and starting a build are refused inside a planning step. It records the rest, whose subjects the build phases introduce, as deferrals, so each build phase starts with its tests written.

- [x] Create or confirm this plan's worktree, so the plan tools read the plan from it.
  <details><summary>Technical</summary>

  `indusk worktree create a-brief-is-planned-unasked` from the trunk; it exists from `indusk plans start`, so this confirms it.

  </details>
- [x] Write the test that the admin's server code is not interface while its pages and components are, failing today.
  <details><summary>Technical</summary>

  T10 in `apps/indusk-mcp/src/lib/promises/interface-files.test.ts` (create if missing): over the real repository root, `interfaceFilesAmong(root, ["apps/indusk-admin/src/lib/build-host.ts", "apps/indusk-admin/src/app/api/plans/approve/route.ts", "apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx", "apps/indusk-admin/src/components/ui/PromiseRow.tsx"])` returns only the last two; and `lookClosures` for the admin has no `null` closure (read `lib/looks/touched.ts` for its signature). Red today on the first half.

  </details>
- [x] Write the test that approving, approving a look and starting a build are refused inside a planning step, failing today.
  <details><summary>Technical</summary>

  T6 in `apps/indusk-mcp/src/lib/plans/planning-step-refusals.test.ts`: with `INDUSK_BUILD_STEP=plan-impl` set for the test, `approvePlan` (on the plan-in-a-worktree fixture) and the look approval in `lib/looks/approve.ts` throw a refusal naming the step. Red today (no such refusal). The build start is an admin function, tested in Build Phase 4 with T2.

  </details>

#### Deferred to Build Phase 2

- **T1** — its subject is `acceptBrief` in `lib/plans/accept-brief.ts`, which Build Phase 2 introduces.

#### Deferred to Build Phase 3

- **T3, T4, T7** — their subjects are `nextPlanningStep` and `runPlanning`, which Build Phase 3 introduces; **T5** — the planning steps' prompts are new in `build-session.ts`.

#### Deferred to Build Phase 4

- **T2, T8** — their subjects are the admin's `startPlanning` and the approve route's new call; **T9** — the live check needs the whole loop.

#### Test Phase 1 Verification

- [x] The two tests exist and each fails on its own assertion, not on a missing file.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/interface-files.test.ts`; T6 under the system config if the fixture starts git.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new; the rules land with the build phases.
  <details><summary>Technical</summary>

  Confirm no context file needs a line yet.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  Confirm the docs change with the build phases.

  </details>

### Build Phase 1: The admin's interface is what draws

**Tier**: med — the work step's default

This phase narrows what counts as the admin's interface to the files that draw — its pages and components — and leaves out its server code and API routes, so a plan that changes how the admin runs, like this one, is not refused at acceptance for a look it never changed. The look check learns to read routes from the narrowed sources, so no look is touched by the change.

- [ ] Narrow the admin's declared interface to its pages and components, leaving out its API routes.
  <details><summary>Technical</summary>

  `.indusk/mockups/admin/screens.json`: `"sources": ["apps/indusk-admin/src/app", "apps/indusk-admin/src/components"]`, `"exclude": ["apps/indusk-admin/src/app/api"]`; `interfaceSources`/`interfaceFilesAmong` (`lib/promises/interface-files.ts`) honour `exclude`. Check every other reader of `sources` (grep `\.sources` under `src/lib/looks`) still finds the stylesheets and config it read before.

  </details>
- [ ] Let the look check read the app's routes when a declared source is the app folder itself.
  <details><summary>Technical</summary>

  `appRouterDir` in `lib/looks/touched.ts`: a source whose last segment is `app` is the app folder. T10.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 1 Verification

- [ ] The admin's server code is not interface, its pages and components are, and every look's sources still read.
  <details><summary>Technical</summary>

  T10; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 1"`.

  </details>

#### Build Phase 1 Context

- [ ] Add to the admin's context file that its interface is its pages and components, not its server code.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: one line, T10 as its guard.

  </details>

#### Build Phase 1 Document

- [ ] Say on the looks reference page that a screens file can exclude paths from an app's interface.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`; changelog.

  </details>

### Build Phase 2: A brief is accepted by a command, and a planning step approves nothing

**Tier**: med — the work step's default

This phase gives accepting a brief a command, so it has a moment the planning run can start from, and makes approving a plan or a look refuse inside a planning step. The planner skill calls the command instead of editing the status by hand.

- [ ] Add the command that accepts a brief once its contract check passes.
  <details><summary>Technical</summary>

  `lib/plans/accept-brief.ts` `acceptBrief(anyCheckout, plan)` (ADR decision 1): refuse a brief not in `draft`, run the plan's contract check and refuse with its message, set `status: accepted` and commit on the plan's branch (reuse how `accept.ts` and `setImplKeys` find the plan and commit); refused inside any build step. CLI `indusk plans accept-brief <plan>` in `bin/commands/plans.ts`. T1.

  </details>
- [ ] Make approving a plan and approving a look refuse inside a planning step.
  <details><summary>Technical</summary>

  `approvePlan` (`lib/plans/approve.ts`) and `lib/looks/approve.ts`: refuse when `currentBuildStep()` names a planning step (`plan-test-plan`, `plan-adr`, `plan-impl`), naming it. T6.

  </details>
- [ ] Make the planner skill accept a brief with the command, and resync its installed copy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md` step 4: after declaring the promises, run `indusk plans accept-brief <plan>` instead of setting the status by hand; `.claude/skills/planner/SKILL.md`; `skill-sync-parity.test.ts`.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 2 Verification

- [ ] A brief is accepted only when its contract passes, and nothing is approved inside a planning step.
  <details><summary>Technical</summary>

  T1, T6; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 2"`.

  </details>

#### Build Phase 2 Context

- [ ] Add to the package's context file that a brief is accepted by its command, not by a hand edit.
  <details><summary>Technical</summary>

  `.indusk/planning/CLAUDE.md` via `apps/indusk-mcp/templates/planning/CLAUDE.md` (the shipped planning rules): the brief line names `indusk plans accept-brief`.

  </details>

#### Build Phase 2 Document

- [ ] Document the brief acceptance command.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`; `guide/briefs.md` where acceptance is described; changelog.

  </details>

### Build Phase 3: The planning loop

**Tier**: med — the work step's default

This phase builds the loop that writes the plan: a decision that names the next document to write or says the plan is ready, a prompt for each document, and a runner that runs one unattended step per document until the impl passes its check, a blocker is written, or nothing progresses.

- [ ] Add the decision that names the next document a plan needs, or says it is waiting or ready.
  <details><summary>Technical</summary>

  `lib/build/next-planning-step.ts` `nextPlanningStep(state)` (ADR decision 2), pure. T3, T4.

  </details>
- [ ] Give each planning step its prompt: write only that document, unattended, to the planner's rules.
  <details><summary>Technical</summary>

  `lib/build/build-session.ts` `stepPrompt` gains `plan-test-plan`, `plan-adr`, `plan-impl` (ADR decision 3); `stepEnv` sets the step name. T5.

  </details>
- [ ] Add the runner that runs planning steps until the plan is ready for approval or cannot continue.
  <details><summary>Technical</summary>

  `lib/build/planning-runner.ts` `runPlanning(deps)` (ADR decision 4), mirroring `runBuild`'s reads, progress fingerprint and two-without-progress rule. T7.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 3 Verification

- [ ] The loop names each document in order, repeats one that fails its check, and stops at approval or with its reason.
  <details><summary>Technical</summary>

  T3, T4, T5, T7; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 3"`.

  </details>

#### Build Phase 3 Context

- [ ] Add to the package's context file where the planning loop lives beside the build loop.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Run, verify, Shape, cleanup (`lib/build/`): one line.

  </details>

#### Build Phase 3 Document

- [ ] Describe the planning loop on the reference page for plans.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (what runs after `accept-brief`); changelog.

  </details>

### Build Phase 4: The admin starts the plan and the build

**Tier**: med — the work step's default

This phase connects the loop to the moments that start it: accepting a brief, approving its last look, and approving the plan. Once it closes, a person accepts a brief and approves the plan, and everything between and after runs by itself to review.

- [ ] Let the admin start a planning run when a brief is ready, and have accepting a brief and approving a look ask it to.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `startPlanning` (ADR decision 5) behind `POST /api/plans/plan`; `accept-brief` posts to the running admin and says so when none runs; the look-approval route asks after approving. Starting a build is refused inside a planning step (decision 7). T2.

  </details>
- [ ] Make approving a plan from the admin start its build.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/app/api/plans/approve/route.ts`: after `approvePlan` returns, `startBuild` (ADR decision 6). T8.

  </details>
- [ ] Run the whole loop once on a real plan and record the result.
  <details><summary>Technical</summary>

  T9 (live check): a small throwaway plan with an accepted-ready brief, the admin running; record the documents written, each check's result, and that the run stopped for approval. Remove the throwaway plan after.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 4 Verification

- [ ] A ready brief starts its planning run, the last look approved starts it, approval starts the build, and the live run stopped for approval.
  <details><summary>Technical</summary>

  T2, T8, T9; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 4"`.

  </details>

#### Build Phase 4 Context

- [ ] Add to the admin's context file that the host starts planning runs as well as builds.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: one line.

  </details>

#### Build Phase 4 Document

- [ ] Write the decision page and the guide step for what happens after accepting a brief.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/a-brief-is-planned-unasked.md` with its sidebar entry; the planning guide; changelog.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `.indusk/mockups/admin/screens.json`, `apps/indusk-mcp/src/lib/promises/interface-files.ts`, `lib/looks/touched.ts` | the admin's interface |
| `apps/indusk-mcp/src/lib/plans/{accept-brief,approve}.ts`, `lib/looks/approve.ts`, `bin/commands/plans.ts` | brief acceptance, refusals |
| `apps/indusk-mcp/src/lib/build/{next-planning-step,planning-runner,build-session}.ts` | the planning loop |
| `apps/indusk-admin/src/lib/build-host.ts`, `src/app/api/plans/{plan,approve}/route.ts`, the look approve route | starting runs |
| `apps/indusk-mcp/skills/planner.md`, `templates/planning/CLAUDE.md` | the command |
| docs, context files | as listed |

## Dependencies

- `archived-plans-are-found` (landed).
