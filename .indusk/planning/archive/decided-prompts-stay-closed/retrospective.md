---
title: "decided-prompts-stay-closed — Retrospective"
date: 2026-10-15
---

# decided-prompts-stay-closed — Retrospective

## What We Set Out to Do

Stop the cockpit's session panel showing Allow/Deny prompts that nobody needs to answer. A build answers its own requests in code, but nothing told the panel, so every one stayed open, and a reload reopened even the ones a person had answered. The brief made two promises: `a-prompt-shows-only-when-a-person-must-choose` (a prompt's buttons show only for a request waiting on a person) and `a-decided-request-stays-decided` (every request is in the log, and once decided it shows its outcome, including after a reload).

## What Actually Happened

The branch touched 23 files (+895/−218), 20 of them under `apps/` (+748/−185), across Test Phase 1 and four build phases.

- **Build Phases 1–2 went as planned.** The session manager records a `decided` event after every decision, whether by the session's rule or by a person, and keeps a planning session's rule-allowed requests in the log rather than dropping them. The panel and the new-project thread read a request's state from that event. The live check of a real build (`cockpit-audit-fixes`) saw requests rise from 1 to 23, every one "Allowed", and 17 of 17 still decided after a reload.
- **Falsification (Build Phase 3) found two gaps the tests had passed.** A person's answer to a question was recorded only as "allowed", so after a reload the question showed every option disabled and nothing chosen: the outcome was gone. And a click whose reply the server refused left the request with neither buttons nor an outcome, because the panel's own "answered" set was never undone. The `decided` event now carries the answers, and a refused reply reopens the request in the panel and the thread.
- **Cleanup (Build Phase 4)** made each piece written twice into one: `useAnsweredRequests` (a click closes a prompt, a refusal reopens it), `lib/request-decisions.ts` (`decisionsOf`, the one reader of a decision), and `QuestionView` in its own file, which took `SessionPanel.tsx` from 442 lines to 290.
- **The cold audit found two more defects, both fixed in Build Phase 4.** Each `decided` event drew an empty, gap-spaced row in the panel's log (row A12 now holds it), and the docs said the conversation thread shows outcomes, which it never did.

## Getting to Done

- Build Phase 1 assumed a draft's `transcript.jsonl` is written through the manager's `opts.onEvent`. It is written by a `subscribe` listener (`new-project-session.ts`). The outcome was right, since listeners hear every event, but the assumption was wrong and nobody checked it until falsification.
- The audit's reader could not confirm the live check, because its evidence is in the working impl, which the reader is not allowed to read. The evidence is there (Build Phase 2).

## What We Learned

- **A decision record must carry what the person chose, not only that they chose.** "Allowed" is the whole outcome of a tool request, but not of a question. The brief's wording ("allowed, or denied with the reason") was about tools and silently left questions out.
- **In the session manager, a starter that replies synchronously inside `onEvent` puts its decision ahead of the request for live listeners**, because `record` calls the starter before the listeners. The stored log is in order; a live stream is not. Every reader today builds a map first, so nothing draws it wrong.
- **A docs sentence about two surfaces needs a test for each.** The same phase wrote "in the panel and in the thread" and tested only the panel.

## What We'd Do Differently

- Read every kind of request a promise covers (tool, question, a person's reply, a rule's reply) against its wording at brief time. The answered-question gap was visible from the brief.
- Write a view's early-close state with its undo from the start. A local "answered" set that is never cleared is a second record that can disagree with the real one.

## Insights Worth Carrying Forward

- Falsification and the cold audit each found defects that every row and Shape had passed (Shape: 2 findings, both acted on, 0 judged wrong). On a UI that reads one record from two places, the close-out readers pay for themselves.

## Audits

- **Docs:** `apps/docs/src/reference/admin-ui/sessions.md` describes what was built: the outcome line is the panel's, the thread stops listing a decided request, and a refused click reopens the request. The admin and mcp `CLAUDE.md` entries match the code.
- **Tests:** the plan's rows pass: admin session, thread and turns tests 67/67, mcp `manager` and `build-session` 36/36. The root run is at landing.
- **Trajectory audit:** A1–A12 all `passing`; no deferred, blocked or non-terminal rows.
- **Quality:** the only recurring mistake was formatting, caught by `biome check`; no new rule is warranted. Shape: 2 findings (`decideByRule` extracted in Build Phase 1, `Replied` moved in Build Phase 4), 0 judged wrong by a person.
- **Open, not fixed here:** a build step's requests leave the log once that step's session ends, because the manager keeps a session's events only in memory and the events route returns 404 after it stops. "Stays done after a reload" holds while the step runs. Keeping a build's requests across steps needs a persisted build log, which is a new plan.
