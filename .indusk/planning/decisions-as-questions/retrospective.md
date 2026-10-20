---
plan: decisions-as-questions
date: 2026-10-19
status: landed-open
---

# Retrospective — decisions-as-questions

## What We Set Out to Do

An unattended session asks each choice the plan does not settle as a question the person can see, with its options, a recommendation and a cost. Each cost has a setting (`hold`, minutes, or `immediate`; `hold` by default) that says what an unanswered question does. A question that would change what was agreed always holds. A late answer that disagrees opens a draft follow-on plan, and `indusk release` waits for it; landing never does. The brief is the source of the expectations and promises; the ADR is the source of the decisions.

## What Actually Happened

- Build: 8 build phases plus 2 test phases were closed. Phase 8 was the falsification phase: the audit found that a timed question only went ahead when someone opened the admin, that an answer to a question whose session had died was refused with a 409, and that the never-silent check judged the plan's own quoted phrase as a break. Phase 8 fixed each (see the audit disposition below).
- Diff against `main` at close: 126 files, +6481 / −234 lines (includes the Phase 8 fixes and the plan's own documents).
- Landing test set (`indusk plans tests decisions-as-questions --landing`, run before the merge): every row and Must-not-break test file passed; exit 0. The one row it does not run is T26, the live check, which is manual by design.
- Trajectory audit (`auditPlanAtClose`): no blocked rows, no non-terminal rows. One deferred row, T26 (every clause upheld by a real run), classified `downstream-plan` with no warning: its mitigation is that `promises confirm` refuses until the real runs report.
- Ritual gate (`checkRetrospectiveReadiness`): passes. Falsification ran as Build Phase 8; cleanup skipped with a reason recorded in the impl's frontmatter; audit exists (`audit.md`).
- Promise confirmation did NOT pass. `indusk promises confirm decisions-as-questions` refused with 34 refusals and wrote nothing. See Choices below.

## Getting to Done

- The hunt in Build Phase 8 was the most valuable part of the plan. Every serious finding was about a path nobody watched: an admin that was closed at a deadline, a session that had died, a restart at the session limit, a release run from a worktree. The happy path had tests; the failure paths did not.
- The question-row looks test (T22) checked approvals and story presence, not rendered output. Phase 8 added a Chromium component test (T41) that renders the rows and asserts their colour and text.
- The Chromium admin project has 48 browser tests in files this plan did not touch that fail in this session with `container` undefined. Not caused by this plan; recorded in Phase 8's verification note.
- Shape review in Phase 2 and Phase 5 found one issue each, both fixed in place (see the Shape numbers below).

## Audit disposition (audit.md)

Every audit finding was checked against the code in Phase 8's hunt record. Status now:

- Fixed in Phase 8: lost answer to a dead session (T29); restart refused at the session limit being swallowed (T31, T32); decision card offered the first option as primary (T33); a history-write failure telling the session to decide silently (T34); the never-silent check matching its own quoted phrase and missing other wordings (T35, T36); a second late answer unreachable (T38); the landed follow-on still blocking and an unreadable one passing (T39); `superseded` counted as closed and `release_follow_on: false` as a switch (refused, T39); the release reading the wrong planning folder from a worktree (T40); the looks test rendering nothing (T41).
- Fixed at close: ADR Alternatives Considered still listed "Stop on every question" and "A new answering surface" as rejected. Both are marked as amended in the ADR (the default is hold for every cost; the admin has a second answer route that offers the same answers as the decision card). The ADR now says what the code does.
- Not fixed, recorded for the next plan:
  - `planning-runner.ts:66` and `build-host.ts` (`ASKED_A_QUESTION`): a held planning-run stop is recognised by its wording. No input breaks it today; no row covers the planning path.
  - `waiting.ts` and `question/route.ts`: the admin has two answer surfaces for a question whose session is waiting (the question row and the decision card, which is now hidden for recorded questions). The second route is reachable but was not removed.
  - T20 (`questions-live.test.ts`): the live check runs a scripted child and calls `planWaiting` directly. It never exercises the admin's reader or routes.
  - `session/limits.ts`: the per-cost wait is one machine-wide setting, beside `sessions.max`. Intended; the test plan's wording "the project sets" is loose and should say "the machine sets".
  - The workbench layouts for the release and the follow-on opener were not traced; no workbench project uses follow-ons yet.

## Choices made on this run (no one to ask)

Each choice below was taken on the run's own judgement because the gate policy was `auto` and no question could be put to a person. Each is recorded here with its reason.

1. **Promise confirmation not forced; the plan lands open.** The 34 refusals are two kinds. (a) Test files a row names do not carry `promise:` or `clause:` tokens, and no code site carries the state-promise tokens. Adding those tokens to tests the audit called narrow (T15, T12, T20, T22) would claim proof those tests do not give, so I did not tag them in this close. (b) The clause signals (`the-cost-sets-the-wait`, `a-decision-is-a-question`, and others) have to be reported upheld by a real run, which is T26: the installed build, the local daemon and a real run, which the person said will happen after landing. Reason: the registry must not be made to pass by tagging tests that do not prove the promise, and the real-run signal cannot be produced inside this close. Consequence: the plan's three promises stay `declared`, so `plans archive` refuses (by design). The plan is landed but open until T26 passes and `promises confirm` runs; the archive and the landing-line append follow then. Follow-on: add the `promise:`/`clause:` tokens and the code-site comments in a plan of their own, reviewed against each row.
2. **No publish.** The project's `workflow.steps.land.install` is declared (`pnpm install:local`), so the build reaches this machine by install and publishing is the operator's deliberate call. Reason: the retrospective's Step 11 rule for projects that install their own build. No version bump was made; the version stays as it was.
3. **Architecture note on the ADR.** The ADR's Alternatives section was edited at close (not a new decision) to match what the code does.
4. **Docs.** The decision page (`apps/docs/src/decisions/decisions-as-questions.md`), its sidebar entry and the questions guide already exist from Phases 6 and 8; no new lessons page was written. Reason: the reusable insights are carried as highlights for the eval agent, not as a docs page.

## Shape numbers

- Findings raised by the Shape step across the build phases: 2 (Phase 2: `keep` carried the session onto only the timed case, fixed in place; Phase 5: two uses of width classes flagged by the looks lint, fixed in place to the foundation's width).
- Of those, judged wrong by a human: 0. Caveat: no person reviewed the build (the run had no one to ask), so 0 is the absence of a judgement, not a judgement that the findings were right.
- Process note: both findings were fixed in place rather than written as unchecked items, which is what the Shape step asks for only when a finding is left open. The impl's Shape lines should say so.
- Not a streak: this is the first plan in the record with a human-judgement count of 0 of 2.

## Quality audit

- The looks lint caught the Phase 5 width classes; no new Biome rule is needed for that.
- `pnpm check` was not run as part of this close. The landing test set passed. Recorded as not run.

## What We Learned

- A timer that only runs when a page renders is not a timer. The sweep ran from the admin's read path, so a timed question with no browser open held its slot forever. The fix runs a timer in the session that holds the question.
- An answer to a question whose session has ended must be kept. Refusing it with a 409 lost the person's answer; the fix records the answer and restarts the run.
- An approval is not a render. A looks test that checks that stories exist and approvals are recorded proves nothing about colour or text; a component test that renders the row does.
- A registry check that reads tokens in test files only works if the tokens are in the tests that prove the promise. Tagging tests that merely run near the promise defeats the check's purpose.

## What We'd Do Differently

- Run a "fails before" check for each Phase 8 hypothesis. Phase 8 wrote the fixes and their tests together; the rows go red by construction for most, but nothing ran them against the old code.
- Put the promise tokens and the code-site comments in the test-authoring phase, not at confirmation. The 34 refusals were all knowable when the rows were written.
- Name the failure paths in the trajectory from the start. Phase 8 found more than Phases 1–7 did, and every one was a path the trajectory did not cover.

## Insights Worth Carrying Forward

- A timed decision must be enforced where the session holds it, with the read path as catch-up only.
- A process check that judges a document must judge what was added, not the whole document, or the plan's own description of the rule trips it.
- Rows that name a library function instead of the path a person takes prove the function, not the feature. The audit found four rows of this kind.

## Landing

- Archive: deferred. Declared promises block `indusk plans archive` by design; the archive happens after `indusk promises confirm` passes at the live check (T26).
- Landed on main: see the line appended below when the merge completes.
