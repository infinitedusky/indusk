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
| T1 | Accepting a brief whose contract passes marks it accepted, and is refused, naming the problem, when the contract check fails | Build Phase 2 | Build Phase 2 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-mcp/src/lib/plans/accept-brief.test.ts |
| T2 | A planning run starts for an accepted brief whose looks are all approved, waits while one is not, and starts when the last is approved | Build Phase 4 | Build Phase 4 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T3 | A plan whose test plan, ADR and impl already exist, or whose impl is approved, starts no planning run | Build Phase 3 | Build Phase 3 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| T4 | The run's next step is the first missing document the workflow needs — test plan, then ADR when the workflow has one, then impl — and a step whose document fails its check is the same step again | Build Phase 3 | Build Phase 3 | passing | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| T5 | Each planning step is told to write only that document, from the plan's brief and research, to the planner's rules, unattended | Build Phase 3 | Build Phase 3 | passing | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/build-session.test.ts |
| T6 | Approving a plan, approving a look and starting a build are refused from inside a planning step, naming the step | Test Phase 1 | Build Phase 2 | passing | unit | clause: an-accepted-brief-is-planned-unasked/never-approves | apps/indusk-mcp/src/lib/plans/planning-step-refusals.test.ts |
| T7 | A planning run ends when the impl passes its check, waiting for approval; a step that writes a blocker, or two steps without progress, end it with that reason | Build Phase 3 | Build Phase 3 | passing | unit | clause: an-accepted-brief-is-planned-unasked/decides-and-records | apps/indusk-mcp/src/lib/build/planning-runner.test.ts |
| T8 | Approving a plan from the admin starts its build, and an approval refused for any reason starts nothing | Build Phase 4 | Build Phase 4 | passing | unit | clause: an-accepted-brief-is-planned-unasked/approval-starts-the-build | apps/indusk-admin/src/app/api/plans/approve/route.test.ts |
| T9 | An accepted brief is planned end to end once on a real plan: the three documents written, each check passing, the run stopped for approval | Build Phase 4 | Build Phase 4 | skipped | live check | a rehearsal of the brief's expectation on a real plan, recorded once | manual: accept a small plan's brief from the CLI with the admin running; watch the planning run write its documents and stop for approval |
| T10 | A change to the admin's server code (its `lib` and API routes) is not an interface change, a change to a page or component still is, and narrowing the admin's sources leaves every look's closure readable | Test Phase 1 | Build Phase 1 | passing | unit | a regression guard: the admin's interface is what draws, so this plan's server changes can be accepted with no look | apps/indusk-mcp/src/lib/promises/interface-files.test.ts |
| T11 | Two asks to plan the same plan at once start one planning run, not two: the second is refused or told one is running | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T12 | A planning run does not start while a person's planning conversation is open on the plan, and the planner skill tells that conversation to stop writing documents once the brief is accepted with the admin planning it | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T13 | A test plan the contract check refuses (a promise clause with no clause plan) is the test-plan step again, not passed on to the ADR and impl steps | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/read-planning.test.ts |
| T14 | The reader judges the impl under the same gate policy the planning session wrote it under, so an impl whose gate is skipped with a reason the session's check allowed is not read as failing | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/read-planning.test.ts |
| T15 | An impl check that cannot run (the hook file missing, node not starting) ends the run saying the check could not run, never reads as an impl that failed, and a check that refuses keeps its message for the run's stop reason | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/each-document-passes-its-check | apps/indusk-mcp/src/lib/build/read-planning.test.ts |
| T16 | Approving a plan from the admin while its planning run is still running is refused and approves nothing | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/approval-starts-the-build | apps/indusk-admin/src/app/api/plans/approve/route.test.ts |
| T17 | The impl step's prompt says an ADR or test plan left proposed or draft by the earlier steps is no reason to stop, and that it changes no other document's status | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/decides-and-records | apps/indusk-mcp/src/lib/build/build-session.test.ts |
| T18 | A `blocker:` line inside a fenced code block of a plan document does not end the planning run | Build Phase 5 | Build Phase 5 | passing | unit | clause: an-accepted-brief-is-planned-unasked/decides-and-records | apps/indusk-mcp/src/lib/build/read-planning.test.ts |
| T19 | When the person's planning conversation for a plan ends, a planning run starts for it if its brief is accepted and every look it names is approved | Build Phase 6 | Build Phase 6 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T20 | The planner skill tells a planning conversation to end after accepting its brief, leaving the documents to the unattended run | Build Phase 6 | Build Phase 6 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-mcp/src/__tests__/planner-ends-after-accept.test.ts |
| T21 | A build session already held for a plan refuses a build start and a planning start alike, naming the session and saying to stop it first | Build Phase 7 | Build Phase 7 | passing | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |
| T22 | Ending a planning conversation starts a run only when the brief was accepted during that conversation; a conversation that ends without accepting it starts nothing, even when the brief was accepted earlier | Build Phase 8 | Build Phase 8 | planned | unit | clause: an-accepted-brief-is-planned-unasked/starts-on-acceptance | apps/indusk-admin/src/lib/build-host.test.ts |

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

- [x] Move the plan tests command's test, which starts git, into the system tier, so the fast-suite guard passes.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/plan-tests.test.ts` calls `execFileSync("git")`, which `everyday-tests-never-wait.test.ts` refuses in the everyday suite; add it to `SYSTEM` in `apps/indusk-mcp/vitest.tiers.ts`. Discovered at Build Phase 1.

  </details>
- [x] Leave the admin's server code and API routes out of its declared interface.
  <details><summary>Technical</summary>

  `.indusk/mockups/admin/screens.json`: `sources` stays `["apps/indusk-admin/src"]` and gains `"exclude": ["apps/indusk-admin/src/lib", "apps/indusk-admin/src/app/api", "apps/indusk-admin/src/instrumentation.ts"]`. Sources are not narrowed because an approval binds `declarationsHashOf({devices, ignore, sources})`, so changing them would return every approved look to proposed; `exclude` is outside that hash. `interfaceSources`/`interfaceFilesAmong` (`lib/promises/interface-files.ts`) honour `exclude`. Every other reader of `sources` reads it unchanged; `looks status admin` shows no look flipped.

  </details>
- [x] Let the look check read the app's routes when a declared source is the app folder itself.
  <details><summary>Technical</summary>

  `appRouterDir` in `lib/looks/touched.ts`: a source whose last segment is `app` is the app folder. T10. Harmless now that sources are unchanged; kept so a narrower declaration also resolves.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.
  - Reviewed `interface-files.ts` and `touched.ts`: one reason to change each, the new `under` and `trimmed` helpers are named and reachable by T10; nothing found.

#### Build Phase 1 Verification

- [x] The admin's server code is not interface, its pages and components are, and every look's sources still read.
  <details><summary>Technical</summary>

  T10; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 1"`.

  </details>

#### Build Phase 1 Context

- [x] Add to the admin's context file that its interface is its pages and components, not its server code.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: one line, T10 as its guard.

  </details>

#### Build Phase 1 Document

- [x] Say on the looks reference page that a screens file can exclude paths from an app's interface.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`; changelog.

  </details>

### Build Phase 2: A brief is accepted by a command, and a planning step approves nothing

**Tier**: med — the work step's default

This phase gives accepting a brief a command, so it has a moment the planning run can start from, and makes approving a plan or a look refuse inside a planning step. The planner skill calls the command instead of editing the status by hand.

- [x] Add the command that accepts a brief once its contract check passes.
  <details><summary>Technical</summary>

  `lib/plans/accept-brief.ts` `acceptBrief(anyCheckout, plan)` (ADR decision 1): refuse a brief not in `draft`, run the plan's contract check and refuse with its message, set `status: accepted` and commit on the plan's branch (reuse how `accept.ts` and `setImplKeys` find the plan and commit); refused inside any build step. CLI `indusk plans accept-brief <plan>` in `bin/commands/plans.ts`. T1.

  </details>
- [x] Make approving a plan and approving a look refuse inside a planning step.
  <details><summary>Technical</summary>

  `approvePlan` (`lib/plans/approve.ts`) and `lib/looks/approve.ts`: refuse when `currentBuildStep()` names a planning step (`plan-test-plan`, `plan-adr`, `plan-impl`), naming it. T6.

  </details>
- [x] Make the planner skill accept a brief with the command, and resync its installed copy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md` step 4: after declaring the promises, run `indusk plans accept-brief <plan>` instead of setting the status by hand; `.claude/skills/planner/SKILL.md`; `skill-sync-parity.test.ts`.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 2 Verification

- [x] A brief is accepted only when its contract passes, and nothing is approved inside a planning step.
  <details><summary>Technical</summary>

  T1, T6; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 2"`.

  </details>

#### Build Phase 2 Context

- [x] Add to the package's context file that a brief is accepted by its command, not by a hand edit.
  <details><summary>Technical</summary>

  `.indusk/planning/CLAUDE.md` via `apps/indusk-mcp/templates/planning/CLAUDE.md` (the shipped planning rules): the brief line names `indusk plans accept-brief`.

  </details>

#### Build Phase 2 Document

- [x] Document the brief acceptance command.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md`; `guide/briefs.md` where acceptance is described; changelog.

  </details>

### Build Phase 3: The planning loop

**Tier**: med — the work step's default

This phase builds the loop that writes the plan: a decision that names the next document to write or says the plan is ready, a prompt for each document, and a runner that runs one unattended step per document until the impl passes its check, a blocker is written, or nothing progresses.

- [x] Add the decision that names the next document a plan needs, or says it is waiting or ready.
  <details><summary>Technical</summary>

  `lib/build/next-planning-step.ts` `nextPlanningStep(state)` (ADR decision 2), pure. T3, T4.

  </details>
- [x] Give each planning step its prompt: write only that document, unattended, to the planner's rules.
  <details><summary>Technical</summary>

  `lib/build/build-session.ts` `stepPrompt` gains `plan-test-plan`, `plan-adr`, `plan-impl` (ADR decision 3); `stepEnv` sets the step name. T5.

  </details>
- [x] Add the runner that runs planning steps until the plan is ready for approval or cannot continue.
  <details><summary>Technical</summary>

  `lib/build/planning-runner.ts` `runPlanning(deps)` (ADR decision 4), mirroring `runBuild`'s reads, progress fingerprint and two-without-progress rule. T7.

  </details>
- [x] Shape — review the files this phase changes against the enabled extensions' craft rules.
  - Reviewed `next-planning-step.ts`, `planning-runner.ts` and the prompt additions in `build-session.ts`: each has one reason to change; the planning step names are defined once in `step-env.ts` and read by the decision, the runner and the prompts; nothing found.

#### Build Phase 3 Verification

- [x] The loop names each document in order, repeats one that fails its check, and stops at approval or with its reason.
  <details><summary>Technical</summary>

  T3, T4, T5, T7; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 3"`.

  </details>

#### Build Phase 3 Context

- [x] Add to the package's context file where the planning loop lives beside the build loop.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Run, verify, Shape, cleanup (`lib/build/`): one line.

  </details>

#### Build Phase 3 Document

- [x] Describe the planning loop on the reference page for plans.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (what runs after `accept-brief`); changelog.

  </details>

### Build Phase 4: The admin starts the plan and the build

**Tier**: med — the work step's default

This phase connects the loop to the moments that start it: accepting a brief, approving its last look, and approving the plan. Once it closes, a person accepts a brief and approves the plan, and everything between and after runs by itself to review.

- [x] Read a real plan into the state the planning run decides from, which nothing did yet.
  <details><summary>Technical</summary>

  Found at the start of this phase: Build Phase 3's `nextPlanningStep` and `runPlanning` take a `PlanningState`, and no code builds one from a plan on disk. `lib/build/read-planning.ts` `readPlanningState(anyCheckout, plan, deps?)`: the documents the plan's workflow needs (`parsePlan` for `workflow` and `documentsOff`, `requiredDocuments`) and which exist (`findPlanFolder`); the contract check (`checkPlanContract`); the impl's structure check, by running the shipped `hooks/validate-impl-structure.js` on the impl's content (stdin `{tool_name:"Write",tool_input:{file_path,content},cwd}`, exit 0 is ok) through an injectable runner; `unapprovedMockups(root, briefText)`; the impl's status; a `blocker:` line in any of the three documents; and the brief's status, for the host. Unit-tested with fakes.

  </details>
- [x] Let the admin start a planning run when a brief is ready, and have accepting a brief and approving a look ask it to.
  - Decision: approving a look asks only for the plan whose worktree recorded the approval (`checkout.plan`), not for every accepted brief waiting on looks. An approval is written and committed in one checkout and no other plan's worktree holds it, so no other plan's state changed; a null checkout (the project's own) asks for nothing. `accept-brief` reaches the admin at the address `indusk ui` recorded (`daemonStatus`), posting the registry's name for the project, and says so when no admin runs, the project is unregistered or the admin refuses.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `startPlanning` (ADR decision 5) behind `POST /api/plans/plan`; `accept-brief` posts to the running admin and says so when none runs; the look-approval route asks after approving. Starting a build is refused inside a planning step (decision 7). T2.

  </details>
- [x] Make approving a plan from the admin start its build.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/app/api/plans/approve/route.ts`: after `approvePlan` returns, `startBuild` (ADR decision 6). T8.

  </details>
- [x] Run the whole loop once on a real plan and record the result. (deferred to after landing — asked: "I'd land first and run it on the real installed build, since that's what you'll actually use. OK, or run it now from the worktree?" — user: "I feel like we should run it landed, then test or something"; the result goes in the retrospective)
  <details><summary>Technical</summary>

  T9 (live check): a small throwaway plan with an accepted-ready brief, the admin running; record the documents written, each check's result, and that the run stopped for approval. Remove the throwaway plan after.

  </details>
- [x] Shape — reviewed the files this phase changes against the enabled extensions' craft rules; nothing to change: the planning start, the plan reader and the admin request each do one job with their reads handed in.
  - Not run: `prepareShapeReview` answers `skipped` while this phase's Verification item (which names the T9 live check) is unticked. A read of the changed files in the meantime found one defect, fixed (a failed start left a run state in the map); `startBuild` and `startPlanning` share slot rules in two bodies, which is two uses and left for `/cleanup`. Run Shape once T9 has passed.

#### Build Phase 4 Verification

- [x] A ready brief starts its planning run, the last look approved starts it, approval starts the build, and the live run stopped for approval. (the automated rows pass; the live run happens after landing)
  <details><summary>Technical</summary>

  T2, T8, T9; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 4"`.

  </details>

#### Build Phase 4 Context

- [x] Add to the admin's context file that the host starts planning runs as well as builds.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: one line.

  </details>

#### Build Phase 4 Document

- [x] Write the decision page and the guide step for what happens after accepting a brief.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/a-brief-is-planned-unasked.md` with its sidebar entry; the planning guide; changelog.

  </details>

### Build Phase 5: Falsification — double starts, checks the reader misjudges, approval mid-run

**Tier**: med — the work step's default

This phase tests the finished planning run against the ways it could start twice, judge a document differently from the session that wrote it, or be approved while it is still writing. Each hypothesis below is a test that should fail on today's code; each task is the fix if it does. Once it closes, a brief starts one planning run, each document is held to the same check the run reads, a check that cannot run says so, and nothing approves a plan that is still being written.

- [x] Make starting a planning run take its place before it reads the plan, so two asks at once start one run.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts` `startPlanning` (lines 286–322): the `planningState(...)?.running` check is followed by `await readPlanningState(...)` before `admitBuild` and `plannings().set`, so the comment "held before the first await below" is not true; two POSTs to `/api/plans/plan` (accept-brief and a look approval, or a double click) both pass the check and both start `runPlanning`. Hold a placeholder state (or a pending set) before the read and release it when the run declines. Also `admitBuild` is a `Set`: the first run's `free()` releases the second's place. T11.

  </details>
- [x] Refuse to start a planning run while a person's planning conversation holds the plan, and tell that conversation to stop once the admin is writing the plan.
  <details><summary>Technical</summary>

  `build-host.ts:290` asks `forPlan(project, plan, "build")` only; the conversation that just ran `indusk plans accept-brief` is a `"planning"` kind session on the same worktree, and the planner skill's step 5 (`apps/indusk-mcp/skills/planner.md`, after line 104) goes straight on to write the test plan — two writers on `test-plan.md`. Decline with the reason while a planning-kind session is open, or have `accept-brief` say the admin is writing it and the skill end the conversation there; resync `.claude/skills/planner/SKILL.md`. T12.

  </details>
- [x] Hold the test plan to the contract check's test-plan refusals before the ADR is written.
  <details><summary>Technical</summary>

  `lib/build/read-planning.ts:116–118` passes a test plan "by standing" (non-empty); `checkPlanContract` refuses a test plan through `clausePlanRefusals` (`lib/promises/contract.ts:434–438`), but that refusal only shows as `contractOk: false`, which `nextPlanningStep` (`next-planning-step.ts:70`) answers with `plan-impl` — a step told to write only `impl.md`, which cannot fix the test plan; the run then ends "two steps in a row made no progress". Mark `test-plan` not ok when a contract refusal names `test-plan.md`. T13.

  </details>
- [x] Run the impl check in the reader under the gate policy the planning session writes under.
  <details><summary>Technical</summary>

  `read-planning.ts:71–77` spawns the hook with the admin's environment (no `INDUSK_GATE_POLICY`), so the hook reads the impl's `gate_policy: ask` (the planner template's default); the session wrote under `INDUSK_GATE_POLICY=auto` (`stepEnv`), where `validate-impl-structure.js:425` skips the write-time opt-out rule. A gate written as `skip-reason: <why>` or `(not applicable)` passes in the session and is refused by the reader, so the impl step repeats until two steps make no progress. Pass `GATE_POLICY_FOR_BUILDS` in the hook's env. T14.

  </details>
- [x] Tell an impl check that could not run apart from one that refused, and keep the refusal's words for the run's stop.
  <details><summary>Technical</summary>

  `realPlanningReads.runHook` returns only `r.status`; a missing `hooks/validate-impl-structure.js` (the three-`..` path at `read-planning.ts:51–58`), a spawn error or a timeout gives a non-zero or null status read as `ok: false`, and the hook's stderr is dropped, so the run's stop says "two steps in a row made no progress" and the next impl step is not told what failed. Throw `PlanningUnreadable` when the hook cannot run (`r.error`, `r.signal`, status other than 0 or 2); carry the stderr of an exit 2 into `PlanningDocument` and into the stop reason. Lesson `detectors-must-distinguish-could-not-check-from-checked-and-failed`. T15.

  </details>
- [x] Refuse approving a plan from the admin while its planning run is running.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/app/api/plans/approve/route.ts:52` calls `approvePlan` with no look at `planningState`; once an impl passes the contract mid-run the person can approve and merge documents a planning session is still writing, and the following `startBuild` is then refused ("is being planned") with nothing to start the build when the run ends. Refuse with 409 naming the running step before `approvePlan`. T16.

  </details>
- [x] Tell the impl and ADR steps that an earlier document left draft or proposed is not a reason to stop.
  <details><summary>Technical</summary>

  The planner skill's step 7 reads "If ADR is accepted … write the impl", and `advance_plan` refuses `adr → impl` while the ADR is `proposed`; `planningPrompt` in `lib/build/build-session.ts` says neither, so a `plan-impl` session following the skill may write a blocker, or set the ADR accepted itself. Add to the planning prompt that the earlier documents stay as the earlier steps left them for the person's one approval, and that the step changes no other document. T17.

  </details>
- [x] Ignore a blocker line that sits inside a code block of a plan document.
  <details><summary>Technical</summary>

  `blockerIn` (`read-planning.ts:92–94`) matches `^blocker:` anywhere with the `m` flag; an ADR that quotes the blocker protocol in a fence (as `archive/gsd-inspired-improvements/adr.md` does) ends the run as blocked. Mask fenced lines before matching (the hooks' `fencedLineMask` shape). T18.

  </details>
- [x] Shape — reviewed the files this phase changes against the enabled extensions' craft rules; nothing to change: the impl judge and the blocker finder each do one job with their inputs handed in, and the planning start claims, declines or runs in that order with one release path.

#### Build Phase 5 Verification

- [x] One planning run starts per plan however many asks arrive, and none starts while a person is planning the plan.
  <details><summary>Technical</summary>

  T11, T12.

  </details>
- [x] Each document is judged by the same check the session wrote it under, a test plan the contract refuses is written again, and a check that cannot run says so.
  <details><summary>Technical</summary>

  T13, T14, T15, T18; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 5"`.

  </details>
- [x] A plan is not approved while it is being planned, and the impl step does not stop on an earlier document's status.
  <details><summary>Technical</summary>

  T16, T17.

  </details>

#### Build Phase 5 Context

- [x] Add to the package's context file that the planning reader runs the impl check under the build's gate policy and tells a check that cannot run from one that refused.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, Run, verify, Shape, cleanup (`lib/build/`): one line, T14 and T15 as its guards.

  </details>

#### Build Phase 5 Document

- [x] Say on the plans reference page that a planning run does not start while a person's planning conversation is open, and that approval waits for the run to end.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/plans.md` (the `accept-brief` section); changelog.

  </details>

### Build Phase 6: The run starts when the conversation ends

**Tier**: med — the work step's default

The falsification fix that keeps a planning run from starting while the person's own planning conversation is open also means the run rarely starts at all: the brief is normally accepted from inside that conversation, the admin declines because the conversation is open, and nothing asks again. This phase makes the end of a planning conversation ask the admin to start the run, and has the planner skill end the conversation after accepting the brief instead of writing the documents itself. Once it closes, accepting a brief in a conversation leads to the unattended run as soon as the conversation ends.

- [x] Make the end of a planning conversation ask the admin to start that plan's planning run.
  <details><summary>Technical</summary>

  Found by the Build Phase 5 builder (2026-10-18): `startPlanning` declines while a planning session is open for the plan (T12's fix), and `accept-brief` is usually run from that session, so nothing starts the run. In the admin's session host, when a session of `kind: "planning"` for a plan ends, call `startPlanning(project, plan)` and ignore a decline (it starts nothing unless the brief is accepted and looks approved). T19.

  </details>
- [x] Make the planner skill end the conversation after accepting the brief, leaving the documents to the unattended run, and resync its installed copy.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/skills/planner.md` step 4 and step 5: after `indusk plans accept-brief <plan>`, say the test plan, ADR and impl are written by the unattended run once this conversation ends, and end; the person can still ask to plan by hand. `.claude/skills/planner/SKILL.md`; `skill-sync-parity.test.ts`. T20.

  </details>
- [x] Shape — reviewed the files this phase changes against the enabled extensions' craft rules; nothing to change: the session manager's end announcement is one optional call that cannot undo the end, and the admin's end handler is one function that asks and reports nothing.

#### Build Phase 6 Verification

- [x] Ending a planning conversation starts the run for a ready brief, and the skill tells the conversation to end after accepting.
  <details><summary>Technical</summary>

  T19 and T20 pass; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 6"`.

  </details>

#### Build Phase 6 Context

- [x] Add to the admin's context file that a planning conversation's end asks for the planning run.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: amend the host line Build Phase 4 added.

  </details>

#### Build Phase 6 Document

- [x] Say in the planning guide that accepting a brief ends the conversation and the run follows.
  <details><summary>Technical</summary>

  The planning guide page Build Phase 4 updated; changelog.

  </details>

### Build Phase 7: Cleanup — one refusal for a held build session

**Tier**: med — the work step's default

This plan added a third place in the admin's run host that refuses to start when a build session is already held for the plan, each copy writing out the same message. Three copies of one rule is the point at which it earns a single home, so a later change to the wording or the check cannot reach only two of them. Once this phase closes the three starts share one refusal and behave exactly as before. The other comparisons the cleanup made found nothing worth moving, and each is recorded below with its reason.

- [x] Give the held-build-session refusal one home in the admin's run host and use it from the build, release and planning starts.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`: `startBuild`, `startRelease` and `startPlanning` each build the string "a build session is already running for ${plan}: ${id} — stop it first" from `sessionManager().forPlan(project, plan, "build")`. Extract one private `assertNoBuildSession(project, plan)` that throws it; the rule of three. Not exported. T21.

  </details>
- [x] Review the planning loop beside the build loop and leave both as they are.
  <details><summary>Technical</summary>

  Reviewed `lib/build/planning-runner.ts` against `lib/build/runner.ts` — left as-is: both are a read, decide, run, repeat loop, but they decide with different pure functions, stop on different answers and track different progress; a shared loop would take a generic over both and be harder to follow than two 30-line loops.

  </details>
- [x] Review the planning reader beside the build reader and leave both as they are.
  <details><summary>Technical</summary>

  Reviewed `lib/build/read-planning.ts` against `lib/build/read-plan.ts` — left as-is: the only shared lines are the live-copy lookup and its error, five lines; everything else reads different documents through different checks.

  </details>
- [x] Review the planning run's state and background wiring beside the build's and leave them as they are.
  <details><summary>Technical</summary>

  Reviewed `startPlanning` against `startBuild` in `build-host.ts` — left as-is beyond the refusal above: the state shapes differ, the claim-and-release order differs (the planning run holds its entry before the first await and releases on a decline, the build does not), and the shared tail is a single promise chain; a helper over both would need flags for each difference.

  </details>
- [x] Review the remaining oversized changed files and leave them as they are.
  <details><summary>Technical</summary>

  Reviewed `bin/cli.ts`, `lib/looks/approve.ts`, `lib/session/manager.ts`, `lib/session/manager.test.ts`, the planner skill and the docs pages — left as-is: this plan added ten lines or fewer to each of the code files and they were already over the threshold; the skill and docs are prose.

  </details>

#### Build Phase 7 Verification

- [x] A held build session stops a build start and a planning start with the same message, and the existing starts still work.
  <details><summary>Technical</summary>

  T21 passes; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 7"`; the admin's build-host tests stay green.

  </details>

#### Build Phase 7 Context

- [x] Add nothing to the context files, since the decomposition is internal to one file.
  <details><summary>Technical</summary>

  (none — internal decomposition: one private function in `build-host.ts`; no rule or structure a reader of the admin's context file needs changes.)

  </details>

#### Build Phase 7 Document

- [x] Add nothing to the docs, since no public surface changes.
  <details><summary>Technical</summary>

  (none — internal decomposition: the refusal message and its triggers are unchanged.)

  </details>

### Build Phase 8: Audit fix — only the conversation that accepted the brief starts the run

**Tier**: med — the work step's default

The cold audit found that ending any planning conversation on a plan whose brief is accepted starts an unattended run, including one where a person planning by hand only paused, which is broader than the promise's start at acceptance. This phase records when a brief was accepted and starts a run at a conversation's end only when the acceptance happened during that conversation. Once it closes, a run starts at acceptance, at the last look's approval, or when the conversation that accepted the brief ends, and at no other time.

- [ ] Record when a brief was accepted, and start a run at a conversation's end only when the brief was accepted after that conversation began.
  <details><summary>Technical</summary>

  Found by the audit (2026-10-19, `apps/indusk-admin/src/app/api/sessions/route.ts:88`). `acceptBrief` writes `accepted_at` (ISO) into the brief's frontmatter beside `status: accepted`; the session's `onEnd` passes the session's `startedAt` to `planningConversationEnded`, which calls `startPlanning` only when the brief's `accepted_at` is at or after it. A brief with no `accepted_at` (accepted by hand, before this) starts nothing at a conversation's end. T22.

  </details>
- [ ] Shape — review the files this phase changes against the enabled extensions' craft rules.

#### Build Phase 8 Verification

- [ ] A conversation that accepted the brief starts the run when it ends, and one that did not starts nothing.
  <details><summary>Technical</summary>

  T22 and T19 still passing; `indusk plans tests a-brief-is-planned-unasked --phase "Build Phase 8"`.

  </details>

#### Build Phase 8 Context

- [ ] Amend the admin's context line about a conversation's end to say only the accepting conversation starts the run.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the host line.

  </details>

#### Build Phase 8 Document

- [ ] Say in the planning guide that only the conversation that accepted the brief starts the run when it ends.
  <details><summary>Technical</summary>

  The planning guide page; the changelog line for this plan.

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
