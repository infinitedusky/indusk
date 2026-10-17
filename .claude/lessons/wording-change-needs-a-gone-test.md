# A plan that retires wording scopes by grepping the old phrase repo-wide and carries a grep-is-gone row in Test Phase 1

The plan impl-tasks-are-instructions retired the old wording for what an impl task is. It listed the files to change from memory and missed the bugfix and refactor templates, shape.ts, hook messages and three docs pages. Only the audit step caught it.

Why it matters: wording lives in templates, validators, hook messages and docs as well as the files a planner remembers. A scope written from memory is a guess. A test that proves the old phrase is gone makes the scope checkable.

How to apply: when a plan retires or changes a phrase, (1) grep the old phrase repo-wide at research and scope the plan from the matches, not from memory, and (2) add a grep-is-gone row to Test Phase 1 that fails while the old phrase remains anywhere outside the record (archives, ADRs). Related: a-promise-worded-wherever-gets-a-row-for-every-render-site-found-by-grep and redaction-commits-need-a-repo-wide-grep-not-a-plan-scoped-one. Source: highlight h-20261017-012, plan impl-tasks-are-instructions.
