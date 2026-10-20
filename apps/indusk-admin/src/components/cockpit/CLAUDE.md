# components/cockpit — rules for working here

Loaded by Claude Code when a file under `src/components/cockpit/` is read
(decisions-as-questions, 2026-10-19).

- **The admin never changes a question's cost.** `QuestionRow` and
  `QuestionRows` show `cost` as the package stored it; only
  `lib/questions/cost.ts` (`effectiveCost`) computes it, and the admin reads,
  never writes, except the reply, which goes to the plan's question route
  (`lib/question-answer.ts`). A question's time words come from `lib/question-view.ts`
  (`whenOf`), pure over the stored deadline. — guarded by `QuestionRows.test.tsx`
  and `question-view.test.ts`.
