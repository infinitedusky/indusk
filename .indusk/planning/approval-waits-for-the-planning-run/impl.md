---
title: "Approval waits for the planning run — Impl"
date: 2026-10-19
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "389b83ccfa63efe02f94267ff646d32e2d06627d1a41382dd24091fba606c3ff"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T16:43:12.193Z"
---

# Approval waits for the planning run — Impl

## Goal

A plan is offered for approval only when its impl is a draft with the documents before it accepted, no session is still writing it, and its `plan-review.md` is written with every finding answered. A plan that meets the first two but not the third, and that no planning run is still writing, is listed under Needs you as needing its plan review — with the reason the admin's planning run stopped, when the admin still knows it. Every Approve button the admin draws (the decision card, the plan page, the brief page) asks that one answer, the package's `planWaiting`. Because the file is read on every render, the rule holds after a run that stopped on a failure, after an admin restart, and for a plan written by hand.

## Decisions made while writing this plan

1. **The plan review is read from the file, through one package reader.** A new package module, `plans/plan-review`, reads `plan-review.md` with `readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS, causes: false })` and reduces it to `missing`, `unanswered` or `answered` (`isAnswered`, the run's own test of "complete"). The planning run's reader (`read-planning.ts`'s `readReview`) asks the same module, so the run cannot stop "ready for approval" on a review the offer reads as unanswered. The admin's plan reader calls it, as it calls `finishedRitualsOf` today; the admin reads no plan-review text itself. Rejected: reading the file in `readWaiting` (a second reader in the admin, against `cockpit-single-definition`).
2. **The new waiting kind is `plan-review`.** It waits at the Impl step, as approval does, with the decision "The plan needs its plan review …" and, when the admin's planning run for the plan stopped short of approval, "Its planning run stopped: <why>". The words are the package's; the admin passes the run's `stop` as it holds it. Its accept ("Ask the agent to write it") and its alternative ("Not yet") are words to the plan's agent, never an approval or a release.
3. **A planning run still going lists nothing.** Neither approval nor the plan review is listed while the admin's run for the plan is going (a new optional input `plannings`, like `builds`). A run that never settles therefore hides the plan until `indusk ui restart`, after which the file rule lists it as needing its plan review — never as approval. Restarting a stopped run is out of scope (the brief's "Not promised").
4. **Absent means missing.** A snapshot with no `planReview` reads as missing, and absent `plannings` reads as no run: a restart or a hand-written plan is held by the file alone.
5. **`canApprove` takes the plan's waiting answer.** `planActions` gains `waitingOn` and offers Approve only when it is `approval`. Both pages compute the plan's waiting answer with `readWaiting` and pass it in. The plan page keeps hiding its session panel's Approve while the decision card offers it, so on the plan page Approve is on the card alone; the brief page's session panel offers it only when the plan waits on approval. The approve route's 409 while a run is going stays.
6. **No gate in `indusk plans approve`.** The command line is unchanged; only the admin's offer changes.
7. **No OTel gate.** `.indusk/config.json` sets `otel.role: "library"`. The promise has no telemetry mark; the deferred live check's mitigation says so rather than claiming a broken reading would reach anyone.
8. **The window between a planning conversation ending and its run starting** (the plan review's last finding) now lists the plan as needing its plan review for that moment, not as approval.

## Scope

### In Scope
- `plans/plan-review` (new package module and subpath): the one reading of a plan's review state; the planning run's reader uses it.
- `PlanSnapshot.planReview`; `planWaiting`'s `plannings` input and its `plan-review` kind.
- The admin's plan reader, snapshot, `readWaiting`, `planActions`, both pages, the decision route and the decision card's heading.
- The changed promise sentence, the admin reference pages and the changelog.

### Out of Scope
- Restarting a stopped planning run, and showing which planning step runs on the plan page (the brief's "Not promised").
- Any gate in `indusk plans approve`.
- A new look, state or component: the decision card's existing ask state carries the new kind.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | every test that can fail on its own assertion today, red; the guards, green; the package reader's test body, recorded | the existing `planWaiting`, `planActions`, `readWaiting`, `answerDecision`, `DecisionCard`, `startPlanning` |
| Build Phase 1 | `plans/plan-review` (`readPlanReview`, `planReviewState`, `planReviewAnswers`), `PlanSnapshot.planReview`, `WaitingInput.plannings`, the `plan-review` waiting kind, the run's reader sharing the module | the tests from Test Phase 1 |
| Build Phase 2 | the admin reading the review into each plan, `readWaiting` passing the planning state, `planActions.waitingOn` on both pages, the decision route and card for the new kind, the changed promise sentence, the docs | the package from Build Phase 1 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A draft impl with the documents before it accepted, no session writing it and no run going, but no plan-review.md, is listed once as needing its plan review at Impl, never for approval | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A2 | The same plan whose plan review leaves a finding unanswered, a finding without its breaks-when line, or a question without its section is listed as needing its plan review, never for approval | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A3 | While a planning run for the plan is going and no session turn is open, nothing is listed for it, whether or not its plan review is answered | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A4 | A run that stopped short of approval with a reason, on a plan whose review is not answered, lists the plan as needing its plan review with the reason in the decision | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A5 | With no planning state passed in (an admin restart), a draft impl without an answered review is listed as needing its plan review with the plain decision, never for approval | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A6 | A hand-written plan no run touched needs its plan review the same way, and is offered for approval once the review is answered | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A7 | A session whose turn is open withholds both approval and the plan-review listing; once the turn ends the plan is listed by its review's state | Test Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A8 | A planning run going for another plan does not affect this plan's listing | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: runs are matched to a plan by its name alone | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A9 | The package reads a plan folder's plan-review.md as missing, unanswered or answered, through the reader with the plan review's questions | Build Phase 1 | Build Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/plan-review.test.ts |
| A10 | The admin's plan reader, on a real plan folder, hands the snapshot the plan review's state for each of the three states | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/planning-reader.plan-review.test.ts |
| A11 | The package exports the plan-review reader and neither the admin nor the editor defines one of its own | Test Phase 1 | Build Phase 1 | passing | unit | lesson: structural-single-definition-test-for-must-agree-invariants | apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts |
| A12 | The admin's planning state stays going through the gap between one step and the next, and reads stopped with its reason once the run ends on a failure | Test Phase 1 | Test Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/build-host.test.ts |
| A13 | Through the admin's reader and the real planning state of a run the admin started, a draft impl is listed nowhere while the run is between steps, and as needing its plan review with the reason once it stops on a failure | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.planning.test.ts |
| A14 | What a plan's page offers says Approve only when the package lists the plan as waiting on approval; waiting on its plan review, a question or nothing offers none | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/plan-actions.test.ts |
| A15 | The plan page and the brief page both pass the package's waiting answer for the plan into what the page offers | Test Phase 1 | Build Phase 2 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/plan-actions-pages.test.ts |
| A16 | On the installed admin, through a whole planning run after a brief is accepted, Needs you and the plan page show no Approve until plan-review.md is answered, then Approve once on the decision card | Build Phase 2 | Build Phase 2 | skipped | live check | promise: approval-waits-for-a-finished-plan | manual: after landing run `pnpm install:local` and `indusk ui restart`; accept a draft brief of a throwaway bugfix plan in the admin; while its planning run writes the test plan, the impl and the plan review, reload Needs you and the plan's page and brief page every few seconds and note that none shows Approve; once plan-review.md has every finding answered and the run stops, note one Approve, on the decision card; record the result with the date in this impl's Notes |
| A17 | A draft impl with no session writing it, no run going and its plan review answered is listed once, as approval, with Approve and Not yet — keep planning | Test Phase 1 | Test Phase 1 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A18 | A question still outranks everything, an amendment and a stopped review are listed as before, and each outranks a plan needing its plan review | Test Phase 1 | Test Phase 1 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting.test.ts |
| A19 | Accepting a plan-review decision, or its alternative, neither approves nor releases; it goes to the plan's agent as words | Test Phase 1 | Build Phase 2 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A20 | The decision card draws a plan-review wait in its ask state, headed as needing its plan review at the step, with the decision's words | Test Phase 1 | Build Phase 2 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx |
| A21 | The planning run still reads the plan review absent, open, then answered with its dismissals, and stops for approval only once it is answered | Test Phase 1 | Test Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-mcp/src/lib/build/read-planning.test.ts, apps/indusk-mcp/src/lib/build/next-planning-step.test.ts |
| A22 | An Accept given on a plan-review card, after the plan has come to wait on approval, approves nothing and is refused naming what the plan waits on now | Build Phase 3 | Build Phase 3 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions.test.ts |
| A23 | The decision card sends the kind of decision it showed with every answer | Build Phase 3 | Build Phase 3 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx |
| A24 | A plan-review answer said to a session already running on the plan carries the decision it answers, naming plan-review.md, not the button's words alone | Build Phase 3 | Build Phase 3 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A25 | A run stopped waiting for its looks names those looks in the plan-review decision, and a stop reason ending in a full stop is not given a second one | Build Phase 3 | Build Phase 3 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-mcp/src/lib/plans/waiting.test.ts |

### Deferred Verification

- **A16, the live check**
  - reason: it needs the installed admin, a real `claude` and a real planning run end to end; no everyday or system-tier test starts a planning run.
  - would require: a slow-tier test that installs the build, starts the admin daemon in a temporary home and drives a planning run of a fixture plan with a real `claude`, polling Needs you between steps.
  - mitigation: the rule is held from its inputs by the package's unit rows, the file reading by the reader rows on real plan folders, and the join of the admin's reader to its real planning state by the reader row; the approve route still refuses while a run is going. The promise has no telemetry mark, so a regression found in use is reported by the person as a break of `approval-waits-for-a-finished-plan`, not detected.

## Checklist

### Test Phase 1: Author every test that can fail today

**Tier**: med — the work step's default

This phase writes the plan's tests before any fix, so the build phases have a fixed target. The tests of the waiting rule, of what each page offers, of the admin's readers, of the decision route and of the decision card all exist after it, and each that describes the new behaviour fails today on its own assertion: today a plan with no answered plan review is offered for approval, and both Approve buttons ignore the rule. The tests that describe what must stay true pass from the start and are recorded as guards. Only the package reader's test waits, because the module it tests does not exist yet; its body is recorded here.

- [x] Confirm this plan's own worktree and branch before any edit.
  <details><summary>Technical</summary>

  The worktree exists (`indusk plans start` made it): confirm with `git -C /Users/the_dusky/code/sandbox/dusk-worktrees/approval-waits-for-the-planning-run rev-parse --abbrev-ref HEAD` (expect `plan/approval-waits-for-the-planning-run`) and that `indusk worktree` records it for this plan; if not recorded, `indusk worktree assign approval-waits-for-the-planning-run /Users/the_dusky/code/sandbox/dusk-worktrees/approval-waits-for-the-planning-run`. Use absolute paths in every command.

  </details>
- [x] Add the tests of the waiting rule for plans whose plan review is missing, unanswered or answered, with and without a planning run.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/plans/waiting.test.ts`: widen the file's local type to `type Plan = PlanSnapshot & { name: string; planReview?: "missing" | "unanswered" | "answered" }` (compiles today, before the field exists) and give the existing `approval` fixture `planReview: "answered"` so the existing approval tests keep their meaning. Add a `describe("approval-waits-for-the-planning-run")` carrying `// promise: approval-waits-for-a-finished-plan`, with A1–A8, A17 and A18. Pass the new input as `planWaiting({ sessions, plans, builds: [], plannings } as Parameters<typeof planWaiting>[0])`, the file's existing cast for an input not yet in the type. The new kind is asserted as `on: "plan-review"`, `step: "Impl"`, and a decision matching `/plan review/`. Sketches:

  ```typescript
  const unread: Plan = { ...approval, planReview: "missing" };
  const running = { plan: approval.name, running: true, stop: null };
  const failed = {
  	plan: approval.name,
  	running: false,
  	stop: { step: "cannot-continue", why: "the last step's session failed: exit 1" },
  };

  it("A1 a written plan without its plan review is listed as needing it, not for approval", () => {
  	expect(wait({ plans: [unread] })).toEqual([
  		expect.objectContaining({ plan: approval.name, on: "plan-review", step: "Impl" }),
  	]);
  });
  it("A3 a run still going lists nothing, answered or not", () => {
  	expect(wait({ plans: [unread], plannings: [running] })).toEqual([]);
  	expect(wait({ plans: [approval], plannings: [running] })).toEqual([]);
  });
  it("A4 a stopped run's reason is in the decision", () => {
  	const [w] = wait({ plans: [unread], plannings: [failed] });
  	expect(w?.on).toBe("plan-review");
  	expect(w?.decision).toContain("the last step's session failed: exit 1");
  });
  ```

  A2 runs over `"unanswered"`. A5 passes no `plannings` and asserts the decision has no "stopped" sentence. A6 is a plan with no run: missing gives `plan-review`, answered gives `approval`. A7: an open session (`writing: true`) gives `[]` for both review states; with `writing: false` and a missing review, `plan-review`. A8: a running run named for another plan leaves `approval` (answered review) — green today. A17: answered review, no session, no run, gives one `approval` entry with `accept: "Approve"` and `alternative: "Not yet — keep planning"` — green today. A18: a question, an amendment, and a review stop each outrank a missing review — green today because the plan-review kind does not exist and the higher kinds win already.

  </details>
- [x] Add a test of the admin's plan reader that reads a plan review from a real plan folder on disk.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/lib/planning-reader.plan-review.test.ts`, carrying `// promise: approval-waits-for-a-finished-plan`, modelled on `planning-reader.rituals.test.ts`: a temp project with `.indusk/planning/p/` holding a bugfix brief (accepted), a test plan (accepted) and a draft impl; read through `readActivePlans(project)` and `snapshotOf`. A10: with no `plan-review.md`, `snapshotOf(plan).planReview` is `"missing"`; with one whose first finding has no `answer:` line, `"unanswered"`; with the four `PLAN_REVIEW_QUESTIONS` sections and every finding answered, `"answered"`. Read the field through `(snapshot as { planReview?: string }).planReview` until Build Phase 2 adds it. Red today: the field is `undefined`.

  </details>
- [x] Add the plan-review reader to the test that keeps each cockpit fact defined once in the package.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts`: add `["./plans/plan-review", "src/lib/plans/plan-review.ts", "readPlanReview"]` to `MODULES` and `readPlanReview`, `planReviewState` to `PACKAGE_ONLY` (A11). Red today on the missing export.

  </details>
- [x] Add a test that the admin's planning state stays going between steps and keeps a failed run's reason.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.test.ts`: add `// promise: approval-waits-for-a-finished-plan` beside the existing token. Let the fake runner keep what it was handed and how to end it — `runPlanning: (deps) => { runs += 1; handed = deps; return new Promise((resolve) => { finishRun = () => resolve({ step: "ready-for-approval" }); failRun = (why) => resolve({ step: "cannot-continue", why }); }); }` — so the existing cases are unchanged. A12: `await startPlanning(PROJECT, PLAN)`; `handed.onStep("plan-test-plan")` → `planningState(PROJECT, PLAN)` is `running: true`, `step: "plan-test-plan"`; with no further call (the gap between steps) it is still `running: true`; `failRun("the last step's session failed: exit 1")`, then `await vi.waitFor(() => expect(planningState(PROJECT, PLAN)?.running).toBe(false))` and `stop` equals `{ step: "cannot-continue", why: "the last step's session failed: exit 1" }`. The host's own state is read through `planningState`, never mocked. Green today.

  </details>
- [x] Add a test of the admin's waiting reader driven by a real planning run started through the admin's host.
  <details><summary>Technical</summary>

  New `apps/indusk-admin/src/lib/decisions-reader.planning.test.ts`, carrying `// promise: approval-waits-for-a-finished-plan`. Mock only what the host stands on, as `build-host.test.ts` does: `@infinitedusky/indusk-mcp/build` (`readPlanningState` answering an accepted brief with a document still to write; `runPlanning` keeping `deps` and an end function), `./session-host` (`planLocation`, and a `sessionManager` with `forPlan` → `undefined`, `admitBuild` → a release, `running` → `[]`, `pendingQuestion` → `null`, `isWriting` → `false`) and `./registry-client` (`getProjectPath` → the temp project). Leave `./build-host` real. Write the plan folder as in the reader test above (no `plan-review.md`) and read it with `readActivePlans`. A13: `await startPlanning("proj", "p")`, `deps.onStep("plan-impl")`, then `readWaiting("proj", project, plans)` is `[]` (red today: approval is listed); end the run with `cannot-continue` and a reason, wait for the state to read stopped, and `readWaiting` gives one entry with `on: "plan-review"` whose decision contains the reason.

  </details>
- [x] Add tests that what a plan's page offers follows the package's waiting answer, on both pages.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/plan-actions.test.ts`: add `// promise: approval-waits-for-a-finished-plan`; call through a local `const offered = (input: PlanActionInput & { waitingOn?: string }) => planActions(input)` so the new field compiles today. Change the existing A10 case "Approve once its impl exists" to pass `waitingOn: "approval"` (still green today). A14: with `implStatus: "draft"`, `canApprove` is true for `waitingOn: "approval"` and false for `"plan-review"`, `"question"` and `undefined` (red today on the last three). New `apps/indusk-admin/src/lib/plan-actions-pages.test.ts`, carrying the same token, A15: read `src/app/p/[project]/plan/[name]/page.tsx` and `src/app/p/[project]/plan/[name]/brief/page.tsx` as text; each calls `readWaiting(` and its `planActions({ … })` call passes `waitingOn: waiting?.on` (red today on the brief page, which reads no waiting, and on the plan page, which passes none). Both files live in `src/lib`, so they run in the node project.

  </details>
- [x] Add the tests that answering a plan-review decision never approves or releases, and that the decision card draws it.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions.test.ts` (A19): a waiting `{ plan: PLAN, on: "plan-review", step: "Impl", decision: "The plan needs its plan review …", accept: "Ask the agent to write it", alternative: "Not yet" } as unknown as Waiting`; `answerDecision` with `accept`, then with `alternative`: `approve` and `release` are never called, and the words reach the plan's running session through `say` (or a new planning session when none runs). Red today: accept runs `release`. `apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx` (A20): render the card for the same waiting; the heading reads "Needs its plan review at Impl", the decision's words are shown, and the card's `data-on` is `plan-review`. Red today: the heading map has no entry. Keep the casts until Build Phase 1 adds the kind; the admin's `typecheck.test.ts` must stay green.

  </details>
- [x] Confirm the planning run's own tests already hold how it reads the plan review and when it stops for approval.
  <details><summary>Technical</summary>

  A21: `read-planning.test.ts` ("reads the plan review: absent, open, then answered with its dismissals") and `next-planning-step.test.ts` (the plan review is the run's last step) exist and pass; both carry `promise: an-accepted-brief-is-planned-unasked`. Change nothing; run them.

  </details>
- [x] Run every test this phase wrote and check that each new-behaviour test fails on its own assertion and every guard passes.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/waiting.test.ts src/__tests__/cockpit-single-definition.test.ts src/lib/build/read-planning.test.ts src/lib/build/next-planning-step.test.ts` and `pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.plan-review.test.ts src/lib/build-host.test.ts src/lib/decisions-reader.planning.test.ts src/lib/plan-actions.test.ts src/lib/plan-actions-pages.test.ts src/lib/decisions.test.ts src/components/cockpit/DecisionCard.test.tsx src/__tests__/typecheck.test.ts`. Commit the red state on the plan's branch.

  </details>

#### Deferred to Build Phase 1

- **A9** — its subject, `readPlanReview` in `plans/plan-review.ts`, is created by Build Phase 1; a file written now would fail to load, not fail an assertion. Body reviewed:

  ```typescript
  // apps/indusk-mcp/src/lib/plans/plan-review.test.ts
  // promise: approval-waits-for-a-finished-plan
  import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
  import { tmpdir } from "node:os";
  import { join } from "node:path";
  import { afterEach, beforeEach, expect, it } from "vitest";
  import { PLAN_REVIEW_QUESTIONS } from "../audit/answers.js";
  import { readPlanReview } from "./plan-review.js";

  let dir: string;
  beforeEach(() => {
  	dir = mkdtempSync(join(tmpdir(), "plan-review-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const review = (answered: boolean) =>
  	[
  		"# Plan review",
  		"",
  		...PLAN_REVIEW_QUESTIONS.flatMap((q, i) => [
  			`## ${q}`,
  			"",
  			i === 0
  				? [
  						"- a finding",
  						"  - breaks when: a run stops early",
  						...(answered ? ["  - answer: fix — the rule reads the file"] : []),
  					].join("\n")
  				: "- Nothing.",
  			"",
  		]),
  	].join("\n");

  it("A9 reads a missing plan review as missing", () => {
  	expect(readPlanReview(dir)).toBe("missing");
  });

  it("A9 reads a plan review with an unanswered finding as unanswered", () => {
  	writeFileSync(join(dir, "plan-review.md"), review(false));
  	expect(readPlanReview(dir)).toBe("unanswered");
  });

  it("A9 reads a plan review with every question's section and every finding answered as answered", () => {
  	writeFileSync(join(dir, "plan-review.md"), review(true));
  	expect(readPlanReview(dir)).toBe("answered");
  });
  ```

#### Deferred to Build Phase 2

- **A16** — a live check of the installed admin through a real planning run; it exists only as the manual procedure in its row's Test cell and is run after landing, recorded in Notes.

#### Regression Guards

- **A8** — another plan's run hides nothing today; it pins that runs are matched by plan name once the new input exists.
- **A12** — the host already holds a run as going until its runner settles and keeps the stop's reason; pinned because the new listing reads both.
- **A17** — a ready plan is listed once for approval today; pinned so the plan-review condition does not drop or duplicate it once the review is answered.
- **A18** — question, amendment and review already outrank approval; pinned so the new kind sits below them.
- **A21** — the planning run's reading of the plan review is unchanged in meaning; pinned while its reader moves onto the shared module.

#### Test Phase 1 Verification

- [x] Every test of new behaviour exists and fails today on its own assertion, never on a missing import.
  <details><summary>Technical</summary>

  Red on an assertion: A1, A2, A3, A4, A5, A6, A7 (`waiting.test.ts` offers approval), A10 (`planReview` undefined), A11 (no `./plans/plan-review` export), A13 (approval listed mid-run), A14, A15, A19 (`release` called), A20 (no heading). A9 and A16 are deferred above.

  </details>
- [x] Every guard passes today, and the deferred test body has been read for whether it will load and asserts what it claims.
  <details><summary>Technical</summary>

  Green: A8, A12, A17, A18, A21, plus the existing approval, amendment and A10 cases kept green by the fixture changes. The A9 body loads once `readPlanReview` exists, and its three cases match `missing`, `unanswered`, `answered`. The admin's `typecheck.test.ts` is green.

  </details>

#### Test Phase 1 Context

- [x] Record nothing new yet.
  <details><summary>Technical</summary>

  The rules this plan adds are written in the build phases, beside the code that enforces them.

  </details>

#### Test Phase 1 Document

- [x] Write nothing in the docs yet.
  <details><summary>Technical</summary>

  The reference pages and the changelog are Build Phase 2's, written with the admin change they describe.

  </details>

### Build Phase 1: The package reads the plan review and lists what a plan waits on by it

**Tier**: med — the work step's default

This phase changes the package's rule for what a plan waits on. The package gains one reader of a plan's review file, used both by the unattended planning run and by the rule, so the two can never disagree about whether a review is answered. The rule then offers approval only when that review is answered, lists a plan needing its review otherwise, and lists nothing while a planning run for the plan is still going, with the run's stop reason carried into the words when there is one. After this phase the admin only has to hand the rule what it reads.

- [x] Add one package reader of a plan's review file and make the planning run use it.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/plans/plan-review.ts`:

  ```typescript
  export type PlanReviewState = "missing" | "unanswered" | "answered";

  /** plan-review.md read the one way: the planning run's stop and the offer of approval both ask this. */
  export function planReviewAnswers(text: string): AuditAnswers {
  	return readAuditAnswers(text, { questions: PLAN_REVIEW_QUESTIONS, causes: false });
  }

  export function planReviewState(text: string | null): PlanReviewState {
  	if (text === null) return "missing";
  	return isAnswered(planReviewAnswers(text)) ? "answered" : "unanswered";
  }

  export function readPlanReview(planDir: string): PlanReviewState {
  	const path = join(planDir, "plan-review.md");
  	return planReviewState(existsSync(path) ? readFileSync(path, "utf-8") : null);
  }
  ```

  Header comment: `promise: approval-waits-for-a-finished-plan`. Add the subpath to `apps/indusk-mcp/package.json` `exports`: `"./plans/plan-review": { "types": "./dist/lib/plans/plan-review.d.ts", "default": "./dist/lib/plans/plan-review.js" }`. In `apps/indusk-mcp/src/lib/build/read-planning.ts`, `readReview` calls `planReviewAnswers` and sets `complete: planReviewState(text) === "answered"` instead of its own `readAuditAnswers` call. Write `plan-review.test.ts` from the reviewed body in "Deferred to Build Phase 1" (A9).

  </details>
- [x] Give the plan snapshot the state of its plan review.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`, `PlanSnapshot`: add `/** Its plan-review.md as \`plans/plan-review\` read it; absent reads as missing. */ planReview?: PlanReviewState;` with `import type { PlanReviewState } from "./plan-review.js"` (type-only, so client components that import `plans/steps` load no `node:fs`).

  </details>
- [x] Make the waiting rule list a plan needing its plan review, offer approval only once it is answered, and list nothing while a planning run for the plan is going.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/waiting.ts`: `WaitingOn` gains `"plan-review"`. Add

  ```typescript
  export interface WaitingPlanning {
  	plan: string;
  	/** The admin's planning run for the plan has not ended (between its steps counts as going). */
  	running: boolean;
  	/** Where the run stopped, as the admin holds it; null while it runs. */
  	stop?: PlanningStop | null;
  }
  ```

  (`import type { PlanningStop } from "../build/planning-runner.js"`) and `plannings?: ReadonlyArray<WaitingPlanning>` on `WaitingInput`, defaulting to `[]`. Export `PLAN_REVIEW_DECISION = "The plan needs its plan review: plan-review.md, written with every finding answered, before it can be approved."`. Replace the last link of the `??` chain with `(awaitingApproval(plan) && !beingWritten(plan, sessions) && !planningGoing(plan.name, plannings) ? (plan.planReview === "answered" ? approval(plan.name) : planReview(plan.name, plannings)) : null)`. `planningGoing` is `plannings.some((p) => p.plan === plan.name && p.running)`. `planReview` returns `{ plan, on: "plan-review", step: "Impl", decision, accept: "Ask the agent to write it", alternative: "Not yet" }`, the decision being `PLAN_REVIEW_DECISION`, followed by ` Its planning run stopped: <why>.` when the plan's entry has a stop other than `ready-for-approval` (`cannot-continue` gives its `why`; `wait-for-looks` gives "it waits for its looks: <looks>"). Tag both helpers `promise: approval-waits-for-a-finished-plan`, and extend the header comment: the approval bullet gains "and its plan review is written with every finding answered", and a new **plan-review** bullet says when it is listed. Remove the `as Parameters<…>` casts from the new tests and the widened `Plan` type in `waiting.test.ts`.

  </details>
- [x] Build the package so the admin reads the new code.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp build` exits 0; `dist/lib/plans/plan-review.js` exists.

  </details>

#### Build Phase 1 Verification

- [x] The package's rule and reader tests that failed now pass, and the guards still pass.
  <details><summary>Technical</summary>

  A1, A2, A3, A4, A5, A6, A7, A9, A11 go green; A8, A17, A18, A21 stay green. `indusk plans tests approval-waits-for-the-planning-run --phase "Build Phase 1"` exits 0, or directly `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/waiting.test.ts src/lib/plans/plan-review.test.ts src/__tests__/cockpit-single-definition.test.ts src/lib/build/read-planning.test.ts src/lib/build/next-planning-step.test.ts`.

  </details>
- [x] The package type-checks and passes the lint rules on the files it changed.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-mcp` exits 0; `pnpm exec biome check apps/indusk-mcp/src/lib/plans apps/indusk-mcp/src/lib/build/read-planning.ts apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts apps/indusk-mcp/package.json` exits 0.

  </details>

#### Build Phase 1 Context

- [x] Add the plan-review reader to the package's context file, beside the audit reader it builds on.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, the `lib/audit/` entry: append "`plans/plan-review`'s `readPlanReview` / `planReviewState` is the one reading of a plan's review as missing, unanswered or answered; the planning run's stop and the admin's offer of approval both ask it — guarded by `plan-review.test.ts` and `cockpit-single-definition.test.ts`". One clause on an existing entry; the guards deliver it.

  </details>

#### Build Phase 1 Document

- [x] Say in the waiting module's own header when a plan waits on its plan review.
  <details><summary>Technical</summary>

  The header comment of `apps/indusk-mcp/src/lib/plans/waiting.ts` (written in the task above) is the reference the cockpit decision page cites; the docs pages change in Build Phase 2 with the admin, where the behaviour becomes visible.

  </details>

### Build Phase 2: Every Approve in the admin asks the package's answer

**Tier**: med — the work step's default

This phase makes the admin hand the package's rule what it needs and draw only what the rule answers. Each plan read from disk carries the state of its review file, the waiting reader passes along whether the admin's planning run for the plan is still going and why it stopped, and both the plan page and the brief page offer Approve only when the rule lists the plan as waiting on approval. Answering a plan that needs its review sends words to its agent and can never approve or release it, and the decision card names the new wait in its existing ask state. The phase ends with the promise's new sentence registered, the reference pages and changelog saying the rule, the two affected looks rechecked, and the live check written down for after landing.

- [x] Make the admin's plan reader carry each plan's review state into the snapshot the rule reads.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/planning-reader.ts`: `Plan` gains `planReview?: PlanReviewState`, set from `readPlanReview(planDir)` (import from `@infinitedusky/indusk-mcp/plans/plan-review`) where `finishedRituals` is read, for the plan's live copy. `apps/indusk-admin/src/lib/plan-snapshot.ts`: `snapshotOf` passes `planReview: plan.planReview`. A10. Remove the cast in `planning-reader.plan-review.test.ts`.

  </details>
- [x] Make the admin's waiting reader pass each plan's planning-run state to the rule.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions-reader.ts`: import `planningState` from `./build-host` and pass `plannings: plans.flatMap((p) => { const s = planningState(project, p.name); return s ? [{ plan: p.name, running: s.running, stop: s.stop }] : []; })` to `planWaiting`; extend its header comment by one sentence. Every test that replaces `./build-host` (or `@/lib/build-host`) and reaches `readWaiting` gains `planningState: () => null` — at least `decisions-reader.amendments.test.ts`; find the rest with `rg -l 'vi.mock\("(\./|@/lib/)build-host"' apps/indusk-admin/src`. A13.

  </details>
- [x] Make both plan pages offer Approve only when the rule lists the plan as waiting on approval.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/plan-actions.ts`: `PlanActionInput` gains `waitingOn?: WaitingOn` (type import from `@infinitedusky/indusk-mcp/plans/waiting`); `canApprove: started && p.waitingOn === "approval"`; the docblock says Approve follows the package's `planWaiting`. `src/app/p/[project]/plan/[name]/page.tsx`: compute `waiting` before `actions` and pass `waitingOn: waiting?.on`; keep `canApprove={actions.canApprove && waiting?.on !== "approval"}`, so on this page Approve is the decision card's alone. `src/app/p/[project]/plan/[name]/brief/page.tsx`: `const waiting = plan.archived ? undefined : (await readWaiting(project, projectPath, [plan]))[0];` and pass `waitingOn: waiting?.on`. Remove the widened input in `plan-actions.test.ts`. Run `__tests__/plan-parts.test.tsx` and `__tests__/plan-page-layout.test.tsx`, which render the brief page, and mock `@/lib/decisions-reader` in any browser test of it that now fails on the new import. A14, A15.

  </details>
- [x] Route an answer to a plan that needs its plan review to the plan's agent as words, and give the decision card its heading.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions.ts`, `deliver`: an `accept` runs `approve` only for `approval` and `release` only for `review`; any other kind (now `plan-review`) falls through to the words path (`say` to the plan's session, or a new planning session with `replyPrompt`). Add a line to the module's docblock for the new kind. `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx`: `HEADING` gains `"plan-review": "Needs its plan review"`. Remove the casts in `decisions.test.ts` and `DecisionCard.test.tsx`. Search for any other map keyed by `Waiting["on"]` or `WaitingOn` (`rg -n 'Waiting\["on"\]|WaitingOn' apps/indusk-admin/src apps/vscode-extension/src`) and give it the new kind. A19, A20.

  </details>
- [x] Keep the shared test fixture's plan that waits on approval waiting on approval.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/__tests__/helpers/cockpit-fixture.ts`: the `awaiting-approval` plan's `Plan` carries `planReview: "answered"`, so `decision.test.tsx`, `cockpit-nav.test.tsx` and `cockpit-phone.test.tsx` keep their approval card and the `WAITING` list. Run those three.

  </details>
- [x] Register the promise's new sentence, now that every Approve asks it.
  <details><summary>Technical</summary>

  `indusk promises change approval-waits-for-a-finished-plan --plan approval-waits-for-the-planning-run --statement "A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written with every finding answered; a plan whose impl is written without an answered plan review, and that no run is still writing, is listed as needing its plan review." --reason "approval waits for an answered plan review (Sandy, 2026-10-19)"`. Never edit the promise file by hand; check `.indusk/promises/approval-waits-for-a-finished-plan.md` carries the sentence and a History line for this plan.

  </details>
- [x] Rebuild the admin bundle so the installed admin carries the change.
  <details><summary>Technical</summary>

  `pnpm --filter indusk-admin build` succeeds (the new subpath must resolve in the production bundle). Landing's `pnpm install:local` installs it; the live check runs after that.

  </details>

#### Build Phase 2 Verification

- [x] The admin's reader, page-offer, decision and card tests that failed now pass, and the host guard still passes.
  <details><summary>Technical</summary>

  A10, A13, A14, A15, A19, A20 go green; A12 stays green. `indusk plans tests approval-waits-for-the-planning-run --phase "Build Phase 2"` exits 0, or `pnpm --filter indusk-admin exec vitest run src/lib/planning-reader.plan-review.test.ts src/lib/decisions-reader.planning.test.ts src/lib/decisions-reader.amendments.test.ts src/lib/build-host.test.ts src/lib/plan-actions.test.ts src/lib/plan-actions-pages.test.ts src/lib/decisions.test.ts src/components/cockpit/DecisionCard.test.tsx "src/app/p/[project]/plan/[name]/decision.test.tsx" "src/app/p/[project]/cockpit-nav.test.tsx" "src/app/p/[project]/cockpit-phone.test.tsx" src/__tests__/plan-parts.test.tsx src/__tests__/plan-page-layout.test.tsx`.

  </details>
- [x] The admin type-checks, passes the lint rules, and the promise registry agrees with the brief.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-admin` exits 0 (no cast left in the new tests); `pnpm exec biome check apps/indusk-admin/src` on the changed files exits 0; `indusk promises contract approval-waits-for-the-planning-run` exits 0 and `pnpm promises:check` passes.

  </details>
- [x] The plan page's looks while being worked on and while waiting on the person still hold.
  <details><summary>Technical</summary>

  The changed page and card files are under the admin's `sources`; the brief keeps `plan.working` and `plan.needs-you` unbroken and draws nothing new. `indusk looks lint admin` exits 0, and `indusk looks check admin` reports `plan.working` and `plan.needs-you` held (or `unchecked … answered 404` for the fixture paths the real project lacks, per the admin's context file) — never broken.

  </details>
- [x] The live check of the installed admin is written down for after landing.
  <details><summary>Technical</summary>

  A16 stays `skipped` with its procedure in its row's Test cell; after landing and `pnpm install:local`, its result is recorded in Notes with the date. Never mark it passing without a recorded result.

  </details>

#### Build Phase 2 Context

- [x] Add to the admin's context file that every Approve button asks the package's waiting answer.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the entry "A fact the cockpit shows is read from a package module": append "every Approve asks it too: `planActions`' `canApprove` is true only when `planWaiting` lists the plan as waiting on approval (`waitingOn`), on the plan page and the brief page alike; a plan whose `plan-review.md` is not answered waits on `plan-review`, whose answers go to the agent as words — guarded by `plan-actions.test.ts`, `plan-actions-pages.test.ts` and `decisions.test.ts`". One clause on an existing entry.

  </details>

#### Build Phase 2 Document

- [x] State the rule on the admin's sessions reference page exactly as the brief does, and add the new wait to its table.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/sessions.md`, the "What a plan waits on" table: the **approval** row's When gains "and its plan review (`plan-review.md`) is written with every finding answered"; a new **plan review** row — When: "the impl is a `draft`, every document before it is accepted, no session is still writing it and no planning run for it is still going, and `plan-review.md` is missing or leaves a finding unanswered; when the admin's planning run for it stopped, the decision says why, and after an admin restart it says only that the plan needs its plan review"; Accept does: "asks the plan's agent, in words, to write it"; alternative: "*Not yet*, sent to the agent as words". Under the table, one sentence: "Every Approve button — the decision card, the plan page and the brief page — asks this answer; while a planning run is going, nothing is listed." Never say a failed run offers approval.

  </details>
- [x] Name the new wait where the admin overview lists what Needs you holds.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/overview.md`, the **Needs you** bullet ("a question its agent asked, an amendment, approval, or review"): add "or its plan review", and in the `plan.needs-you` sentence add "a plan review to answer". This is the admin rendering of the new waiting kind, which the decision card draws in its existing ask state.

  </details>
- [x] Add a changelog line for the fix.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, `## [Unreleased]`, under a `### Fixed` heading (add it if absent): "**Approval waits for an answered plan review** (approval-waits-for-the-planning-run): a plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written with every finding answered; a plan whose impl is written without an answered plan review, and that no run is still writing, is listed under Needs you as needing its plan review, with why its planning run stopped when the admin knows. Every Approve button — the decision card, the plan page, the brief page — asks the same rule."

  </details>

### Build Phase 3: Falsification — a card answered after the plan moved on, and words without their decision

**Tier**: med — the work step's default

This phase tests the finished change against two things a person does with the new card. A plan needing its plan review becomes ready for approval on its own when the agent finishes the review, so a card still on screen can be answered after the plan has moved on; today the admin reads only "accept" and runs whatever the plan waits on now, so asking for the review can approve the plan. And when an agent is already running on the plan, the person's answer reaches it as the button's words alone, which never say what is to be written. Once it closes, an answer is refused when the plan no longer waits on what the card showed, the agent is told what the review is, and a stop reason reads correctly in every case the run can stop.

- [x] Refuse an answer when the plan no longer waits on the decision the card showed, before anything is approved, released or sent.
  <details><summary>Technical</summary>

  Hypothesis (A22): the decision route (`apps/indusk-admin/src/app/api/plans/[name]/decision/route.ts:58`) re-reads `readWaiting` and hands `answerDecision` whatever the plan waits on now; the card (`DecisionCard.tsx:78`) posts only `{ project, choice }`. A plan-review card ("Ask the agent to write it") left on screen — a hidden tab pauses `LiveRefresh`, or the agent finishes inside the 5 s refresh — is answered `accept` after the review became answered and no session is writing: the route reads `approval` and `deliver` (`decisions.ts:149`) runs `approvePlan`, merging the documents to the trunk although the person asked for words. The plan-review → approval step happens without the person, which no earlier kind pair did. Fix: `answerDecision(deps, project, waiting, choice, shown?: WaitingOn)` throws `` `${plan} now waits on ${waiting.on}, not ${shown}: reload the page` `` when `shown` is given and differs, before `deliver`; the route reads `body.on` and passes it (refused 400 when `on` is not one of the `WaitingOn` kinds); `rg -n '/decision' apps/indusk-admin/src -g '!*.test.*'` to confirm the card is the only poster. Update the route's docblock: an answer names the decision it answers.

  </details>
- [x] Make the decision card send the kind of decision it showed with every answer.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx` `answer`: add `on: waiting.on` to the posted body. A23. Write the test as A20 was written (wait for the card with `vi.waitFor`, read it through `screen.getByTestId`), since this worktree's older render-timing failures in the file are not this plan's (Notes).

  </details>
- [x] When the answer to a plan-review card goes to an agent already running on the plan, send the decision with it.
  <details><summary>Technical</summary>

  Hypothesis (A24): `deliver`'s words path (`decisions.ts:163`) calls `say(ours.id, answer)`, so an idle planning conversation — the likely session, since a run does not start while one is open (`build-host.ts:365`) — receives "Ask the agent to write it" (or "Not yet") with no antecedent; the new-session path uses `replyPrompt`, which quotes the decision. Fix: for `waiting.on === "plan-review"`, say `` `${waiting.decision}\n\n${answer}` ``; other kinds unchanged. Change A19's third case, which pins `say` to the bare label, to expect the decision and the label.

  </details>
- [x] Word a stopped run's reason correctly for a run waiting on its looks and for a reason that already ends in a full stop.
  <details><summary>Technical</summary>

  Hypothesis (A25), left to falsification by the audit (`audit.md`, the A4 finding): `planReview` in `apps/indusk-mcp/src/lib/plans/waiting.ts` has no test of the `wait-for-looks` branch, and appends `.` to any `why`, so a reason ending in a full stop (an impl-check refusal carried into "two steps in a row made no progress; the impl check said: …", or an error's message) reads "..". Strip one trailing `.` from `why` before appending. Test: a stop `{ step: "wait-for-looks", looks: ["plan.working", "plan.needs-you"] }` gives a decision containing both names; a `cannot-continue` whose `why` ends in `.` gives a decision not containing `..`.

  </details>
- [x] Rebuild the package so the admin reads the changed rule.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp build` exits 0.

  </details>

#### Build Phase 3 Verification

- [x] An answer meant for a plan's review approves nothing once the plan waits on approval, the card says which decision it answers, the agent is told what the review is, and the stop reasons read correctly; each fails today and passes after the fixes.
  <details><summary>Technical</summary>

  A22, A23, A24, A25 go green; A19 (as changed), A20 and A17 stay green. `pnpm --filter indusk-admin exec vitest run src/lib/decisions.test.ts src/components/cockpit/DecisionCard.test.tsx` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/waiting.test.ts` exit 0 on these rows (DecisionCard's pre-existing render-timing failures excepted, as recorded in Notes).

  </details>
- [x] The admin and the package type-check and pass the lint rules on the files this phase changed.
  <details><summary>Technical</summary>

  `pnpm exec tsc --noEmit -p apps/indusk-admin` and `pnpm exec tsc --noEmit -p apps/indusk-mcp` exit 0; `pnpm exec biome check` on the changed files exits 0.

  </details>

#### Build Phase 3 Context

- [x] Add to the admin's context file that an answer names the decision it answers and is refused when the plan has moved on.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`, the entry "A decision's card is read again from what the daemon holds after every answer": append "an answer carries the kind of decision the card showed (`on`), and one the plan no longer waits on is refused before anything runs — a plan-review card can become an approval without the person; guarded by A22 in `decisions.test.ts`". One clause on an existing entry; the guard delivers it.

  </details>

#### Build Phase 3 Document

- [x] Say on the admin's sessions reference page that an answer to a decision that has since changed is refused.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/admin-ui/sessions.md`, under the "What a plan waits on" table beside the sentence Build Phase 2 added: "An answer names the decision it was given for; if the plan waits on something else by then (a plan review finished and now waiting on approval), it is refused and the page reloads, so asking for a plan review never approves the plan."

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/plans/plan-review.ts` | new: `readPlanReview`, `planReviewState`, `planReviewAnswers` |
| `apps/indusk-mcp/src/lib/plans/plan-review.test.ts` | new: A9 |
| `apps/indusk-mcp/package.json` | `./plans/plan-review` subpath |
| `apps/indusk-mcp/src/lib/plans/steps.ts` | `PlanSnapshot.planReview` |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | `plannings` input, `plan-review` kind, approval only with an answered review |
| `apps/indusk-mcp/src/lib/plans/waiting.test.ts` | A1–A8, A17, A18 |
| `apps/indusk-mcp/src/lib/build/read-planning.ts` | `readReview` asks `plans/plan-review` |
| `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts` | A11 |
| `apps/indusk-mcp/CLAUDE.md` | one clause on the `lib/audit/` entry |
| `apps/indusk-admin/src/lib/planning-reader.ts` | `Plan.planReview` |
| `apps/indusk-admin/src/lib/plan-snapshot.ts` | passes `planReview` |
| `apps/indusk-admin/src/lib/planning-reader.plan-review.test.ts` | new: A10 |
| `apps/indusk-admin/src/lib/decisions-reader.ts` | passes `plannings` |
| `apps/indusk-admin/src/lib/decisions-reader.planning.test.ts` | new: A13 |
| `apps/indusk-admin/src/lib/decisions-reader.amendments.test.ts` | its `build-host` mock gains `planningState` |
| `apps/indusk-admin/src/lib/build-host.test.ts` | A12; the fake runner keeps its deps |
| `apps/indusk-admin/src/lib/plan-actions.ts` | `waitingOn`; `canApprove` follows it |
| `apps/indusk-admin/src/lib/plan-actions.test.ts` | A14 |
| `apps/indusk-admin/src/lib/plan-actions-pages.test.ts` | new: A15 |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/page.tsx` | passes `waitingOn` |
| `apps/indusk-admin/src/app/p/[project]/plan/[name]/brief/page.tsx` | reads the plan's waiting answer, passes `waitingOn` |
| `apps/indusk-admin/src/lib/decisions.ts` | a `plan-review` answer goes to the agent as words |
| `apps/indusk-admin/src/lib/decisions.test.ts` | A19 |
| `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx` | heading for `plan-review` |
| `apps/indusk-admin/src/components/cockpit/DecisionCard.test.tsx` | A20 |
| `apps/indusk-admin/src/__tests__/helpers/cockpit-fixture.ts` | `awaiting-approval` carries an answered review |
| `apps/indusk-admin/CLAUDE.md` | one clause on the cockpit-facts entry |
| `.indusk/promises/approval-waits-for-a-finished-plan.md` | sentence changed by `indusk promises change` |
| `apps/docs/src/reference/admin-ui/sessions.md` | approval row, new plan-review row, one sentence |
| `apps/docs/src/reference/admin-ui/overview.md` | Needs you names the new wait |
| `apps/docs/src/changelog.md` | unreleased Fixed line |
| `apps/indusk-admin/src/app/api/plans/[name]/decision/route.ts` | Build Phase 3: reads the answered kind `on`, passes it |
| `apps/indusk-admin/src/lib/decisions.ts` | Build Phase 3: refuses an answer for a kind no longer waited on; a plan-review answer said with its decision |
| `apps/indusk-admin/src/components/cockpit/DecisionCard.tsx` | Build Phase 3: posts `on` |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | Build Phase 3: no doubled full stop after a stop reason |

## Dependencies

- `approval-waits-for-a-finished-plan` (cockpit-audit-fixes) and `decisions-wait-in-one-place` (plan-cockpit) are in force, held by the existing rows in `waiting.test.ts`.
- `readAuditAnswers`, `PLAN_REVIEW_QUESTIONS` and `isAnswered` (`lib/audit/answers.ts`, audit-concerns-are-answered) exist; the planning run already writes `plan-review.md` as its last step.
- The admin's `planningState` in `build-host.ts` (a-brief-is-planned-unasked) exists; this plan does not change it.

## Notes

- A run that never settles keeps the plan unlisted until `indusk ui restart`; then the file rule lists it as needing its plan review (decision 3).
- Test Phase 1 (unattended): in this worktree six of `DecisionCard.test.tsx`'s pre-existing tests fail before any change here (`render`'s `container` is still empty when read; the card appears later). A20 therefore waits for the card with `vi.waitFor` and reads it through `screen.getByTestId`, and is red on its own assertion (the heading reads "undefined at Impl"). The pre-existing failures are not this plan's; `cockpit-nav.test.tsx` (a must-not-break file) also fails at the start of the plan on the same kind of render timing — to be compared again at Build Phase 2's close.
- Build Phase 1 Shape review (unattended): reviewed `plans/plan-review.ts`, the `waiting.ts` additions and `read-planning.ts`'s change — nothing found; each unit has one job and the run's reader now shares the module.
- Build Phase 2 (unattended) decisions: (1) every `*.test.tsx` browser-project file that reads `render`'s `container` (cockpit-nav, DecisionCard's older cases, nav/layout files) fails in this environment before and after this plan's changes — verified by running `cockpit-nav.test.tsx` and `DecisionCard.test.tsx` in the main checkout (19 of 19 and 6 of 8 red there); they are not this plan's regressions, and A20 (written to wait for the card) passes. (2) The verification item "the live check ... is written down for after landing" is ticked because the procedure is written in row A16's Test cell and the check itself is a post-landing step, not one a person must do during this build; A16 stays `skipped`. (3) `indusk looks lint admin` exits 0 (its `needs-a-story` lines are the earlier `plan-looks` mockups', not this plan's) and `looks check admin` reports nothing broken, only `unchecked … 404` for fixture paths. (4) Biome `--write` on the admin reformatted five unrelated files; they were restored.
- Build Phase 3 (unattended): A22–A25 authored with the fixes in one pass (tests and fixes written together, then run; A23's body assertion and the three older posted-body assertions now include `on`). `DecisionCard.test.tsx` still has the 7 render-timing failures that predate this plan; A23 (waits for the card) passes. `route.ts` returns 400 for an `on` outside the five kinds; an absent `on` is accepted (older clients), which only skips the stale-card check. A25 passes: a trailing `.` is stripped once from a `cannot-continue` reason.
- Live check result (A16) goes here when it is run after landing.
- Falsification (unattended, 2026-10-19), what was looked at and decided:
  - **Authored** (Build Phase 3): a stale plan-review card's Accept approving the plan (A22, A23); a running agent told only the button's words (A24); the `wait-for-looks` wording and a doubled full stop (A25, the audit's hand-off).
  - **Searched, nothing found**: `plans/plan-review` and the run's `readReview` (one reader, `readAuditAnswers` never throws, CRLF and fenced text read alike); `nextPlanningStep` (no config skips the plan review, so the run and the offer cannot disagree on whether one is needed); `startPlanning`'s state (held before the first await, cleared to stopped in `finally`, a rejection becomes `cannot-continue`; a declined start stores nothing, so no stale reason from it); every reader of the waiting kinds (`DecisionCard`'s `HEADING`, the plan page, `decisions.ts`; nothing in `vscode-extension`); `readPlanFolder` reads the review from the same live copy as the impl.
  - **Not authored, with reasons**: "Not yet" on a plan-review card with no session starts a planning session told to carry on — the audit answered it (same words path as approval's "Not yet — keep planning"), and changing what an alternative starts for every kind is wider than this plan; a stored stop reason outliving a hand rewrite — the audit's answer holds (a new run replaces it); the approve route accepting a stale brief-page Approve — that button is drawn only while the plan waits on approval, and the route's own gate is out of scope (decision 6); the window between a planning conversation ending and its run starting — decision 8 accepts it.
  - **Not investigated**: the CLI `indusk plans approve` (unchanged, decision 6) and the live planning run end to end (A16, after landing).
