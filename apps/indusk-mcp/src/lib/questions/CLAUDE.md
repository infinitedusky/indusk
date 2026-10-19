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
