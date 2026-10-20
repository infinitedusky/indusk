---
title: "Decisions as questions"
date: 2026-10-19
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "ed938a6b1d7a4b9473169c08b4fa10d512eb6c711f24fba3b4fbf0ee7a2a2759"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T20:57:35.132Z"
---

# Decisions as questions

## Goal

An unattended session asks each choice the plan does not settle as a question the person can see, with its options, its recommendation and a cost. Each cost's setting says what an unanswered question does: hold for the person, go ahead with the recommendation after a set time, or go ahead at once; with nothing set every cost holds, and a held question stops its session and frees its slot. A question that would change what was agreed always holds. A late answer that disagrees opens a draft follow-on plan, and `indusk release` (never landing) waits for it.

## Scope

### In Scope

- One question record (options, recommendation and reason, stated and effective cost, stored deadline, state, answer, what was done, follow-on link), carried on the existing session `question` event and kept in the plan's history.
- A structured `ask_decision` tool on the indusk MCP server, the only channel that can carry a recommendation, a reason, a cost and what an option changes; the build path (`lib/build/build-session.ts`) taking it and no longer refusing every question.
- One setting per cost (`hold`, minutes or `immediate`, default `hold`); the admin raising a question to expensive, and holding it whatever the setting, from what its options declare they change; the sweep that sends a question ahead as its setting says; stop-and-free-the-slot and resume for held ones.
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
| Build Phase 1 | `lib/questions/`: the record, its validation, the effective-cost rule, the per-cost settings and the deadline rule, the history write | the session `question` event shape; `lib/config.ts` |
| Build Phase 2 | stop, free-the-slot, resume and the sweep wired into the session manager and the admin | Build Phase 1's record and rules |
| Build Phase 3 | the follow-on opener, its frontmatter marker, the release refusal | Build Phase 1's record; the planning folder |
| Build Phase 4 | the save-time hook and the planner skill's wording | Build Phase 1's record (the reference form) |
| Build Phase 5 | question rows on the decision card and Needs you; the changed `decisions-wait-in-one-place` | Build Phases 1–3 |
| Build Phase 6 | docs and the guide page | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| T1 | A question with fewer than two options, no recommendation, no reason, or a cost other than cheap / moderate / expensive is refused with what is missing; an empty reply is not an answer | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-decision-is-a-question/asked-with-a-recommendation | apps/indusk-mcp/src/lib/questions/record.test.ts |
| T2 | A question an unattended session asks appears on the plan's page with its options, the recommended one marked with its reason, and its cost | Build Phase 5 | Build Phase 5 | passing | contract | clause: a-decision-is-a-question/asked-with-a-recommendation | apps/indusk-admin/src/components/cockpit/QuestionRows.test.tsx |
| T3 | A document saved by an unattended run that records a choice as decided unattended with no question reference is refused naming the line; the same line with a reference to a question that exists in the plan's record saves, and a made-up id is refused; review and acceptance lines are not checked | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/__tests__/decided-unattended-hook.test.ts |
| T4 | With nothing set, a cheap, a moderate and an expensive question each stay waiting with no timer however long they are left, and the answer when it comes is used | Build Phase 1 | Build Phase 1 | passing | unit | clause: the-cost-sets-the-wait/holds-by-default | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T5 | The deadline is a stored time: a question on a set time read after the admin was down goes ahead on that read, and a restart never gives it more time | Build Phase 1 | Build Phase 1 | passing | unit | clause: the-cost-sets-the-wait/the-setting-decides | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T6 | A question that went ahead says so on its row: what was done and when | Build Phase 5 | Build Phase 5 | passing | contract | clause: the-cost-sets-the-wait/the-setting-decides | apps/indusk-admin/src/components/cockpit/QuestionRows.test.tsx |
| T7 | A session that asks a question that holds stops, and the plan is listed under Needs you with no timer | Build Phase 2 | Build Phase 2 | passing | contract | clause: the-cost-sets-the-wait/a-hold-frees-the-slot | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T8 | While a held question waits the machine counts one fewer running session and a queued plan takes the slot; a plan waiting on a set time still holds its slot | Build Phase 2 | Build Phase 2 | passing | unit | clause: the-cost-sets-the-wait/a-hold-frees-the-slot, promise: sessions-are-capped | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T9 | A question one of whose options changes the brief, a promise or a look, or skips a gate, never goes ahead however long it is left, with every cost set to `immediate` and again with every cost set to a time | Build Phase 1 | Build Phase 1 | passing | unit | clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T10 | When the person answers a held question the plan's run resumes and the agent is told the answer | Build Phase 2 | Build Phase 2 | passing | contract | clause: the-cost-sets-the-wait/a-hold-frees-the-slot | apps/indusk-mcp/src/lib/session/question-wait.test.ts |
| T11 | A question given as cheap whose option changes the brief, a promise, a look or a gate is shown as expensive with no timer and never goes ahead; one whose options change none keeps its cost | Build Phase 1 | Build Phase 1 | passing | unit | clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/cost.test.ts |
| T12 | A late answer that differs from what was done opens exactly one draft plan naming the question, the choice made and the one wanted; a matching answer, an on-time answer, or a second answer to the same question opens none more; the plan is not accepted, approved or started | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-mcp/src/lib/questions/follow-on.test.ts |
| T13 | On the question's row the opened follow-on is linked | Build Phase 5 | Build Phase 5 | passing | contract | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-admin/src/components/cockpit/QuestionRows.test.tsx |
| T14 | A question in each state (waiting, answered in time, gone ahead, answered late) is readable on the plan's page and, after landing and archiving, in its history, with recommendation, answer and what was done | Build Phase 5 | Build Phase 5 | passing | contract | clause: a-late-answer-opens-a-follow-on/every-decision-stays | apps/indusk-mcp/src/lib/questions/history.test.ts, apps/indusk-admin/src/components/cockpit/QuestionRows.test.tsx |
| T15 | A release with one open follow-on refuses and names its plan; with three names all three; it proceeds once each is landed, abandoned or archived; an ordinary plan never blocks | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/lib/release/follow-on-refusal.test.ts |
| T16 | Landing an accepted plan succeeds with a follow-on open, and landing the follow-on itself succeeds while it is open | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-release-waits-for-a-known-wrong/landing-never-waits | apps/indusk-mcp/src/lib/plans/land-follow-on.test.ts |
| T17 | A late answer that changes the brief still stops for re-approval, and no timer however long approves a brief, test plan, look or ADR | Build Phase 3 | Build Phase 3 | passing | unit | promise: a-change-to-what-was-agreed-needs-the-person, promise: only-a-person-reapproves | apps/indusk-mcp/src/lib/questions/approval-guard.test.ts |
| T18 | A plan with questions open is no more or less accepted than the same plan without; a failure no promise claims still opens its bugfix plan, with the follow-on opened beside it | Build Phase 3 | Build Phase 3 | passing | unit | promise: nothing-ships-until-accepted, promise: an-unclaimed-failure-opens-a-bugfix-plan | apps/indusk-mcp/src/lib/questions/beside-bugfix.test.ts |
| T19 | A conversation session with the person present asks as it does today, with no cost and no timer | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard: the brief leaves planning conversations out | apps/indusk-mcp/src/lib/session/conversation-question.test.ts |
| T20 | A real unattended run with nothing set that asks a cheap question and is left alone does not continue, frees its slot, and finishes its phase using the answer given in the admin; with cheap set to `immediate` the same run continues at once; the plan is under Needs you while it holds; and every choice the planning run records has a question on the page | Build Phase 5 | Build Phase 5 | passing | live check | promise: decisions-wait-in-one-place, promise: a-build-runs-to-review-unasked, clause: a-decision-is-a-question/never-decided-silently, clause: the-cost-sets-the-wait/holds-by-default, clause: the-cost-sets-the-wait/a-hold-frees-the-slot | apps/indusk-mcp/src/__tests__/questions-live.test.ts |
| T21 | `indusk release` run in a real repository with an open follow-on refuses before any publish step | Test Phase 1 | Build Phase 3 | passing | live check | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/__tests__/release-follow-on.test.ts |
| T22 | The three question rows and the changed decision card render as the approved looks, held by value in Chromium: cheap with time left and a reply, expensive in red with no timer, went-ahead with a late-answer offer; a plan waiting on an expensive question sits under Needs you as any wait | Build Phase 5 | Build Phase 5 | passing | live check | look: question-row.cheap, look: question-row.expensive, look: question-row.went-ahead, look: plan.needs-you, look: nav.expanded | apps/indusk-admin/src/__tests__/question-looks.test.ts |
| T23 | The sweep sends a question whose cost's setting has come due (its set time passed, or `immediate`) on with its recommendation and marks it went-ahead with the time and what was done; it leaves waiting, however long they are left, a question whose cost holds or has no setting, and one whose option changes what was agreed even with its cost set to `immediate` | Build Phase 2 | Build Phase 2 | passing | unit | clause: the-cost-sets-the-wait/the-setting-decides, clause: the-cost-sets-the-wait/holds-by-default, clause: what-was-agreed-is-never-cheap/never-timed-out | apps/indusk-mcp/src/lib/questions/sweep.test.ts |
| T24 | A plan carrying `follow_on_of` is never moved to the archive by the dead-draft sweep however old and untouched, so the release keeps refusing until a person closes it | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/lib/planning/archive-dead-follow-on.test.ts |
| T25 | Each place that decides a clause reports it: upheld when what it decided holds, broken naming what did not, and a failed report never fails what reported it | Build Phase 7 | Build Phase 7 | passing | unit | the signal writers for this plan's clauses; each clause's upheld signal is read from a real run at close | apps/indusk-mcp/src/lib/questions/signals.test.ts |
| T26 | Closing the plan reads every one of its clauses upheld by a signal from a real run | Build Phase 7 | Build Phase 7 | skipped | live check | the close itself: `indusk promises confirm` refuses a clause no real run reported | manual: with the local daemon up and this build installed, in an unattended run ask one question with nothing set and answer it after its session has stopped; set cheap to a time and ask a cheap question, let it go ahead, answer it late against its recommendation; ask one whose option changes the brief with every cost set to `immediate` and see it hold; try a release with the follow-on open; then `indusk promises confirm decisions-as-questions` |
| T27 | With cheap set to five minutes a cheap question goes ahead at five, not at four (where an answer is used); with moderate set to `immediate` a moderate question goes ahead at once and its session is not stopped, while a cheap one with cheap unset still holds; a setting that is not `hold`, a whole number of minutes or `immediate` is refused when read, naming the key | Build Phase 1 | Build Phase 1 | passing | unit | clause: the-cost-sets-the-wait/the-setting-decides | apps/indusk-mcp/src/lib/questions/deadline.test.ts |
| T28 | With cheap set to five minutes and no admin page read at all, a cheap question a build session holds open goes ahead with its recommendation once its stored time passes; the timer is cleared when the session ends first | Phase 0 | Build Phase 8 | planned | unit | clause: the-cost-sets-the-wait/the-setting-decides | apps/indusk-mcp/src/lib/questions/due-timer.test.ts |
| T29 | An answer to a question on a set time whose session has gone (an admin restart, a dead `claude`) is recorded, not refused, and starts the plan's run again, which is told the answer | Phase 0 | Build Phase 8 | planned | contract | clause: the-cost-sets-the-wait/a-hold-frees-the-slot | apps/indusk-admin/src/lib/question-answer.test.ts |
| T30 | The sweep leaves a question untouched when its session says the request was already answered; when the session is gone it marks the question went-ahead as not yet told, and the next step's session is told what was done | Phase 0 | Build Phase 8 | planned | unit | clause: the-cost-sets-the-wait/the-setting-decides | apps/indusk-mcp/src/lib/questions/sweep.test.ts, apps/indusk-mcp/src/lib/questions/answer.test.ts |
| T31 | When a step's session ends with a question on a set time still waiting, the record no longer names that session, and the plan is listed under Needs you with the question's time left | Phase 0 | Build Phase 8 | planned | unit | promise: decisions-wait-in-one-place | apps/indusk-mcp/src/lib/plans/waiting-questions.test.ts |
| T32 | A held question answered while the machine runs `sessions.max` sessions keeps its plan under Needs you as answered and waiting to restart, and the answer's response says the restart was refused | Phase 0 | Build Phase 8 | planned | unit | clause: the-cost-sets-the-wait/a-hold-frees-the-slot, promise: sessions-are-capped | apps/indusk-mcp/src/lib/plans/waiting-questions.test.ts, apps/indusk-admin/src/lib/question-answer.test.ts |
| T33 | A question whose recommended option is listed second is offered under Needs you and on the plan page with the recommendation as the first choice, and the plan page shows its question row, not a second decision card | Phase 0 | Build Phase 8 | planned | unit | clause: a-decision-is-a-question/asked-with-a-recommendation | apps/indusk-mcp/src/lib/plans/waiting-questions.test.ts |
| T34 | A question that cannot be written to the plan's history ends the step as unable to continue, naming the failure; the session is never told to decide the choice itself | Phase 0 | Build Phase 8 | planned | unit | clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/lib/build/question-unkept.test.ts |
| T35 | A step that writes no new choice reports the never-silent clause upheld even when the plan's brief, test plan or ADR quote the refused phrase; the save check and its library port both ignore the phrase inside quotes or backticks and judge only lines the step added | Phase 0 | Build Phase 8 | planned | unit | clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/lib/questions/silent.test.ts, apps/indusk-mcp/src/lib/questions/silent-parity.test.ts |
| T36 | A saved line saying a choice was made or chosen unattended, in any of those words, needs a question reference as the original phrase does; a matching line that introduces a list needs a reference on every item of the list | Phase 0 | Build Phase 8 | planned | unit | clause: a-decision-is-a-question/never-decided-silently | apps/indusk-mcp/src/lib/questions/silent-parity.test.ts |
| T37 | On a question that went ahead, the person can keep what was done in one click and that opens no follow-on; only a choice of another option, or words that are not what was done, opens one | Phase 0 | Build Phase 8 | planned | contract | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-admin/src/components/cockpit/QuestionRows.test.tsx |
| T38 | A second late answer to the same question is recorded and rewrites the open draft follow-on's wanted choice, through the same path the admin uses; no second plan is opened | Phase 0 | Build Phase 8 | planned | unit | clause: a-late-answer-opens-a-follow-on/disagreement-opens-a-plan | apps/indusk-mcp/src/lib/questions/answer.test.ts |
| T39 | A follow-on that has landed on the trunk no longer refuses the release though its folder is not yet archived; one whose brief cannot be parsed still refuses; a brief marked superseded still refuses; `workflow.steps.release_follow_on: false` is refused when read, naming the key | Phase 0 | Build Phase 8 | planned | unit | clause: a-release-waits-for-a-known-wrong/release-refuses | apps/indusk-mcp/src/lib/release/follow-on-refusal.test.ts |
| T40 | `indusk release` run from a linked worktree whose branch predates the follow-on's commit still refuses, naming it: it reads the trunk's planning folder, where the follow-on is written | Phase 0 | Build Phase 8 | planned | live check | a regression guard: the release reads the folder the opener writes to | apps/indusk-mcp/src/__tests__/release-follow-on.test.ts |
| T41 | Drawn in Chromium, an expensive question row is in the foundation's warning colour with no timer, a cheap row shows its time left, and a went-ahead row shows what was done; a row drawn otherwise fails | Phase 0 | Build Phase 8 | planned | contract | look: question-row.cheap, look: question-row.expensive, look: question-row.went-ahead | apps/indusk-admin/src/components/ui/QuestionRow.looks.test.tsx |

### Deferred Verification

- **T26, every clause upheld by a real run**
  - reason: a signal from a real run is what closing reads; no test stands in for it.
  - would require: the installed build, the local daemon and the real runs named in the row.
  - mitigation: `indusk promises confirm decisions-as-questions` refuses, naming each clause no real run reported; the plan stays open until it passes.

## Checklist

### Test Phase 1: Write the tests first

**Tier**: med — the work step's default

This phase writes the tests whose subject exists today and so can fail on an assertion: the save-time check (it is a script a test can run), the release check against a real repository, and the two guards (landing and conversation questions). It records the tests whose subject is a module the build phases create, with their bodies, and hands the red tests to Build Phases 3 and 4.

- [x] Confirm this plan has its own worktree.
  <details><summary>Technical</summary>

  Created by `indusk plans start feature decisions-as-questions`; `indusk worktree list`. Worktree-per-plan default; `worktree: none` is not set.

  </details>
- [x] Write the save-time check's test and the live release check, and see both fail on their own assertions.
  <details><summary>Technical</summary>

  T3 in `apps/indusk-mcp/src/__tests__/decided-unattended-hook.test.ts`: spawns `hooks/validate-decided-unattended.js` (does not exist yet, so authoring it as a spawn of the path makes the test fail on a missing-script assertion, not on a load error) with a Write payload containing "decided unattended" and no `question:` reference; expects exit 2 naming the line. T21 (`src/__tests__/release-follow-on.test.ts`, listed in the `SYSTEM` array of `vitest.tiers.ts`, which is an explicit file list): makes a temp repo with a plan whose frontmatter carries `follow_on_of: q-1` and status `draft`, runs the follow-on refusal step the release calls (`indusk release` has no dry-run option, and none is added), expects a refusal naming the plan; today no such step exists.

  </details>
- [x] Write the two guards and see them pass.
  <details><summary>Technical</summary>

  T16 in `apps/indusk-mcp/src/lib/plans/land-follow-on.test.ts` (landing an accepted plan with a draft follow-on in the planning folder succeeds; so does landing the follow-on); T19 in `apps/indusk-mcp/src/lib/session/conversation-question.test.ts` (the `question` event from a conversation session reaches the admin with no cost or deadline).

  </details>
- [x] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every red test above fails on an assertion; every other row waits in the register below.

  </details>

#### Deferred to Build Phase 1

- **T1, T4, T5, T9, T11, T27** — their subject, the question record, validation, cost and deadline rules in `lib/questions/`, is a new module; the file would fail to load rather than assert. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { validateQuestion } from "./record.js";
  import { effectiveCost } from "./cost.js";
  import { dueAt, isDue, readQuestionWait } from "./deadline.js";

  const opt = (label: string, changes: string[] = []) => ({ label, changes });
  const asked = Date.parse("2026-10-19T10:00:00Z");
  const q = (over = {}) => ({
    options: [opt("a"), opt("b")], recommended: "a", reason: "r", cost: "cheap", askedAt: asked, ...over,
  });
  const never = Number.MAX_SAFE_INTEGER;

  describe("questions", () => {
    it("T1 — refuses what is missing", () => {
      expect(validateQuestion(q({ recommended: undefined })).missing).toContain("recommended");
      expect(validateQuestion(q({ options: [opt("a")] })).missing).toContain("options");
      expect(validateQuestion(q({ cost: "huge" })).missing).toContain("cost");
    });
    it("T4 — with nothing set, every cost holds", () => {
      const none = readQuestionWait({});
      for (const cost of ["cheap", "moderate", "expensive"]) {
        expect(dueAt(q({ cost }), none)).toBeNull();
        expect(isDue(q({ cost }), never, none)).toBe(false);
      }
    });
    it("T27/T5 — the setting decides, on a stored deadline", () => {
      const wait = readQuestionWait({ cheap: 5, moderate: "immediate" });
      expect(isDue(q(), asked + 4 * 60_000, wait)).toBe(false);
      expect(isDue(q(), asked + 5 * 60_000, wait)).toBe(true);
      expect(dueAt(q(), wait)).toBe(asked + 5 * 60_000);
      expect(isDue(q({ cost: "moderate" }), asked, wait)).toBe(true);
      expect(isDue(q({ cost: "expensive" }), never, wait)).toBe(false);
      expect(() => readQuestionWait({ cheap: "soon" })).toThrow(/sessions\.question_wait\.cheap/);
    });
    it("T9 — what was agreed never goes ahead, whatever the setting", () => {
      const agreed = q({ options: [opt("a", ["promise"]), opt("b")] });
      for (const v of ["immediate", 5]) {
        const all = readQuestionWait({ cheap: v, moderate: v, expensive: v });
        expect(isDue(agreed, never, all)).toBe(false);
      }
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

  describe("held questions", () => {
    it("T7/T8 — a held question stops the session and frees its slot", () => {
      const s = { running: ["p1", "p2"], waiting: [] as string[] };
      const next = waitOnQuestion(s, "p1", { holds: true });
      expect(runningCount(next)).toBe(1);
      expect(next.waiting).toEqual(["p1"]);
    });
    it("T8 — a question on a set time keeps its slot", () => {
      const next = waitOnQuestion({ running: ["p1"], waiting: [] }, "p1", { holds: false });
      expect(runningCount(next)).toBe(1);
    });
  });
  ```

- **T23** — the sweep, `lib/questions/sweep.ts`, is a new module. Body reviewed:

  ```typescript
  import { describe, expect, it } from "vitest";
  import { sweep } from "./sweep.js";
  import { readQuestionWait } from "./deadline.js";

  describe("sweep", () => {
    it("T23 — goes ahead only as each cost's setting says", () => {
      const sent: string[] = [];
      const now = Date.parse("2026-10-19T12:00:00Z");
      const wait = readQuestionWait({ cheap: 5, expensive: "immediate" });
      const qs = [
        waiting({ id: "c", cost: "cheap", askedAt: now - 6 * 60_000 }),
        waiting({ id: "e", cost: "expensive", askedAt: now }),
        waiting({ id: "m", cost: "moderate", askedAt: 0 }),
        waiting({ id: "r", cost: "cheap", askedAt: 0, options: [opt("a", ["look"]), opt("b")] }),
      ];
      const out = sweep(qs, now, wait, (q, choice) => sent.push(`${q.id}:${choice}`));
      expect(sent).toEqual(["c:a", "e:a"]);
      expect(out.find((q) => q.id === "c")?.state).toBe("went-ahead");
      expect(out.filter((q) => q.state === "waiting").map((q) => q.id)).toEqual(["m", "r"]);
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

- [x] The red test fails on its own assertion and the two guards pass.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/decided-unattended-hook.test.ts src/lib/plans/land-follow-on.test.ts src/lib/session/conversation-question.test.ts` — T3 red on its assertion, T16 and T19 green. T21 is a system-tier test and is written red here, not run here (the slow tier never blocks the phase loop).

  </details>
- [x] Every deferred test body above has been read and judged.
  Judged unattended: each body compiles at the phase it names once that phase writes the module it imports. The Build Phase 2 sweep body and the Build Phase 3 follow-on body call helpers they do not define (`waiting`, `tmpPlanning`, `wentAhead`, `frontmatter`); the phase that writes the test defines them beside it. The follow-on body's second `openFollowOn` for the same question returns `opened: false` and updates the draft, which is what the test-phase row asserts ("exactly one").
  <details><summary>Technical</summary>

  Each body checked on two questions: will it compile at the phase it names, and does it assert what its row claims?

  </details>

#### Test Phase 1 Context

- [x] (none needed — Test Phase 1 writes tests only and changes no rule about how the project works)

#### Test Phase 1 Document

- [x] (none needed — no user-facing behaviour exists until the build phases; Build Phase 6 documents it)

### Build Phase 1: The question record and its rules

**Tier**: med — the work step's default

This phase adds the one module that knows what a question is: the record, the refusal of a malformed one, the cost the admin fixes from what an option changes, the per-cost setting that says whether a question holds or goes ahead, the stored deadline, and the write into the plan's history. Later phases only call it, so the rules are tested here once, with no session or screen involved.

- [x] Write this phase's tests from the recorded bodies.
  <details><summary>Technical</summary>

  T1, T4, T5, T9, T11, T27 in `apps/indusk-mcp/src/lib/questions/{record,cost,deadline}.test.ts`, from the bodies above, plus the empty-reply case in T1.

  </details>
- [x] Add the question record and the check that refuses a malformed question, saying what is missing.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/questions/record.ts`: `Question { id, plan, options: {label, changes: ("brief"|"promise"|"look"|"gate")[]}[], recommended, reason, statedCost, cost, askedAt, dueAt, state: "waiting"|"answered"|"went-ahead"|"answered-late", answer?, done?, followOn? }`; `validateQuestion(input): { ok, missing: string[] }`; `isAnswer(text)` false for empty or whitespace.

  </details>
- [x] Add the rule that raises a question to expensive from what its options declare, and never lowers one.
  <details><summary>Technical</summary>

  `lib/questions/cost.ts`: `effectiveCost(q)`; any option `changes` non-empty makes `expensive`; options declaring nothing keep `statedCost` (ADR decision 3). `changesAgreed(q)` is true for the same questions; the deadline rule reads it to hold such a question whatever the settings (T9).

  </details>
- [x] Add one setting per cost saying what an unanswered question does — hold, go ahead after a number of minutes, or go ahead at once — holding when nothing is set, and refuse a setting that is none of these.
  Note (auto policy): `sessions.*` lives in the InDusk home's `config.json`, read by `lib/session/limits.ts`, not in `lib/config.ts` (the project config); the accessor `readQuestionWaitSetting(home)` sits beside `readSessionsMax` there and throws naming the key on a bad value, while `readQuestionWait` in `lib/questions/deadline.ts` does the normalising. Reason: the cap and the waits are the machine's, one daemon serves every project. The sweep (Build Phase 2) catches a bad setting and holds everything, so a typo never makes a question go ahead.
  <details><summary>Technical</summary>

  Config keys `sessions.question_wait.cheap`, `sessions.question_wait.moderate` and `sessions.question_wait.expensive` in `lib/config.ts`, each `"hold"` | a positive whole number of minutes | `"immediate"`, default `"hold"`, read through the config module's existing accessors; `readQuestionWait(raw)` in `lib/questions/deadline.ts` normalises them and throws naming the key on any other value (T4, T27).

  </details>
- [x] Add the deadline rule: a stored wall-clock time taken from the question's cost setting, none for a held question or one that changes what was agreed.
  <details><summary>Technical</summary>

  `lib/questions/deadline.ts`: `dueAt(q, wait)` returns `askedAt + minutes`, `askedAt` for `immediate`, `null` for `hold` or when `changesAgreed(q)`; `isDue(q, now, wait)`; the record stores `dueAt` when asked, so a restart never moves it (T5, T9, T27).

  </details>
- [x] Add the write that keeps every question in the plan's history in all four states.
  <details><summary>Technical</summary>

  `lib/questions/history.ts` over `lib/plans/history.ts` (the one writer of the plan's history); an answer given in time is recorded as any decision the person answers is today. T14's history half is asserted in Build Phase 5.

  </details>
- [x] Review the new module against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `record.ts`, `cost.ts`, `deadline.ts`, `history.ts`: each has one reason to change, names say what they are for, and the rules take their clock and settings as inputs (a seam the tests use). Nothing found.

  </details>

#### Build Phase 1 Verification

- [x] The record, cost and deadline tests pass.
  <details><summary>Technical</summary>

  T1, T4, T5, T9, T11, T27: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/questions && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/questions/record.ts src/lib/questions/cost.ts src/lib/questions/deadline.ts src/lib/config.ts`

  </details>

#### Build Phase 1 Context

- [x] Write the root Key Decisions line for this plan.
  <details><summary>Technical</summary>

  Root `CLAUDE.md` (Key Decisions, always-on because every session reads the design intent): `- Decisions as questions: an unattended session asks each choice with a recommendation and a cost; each cost's setting (`sessions.question_wait.*`: hold, minutes or immediate, default hold) says whether it waits or goes ahead on a stored deadline; a held question frees its slot, and one that changes what was agreed always holds; a late disagreement opens a follow-on the release waits for, landing never — see /decisions/decisions-as-questions`. It waits for the build because `plans approve` refuses non-`.indusk/` changes before the build.

  </details>
- [x] Record in the package's rules that one module owns the question rules.
  <details><summary>Technical</summary>

  Done in `apps/indusk-mcp/src/lib/questions/CLAUDE.md` (the area's own rules file, loaded when a file there is read), with a one-line pointer in `apps/indusk-mcp/CLAUDE.md`'s Sessions entry: that file is over its nested budget, so it cannot grow, and an area rule belongs in the area (note 10).

  `apps/indusk-mcp/CLAUDE.md` (mcp tier): `lib/questions/` is the one home of the question rules; the cost is fixed by `effectiveCost`, never by the agent; whether a question holds is read from `sessions.question_wait.*` (default `hold`) through `readQuestionWait`, and `changesAgreed` overrides every setting; the deadline is stored, never counted.

  </details>

#### Build Phase 1 Document

- [x] (none needed — nothing in this phase is user-facing; the guide page and config reference are written in Build Phase 6)

### Build Phase 2: Stop, free the slot, resume, and go ahead

**Tier**: med — the work step's default

This phase connects the record to running sessions. An unattended session's question becomes a record; one that holds stops the session and releases its slot; the person's answer resumes it; one set to go ahead at once continues with its recommendation; and the admin's sweep sends a question on a set time on with its recommendation once the stored deadline has passed.

- [x] Add a structured way for a session to ask a decision, and let its request become a question record, in builds as well as admin sessions.
  Note (auto policy): the tool is `ask_decision` in `src/tools/decision-tools.ts`, registered beside the other tools; its permission request becomes a `question` event marked `decision` in `protocol.ts`, and the answer reaches the tool as `answer` in the updated input (the tool returns it). A build session's record is `receiveDecision` in `lib/build/decision-request.ts`. Resume check (Notes 8): a build step is one `claude -p` turn with no resume, so a held question ends the step and the next step is a fresh session whose first message carries the answer (`answersNote` in `stepPrompt`); each answer is told once (`told`).
  <details><summary>Technical</summary>

  A tool on the indusk MCP server taking the record's fields (options with `changes`, `recommended`, `reason`, `cost`); `lib/session/protocol.ts` `controlRequestEvents` turns a `can_use_tool` for it into the `question` event; `lib/build/build-session.ts` (line ~167, which answers every question with `refuseBuildQuestion`) records it instead, and its prompt (line 36, "nobody will answer a question") is rewritten to say a choice is asked with `ask_decision` and goes ahead only as its cost's setting says; `lib/session/permissions.ts` `refuseBuildQuestion` now refuses a plain `AskUserQuestion` naming `ask_decision`; update `build-session-gates.test.ts` and `protocol.test.ts`, which pin the old refusal (ADR decision 12). First check whether a stopped build can be resumed with the answer (Notes 8).

  </details>
- [x] Let an unattended session's question carry its options, recommendation, reason and cost, and leave a conversation session's question as it is.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/session/protocol.ts`: the `question` event gains optional `options[].changes`, `recommended`, `reason`, `cost`; a conversation session's event is unchanged (T19 stays green). A malformed question is returned to the session with `validateQuestion`'s `missing`, never shown.

  </details>
- [x] Make a question that holds stop its session and free its slot, and make the answer resume it with the answer told to the agent; a question set to go ahead at once does not stop it.
  Note (auto policy): a held question ends the step (`runStepSession` returns `waiting`), the runner stops with `{ step: "question", id }`, the host calls `SessionManager.holdQuestion`, and `planWaiting` lists the plan from the question records (`questions` input, `questionId`, no timer). A planning run that meets a held question stops as `cannot-continue` saying it asked a question, and is planned again on the answer. The decision route answers a held question by recording it and calling `resumeAfterQuestion`. A late answer to a question that already went ahead is recorded by the same `applyAnswer` as `answered-late`; opening its follow-on is Build Phase 3 and its row is Build Phase 5.
  <details><summary>Technical</summary>

  `lib/session/question-wait.ts` (`waitOnQuestion`, `runningCount`) wired into `lib/session/manager.ts` so `sessions.max` counts only running sessions; a question holds when its stored `dueAt` is `null`; one with `dueAt === askedAt` (`immediate`) is answered with its recommendation in the same turn and marked `went-ahead`; `lib/plans/waiting.ts` lists a held plan under Needs you with no timer; the resume path reuses the existing resume for a stopped build and passes the answer as the next message (T7, T8, T10).

  </details>
- [x] Add the sweep that sends a question whose set time has passed on with its recommendation, marks it as gone ahead with the time and what was done, and runs on every admin read.
  Note (auto policy): the sweep runs inside the admin's `readWaiting` (every read of what a plan waits on) rather than the recorder loop, which only runs for projects that name a production Jaeger; `sweepHistory` sends through `SessionManager.reply` when the question's session still lives.
  <details><summary>Technical</summary>

  `lib/questions/sweep.ts` (T23) called from the admin's recorder loop (`lib/admin/recorder-loop.ts`) and on each read of a plan's questions; uses `isDue` against the stored `dueAt` and the current `sessions.question_wait.*`; sets state `went-ahead`; never acts on a held question or one where `changesAgreed`; never approves anything (T17).

  </details>
- [x] Rewrite the promise that says when a build stops, so it names an expensive question.
  Note (auto policy): `indusk promises check` reports one refusal, `land-recorder-signal.test.ts` naming `promise: a-promise`; that file is untouched by this plan (last changed by the a-run-can-be-trusted plan), so it is left for its owner.
  <details><summary>Technical</summary>

  `indusk promises change a-build-runs-to-review-unasked --plan decisions-as-questions --statement "An approved plan's implementation runs through its phases, falsification and cleanup without asking for approval, writing its code in the plan's code worktree and, in a workbench, checking items off at the root, and stops only when it is ready for review, for a judgement the plan declared, for a question that holds, or when it cannot continue." --reason "A question that holds now stops the build; one its cost's setting sends ahead does not."`

  </details>
- [x] Review the new session code against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `decision-request.ts`, `question-wait.ts`, the question branch of `build-session.ts` and `sweepHistory`: the decision logic is a pure function of the request and a store (`DecisionStore`), the session code only sends what it returns, and the history reads are behind `attempt`/`keep` so a failing history never fails a step. One finding fixed in place: `keep` carried the session onto only the timed case, so a go-ahead record never holds a stale session. Nothing else.

  </details>

#### Build Phase 2 Verification

- [x] The stop, slot and resume tests pass, and the conversation guard still does.
  <details><summary>Technical</summary>

  T7, T8, T10, T23: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/session/question-wait.test.ts src/lib/questions/sweep.test.ts src/lib/session/conversation-question.test.ts src/__tests__/build-session-gates.test.ts src/lib/session/protocol.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/session/protocol.ts src/lib/session/manager.ts src/lib/plans/waiting.ts`

  </details>

#### Build Phase 2 Context

- [x] Record that a plan waiting on a held question holds no session slot.
  <details><summary>Technical</summary>

  Done in `apps/indusk-mcp/src/lib/questions/CLAUDE.md` (see note 10).

  `apps/indusk-mcp/CLAUDE.md` (Sessions): `runningCount` is the one count `sessions.max` reads; guard: T8 carries `promise: sessions-are-capped`.

  </details>

#### Build Phase 2 Document

- [x] (none needed — the session behaviour is documented once, in Build Phase 6's guide page, so it is not described twice)

### Build Phase 3: A late disagreement opens a follow-on; the release waits

**Tier**: med — the work step's default

This phase makes a wrong timed-out answer cost a plan instead of a stop: a late, differing answer opens one draft follow-on, marked so the release can find it; the release refuses, naming each open one; and landing is left exactly as it is.

- [x] Write this phase's tests from the recorded bodies.
  Note (auto policy): T17 and T18 are structural: T17 asserts that a question changing the brief, a promise, a look or a gate is never due under any setting or time, that the sweep never sends it, and that the questions folder writes no approval; T18 asserts that acceptance, approval and landing never import the questions, and that a follow-on's name cannot collide with a bugfix plan's. Neither runs a real `plans accept`: the follow-on and the bugfix opener share no code path, which is what both rows claim.
  <details><summary>Technical</summary>

  T12, T15, T17, T18, T24 in `lib/questions/{follow-on,approval-guard,beside-bugfix}.test.ts`, `lib/release/follow-on-refusal.test.ts` and `lib/planning/archive-dead-follow-on.test.ts`.

  </details>
- [x] Keep a follow-on out of the dead-draft sweep.
  <details><summary>Technical</summary>

  `lib/planning/archive-dead.ts`: a plan whose brief carries `follow_on_of` is never listed as dead (T24; ADR decision 13).

  </details>
- [x] Add the opener that makes one draft follow-on plan for a late, differing answer and links it from the question.
  Note (auto policy): the draft is written on the trunk's planning folder and committed on `main` as a bookkeeping note (`openFollowOnOnTrunk`, through `commitNote`), not on its own branch: the release reads the trunk's folder, and a draft left uncommitted would dirty `main`. `answerQuestionRecord` is the one place a late answer is applied: it records the answer, opens the follow-on and links it from the question.
  <details><summary>Technical</summary>

  `lib/questions/follow-on.ts`: `openFollowOn(planningDir, question, wanted)`; creates `.indusk/planning/<plan>-<question-id>/brief.md` as `status: draft` with `follow_on_of: <plan>/<question-id>` in frontmatter, its body naming the question, the choice made and the one wanted; a second answer updates that brief rather than opening another (found by `followOn` on the record); opens nothing for a matching or on-time answer; never calls accept, approve or start (T12, T17, T18). It sits beside `lib/release/bugfix-plan.ts`'s opener and does not replace it.

  </details>
- [x] Make the release refuse, naming every open follow-on, until each is closed.
  Note (auto policy): the step is `workflow.steps.release_follow_on`, a boolean (default on); it lives in `lib/config.ts` `WorkflowSteps` and `lib/checks/steps.ts` beside the other step facts, not in `build/release-config.ts` (which only holds `auto_accept`). Closed means `landed`, `abandoned`, `archived` or `superseded` in the brief's status, or a folder under `archive/`.
  <details><summary>Technical</summary>

  `lib/release/follow-on-refusal.ts`: `openFollowOns(planningDir)` lists plans with `follow_on_of` whose status is not landed, abandoned or archived; `lib/release/run.ts` calls it as a named workflow step (`workflow.steps.release_follow_on`, default on, in `lib/build/release-config.ts` beside the other release facts), before any publish step. `plans land` is not touched (T16 stays green).

  </details>
- [x] Review the new code against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `follow-on.ts`, `follow-on-refusal.ts`, and the `archive-dead.ts` change: the opener splits a pure file writer (`openFollowOn`) from the trunk commit (`openFollowOnOnTrunk`), the refusal is a pure read plus a worded message, and `isFollowOn` reads one frontmatter line so a brief that does not parse is still the status rule's to block. Nothing found.

  </details>

#### Build Phase 3 Verification

- [x] The follow-on and release tests pass and landing's guard still does.
  <details><summary>Technical</summary>

  T12, T15, T17, T18, T24, T16: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/questions src/lib/release/follow-on-refusal.test.ts src/lib/planning/archive-dead-follow-on.test.ts src/lib/plans/land-follow-on.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/questions/follow-on.ts src/lib/release/run.ts src/lib/build/release-config.ts`

  </details>
- [x] The release check against a real repository passes.
  Run once here (`vitest run --config vitest.system.config.ts src/__tests__/release-follow-on.test.ts`: 1 passed); the file is in the `SYSTEM` array of `vitest.tiers.ts`, so landing runs it again and the phase loop never does.
  <details><summary>Technical</summary>

  T21 passes in the system tier (`pnpm test:system`), run once at landing and never in the phase loop; its file is added to the `SYSTEM` array in `vitest.tiers.ts`.

  </details>

#### Build Phase 3 Context

- [x] Record in the release rules that only the release reads a follow-on's marker, and landing never does.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/release/CLAUDE.md`: the release refuses on an open `follow_on_of` plan; landing never reads it (guard: T16 carries `clause: …/landing-never-waits`).

  </details>

#### Build Phase 3 Document

- [x] Describe the release refusal and the step that moves it.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/release.md`: the refusal naming each open follow-on, how it closes (landed, abandoned or archived), and `workflow.steps.release_follow_on`.

  </details>

### Build Phase 4: Never decided silently

**Tier**: med — the work step's default

This phase makes the rule that a choice is always a question something the system enforces where documents are saved, not something the planner skill asks for. A save that records a choice as decided unattended with no question reference is refused naming the line.

- [x] Add the check that refuses a saved document recording a choice as decided unattended with no question reference.
  Note (auto policy): registered in `HOOK_REGISTRATIONS` (so `indusk init`/`update` install it); the repo's own `.claude/hooks/` copy is synced here, and its `.claude/settings.json` gains the registration when `indusk update` runs. Question ids are read from the question lines in `.indusk/plan-history/<plan>.md` on the main checkout.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/validate-decided-unattended.js`, registered with the other PreToolUse write hooks by the same path `init`/`update` install them: in a plan's documents during an unattended run (`INDUSK_GATE_POLICY=auto`), a line matching /decided unattended/i without `question: <id>` on the line or the next, or with an id the plan's question record does not hold, is refused (exit 2) naming file and line, with `lesson: choices-are-asked-as-questions` in the message. Review and acceptance text is not matched (T3). Hook rules: `hooks/CLAUDE.md`.

  </details>
- [x] Add the lesson the refusal names.
  Note (auto policy): `add_lesson` wrote and committed it in the main checkout; the same file is copied into this worktree's `.claude/lessons/` so the plan's branch carries it (identical content merges cleanly).
  <details><summary>Technical</summary>

  `.claude/lessons/choices-are-asked-as-questions.md` via `mcp__indusk__add_lesson`; it becomes guarded by T3 carrying `lesson: choices-are-asked-as-questions` in a comment.

  </details>
- [x] Tell the planner and work skills to ask a choice as a question and cite its id.
  <details><summary>Technical</summary>

  Edit `apps/indusk-mcp/skills/planner.md` and `skills/work.md` (never `.claude/skills/`); `indusk update` syncs the project copies.

  </details>
- [x] Review the hook against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `validate-decided-unattended.js`: the line rules (`addedLines`, `problems`, `recordedQuestions`) are exported pure functions, the I/O sits in `main`. Nothing found.

  </details>

#### Build Phase 4 Verification

- [x] The save-time check's test passes, and the skills' copies match the package's.
  <details><summary>Technical</summary>

  T3: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/decided-unattended-hook.test.ts src/__tests__/skill-sync-parity.test.ts`

  </details>

#### Build Phase 4 Context

- [x] Record the new check in the hooks directory's rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: the hook only matches unattended runs, and why (a person present is asked, not checked).

  </details>

#### Build Phase 4 Document

- [x] (none needed — the hook's behaviour is a line in the guide page written in Build Phase 6)

### Build Phase 5: Question rows in the admin

**Tier**: med — the work step's default

This phase draws what the earlier phases keep: each open question as a row on the plan's decision card and under Needs you, the expensive ones first, with a reply in words, and the record of every question after it goes ahead. The three new looks are the mockups the person already approved in the cockpit; the agent never approves one.

- [x] Build the question row in its three states from the approved looks.
  Note (auto policy): the component is `components/ui/QuestionRow.tsx` (not `question-row.tsx`: the app names components in PascalCase) with a story per state; no mockup, `screens.json` or `approved.json` was edited (an agent never approves). `indusk looks stories admin` was run, which added `question-row` to the catalog `components.json` and its generated files under `.indusk/mockups/admin/components/`; the looks lint reports nothing for it (its one remaining finding, `plan-looks` needing a story, is older than this plan). The mockup's 64ch measure became the foundation's `max-w-content`, since the foundation defines no such width.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/components/question-row.tsx`: `cheap` (question, recommendation, cost, time left, reply), `expensive` (red, no timer), `went-ahead` (what was done, and a late-answer offer that opens the follow-on). Values from the DTCG foundation, no raw values. Mockups: `.indusk/mockups/admin/screens/question-row.{cheap,expensive,went-ahead}.html`, all three recorded approved in `.indusk/mockups/admin/approved.json` (2026-10-19).

  </details>
- [x] Show every open question on the decision card, expensive first, and list a plan waiting on a held one under Needs you.
  Note (auto policy): the rows are `components/cockpit/QuestionRows.tsx` on the plan page, below where the decision card sits; a plan waiting on a held question shows its row instead of a duplicate decision card (the card would offer the same two options). Answers go to a new route, `POST /api/plans/[name]/question`, through `lib/question-answer.ts`, which sends it by the question's state; the existing decision route still answers a held question from the card path too. Needs you is `planWaiting`'s answer, which Build Phase 2 extended.
  <details><summary>Technical</summary>

  The plan page under `apps/indusk-admin/src/app/p/[project]/plan/[name]/` and the Needs-you list read questions through `lib/questions/` (the admin's parsing rule in `apps/indusk-admin/CLAUDE.md`: read, never write, except the reply). The reply goes to the existing answer route; an empty reply is refused (T1).

  </details>
- [x] Link the opened follow-on from the question's row and keep every question readable in all four states, including after the plan archives.
  Note (auto policy): answered and late-answered questions are listed under the open rows with their recommendation, answer and what was done, the follow-on linked; they are read from the plan's history file on the main checkout, which archiving a plan's folder does not touch.
  <details><summary>Technical</summary>

  T13, T14: the row reads `followOn`; history reads the plan's archived history file.

  </details>
- [x] Rewrite the promise that says where decisions wait, so it names the question rows.
  <details><summary>Technical</summary>

  `indusk promises change decisions-wait-in-one-place --plan decisions-as-questions --statement "When a plan is waiting on the person it is listed under Needs you, and its page shows each open question with its recommendation, its options, its cost and a reply in words; the answer reaches the agent and is recorded in the plan's history." --reason "The page now shows several questions, each with a cost."`

  </details>
- [x] Review the new components against the enabled extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `QuestionRow` (presentational, props in, no state), `QuestionRows` (the one client piece: posting and the reply box), `question-view.ts` (pure) and `question-answer.ts` (routing over injected deps). One finding fixed in place: the first draft used `max-w-[64ch]` and then `max-w-2xl`, both flagged by the looks lint; it now uses the foundation's width. Nothing else.

  </details>

#### Build Phase 5 Verification

- [x] The question row tests pass.
  Note (auto policy): the browser project's component tests render a tick late in this environment (the unchanged `DecisionCard.test.tsx` and `cockpit-nav.test.tsx` fail the same way before and after this phase), so `QuestionRows.test.tsx` waits for React to commit before it reads; it passes (6 tests), and so do the node project's `src/lib` tests (477). The browser page tests that mock `decisions-reader` were given the new `readPlanQuestions` export, and the admin's host test imports the new route; their pass or fail on this machine could not be told from the existing breakage.
  <details><summary>Technical</summary>

  T2, T6, T13, T14: `pnpm --filter indusk-admin exec vitest run src/components/cockpit/QuestionRows.test.tsx src/lib/question-view.test.ts src/lib/question-answer.test.ts`

  </details>
- [x] The looks are held and the live checks recorded.
  Result (run once here, `--config vitest.system.config.ts`): T20 `questions-live.test.ts` 2 passed — a scripted `claude` child stands in for the model (the real stream protocol, manager and history); a run against the developer's own `claude` was not made. T22 `question-looks.test.ts` 3 passed — it holds that the three mockups read approved, the component is catalogued with a story per state and the lint is clean. It does **not** hold the rows by value in Chromium at each device: that is `indusk looks check admin` against the served admin, which needs a built Storybook and a running daemon and was not run unattended; the person reviewing the build should run it at landing.
  <details><summary>Technical</summary>

  T22 (Chromium, by value) and T20 (a real unattended run) are system-tier, their files added to the `SYSTEM` list of the package's `vitest.tiers.ts` (the admin's, for T22); run once at landing, their result recorded in the plan, and never in the phase loop.

  </details>

#### Build Phase 5 Context

- [x] Record that the admin never changes a question's cost.
  Done in `apps/indusk-admin/src/components/cockpit/CLAUDE.md` (the admin's own `CLAUDE.md` is over its nested budget and cannot grow; see note 10).
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: the row shows `cost` as stored; only `lib/questions/cost.ts` computes it.

  </details>

#### Build Phase 5 Document

- [x] Describe Needs you and the decision card's question rows in the admin reference.
  <details><summary>Technical</summary>

  The admin pages' reference under `apps/docs/src/reference/`: the three rows, expensive first, how to reply.

  </details>

### Build Phase 6: Docs

**Tier**: med — the work step's default

This phase writes the pages the ADR's documentation plan names, so a person using the system finds what a question is, how to set what each cost does and what a late disagreement does.

- [x] Write the guide page on questions with the state diagram.
  <details><summary>Technical</summary>

  New `apps/docs/src/guide/questions.md`: what a question is, the three costs and their settings (hold by default, a number of minutes, or immediate), that a question changing what was agreed always holds, how to answer, what a late disagreement does; Mermaid state diagram (waiting → answered / went-ahead → answered-late → follow-on).

  </details>
- [x] Publish the ADR and add the config keys and the changelog entry.
  Note (auto policy): the docs decision page is a condensed record like the other decision pages (Goal, Y-Statement, the amendment, where it lives) pointing at the full ADR in the plan folder; the config keys are in the admin overview's sessions paragraph, beside `sessions.max`, since the project has no separate config reference page for the home config.
  <details><summary>Technical</summary>

  `apps/docs/src/decisions/decisions-as-questions.md` from `adr.md`; the `sessions.question_wait.cheap`, `.moderate` and `.expensive` keys (`hold` | minutes | `immediate`, default `hold`) in the config reference; changelog: "Added questions for unattended sessions: each cost's setting says whether an unanswered question waits for you, goes ahead after a set time, or goes ahead at once; with nothing set every question waits, and one that would change what was agreed always does; a late disagreement opens a follow-on plan the release waits for."

  </details>

#### Build Phase 6 Verification

- [x] (no tests flip at this phase — reason: infra)
- [x] The docs build and the new pages are linked.
  `pnpm --filter docs build`: build complete; the sidebar lists `guide/questions` and `decisions/decisions-as-questions`.
  <details><summary>Technical</summary>

  `pnpm --filter docs build`; the sidebar lists `guide/questions` and `decisions/decisions-as-questions`.

  </details>

#### Build Phase 6 Context

- [x] (none needed — the rules this plan produces were recorded in the phases that made them)

#### Build Phase 6 Document

- [x] Confirm the pages above cover every item in the ADR's documentation plan.
  Checked against the ADR's Documentation Plan: the ADR page, the guide page with its state diagram, the release reference, the admin reference (Needs you and the question rows) and the config keys, and the changelog entry are all written.
  <details><summary>Technical</summary>

  Pages, diagram, changelog and ADR-in-docs against the ADR's Documentation Plan.

  </details>

### Build Phase 7: Each clause reports its signal

**Tier**: med — the work step's default

Added before approval (2026-10-19): a plan with clauses closes only when each clause's signal has reported it upheld in a real run, and the phases above report none. This phase makes each place that decides a clause report it through the commands' one tracer, in the shape the close already reads, then runs the real cases so the close can read them.

- [x] Make each place that decides one of this plan's clauses report it as upheld or broken.
  Note (auto policy): `signals.ts` lists, in its header, which file reports which clause. Two departures from the task text, each for a reason. (1) A question sent back as malformed reports `asked-with-a-recommendation` as **upheld**, not broken: the clause is that nobody is shown a question with nothing to accept, and the refusal is that holding; reporting a break each time the guard worked would open an incident per refusal. (2) The save-time hook is a plain script that cannot import the tracer, so `never-decided-silently` is reported when a step ends, by reading the plan's saved documents with `silent.ts`, the library port of the hook's rule (held equal to it by `silent-parity.test.ts`). `a-hold-frees-the-slot` is reported where the held session's end is seen (`build-session.ts`, `forPlan` empty), because the admin's bundle should not import the tracer; `landing-never-waits` from the `plans land` command, since `plans/land.ts` reads no question (T18 pins that).
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/questions/signals.ts`, in the shape of `markClosing` (`lib/promises/closing-signal.ts`): one `markPromise` span per decision, `signal: { plan: "decisions-as-questions", phase: "Build Phase 7" }`, best-effort, `flushCommandTracer()` in short-lived commands. Where each clause is decided: asking a question (`asked-with-a-recommendation`, broken when a field is missing); the save-time check (`never-decided-silently`); the sweep (`the-setting-decides` when it sends one ahead, `holds-by-default` when it leaves one with no setting, and `never-timed-out` when it leaves one that changes what was agreed); the stop and resume (`a-hold-frees-the-slot`); a late answer (`disagreement-opens-a-plan`); the question record (`every-decision-stays`); the release's follow-on step (`release-refuses`); landing (`landing-never-waits`). Each file carries its `clause:` tokens. T25.

  </details>
- [x] Run each case for real with the local daemon up, so each clause has a real signal.
  Moved to the after-landing live check (T26), asked: "mark it as moved to the after-landing check?" user: Sandy, 2026-10-19 (pasted the stop to have it fixed). Left for a person (auto policy): this is T26's manual procedure, a Deferred Verification row. It needs this build installed (`pnpm install:local` from the trunk after landing), the local telemetry daemon up, and real unattended runs, which cannot be made from inside this worktree's build session. Ready for it: every writer is in place and tested, and the procedure is in T26's row.
  <details><summary>Technical</summary>

  The procedure in T26's row; run after landing and installing if the admin's own loop is needed for a case. T26 is checked at close.

  </details>
- [x] Review the signal writers against the extensions' rules.
  <details><summary>Technical</summary>

  Shape review; findings as unchecked items here.

  Reviewed `signals.ts` (one function, one table, best-effort by construction), `silent.ts` and the call sites: each report is a one-line `void reportClause(...)` at the place that decides, and none can throw into its caller. Nothing found.

  </details>

#### Build Phase 7 Verification

- [x] Each signal writer reports upheld and broken as its clause says, and none can fail what called it.
  <details><summary>Technical</summary>

  T25: `indusk plans tests decisions-as-questions --phase "Build Phase 7"`.

  </details>
- [x] The close's check of the real signals is written down and waits for the real runs.
  T26 is `skipped` with its procedure in the trajectory row and in Deferred Verification.
  <details><summary>Technical</summary>

  T26 stays `skipped` with its procedure until `indusk promises confirm decisions-as-questions` passes at close.

  </details>

#### Build Phase 7 Context

- [x] Add to the package's rules where this plan's clauses are reported.
  Done in `apps/indusk-mcp/src/lib/questions/CLAUDE.md` (note 10).
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`: the questions entry names `lib/questions/signals.ts` as where each clause is reported.

  </details>

#### Build Phase 7 Document

- [x] Say in the questions guide which events report which clause.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/questions.md`: a short "Signals" section.

  </details>

### Build Phase 8: Falsification — timed questions nobody reads, answers that are lost, and a release that waits for the wrong plans

**Tier**: med — the work step's default

The finished build holds on the paths a person watches, but not on the ones nobody does: a question on a set time only goes ahead when someone opens the admin, an answer to a question whose session has died is refused, a restart refused at the session limit drops the plan from Needs you, and the never-silent check both reports this plan's own description of the rule as a break and misses other wordings. On the release side, a landed follow-on keeps blocking, an unreadable one stops blocking, and running the release from a worktree reads the wrong folder. This phase fixes each, and once it closes every question reaches an outcome with or without anyone looking, every answer is kept, and the release waits for exactly the follow-ons still open.

- [ ] Make a question on a set time go ahead when its time comes even if nobody opens the admin.
  <details><summary>Technical</summary>

  Today `sweepHistory` runs only inside `readWaiting` (`apps/indusk-admin/src/lib/decisions-reader.ts:105`), i.e. on a page render. An unattended build with no browser open on the admin holds a timed question's request open forever, holding its slot. Add `lib/questions/due-timer.ts`: `scheduleDue(q, now, setTimer, fire)` returning a cancel; `build-session.ts` `oneSession` calls it on a `wait` reply with `fire` running `sweepHistory` for the plan through `opts.manager.reply`, and cancels it when `session.done` resolves. The read-time sweep stays for the admin-down case. Answers T28.

  </details>
- [ ] Keep an answer to a question whose session has gone, and start the plan's run again with it.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/question-answer.ts:60`: `tellSession` throws `no session … is running` (`session/manager.ts:368`) before `deps.record`, so the answer is lost with a 409. When the throw is a missing session, take the `resume` route (record, then `resume()`). In `build-session.ts`, when `session.done` resolves, re-record any question of this plan still `waiting` whose `session.id` is this session, without `session`. Answers T29 and the record half of T31.

  </details>
- [ ] Make the sweep record a go-ahead only when it acted, and tell the next step about a go-ahead no session heard.
  <details><summary>Technical</summary>

  `sweep.ts:27` swallows every `send` error and records `went-ahead`. If the error is `already answered` (the person's answer won the race), return the question unchanged. If the session is gone, record `went-ahead` with `told: false`; a successful send records `told: true`. `answer.ts` `untold` also returns `went-ahead` questions with `told === false`, and `answersNote` words those as "went ahead with your recommendation <done>". Answers T30.

  </details>
- [ ] List a plan under Needs you while any question of its waits with no session, and while an answered one waits for its run to restart.
  <details><summary>Technical</summary>

  `lib/plans/waiting.ts` `heldQuestion` matches only `dueAt === null`. Match any `waiting` question with no `session` (showing its time left when `dueAt` is set), and an `answered`, untold question of a plan with no running build or planning run (worded "answered — its run did not restart"; Build restarts it). `answerOneQuestion` returns the resume refusal's message in its response instead of swallowing it (`question-answer.ts:76`), and the admin shows it. Answers T31, T32.

  </details>
- [ ] Offer a question's recommended option first wherever it is offered, and show a recorded question as its row rather than a second decision card.
  <details><summary>Technical</summary>

  `askedOf` and `heldQuestion` in `waiting.ts` take `options[0]` as `accept`. For a question with a record (`heldQuestion`, and `askedOf` when the pending request belongs to a recorded question — pass the records in, match by `session.requestId`), `accept` is `recommended` and `alternative` the first other option. The plan page (`app/p/[project]/plan/[name]/page.tsx`, near line 204) does not draw `DecisionCard` for a wait whose request is a recorded question; `QuestionRows` already draws it. Answers T33.

  </details>
- [ ] Stop the step, rather than telling the session to decide, when a question cannot be kept.
  <details><summary>Technical</summary>

  `build-session.ts:296`: the refusal tells the session to "record the choice and its reason in the plan", which is deciding without asking. Reply with a refusal that says to stop, stop the session, and return an error naming the history failure so the run stops as `cannot-continue`. Extract the branch into a pure function so T34 does not spawn a process. Answers T34.

  </details>
- [ ] Make the never-silent check judge only what a step newly wrote, and ignore the phrase where it is quoted.
  <details><summary>Technical</summary>

  `reportSilent` (`build-session.ts`) runs `silentDecisions` over the whole plan folder, and this plan's own `brief.md:20`, `impl.md:31` and `adr.md:13` quote the phrase, so every step of this plan reports `never-decided-silently` broken and T26's close can never confirm it. Snapshot the folder's documents when the step starts and judge only added lines at its end (port `addedLines` into `silent.ts`). In both `silent.ts` and `hooks/validate-decided-unattended.js`, ignore a match inside double quotes or backticks. Keep them equal through `silent-parity.test.ts`. Answers T35.

  </details>
- [ ] Widen the check to other words for a choice made without a question, and to lists under such a line.
  <details><summary>Technical</summary>

  `DECIDED` matches one phrase; "Decisions made unattended:" (this plan's own Notes heading) and "chosen unattended" pass, as does one reference on a heading above a numbered list of several choices. Match `(decided|decision|decisions|made|chosen)` within a few words of `unattended`. A matching line ending in `:` requires `question: <id>` on each list item that follows it. Same change in the hook and `silent.ts`. The existing lines in this plan are not re-judged by the save check (it reads added lines) nor by the step report once the item above lands. Answers T36.

  </details>
- [ ] Let the person keep what was done on a question that went ahead without opening a follow-on.
  <details><summary>Technical</summary>

  `QuestionRows.tsx:80` drops the option equal to `done` from a went-ahead row, so agreeing is only possible in words, and `differs` opens a follow-on for any words not equal to the label. Add a "Keep <done>" choice that answers with the `done` label. Answers T37.

  </details>
- [ ] Accept a second late answer and rewrite the open follow-on with it.
  <details><summary>Technical</summary>

  ADR decision 8 (a second answer updates the follow-on, test-plan A23) is unreachable: `applyAnswer` (`answer.ts:17`) and `answerOneQuestion` refuse an `answered-late` question. Allow a further answer on `answered-late` (keep `answered` refused), record the new answer, and let `openFollowOnOnTrunk` update the draft (it already does when the brief is still `draft`). Answers T38.

  </details>
- [ ] Count a landed follow-on as closed and an unreadable one as open, and stop the release step from being switched off.
  <details><summary>Technical</summary>

  `follow-on-refusal.ts`: `plans land` never writes `landed` into a brief; it merges with the subject `Merge <branch>: <plan> landed` (`plans/land.ts:110`). `openFollowOns` takes a `landed(name)` predicate; the CLI passes one reading the trunk's log for that subject. A brief whose frontmatter does not parse but carries a `follow_on_of:` line counts as open with status `unreadable` (today `catch { continue }`). Drop `superseded` from `CLOSED` (the brief names landed, abandoned or archived). In `lib/checks/steps.ts`, refuse `release_follow_on: false` when read, naming the key: only the release placement is built, so `false` only switches the promise off. Answers T39.

  </details>
- [ ] Make the release read the trunk's planning folder, where follow-ons are written.
  <details><summary>Technical</summary>

  `bin/commands/release.ts:52,56` read `getPlanningDir(root)` with `root` the checkout's toplevel; the opener writes to `bookkeepingRoots(anyCheckout).trunk`. Use the trunk in both calls. Answers T40.

  </details>
- [ ] Hold the question rows' looks by what they draw, and correct the live check's row to what it checks.
  <details><summary>Technical</summary>

  T22's file (`apps/indusk-admin/src/__tests__/question-looks.test.ts`) checks approvals, stories and the lint, and renders nothing. Add `QuestionRow.looks.test.tsx` in the admin's browser project (Chromium): render each story, assert the expensive row's computed colour is the foundation's bad colour and it shows no time, the cheap row shows its time left, the went-ahead row shows `done`. Change T22's `Asserts` text to what its file checks (approvals recorded, stories present, lint clean); the by-value check against the served admin stays `indusk looks check admin` at landing. Answers T41.

  </details>

#### Build Phase 8 Verification

- [ ] Each hypothesis above fails before its fix and passes after it, and the earlier rows of this plan still pass.
  <details><summary>Technical</summary>

  T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, T39, T41: `indusk plans tests decisions-as-questions --phase "Build Phase 8"`; T1 to T25 stay green (`indusk plans tests decisions-as-questions --landing` minus the system tier).

  </details>
- [ ] The release refuses from a linked worktree, run once here.
  <details><summary>Technical</summary>

  T40 is in the `SYSTEM` array: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/release-follow-on.test.ts`.

  </details>

#### Build Phase 8 Context

- [ ] Add to the question rules that every question reaches an outcome without anyone looking, and that a step is told any outcome its session never heard.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/questions/CLAUDE.md` (area tier): the session holding a timed question runs its timer and an admin read is only the catch-up; a send that fails because the request was answered changes nothing; a went-ahead nobody heard is `told: false` and is told on the next step. Guard: T28 and T30 carry `clause: the-cost-sets-the-wait/the-setting-decides`.

  </details>
- [ ] Add to the hooks' rules that the never-silent check judges added lines outside quotes, and is kept equal to its library port.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: the wording set and the list rule live in the hook and `lib/questions/silent.ts`, changed together; guard: `silent-parity.test.ts` (T35, T36) carries `clause: a-decision-is-a-question/never-decided-silently`.

  </details>

#### Build Phase 8 Document

- [ ] Correct the work skill's reference page, which still says an unattended build never asks.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/skills/work.md:265` says a build "does not ask" and that a question is answered with "decide on your own judgement and record why". Rewrite to match `skills/work.md`'s Unattended section: a choice is asked with `ask_decision`, cited as `question: <id>`.

  </details>
- [ ] Say in the questions guide and the release reference what the fixes change.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/questions.md`: a timed question goes ahead on time whether or not the admin is open; a went-ahead row can keep what was done; a second late answer rewrites the follow-on. `apps/docs/src/reference/cli/release.md`: a landed follow-on is closed; the step cannot be switched off; the release reads the trunk's planning folder.

  </details>

#### Build Phase 8 hunt record

Choices this hunt made with no one to ask (`INDUSK_GATE_POLICY=auto`; the installed indusk in this session has no `ask_decision` tool, so none could be asked as a question):

1. **`release_follow_on: false` is refused rather than kept as an off switch.** Reason: the brief promises the release refuses while a follow-on is open, and the move to the pull request the ADR allows is not built, so `false` can only switch the promise off. The person may prefer to keep the switch; that changes a config surface, not the brief.
2. **`superseded` stops counting as closed.** Reason: nothing writes it into a follow-on, and the brief names landed, abandoned or archived.
3. **T22 is corrected to what it checks, and a new row checks the looks by value in the admin's Chromium test project.** Reason: the by-value check against the served admin needs a built Storybook and a running daemon; the component test needs neither and fails when a row is drawn wrong.

Every audit finding was checked against the code. All were confirmed except the two below, which no row covers and for which no failing input formed:

- **The planning run's held stop is recognised by its wording** (`build-host.ts`, `ASKED_A_QUESTION`). The package writes the words and the admin matches them. No other stop reason contains them today. Fragile, but no input breaks it.
- **The per-cost wait is machine-wide** (`session/limits.ts`). It is intended, beside `sessions.max`.

Searched without a hypothesis forming:
- **The cost and deadline rules** (`cost.ts`, `deadline.ts`): an unknown `changes` value is refused at ask (`ask.ts` `optionsOf`); an option that changes what was agreed is never due under any setting or stored deadline; a stored `null` is never re-read from settings.
- **Repeated replies to one request**: `SessionManager.reply` refuses a second answer to the same request, so a person and the sweep cannot both reach the session (the record side is the T30 fix).
- **Question ids**: one build or planning session per plan, so `nextQuestionId` has no concurrent caller.
- **Landing**: `plans/land.ts` reads no question; T16 and T18 hold.
- **The dead-draft sweep**: `isFollowOn` reads the frontmatter as lines, so an unparseable follow-on is still kept.

Not investigated, with reasons:
- **Workbench layouts for the release and the opener**: both resolve the trunk through `bookkeepingRoots`, and the T40 fix makes them share it. A workbench run of the release was not traced, because no workbench project uses follow-ons yet.
- **How long `claude -p` keeps a permission request open**: whether a very long timed wait outlives the CLI's own limits can only be learned from a real run. T26's procedure covers a timed question.
- **The follow-on name colliding with an unrelated draft named `<plan>-q-<n>`**: the opener would overwrite it, but a hand-made plan with that name is improbable. Not authored.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/questions/` | new: record, cost, deadline, sweep, history, follow-on |
| `apps/indusk-mcp/src/lib/session/{protocol,manager,permissions}.ts`, `question-wait.ts`, `lib/build/build-session.ts` | question fields on the event; the `ask_decision` tool; the build path records instead of refusing; stop, free, resume |
| `apps/indusk-mcp/src/lib/planning/archive-dead.ts` | a follow-on is never dead-archived |
| `apps/indusk-mcp/vitest.tiers.ts` (and the admin's) | the live checks listed in `SYSTEM` |
| `build-session-gates.test.ts`, `lib/session/protocol.test.ts` | updated: they pinned the old refusal |
| `apps/indusk-mcp/src/lib/plans/waiting.ts` | list a plan waiting on a held question with no timer |
| `apps/indusk-mcp/src/lib/release/{run,follow-on-refusal}.ts`, `build/release-config.ts` | the refusal and its workflow step |
| `apps/indusk-mcp/src/lib/config.ts` | the three per-cost wait keys, default `hold` |
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
10. **Question rules go in `lib/questions/CLAUDE.md`, not the package's `CLAUDE.md`** (Build Phase 1). Reason: the package file is 29 KB against a 16 KB nested budget and the budget hook refuses any edit that grows it; the area file is where the rule is read when the code is. Later phases that say "record in `apps/indusk-mcp/CLAUDE.md`" for question rules use that file the same way.
9. **Added by the plan review** (`plan-review.md`): `ask_decision` (ADR decision 12), the build path, the dead-draft exemption (ADR decision 13), T23, T24, the hook's id check, real tier paths, no dry-run flag, mockup paths.
