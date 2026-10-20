# A run can be trusted — what a run says about itself

**Status:** accepted (2026-10-19)
**Full impl:** `.indusk/planning/archive/a-run-can-be-trusted/impl.md` (its "Decisions made while writing this plan" lists the twelve decisions in full)

## What was decided

- **A run is a record on disk.** Each build, planning run and release writes one record per plan and kind in machine state. A dead process reads as stopped, with its reason. Build restarts a dead run from the step the plan's documents say is next, not from the record.
- **Pure rules in the package, wiring in the admin.** Which step restarts, which phase shows, whether a release landed, and the situation sentence are functions over inputs (clock, process reads, git). The admin only supplies the reads and writes the record.
- **A release or plan reads landed from trunk.** Landed means the landing merge on the trunk or the archived folder there, never whether a branch is contained in `main`.
- **The shell guard refuses writes to plan documents, and judgement lives outside the hook.** The guard records each decision; a package drain judges it against the on-disk change and a parsed command. A hook never returns a verdict on itself.
- **An impl for a clause-bearing brief names each clause's signal.** Checked through `indusk promises contract`, not a second reader in the hook.
- **Approval is offered only for a plan review whose hash matches the documents.** One reader serves the admin, the approval command and the planning run.
- **The recorder landing test waits for its incident.** It waits on a scan record the loop writes, not a fixed minute.

## Rejected

A verdict written by the hook itself (it can never read broken). A branch-containment check for "landed" (a branch made from `main` with no commits passes it). A second hand-written shell parser (the plan uses `shell-quote`). A fixed one-minute wait in the recorder test.

## What falsification changed

Twenty-five audit findings became hypotheses A91–A103 in Build Phase 7. Several were real: a stopped sentence that stayed "stopped" after approval, a merged plan that claimed everything was confirmed when its list was unread, a landing read from the wrong branch, a build pressed twice, and a self-reported verdict in the clause-signal rules that departed from the no-self-verdict decision.

## Key tradeoffs accepted

- The shell guard catches a script's writes only after the fact: a script file whose text names no plan path is detected by the on-disk comparison, not prevented.
- Every `indusk` command drains the guard's pending decisions, at most once a minute; the export latency is not yet measured.
- Git commands that move a checkout between committed states (`git merge`, `git pull`, `git checkout <branch>`, `git reset --hard`) are allowed, because they write no new plan-document text.
- A plan's impl rule never newly refuses an approved impl; the gap is caught at confirm time.

See also: [`indusk plans`](/reference/cli/plans), [`indusk promises`](/reference/cli/plans), and the [lessons](/lessons/a-run-can-be-trusted).
