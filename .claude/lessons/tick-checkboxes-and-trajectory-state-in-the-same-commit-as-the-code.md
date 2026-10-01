# Check off impl checklist items and update trajectory State in the exact same commit as the code that makes them pass — never in a later commit, and never just in the commit message

During release-ritual, a commit message said "T8, T9 pass" but the impl's trajectory table still said `planned` for those rows — the checkboxes and State column weren't updated in that commit. A session resuming on another machine read the stale table as ground truth (reasonably — see [[verify-trajectory-state-against-the-pre-fix-source-not-the-table]]) and burned a whole session chasing a false test-first violation that was purely a bookkeeping lag.

Why it matters: a commit message is not machine-readable state and isn't guaranteed to be read by whoever resumes the work next — especially across machines, where the next session's context comes from current.md and the plan documents, not from scrolling commit messages. The trajectory table and checklist are the canonical state; if they lag the actual code by even one commit, any resuming session (or auditor) is working from stale ground truth.

What to do instead: when a commit makes a trajectory row's tests pass, check off the corresponding checklist item AND flip that row's State column to `passing`/`done` in the exact same commit — not "I'll update the table next commit," not "the message says it passed." Treat the table update as part of the code change, not a follow-up.

Related, same retrospective: a plan that goes brief → impl directly (skipping the test plan a workflow type requires) creates a visible gap the admin now surfaces (see admin-plan-type, which this exact gap motivated) — write the test plan the declared workflow type requires, don't skip stages even under time pressure.

See `.indusk/planning/release-ritual/` retrospective and `.indusk/planning/admin-plan-type/`.
