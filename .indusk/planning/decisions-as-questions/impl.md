---
title: "Decisions as questions"
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

# Decisions as questions

## Goal

An unattended session asks each choice the plan does not settle as a question the person can see, with its options, its recommendation and a cost. A cheap or moderate question goes ahead on a timer; an expensive one stops its session and frees its slot. A late answer that disagrees opens a draft follow-on plan, and `indusk release` (never landing) waits for it.

## Scope

### In Scope

- One question record (options, recommendation and reason, stated and effective cost, stored deadline, state, answer, what was done, follow-on link), carried on the existing session `question` event and kept in the plan's history.
- A structured `ask_decision` tool on the indusk MCP server, the only channel that can carry a recommendation, a reason, a cost and what an option changes; the build path (`lib/build/build-session.ts`) taking it and no longer refusing every question.
- The admin raising a question to expensive from what its options declare they change; the timer sweep; stop-and-free-the-slot and resume for expensive ones.
- The follow-on plan opened by a late disagreeing answer, and the release refusal that names it.
- A save-time check that refuses "decided unattended" with no question reference.
- The decision card and Needs you showing question rows (the three new looks and the changed `plan.needs-you`).
- Docs, the root Key Decisions line, and the two `indusk promises change` items.

### Out of Scope

- Holding only the phases downstream of a question (`run-the-graph`).
- Notifying the person outside the admin (`activity-and-graph`).
- Questions in planning conversations with the person present.
- Moving the release step to the pull request: only the default (release) is built and tested; the step is a named workflow step so a project can move it.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the save-time check's tests and the live release check, red; the landing and conversation guards; the deferred tests' bodies | the brief, the test plan, the ADR |
| Build Phase 1 | `lib/questions/`: the record, its validation, the effective-cost rule, the deadline rule, the history write | the session `question` event shape |
| Build Phase 2 | stop, free-the-slot, resume and the timer sweep wired into the session manager and the admin | Build Phase 1's record and rules |
| Build Phase 3 | the follow-on opener, its frontmatter marker, the release refusal | Build Phase 1's record; the planning folder |
| Build Phase 4 | the save-time hook and the planner skill's wording | Build Phase 1's record (the reference form) |
| Build Phase 5 | question rows on the decision card and Needs you; the changed `decisions-wait-in-one-place` | Build Phases 1–3 |
| Build Phase 6 | docs and the guide page | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | A question with fewer than two options, no recommendation, no reason, or a cost other than cheap / moderate / expensive is refused with what is missing; an empty reply is not an answer | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-decision-is-a-question/asked-with-a-recommendation | apps/indusk-mcp/src/lib/questions/record.test.ts |
| T2 | A question an unattended session asks appears on the plan's page with its options, the recommended one marked with its reason, and its cost | Build Phase 5 | Build Phase 5 | planned | contract | clause: a-decision-is-a-question/asked-with-a-recommendation | apps/indusk-admin/src/__tests__/question-row.test.tsx |
| T3 | A document saved by an unattended run that records a choice as decided unattended with no question reference is refused naming the line; the same line with a reference to a question that exists in the plan's record saves, and a made-up id is refused; review and acceptance lines are not checked | Test Phase 1 | Build Phase 4 | planned | unit | clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/__tests__/decided-unattended-hook.test.ts |
| T4 | A cheap question goes ahead at five minutes, not at four (where an answer is used); a moderate one at an hour, not at five minutes | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-cost-sets-the-wait/cheap-and-moderate-go-ahead | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T5 | The deadline is a stored time: a question read after the admin was down goes ahead on that read, and a restart never gives it more time | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-cost-sets-the-wait/cheap-and-moderate-go-ahead | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T6 | A question that went ahead says so on its row: what was done and when | Build Phase 5 | Build Phase 5 | planned | contract | clause: the-cost-sets-the-wait/cheap-and-moderate-go-ahead | apps/indusk-admin/src/__tests__/question-row.test.tsx |
| T7 | A session that asks an expensive question stops, and the plan is listed under Needs you with no timer | Build Phase 2 | Build Phase 2 | planned | contract | clause: the-cost-sets-the-wait/expensive-waits | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T8 | While an expensive question waits the machine counts one fewer running session and a queued plan takes the slot; a plan waiting on a timer still holds its slot | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-cost-sets-the-wait/expensive-waits, promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T9 | An expensive question left unanswered for any length of time never goes ahead | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-cost-sets-the-wait/expensive-waits, clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T10 | When the person answers an expensive question the plan's run resumes and the agent is told the answer | Build Phase 2 | Build Phase 2 | planned | contract | clause: the-cost-sets-the-wait/expensive-waits | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T11 | A question given as cheap whose option changes the brief, a promise, a look or a gate is shown as expensive with no timer and never goes ahead; one whose options change none keeps its cost | Build Phase 1 | Build Phase 1 | planned | unit | clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/cost.test.ts |
| T12 | A late answer that differs from what was done opens exactly one draft plan naming the question, the choice made and the one wanted; a matching answer, an on-time answer, or a second answer to the same question opens none more; the plan is not accepted, approved or started | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-mcp/src/lib/questions/follow-on.test.ts |
| T13 | On the question's row the opened follow-on is linked | Build Phase 5 | Build Phase 5 | planned | contract | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-admin/src/__tests__/question-row.test.tsx |
| T14 | A question in each state (waiting, answered in time, gone ahead, answered late) is readable on the plan's page and, after landing and archiving, in its history, with recommendation, answer and what was done | Build Phase 5 | Build Phase 5 | planned | contract | clause: a-late-answer-opens-a-follow-on/every-decision-stays | apps/indusk-mcp/src/lib/questions/history.test.ts, apps/indusk-admin/src/__tests__/question-row.test.tsx |
| T15 | A release with one open follow-on refuses and names its plan; with three names all three; it proceeds once each is landed, abandoned or archived; an ordinary plan never blocks | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/lib/release/follow-on-refusal.test.ts |
| T16 | Landing an accepted plan succeeds with a follow-on open, and landing the follow-on itself succeeds while it is open | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-release-waits-for-a-known-wrong/landing-never-waits | apps/indusk-mcp/src/lib/plans/land-follow-on.test.ts |
| T17 | A late answer that changes the brief still stops for re-approval, and no timer however long approves a brief, test plan, look or ADR | Build Phase 3 | Build Phase 3 | planned | unit | promise: a-change-to-what-was-agreed-needs-the-person, promise: only-a-person-reapproves | apps/indusk-mcp/src/lib/questions/approval-guard.test.ts |
| T18 | A plan with questions open is no more or less accepted than the same plan without; a failure no promise claims still opens its bugfix plan, with the follow-on opened beside it | Build Phase 3 | Build Phase 3 | planned | unit | promise: nothing-ships-until-accepted, promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/lib/questions/beside-bugfix.test.ts |
| T19 | A conversation session with the person present asks as it does today, with no cost and no timer | Test Phase 1 | Test Phase 1 | planned | unit | a regression guard: the brief leaves planning conversations out | apps/indusk-mcp/src/lib/session/conversation-question.test.ts |
| T20 | A real unattended run that asks a cheap question and is left alone continues after five minutes; one stopped by an expensive question finishes its phase using the answer given in the admin; the plan is under Needs you meanwhile; and every choice the planning run records has a question on the page | Build Phase 5 | Build Phase 5 | planned | live check | promise: decisions-wait-in-one-place, promise: a-build-runs-to-review-unasked, clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/__tests__/questions-live.test.ts |
| T21 | `indusk release` run in a real repository with an open follow-on refuses before any publish step | Test Phase 1 | Build Phase 3 | planned | live check | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/__tests__/release-follow-on.test.ts |
| T22 | The three question rows and the changed decision card render as the approved looks, held by value in Chromium: cheap with time left and a reply, expensive in red with no timer, went-ahead with a late-answer offer; a plan waiting on an expensive question sits under Needs you as any wait | Build Phase 5 | Build Phase 5 | planned | live check | look: question-row.cheap, look: question-row.expensive, look: question-row.went-ahead, look: plan.needs-you, look: nav.expanded | apps/indusk-admin/src/__tests__/question-looks.test.ts |
| T23 | The sweep sends a due cheap or moderate question's session on with its recommendation and marks it went-ahead with the time and what was done; it leaves an expensive question, and a cheap one raised to expensive, waiting however long they are left | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-cost-sets-the-wait/cheap-and-moderate-go-ahead, clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/sweep.test.ts |
| T24 | A plan carrying `follow_on_of` is never moved to the archive by the dead-draft sweep however old and untouched, so the release keeps refusing until a person closes it | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/lib/planning/archive-dead-follow-on.test.ts |
| T25 | Each place that decides a clause reports it: upheld when what it decided holds, broken naming what did not, and a failed report never fails what reported it | Build Phase 7 | Build Phase 7 | planned | unit | the signal writers for this plan's clauses; each clause's upheld signal is read from a real run at close | apps/indusk-mcp/src/lib/questions/signals.test.ts |
| T26 | Closing the plan reads every one of its clauses upheld by a signal from a real run | Build Phase 7 | Build Phase 7 | planned | live check | the close itself: `indusk promises confirm` refuses a clause no real run reported | manual: with the local daemon up and this build installed, ask one cheap and one expensive question in an unattended run, let the cheap one go ahead, answer one late against its recommendation, and try a release with the follow-on open; then `indusk promises confirm decisions-as-questions` |

### Deferred Verification

- **T26, every clause upheld by a real run**
  - reason: a signal from a real run is what closing reads; no test stands in for it.
  - would require: the installed build, the local daemon and the real runs named in the row.
  - mitigation: `indusk promises confirm decisions-as-questions` refuses, naming each clause no real run reported; the plan stays open until it passes.

## Checklist

### Test Phase 1: Write the tests first

**Tier**: med — the work step's default

This phase writes the tests whose subject exists today and so can fail on an assertion: the save-time check (it is a script a test can run), the release check against a real repository, and the two guards (landing and conversation questions). It records the tests whose subject is a module the build phases create, with their bodies, and hands the red tests to Build Phases 3 and 4.

- [ ] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start feature decisions-as-questions`; `indusk worktree list`. Worktree-per-plan default; `worktree: none` is not set.

  </details>
- [ ] Write the save-time check's test and the live release check, and see both fail on their own assertions.
  <details><summary>Technical</summary>

  T3 in `apps/indusk-mcp/src/__tests__/decided-unattended-hook.test.ts`: spawns `hooks/validate-decided-unattended.js` (does not exist yet, so authoring it as a spawn of the path makes the test fail on a missing-script assertion, not on a load error) with a Write payload containing "decided unattended" and no `question:` reference; expects exit 2 naming the line. T21 (`src/__tests__/release-follow-on.test.ts`, listed in the `SYSTEM` array of `vitest.tiers.ts`, which is an explicit file list): makes a temp repo with a plan whose frontmatter carries `follow_on_of: q-1` and status `draft`, runs the follow-on refusal step the release calls (`indusk release` has no dry-run option, and none is added), expects a refusal naming the plan; today no such step exists.

  </details>
- [ ] Write the two guards and see them pass.
  <details><summary>Technical</summary>

  T16 in `apps/indusk-mcp/src/lib/plans/land-follow-on.test.ts` (landing an accepted plan with a draft follow-on in the planning folder succeeds; so does landing the follow-on); T19 in `apps/indusk-mcp/src/lib/session/conversation-question.test.ts` (the `question` event from a conversation session reaches the admin with no cost or deadline).

  </details>
- [ ] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every red test above fails on an assertion; every other row waits in the register below.

  </details>

#### Deferred to Build Phase 1

- **T1, T4, T5, T9, T11** — their subject, the question record, validation, cost and deadline rules in `lib/questions/`, is a new module; the file would fail to load rather than assert. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { validateQuestion } from "./record.js";
  import { effectiveCost } from "./cost.js";
  import { dueAt, isDue } from "./deadline.js";

  const opt = (label: string, changes: string[] = []) => ({ label, changes });
  const q = (over = {}) => ({
    options: [opt("a"), opt("b")], recommended: "a", reason: "r", cost: "cheap", ...over,
  });

  describe("questions", () => {
    it("T1 — refuses what is missing", () => {
      expect(validateQuestion(q({ recommended: undefined })).missing).toContain("recommended");
      expect(validateQuestion(q({ options: [opt("a")] })).missing).toContain("options");
      expect(validateQuestion(q({ cost: "huge" })).missing).toContain("cost");
    });
    it("T4/T5 — a stored deadline", () => {
      const asked = Date.parse("2026-10-19T10:00:00Z");
      expect(isDue("cheap", asked, asked + 4 * 60_000)).toBe(false);
      expect(isDue("cheap", asked, asked + 5 * 60_000)).toBe(true);
      expect(isDue("moderate", asked, asked + 59 * 60_000)).toBe(false);
      expect(dueAt("moderate", asked)).toBe(asked + 60 * 60_000);
    });
    it("T9 — expensive never due", () => {
      expect(isDue("expensive", 0, Number.MAX_SAFE_INTEGER)).toBe(false);
    });
    it("T11 — raised, never lowered", () => {
      const raised = q({ options: [opt("a", ["brief"]), opt("b")] });
      expect(effectiveCost(raised)).toBe("expensive");
      expect(effectiveCost(q({ cost: "moderate" }))).toBe("moderate");
    });
  });
  ```

#### Deferred to Build Phase 2

- **T7, T8, T10** — their subject, the stop/free/resume path in `lib/session/question-wait.ts`, is a new module and the file would fail to load. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { waitOnQuestion, runningCount } from "./question-wait.js";

  describe("expensive questions", () => {
    it("T7/T8 — stops the session and frees its slot", () => {
      const s = { running: ["p1", "p2"], waiting: [] as string[] };
      const next = waitOnQuestion(s, "p1", { cost: "expensive" });
      expect(runningCount(next)).toBe(1);
      expect(next.waiting).toEqual(["p1"]);
    });
    it("T8 — a timed question keeps its slot", () => {
      const next = waitOnQuestion({ running: ["p1"], waiting: [] }, "p1", { cost: "cheap" });
      expect(runningCount(next)).toBe(1);
    });
  });
  ```

- **T23** — the sweep, `lib/questions/sweep.ts`, is a new module. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { sweep } from "./sweep.js";

  describe("sweep", () => {
    it("T23 — goes ahead on due timed questions only", () => {
      const sent: string[] = [];
      const now = Date.parse("2026-10-19T12:00:00Z");
      const qs = [
        waiting({ id: "c", cost: "cheap", askedAt: now - 6 * 60_000 }),
        waiting({ id: "r", cost: "cheap", askedAt: now - 6 * 60_000, options: [opt("a", ["look"]), opt("b")] }),
        waiting({ id: "e", cost: "expensive", askedAt: 0 }),
      ];
      const out = sweep(qs, now, (q, choice) => sent.push(`${q.id}:${choice}`));
      expect(sent).toEqual(["c:a"]);
      expect(out.find((q) => q.id === "c")?.state).toBe("went-ahead");
      expect(out.filter((q) => q.state === "waiting").map((q) => q.id)).toEqual(["r", "e"]);
    });
  });
  ```

#### Deferred to Build Phase 3

- **T24** — `lib/planning/archive-dead.ts` skipping a plan with `follow_on_of`; the fixture is a follow-on brief that is old and untouched, expected to stay out of `archived`; it is a new test beside an existing module, written in Build Phase 3 with the change.
- **T12, T15, T17, T18** — their subjects, the follow-on opener (`lib/questions/follow-on.ts`) and the release refusal (`lib/release/follow-on-refusal.ts`), are new modules. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { openFollowOn } from "./follow-on.js";
  import { openFollowOns } from "../release/follow-on-refusal.js";

  describe("follow-on", () => {
    it("T12 — one draft per question, only on a late disagreement", () => {
      const dir = tmpPlanning();
      const q = wentAhead({ done: "a", id: "q1" });
      expect(openFollowOn(dir, q, "b").opened).toBe(true);
      expect(openFollowOn(dir, q, "b").opened).toBe(false);
      expect(openFollowOn(dir, wentAhead({ done: "a", id: "q2" }), "a").opened).toBe(false);
      expect(frontmatter(dir, "q1").status).toBe("draft");
    });
    it("T15 — names every open follow-on", () => {
      const dir = tmpPlanning({ followOns: ["x", "y", "z"] });
      expect(openFollowOns(dir).map((p) => p.name)).toEqual(["x", "y", "z"]);
    });
  });
  ```

#### Deferred to Build Phase 5

- **T2, T6, T13, T14, T20, T22** — their subject, the question row component and the decision card that lists it, does not exist until Build Phase 5; the test files would fail to load. Rows, not bodies: T22 is held by value against the three approved mockups, which already exist under `.indusk/mockups/`.

#### Regression Guards

- **T16** — landing already ignores follow-ons; it passes now and must keep passing once Build Phase 3 adds follow-on plans to the planning folder.
- **T19** — conversation sessions ask today with no cost or timer; it passes now and pins the regression that the new record never reaches them.

#### Test Phase 1 Verification

- [ ] The red test fails on its own assertion and the two guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/decided-unattended-hook.test.ts src/lib/plans/land-follow-on.test.ts src/lib/session/conversation-question.test.ts` — T3 red on its assertion, T16 and T19 green. T21 is a system-tier test and is written red here, not run here (the slow tier never blocks the phase loop).

  </details>
- [ ] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body checked on two questions: will it compile at the phase it names, and does it assert what its row claims?

  </details>

#### Test Phase 1 Context

- [ ] (none needed — Test Phase 1 writes tests only and changes no rule about how the project works)

#### Test Phase 1 Document

- [ ] (none needed — no user-facing behaviour exists until the build phases; Build Phase 6 documents it)

### Build Phase 1: The question record and its rules

**Tier**: med — the work step's default

This phase adds the one module that knows what a question is: the record, the refusal of a malformed one, the cost the admin fixes from what an option changes, the stored deadline, and the write into the plan's history. Later phases only call it, so the rules are tested here once, with no session or screen involved.

- [ ] Write this phase's tests from the recorded bodies.
  <details><summary>Technical</summary>

  T1, T4, T5, T9, T11 in `apps/indusk-mcp/src/lib/questions/{record,cost,deadline}.test.ts`, from the bodies above, plus the empty-reply case in T1.

  </details>
- [ ] Add the question record and the check that refuses a malformed question, saying what is missing.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/questions/record.ts`: `Question { id, plan, options: {label, changes: ("brief"|"promise"|"look"|"gate")[]}[], recommended, reason, statedCost, cost, askedAt, dueAt, state: "waiting"|"answered"|"went-ahead"|"answered-late", answer?, done?, followOn? }`; `validateQuestion(input): { ok, missing: string[] }`; `isAnswer(text)` false for empty or whitespace.

  </details>
- [ ] Add the rule that raises a question to expensive from what its options declare, and never lowers one.
  <details><summary>Technical</summary>

  `lib/questions/cost.ts`: `effectiveCost(q)`; any option `changes` non-empty makes `expensive`; options declaring nothing keep `statedCost` (ADR decision 3).

  </details>
- [ ] Add the deadline rule: a stored wall-clock time, five minutes for cheap, an hour for moderate, never for expensive, both waits configurable.
  <details><summary>Technical</summary>

  `lib/questions/deadline.ts`: `dueAt(cost, askedAt, cfg)`, `isDue(cost, askedAt, now, cfg)`; config keys `sessions.question_wait_cheap_minutes` (5) and `sessions.question_wait_moderate_minutes` (60) added to `lib/config.ts` with their defaults, read through the config module's existing accessors.

  </details>
- [ ] Add the write that keeps every question in the plan's history in all four states.
  <details><summary>Technical</summary>

  `lib/questions/history.ts` over `lib/plans/history.ts` (the one writer of the plan's history); an answer given in time is recorded as any decision the person answers is today. T14's history half is asserted in Build Phase 5.

  </details>
- [ ] Review the new module against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 1 Verification

- [ ] The record, cost and deadline tests pass.
  <details><summary>Technical</summary>

  T1, T4, T5, T9, T11: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/questions && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/questions/record.ts src/lib/questions/cost.ts src/lib/questions/deadline.ts src/lib/config.ts`

  </details>

#### Build Phase 1 Context

- [ ] Write the root Key Decisions line for this plan.
  <details><summary>Technical</summary>

  Root `CLAUDE.md` (Key Decisions, always-on because every session reads the design intent): `- Decisions as questions: an unattended session asks each choice with a recommendation and a cost; cheap and moderate go ahead on a stored timer, expensive waits and frees its slot; a late disagreement opens a follow-on the release waits for, landing never — see /decisions/decisions-as-questions`. It waits for the build because `plans approve` refuses non-`.indusk/` changes before the build.

  </details>
- [ ] Record in the package's rules that one module owns the question rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (mcp tier): `lib/questions/` is the one home of the question rules; the cost is fixed by `effectiveCost`, never by the agent; the deadline is stored, never counted.

  </details>

#### Build Phase 1 Document

- [ ] (none needed — nothing in this phase is user-facing; the guide page and config reference are written in Build Phase 6)

### Build Phase 2: Stop, free the slot, resume, and go ahead

**Tier**: med — the work step's default

This phase connects the record to running sessions. An unattended session's question becomes a record; an expensive one stops the session and releases its slot; the person's answer resumes it; and the admin's sweep sends a cheap or moderate question's session on with its recommendation once the stored deadline has passed.

- [ ] Add a structured way for a session to ask a decision, and let its request become a question record, in builds as well as admin sessions.
  <details><summary>Technical</summary>

  A tool on the indusk MCP server taking the record's fields (options with `changes`, `recommended`, `reason`, `cost`); `lib/session/protocol.ts` `controlRequestEvents` turns a `can_use_tool` for it into the `question` event; `lib/build/build-session.ts` (line ~167, which answers every question with `refuseBuildQuestion`) records it instead, and its prompt (line 36, "nobody will answer a question") is rewritten to say a choice is asked with `ask_decision` and cheap ones go ahead; `lib/session/permissions.ts` `refuseBuildQuestion` now refuses a plain `AskUserQuestion` naming `ask_decision`; update `build-session-gates.test.ts` and `protocol.test.ts`, which pin the old refusal (ADR decision 12). First check whether a stopped build can be resumed with the answer (Notes 8).

  </details>
- [ ] Let an unattended session's question carry its options, recommendation, reason and cost, and leave a conversation session's question as it is.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/session/protocol.ts`: the `question` event gains optional `options[].changes`, `recommended`, `reason`, `cost`; a conversation session's event is unchanged (T19 stays green). A malformed question is returned to the session with `validateQuestion`'s `missing`, never shown.

  </details>
- [ ] Make an expensive question stop its session and free its slot, and make the answer resume it with the answer told to the agent.
  <details><summary>Technical</summary>

  `lib/session/question-wait.ts` (`waitOnQuestion`, `runningCount`) wired into `lib/session/manager.ts` so `sessions.max` counts only running sessions; `lib/plans/waiting.ts` lists the plan under Needs you with no timer; the resume path reuses the existing resume for a stopped build and passes the answer as the next message (T7, T8, T10).

  </details>
- [ ] Add the sweep that sends a due cheap or moderate question's session on with its recommendation, marks it as gone ahead with the time and what was done, and runs on every admin read.
  <details><summary>Technical</summary>

  `lib/questions/sweep.ts` (T23) called from the admin's recorder loop (`lib/admin/recorder-loop.ts`) and on each read of a plan's questions; uses `isDue` against the stored `dueAt`; sets state `went-ahead`; never acts on an expensive question; never approves anything (T17).

  </details>
- [ ] Rewrite the promise that says when a build stops, so it names an expensive question.
  <details><summary>Technical</summary>

  `indusk promises change a-build-runs-to-review-unasked --plan decisions-as-questions --statement "An approved plan's implementation runs through its phases, falsification and cleanup without asking for approval, writing its code in the plan's code worktree and, in a workbench, checking items off at the root, and stops only when it is ready for review, for a judgement the plan declared, for an expensive question, or when it cannot continue." --reason "An expensive question now stops the build; cheap and moderate ones do not."`

  </details>
- [ ] Review the new session code against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 2 Verification

- [ ] The stop, slot and resume tests pass, and the conversation guard still does.
  <details><summary>Technical</summary>

  T7, T8, T10, T23: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/session/question-wait.test.ts src/lib/questions/sweep.test.ts src/lib/session/conversation-question.test.ts src/__tests__/build-session-gates.test.ts src/lib/session/protocol.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/session/protocol.ts src/lib/session/manager.ts src/lib/plans/waiting.ts`

  </details>

#### Build Phase 2 Context

- [ ] Record that a plan waiting on an expensive question holds no session slot.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Sessions): `runningCount` is the one count `sessions.max` reads; guard: T8 carries `promise: sessions-are-capped`.

  </details>

#### Build Phase 2 Document

- [ ] (none needed — the session behaviour is documented once, in Build Phase 6's guide page, so it is not described twice)

### Build Phase 3: A late disagreement opens a follow-on; the release waits

**Tier**: med — the work step's default

This phase makes a wrong timed-out answer cost a plan instead of a stop: a late, differing answer opens one draft follow-on, marked so the release can find it; the release refuses, naming each open one; and landing is left exactly as it is.

- [ ] Write this phase's tests from the recorded bodies.
  <details><summary>Technical</summary>

  T12, T15, T17, T18, T24 in `lib/questions/{follow-on,approval-guard,beside-bugfix}.test.ts`, `lib/release/follow-on-refusal.test.ts` and `lib/planning/archive-dead-follow-on.test.ts`.

  </details>
- [ ] Keep a follow-on out of the dead-draft sweep.
  <details><summary>Technical</summary>

  `lib/planning/archive-dead.ts`: a plan whose brief carries `follow_on_of` is never listed as dead (T24; ADR decision 13).

  </details>
- [ ] Add the opener that makes one draft follow-on plan for a late, differing answer and links it from the question.
  <details><summary>Technical</summary>

  `lib/questions/follow-on.ts`: `openFollowOn(planningDir, question, wanted)`; creates `.indusk/planning/<plan>-<question-id>/brief.md` as `status: draft` with `follow_on_of: <plan>/<question-id>` in frontmatter, its body naming the question, the choice made and the one wanted; a second answer updates that brief rather than opening another (found by `followOn` on the record); opens nothing for a matching or on-time answer; never calls accept, approve or start (T12, T17, T18). It sits beside `lib/release/bugfix-plan.ts`'s opener and does not replace it.

  </details>
- [ ] Make the release refuse, naming every open follow-on, until each is closed.
  <details><summary>Technical</summary>

  `lib/release/follow-on-refusal.ts`: `openFollowOns(planningDir)` lists plans with `follow_on_of` whose status is not landed, abandoned or archived; `lib/release/run.ts` calls it as a named workflow step (`workflow.steps.release_follow_on`, default on, in `lib/build/release-config.ts` beside the other release facts), before any publish step. `plans land` is not touched (T16 stays green).

  </details>
- [ ] Review the new code against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 3 Verification

- [ ] The follow-on and release tests pass and landing's guard still does.
  <details><summary>Technical</summary>

  T12, T15, T17, T18, T24, T16: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/questions src/lib/release/follow-on-refusal.test.ts src/lib/planning/archive-dead-follow-on.test.ts src/lib/plans/land-follow-on.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/questions/follow-on.ts src/lib/release/run.ts src/lib/build/release-config.ts`

  </details>
- [ ] The release check against a real repository passes.
  <details><summary>Technical</summary>

  T21 passes in the system tier (`pnpm test:system`), run once at landing and never in the phase loop; its file is added to the `SYSTEM` array in `vitest.tiers.ts`.

  </details>

#### Build Phase 3 Context

- [ ] Record in the release rules that only the release reads a follow-on's marker, and landing never does.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/release/CLAUDE.md`: the release refuses on an open `follow_on_of` plan; landing never reads it (guard: T16 carries `clause: …/landing-never-waits`).

  </details>

#### Build Phase 3 Document

- [ ] Describe the release refusal and the step that moves it.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/release.md`: the refusal naming each open follow-on, how it closes (landed, abandoned or archived), and `workflow.steps.release_follow_on`.

  </details>

### Build Phase 4: Never decided silently

**Tier**: med — the work step's default

This phase makes the rule that a choice is always a question something the system enforces where documents are saved, not something the planner skill asks for. A save that records a choice as decided unattended with no question reference is refused naming the line.

- [ ] Add the check that refuses a saved document recording a choice as decided unattended with no question reference.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/validate-decided-unattended.js`, registered with the other PreToolUse write hooks by the same path `init`/`update` install them: in a plan's documents during an unattended run (`INDUSK_GATE_POLICY=auto`), a line matching /decided unattended/i without `question: <id>` on the line or the next, or with an id the plan's question record does not hold, is refused (exit 2) naming file and line, with `lesson: choices-are-asked-as-questions` in the message. Review and acceptance text is not matched (T3). Hook rules: `hooks/CLAUDE.md`.

  </details>
- [ ] Add the lesson the refusal names.
  <details><summary>Technical</summary>

  `.claude/lessons/choices-are-asked-as-questions.md` via `mcp__indusk__add_lesson`; it becomes guarded by T3 carrying `lesson: choices-are-asked-as-questions` in a comment.

  </details>
- [ ] Tell the planner and work skills to ask a choice as a question and cite its id.
  <details><summary>Technical</summary>

  Edit `apps/indusk-mcp/skills/planner.md` and `skills/work.md` (never `.claude/skills/`); `indusk update` syncs the project copies.

  </details>
- [ ] Review the hook against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 4 Verification

- [ ] The save-time check's test passes, and the skills' copies match the package's.
  <details><summary>Technical</summary>

  T3: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/decided-unattended-hook.test.ts src/__tests__/skill-sync-parity.test.ts`

  </details>

#### Build Phase 4 Context

- [ ] Record the new check in the hooks directory's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: the hook only matches unattended runs, and why (a person present is asked, not checked).

  </details>

#### Build Phase 4 Document

- [ ] (none needed — the hook's behaviour is a line in the guide page written in Build Phase 6)

### Build Phase 5: Question rows in the admin

**Tier**: med — the work step's default

This phase draws what the earlier phases keep: each open question as a row on the plan's decision card and under Needs you, the expensive ones first, with a reply in words, and the record of every question after it goes ahead. The three new looks are the mockups the person already approved in the cockpit; the agent never approves one.

- [ ] Build the question row in its three states from the approved looks.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/question-row.tsx`: `cheap` (question, recommendation, cost, time left, reply), `expensive` (red, no timer), `went-ahead` (what was done, and a late-answer offer that opens the follow-on). Values from the DTCG foundation, no raw values. Mockups: `.indusk/mockups/admin/screens/question-row.{cheap,expensive,went-ahead}.html`, all three recorded approved in `.indusk/mockups/admin/approved.json` (2026-10-19).

  </details>
- [ ] Show every open question on the decision card, expensive first, and list a plan waiting on an expensive one under Needs you.
  <details><summary>Technical</summary>

  The plan page under `apps/indusk-admin/src/app/p/[project]/plan/[name]/` and the Needs-you list read questions through `lib/questions/` (the admin's parsing rule in `apps/indusk-admin/CLAUDE.md`: read, never write, except the reply). The reply goes to the existing answer route; an empty reply is refused (T1).

  </details>
- [ ] Link the opened follow-on from the question's row and keep every question readable in all four states, including after the plan archives.
  <details><summary>Technical</summary>

  T13, T14: the row reads `followOn`; history reads the plan's archived history file.

  </details>
- [ ] Rewrite the promise that says where decisions wait, so it names the question rows.
  <details><summary>Technical</summary>

  `indusk promises change decisions-wait-in-one-place --plan decisions-as-questions --statement "When a plan is waiting on the person it is listed under Needs you, and its page shows each open question with its recommendation, its options, its cost and a reply in words; the answer reaches the agent and is recorded in the plan's history." --reason "The page now shows several questions, each with a cost."`

  </details>
- [ ] Review the new components against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 5 Verification

- [ ] The question row tests pass.
  <details><summary>Technical</summary>

  T2, T6, T13, T14: `pnpm --filter indusk-admin exec vitest run src/__tests__/question-row.test.tsx && pnpm --filter indusk-admin exec vitest related src/components/question-row.tsx`

  </details>
- [ ] The looks are held and the live checks recorded.
  <details><summary>Technical</summary>

  T22 (Chromium, by value) and T20 (a real unattended run) are system-tier, their files added to the `SYSTEM` list of the package's `vitest.tiers.ts` (the admin's, for T22); run once at landing, their result recorded in the plan, and never in the phase loop.

  </details>

#### Build Phase 5 Context

- [ ] Record that the admin never changes a question's cost.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: the row shows `cost` as stored; only `lib/questions/cost.ts` computes it.

  </details>

#### Build Phase 5 Document

- [ ] Describe Needs you and the decision card's question rows in the admin reference.
  <details><summary>Technical</summary>

  The admin pages' reference under `apps/docs/src/reference/`: the three rows, expensive first, how to reply.

  </details>

### Build Phase 6: Docs

**Tier**: med — the work step's default

This phase writes the pages the ADR's documentation plan names, so a person using the system finds what a question is, what each cost does and what a late disagreement does.

- [ ] Write the guide page on questions with the state diagram.
  <details><summary>Technical</summary>

  New `apps/docs/src/guide/questions.md`: what a question is, the three costs, how to answer, what a late disagreement does; Mermaid state diagram (waiting → answered / went-ahead → answered-late → follow-on).

  </details>
- [ ] Publish the ADR and add the config keys and the changelog entry.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/decisions-as-questions.md` from `adr.md`; the `sessions.question_wait_*` keys in the config reference; changelog: "Added questions for unattended sessions: cheap and moderate ones go ahead on a timer, expensive ones wait; a late disagreement opens a follow-on plan the release waits for."

  </details>

#### Build Phase 6 Verification

- [ ] (no tests flip at this phase — reason: infra)
- [ ] The docs build and the new pages are linked.
  <details><summary>Technical</summary>

  `pnpm --filter docs build`; the sidebar lists `guide/questions` and `decisions/decisions-as-questions`.

  </details>

#### Build Phase 6 Context

- [ ] (none needed — the rules this plan produces were recorded in the phases that made them)

#### Build Phase 6 Document

- [ ] Confirm the pages above cover every item in the ADR's documentation plan.
  <details><summary>Technical</summary>

  Pages, diagram, changelog and ADR-in-docs against the ADR's Documentation Plan.

  </details>

### Build Phase 7: Each clause reports its signal

**Tier**: med — the work step's default

Added before approval (2026-10-19): a plan with clauses closes only when each clause's signal has reported it upheld in a real run, and the phases above report none. This phase makes each place that decides a clause report it through the commands' one tracer, in the shape the close already reads, then runs the real cases so the close can read them.

- [ ] Make each place that decides one of this plan's clauses report it as upheld or broken.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/questions/signals.ts`, in the shape of `markClosing` (`lib/promises/closing-signal.ts`): one `markPromise` span per decision, `signal: { plan: "decisions-as-questions", phase: "Build Phase 7" }`, best-effort, `flushCommandTracer()` in short-lived commands. Where each clause is decided: asking a question (`asked-with-a-recommendation`, broken when a field is missing); the save-time check (`never-decided-silently`); the sweep (`cheap-and-moderate-go-ahead`, and `never-timed-out` when it leaves an expensive one); the stop and resume (`expensive-waits`); a late answer (`disagreement-opens-a-plan`); the question record (`every-decision-stays`); the release's follow-on step (`release-refuses`); landing (`landing-never-waits`). Each file carries its `clause:` tokens. T25.

  </details>
- [ ] Run each case for real with the local daemon up, so each clause has a real signal.
  <details><summary>Technical</summary>

  The procedure in T26's row; run after landing and installing if the admin's own loop is needed for a case. T26 is checked at close.

  </details>
- [ ] Review the signal writers against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  </details>

#### Build Phase 7 Verification

- [ ] Each signal writer reports upheld and broken as its clause says, and none can fail what called it.
  <details><summary>Technical</summary>

  T25: `indusk plans tests decisions-as-questions --phase "Build Phase 7"`.

  </details>
- [ ] The close's check of the real signals is written down and waits for the real runs.
  <details><summary>Technical</summary>

  T26 stays `skipped` with its procedure until `indusk promises confirm decisions-as-questions` passes at close.

  </details>

#### Build Phase 7 Context

- [ ] Add to the package's rules where this plan's clauses are reported.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`: the questions entry names `lib/questions/signals.ts` as where each clause is reported.

  </details>

#### Build Phase 7 Document

- [ ] Say in the questions guide which events report which clause.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/questions.md`: a short "Signals" section.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/questions/` | new: record, cost, deadline, sweep, history, follow-on |
| `apps/indusk-mcp/src/lib/session/{protocol,manager,permissions}.ts`, `question-wait.ts`, `lib/build/build-session.ts` | question fields on the event; the `ask_decision` tool; the build path records instead of refusing; stop, free, resume |
| `apps/indusk-mcp/src/lib/planning/archive-dead.ts` | a follow-on is never dead-archived |
| `apps/indusk-mcp/vitest.tiers.ts` (and the admin's) | the live checks listed in `SYSTEM` |
| `build-session-gates.test.ts`, `lib/session/protocol.test.ts` | updated: they pinned the old refusal |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | list a plan waiting on an expensive question with no timer |
| `apps/indusk-mcp/src/lib/release/{run,follow-on-refusal}.ts`, `build/release-config.ts` | the refusal and its workflow step |
| `apps/indusk-mcp/src/lib/config.ts` | the two wait keys |
| `apps/indusk-mcp/hooks/validate-decided-unattended.js` | the save-time check |
| `apps/indusk-mcp/skills/{planner,work}.md` | ask a choice as a question |
| `apps/indusk-admin/src/components/question-row.tsx`, plan page | question rows |
| `.claude/lessons/choices-are-asked-as-questions.md` | the lesson the refusal names |
| `apps/docs/src/{guide,decisions,reference}/` | pages above |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `hooks/CLAUDE.md`, `lib/release/CLAUDE.md`, `apps/indusk-admin/CLAUDE.md` | rules and the Key Decisions line |

## Dependencies

- The three new looks approved in the cockpit before Build Phase 5: done, all three are in `approved.json`; a mockup edited later needs approving again.
- None on another plan: `run-the-graph` narrows the hold later.

## Notes

Decisions made unattended (`INDUSK_GATE_POLICY=auto`), for the reviewer:

1. **The follow-on is marked `follow_on_of: <plan>/<question-id>` in its brief's frontmatter.** Reason: the release needs to tell it from an ordinary plan (T15) and a frontmatter field is what every other plan-level fact uses. Alternative, a separate registry file, rejected as a second place to lose it.
2. **The release refusal is its own named workflow step, `release_follow_on`, default on.** Reason: the ADR says a project whose main deploys moves it to the pull request; a named step is the existing way. Only the default is built.
3. **Live checks live in the system tier, by listing their files in `vitest.tiers.ts`'s `SYSTEM` array** (corrected by the plan review; there is no `*.tiers.test.ts` convention). Reason: the slow tier never blocks landing or release (`/decisions/release-checks-run-once`).
4. **The hook matches only unattended runs.** Reason: a person present is asked, not checked (T19 guards that conversations are untouched).
5. **T21 is written red in Test Phase 1 but not run there.** Reason: it spawns `indusk release` in a real repository, which belongs to the system tier.
6. **Two exact-path assumptions to check when the phase starts:** the admin's plan page route and the `question-wait.ts` module name; if either differs, move the file, not the row.
7. **Test plan assertions are consolidated into 22 rows** where several shared one level and one subject (the test plan's A-numbers are in the `Asserts` text, not the IDs).
8. **Resume is unchecked.** A build session is one `claude -p` turn; I found no resume for it. At Build Phase 2, first look for one; if none, resume by starting a new session on the same worktree with the answer as its first message. Reason: the plan review could not confirm it (`plan-review.md`, finding 9).
9. **Added by the plan review** (`plan-review.md`): `ask_decision` (ADR decision 12), the build path, the dead-draft exemption (ADR decision 13), T23, T24, the hook's id check, real tier paths, no dry-run flag, mockup paths.
