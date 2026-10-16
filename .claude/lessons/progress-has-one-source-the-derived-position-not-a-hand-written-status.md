# Read a plan's progress from the derived plan position, never from the impl's hand-written status: word — status: is the author's declaration

When progress is stored twice, the impl's hand-written `status:` word and the derived plan position, any reader of the first trusts the agent to have edited it, and the nav and the plan page then disagree. Read progress from the derived position; keep `status:` as the author's declaration only.

Why: found in the nav-stage-matches-plan-page retrospective (2026-10-16). The audit turned up two more readers of the status word that the brief had missed, so the fix needs a grep for every reader of the field being replaced, not only the one that showed the bug (see the lesson on finding every reader of the question, not every reader of the data).

How to apply: before writing a brief or a fix for a progress or stage display, list every reader of `status:` and move each to the derived position. Do not add a second hand-edited field. Pointer: nav-stage-matches-plan-page plan, its retrospective and audit.
