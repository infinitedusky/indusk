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
