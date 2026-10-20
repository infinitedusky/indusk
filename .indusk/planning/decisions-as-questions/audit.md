---
plan: decisions-as-questions
audited: 2026-10-19
model: claude-opus-5-5
---

# Audit — decisions-as-questions

## Does each row prove its promise's sentence, or something narrower?
- `apps/indusk-mcp/src/lib/release/follow-on-refusal.ts:22` — T15 is the trajectory row for clause `release-refuses`: a release refuses while a follow-on is open, and goes ahead once each is landed, abandoned or archived. The test proves this only for briefs whose frontmatter says `status: landed` or `abandoned`, written by hand in the fixture. Nothing in the package writes `landed` or `abandoned` into a brief. `plans land` leaves the plan folder in `.indusk/planning/` with its brief still `accepted`, so in use a follow-on counts as closed only once its retrospective archives it.
  - breaks when: a follow-on is accepted and landed through `plans land`, and its retrospective has not yet archived it. The release keeps refusing and names a plan that has already landed.
  - answer: nothing — real: `plans land` never writes `landed`, so a landed follow-on blocks until archived; not acted on, as this unattended audit was told to record findings only; for /falsify.
- `apps/indusk-mcp/hooks/validate-decided-unattended.js:30` — T3 is the row for clause `never-decided-silently`: a session never records a choice as decided unattended without asking it as a question. The test proves only that the exact phrase "decided unattended" needs a `question: <id>` on the same line or the next. Any other wording gets through. So does one reference placed on a heading that covers a numbered list of several choices.
  - breaks when: an unattended run writes "Each decision was made unattended", which is the wording of this plan's own ADR (Decision section, line 44). It also breaks when a run writes a "Decided unattended" heading carrying one `question:` reference above five numbered choices. Both saves go through.
  - answer: nothing — real: the save check matches one phrase and one reference per line; not acted on (record only); /falsify should test other wordings and multi-choice lists.
- `apps/indusk-mcp/src/lib/questions/answer.ts:17` — T12 is the row for clause `disagreement-opens-a-plan`: a late answer that differs from what was done opens one draft follow-on. Its claim that "a second answer to the same question opens none more" (ADR decision 8: a second answer updates that plan) is proved only by calling `openFollowOn` directly. In use, `applyAnswer` and the admin's `answerOneQuestion` refuse any answer to a question already in state `answered-late`. The update path is never reached, and a person who changes their mind cannot record it.
  - breaks when: the person answers a question that went ahead with "b", then answers again with "c". The second answer is refused with "already answered", and the follow-on's brief keeps "b".
  - answer: nothing — real: a second late answer is refused before the update path runs, so ADR decision 8's update is unreachable; not acted on (record only); for /falsify.
- `apps/indusk-admin/src/__tests__/question-looks.test.ts:36` — T22 is the row for the three new question-row looks plus `plan.needs-you` and `nav.expanded`. It asserts the looks "render as the approved looks, held by value in Chromium". The file renders nothing. It checks that the approvals are recorded, that the story exports exist and that the looks lint is clean. It never touches `plan.needs-you` or `nav.expanded`.
  - breaks when: `QuestionRows` stops drawing an expensive row in red, or drops a cheap row's time left. T22 still passes.
  - answer: nothing — real: T22 checks approvals and stories exist but renders no look; not acted on (record only); /falsify should confirm the looks check covers these rows.
- `apps/indusk-mcp/src/__tests__/questions-live.test.ts:91` — T20 is a live-check row naming clause `never-decided-silently`, promise `decisions-wait-in-one-place` and promise `a-build-runs-to-review-unasked`. It runs a scripted child that writes no plan document, so it asserts nothing about choices recorded in documents. It checks Needs you by calling `planWaiting` directly, never through the admin's reader or routes.
  - breaks when: a real run records a choice in a document in a form the save check misses, or the admin's reader stops listing a held plan. T20 still passes.
  - answer: nothing — partly by design: a scripted child stands in for the model in a live check, and the document wording is T3's to prove; the admin-reader gap is not acted on (record only).

## What does the diff change that no row touches?
- `apps/indusk-admin/src/lib/question-answer.ts:60` — A question on a set time keeps its session's id. An answer is first sent to that session through `sessionManager().reply`, which throws `no session … is running` once the session is gone (`session/manager.ts:368`). The answer is never recorded. When the deadline passes, `sweep` marks the question `went-ahead` with the recommendation as "done", even though no session received it. `untold()` only replays `answered` questions, and nothing restarts the run.
  - breaks when: the admin restarts, or the step's `claude` process dies, while a cheap question with a 60-minute setting is waiting. The person's answer is refused with a 409. Later the row says it went ahead with the recommendation, but no work continued.
  - answer: nothing — real and the most serious finding: an answer to a timed question whose session died is lost, and the sweep later reports a go-ahead no run made; not acted on (record only); /falsify first.
- `apps/indusk-admin/src/lib/question-answer.ts:76` — After a held question is answered, the plan is taken out of the question waits and `startBuild` is called. `admitBuild` throws at `sessions.max`, and that throw is swallowed (the decision-card path in `lib/decisions.ts:165` lets it escape after the answer is already recorded). The question now reads `answered`, so `planWaiting` no longer lists the plan under Needs you, and no queue retries the start.
  - breaks when: the machine is running `sessions.max` sessions when the person answers. The run never resumes, and nothing tells anyone it is waiting.
  - answer: nothing — real: a restart refused at `sessions.max` is swallowed and the plan leaves Needs you; not acted on (record only); for /falsify.
- `apps/indusk-mcp/src/lib/plans/waiting.ts:174` — While a session waits on a question with a set time, it still has a pending request. `askedOf` therefore lists the plan first and the plan page renders the old `DecisionCard` (`page.tsx:204`). That card's primary button is `options[0]`, not the recommended option, and it shows no cost, reason or time left. The question row is drawn again below it.
  - breaks when: the agent lists its recommended option second, and the person clicks the card's first button thinking it is the recommendation.
  - answer: nothing — real: the old decision card shows beside the question row with the first option as its primary button; not acted on (record only); for /falsify.
- `apps/indusk-mcp/src/lib/build/build-session.ts:296` — If a question cannot be written to the plan's history, it is refused. The session is told to "record the choice and its reason in the plan and say plainly that it could not be asked". That is a choice decided without a question.
  - breaks when: the history write fails, for example on a lock or a commit error on the trunk. The agent is told to decide silently, and the save check then refuses the line or the agent rewords it to get past.
  - answer: nothing — real: on a failed history write the session is told to decide unasked, against clause `never-decided-silently`; not acted on (record only); for /falsify.
- `apps/indusk-mcp/src/lib/build/planning-runner.ts:66` — A held question in a planning run comes back as a `cannot-continue` stop. The admin recognises it, both to free the slot and to resume, only because `why` contains the words "asked a question" (`build-host.ts`, `ASKED_A_QUESTION`). T20 runs only the build's `work` step, so no row covers the planning path.
  - breaks when: the stop's wording changes, or another cannot-continue reason contains "asked a question". The planning run is then not resumed by the answer, or is resumed when it should not be. Meanwhile the plan reads "cannot continue" rather than waiting on a question.
  - answer: nothing — real: the planning run's held stop is recognised by its wording; not acted on (record only); for /falsify.

## What does the code do that the brief never promised?
- `apps/indusk-mcp/src/lib/release/run.ts:109` — Setting `workflow.steps.release_follow_on: false` turns the refusal off entirely. The brief promises that a release refuses while a follow-on is open. ADR decision 11 (the release refuses; landing never does) lets the wait move to the pull request, but does not let it be switched off.
  - breaks when: a project sets the key to `false`. A release publishes with follow-ons open, and nothing anywhere waits for them.
  - answer: nothing — real: the switch turns off what the brief promises, past what ADR decision 11 allows; not acted on (record only); the person decides whether it stays.
- `apps/indusk-mcp/src/lib/release/follow-on-refusal.ts:22` — `superseded` also counts as closed, beside landed, abandoned and archived.
  - breaks when: a follow-on's brief is marked superseded. The release goes ahead although the late answer it carries was never acted on.
  - answer: nothing — real but low risk: nothing marks a follow-on superseded today; not acted on (record only).
- `apps/indusk-mcp/src/lib/session/limits.ts:37` — The per-cost wait is read from the InDusk home's `config.json`, so one setting covers every project on the machine. The test plan speaks of the setting as one "the project sets".
  - breaks when: one project sets `cheap: "immediate"`. Every other project's cheap questions then also go ahead at once.
  - answer: nothing — intended: the wait sits in the home config beside `sessions.max`, which also governs every project on the machine; the test plan's "the project sets" is loose wording.

## Which rejected ADR alternative does the code quietly take?
- `apps/indusk-mcp/src/lib/questions/deadline.ts:28` — "Stop on every question" is still listed as rejected under Alternatives Considered, on the grounds that the first expectation (runs stop less) fails. With nothing set, every cost reads `hold`, so every question stops its session. This came from the amendment to decision 4 and the brief's `holds-by-default`, not silently. The ADR's rejection was never withdrawn.
  - breaks when: a project leaves `sessions.question_wait` unset. The first expectation (fewer stops for the person than questions asked) cannot be met.
  - answer: nothing — the person chose this default in the amendment (clause `holds-by-default`: answer everything first, then automate); the ADR's Alternatives text is stale, not the code; the retrospective should update it.
- `apps/indusk-admin/src/app/api/plans/[name]/question/route.ts:22` — "A new answering surface" was rejected: answers were to come through Needs you and the existing decision card. The code adds a second answer route and a separate `QuestionRows` block on the plan page. `DecisionCard` is unchanged, and it is hidden for held questions.
  - breaks when: a session is waiting on a question with a set time. The page offers two controls for the same question, through two routes that word and record the answer differently.
  - answer: nothing — real: a second answer route and row block sit beside the unchanged card; overlaps the decision-card finding at `waiting.ts:174`; not acted on (record only); for /falsify.

## What let these through?
- Rows proved a clause by calling a library function or a hand-set fixture state instead of the path a person or the package takes — findings: follow-on-refusal.ts:22 (T15), answer.ts:17 (T12), questions-live.test.ts:91 (T20), question-looks.test.ts:36 (T22) — highlight: h-20261019-039
- The trajectory covered a question's happy path and none of its failure paths — findings: question-answer.ts:60, question-answer.ts:76, build-session.ts:296, planning-runner.ts:66, waiting.ts:174, validate-decided-unattended.js:30 — highlight: h-20261019-040
- The brief's amendment was not carried back into the ADR and its config switches — findings: deadline.ts:28, run.ts:109, follow-on-refusal.ts:22 (superseded), question/route.ts:22 — highlight: h-20261019-041
