# Before archiving a plan, ask "does this change how anything looks?" against the diff, not the brief — acceptance refuses "Looks: None" when interface files changed, and an archived plan cannot be amended

In decided-prompts-stay-closed, the brief said "Looks: None — no approved look holds the session panel". Approval allows "None — reason" (contract.ts:251); acceptance does not when the diff touches interface files (accept.ts:121), by design, because the diff proves a look changed. The retrospective had already archived the plan, and `plans amendments` / `reapprove` (amendmentsOf) read the approved brief at the archive path in the approval commit, which never existed there. The plan had to be moved back out of the archive, its brief amended to declare `agent-panel.decided`, re-approved by a person, accepted, and archived again.

Rule: at the close (before the retrospective archives), run the looks question against the diff: if any interface file changed and the brief says "Looks: None", amend the brief and get the look approved first. Judge "None" by whether a user sees something new, not by whether an approved look already exists for that screen.

Pointer: .indusk/planning/archive/decided-prompts-stay-closed/retrospective.md ("Getting to Done", "What We'd Do Differently"); commits 8bdc5f267 and d8356600a.
