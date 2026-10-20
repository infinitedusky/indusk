# lib/questions — rules for working here

Loaded by Claude Code when a file under `src/lib/questions/` is read
(decisions-as-questions, 2026-10-19).

- **This folder is the one home of the question rules.** The cost is fixed by
  `effectiveCost` from what an option declares it changes, never by the agent
  and never by a screen; `changesAgreed` is true for the same questions and
  overrides every setting. Whether a question holds is read from
  `sessions.question_wait.<cost>` (`readQuestionWait`; `hold`, a whole number
  of minutes or `immediate`; nothing set holds) and a bad value throws naming
  the key. — see `/decisions/decisions-as-questions`
- **The deadline is stored when the question is asked, never counted**: a
  restart or a later setting never gives more time, and a down admin sends a
  question ahead late, not early. A timer only picks the recommended option; it
  never approves a brief, a test plan, a look or an ADR.
- **Every question is kept in the plan's history in all four states**, through
  `plans/history.ts`'s `appendHistoryLine`, the one writer of that file.
- **A plan waiting on a held question holds no session slot.** A question that
  holds ends its run, so `SessionManager.holdQuestion` takes the plan out of the
  set `capRefusal` counts; one on a set time keeps its session and its place.
  `runningCount` (`session/question-wait.ts`) is the one count `sessions.max`
  reads. — guarded by `question-wait.test.ts` (`promise: sessions-are-capped`)
- **A choice is asked through `ask_decision`, never `AskUserQuestion`, in an
  unattended run**: `protocol.ts` turns its permission request into a `question`
  event marked `decision`, `build-session.ts` records it (`decision-request.ts`)
  and a plain question is refused naming the tool. A conversation session's
  question is unchanged.
- **Each of this plan's clauses is reported by the place that decides it**,
  through `signals.ts`'s `reportClause` (best-effort, one span per decision, the
  commands' one tracer): its header lists which file reports which clause. A new
  place that decides one reports it there, and never lets a failed report fail
  the work. `silent.ts` is the TS port of the save-time hook's rule —
  `silent-parity.test.ts` holds the two equal. — guarded by `signals.test.ts`
- **Every question reaches an outcome with nobody looking, and a step is told any
  outcome its session never heard.** The session holding a question on a set time
  runs its own timer (`due-timer.ts`, set in `build-session.ts`) and sweeps at the
  stored time; the admin's read-time sweep is only the catch-up for a session that is
  gone. A send that fails because the request was already answered changes nothing
  (the person's answer won); a go-ahead whose session is gone is `told: false` and is
  told on the next step (`untold`). A session that ends no longer holds its questions
  (`session` is dropped), so the plan lists under Needs you. A question that cannot be
  kept stops the step (`question-unkept.ts`); the session is never told to decide it.
  — guarded by `due-timer.test.ts` (T28), `sweep.test.ts`, `answer.test.ts` (T30)
  (`clause: the-cost-sets-the-wait/the-setting-decides`)
