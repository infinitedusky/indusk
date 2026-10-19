---
title: "A run can be trusted — Impl"
date: 2026-10-19
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
---

# A run can be trusted — Impl

## Goal

What an unattended run says about itself is true. The admin keeps each build, planning run and release as a record on disk and shows that record, so a run whose process died reads as stopped with its reason and Build starts it again from where the plan stands; the build controls name the phase the plan is really on; a release reads released only when the plan is on main; a shell command can no longer write a plan document around its checks; an impl for a brief with clauses is refused unless a task reports each clause's signal and no after-landing check is a clause's proof; the three clauses of `a-brief-is-accepted-on-current-main` report so that plan can close; approval is offered only for a plan review written for the documents as they stand; and the admin-recorder landing test waits for its incident instead of a fixed minute.

## Decisions made while writing this plan

This impl was written unattended (`INDUSK_GATE_POLICY=auto`): nobody could be asked, so each choice is the author's, with its reason. The person reads them at the single approval after this document.

1. **The rows for the first promise's later clauses follow the test plan.** The brief now states eight clauses under `a-run-is-read-from-its-record`, and the test plan has a section for each: `says-what-is-true` (A65–A68, a merged plan reading complete with its confirmation list among them), `never-in-progress-when-idle` (A69), `always-a-next-step` (A70, A71) and `the-planning-audit-is-a-step` (A72). An earlier draft of this impl invented rows A65–A68 for two of them; those are replaced by the test plan's, with the same IDs. All eight are built in Build Phase 2, where the plan page's situation words are built.
2. **Pure rules live in the package, wiring in the admin.** Which step a dead run restarts at, which phase to show, whether a release is landed and what the situation sentence says are inputs-in, answer-out functions in a new `apps/indusk-mcp/src/lib/run-record/` folder (the clock, the process reads and git are inputs, `lesson: code-that-decides-takes-its-clock-and-its-reads`), exported through the package's existing `build` export the admin already imports. The admin's `build-host.ts` only supplies the reads and writes the record. This keeps nearly every row a `unit` test that starts nothing.
3. **A run's record is one JSON file per plan and kind in machine state**, `<indusk eval home>/runs/<plan>.<kind>.json`, written whole by temporary file and rename, read by one reader that returns `unknown` for a missing, cut-off or unreadable file. It holds `{ plan, kind, step, phase, pid, startedAt, stop, stopReason, updatedAt }`. Machine state is outside the repository, so a record never shows as a change in the plan's tree (`/decisions/bookkeeping-lives-where-it-is-read`). The in-memory map in `build-host.ts` stays as a cache; the record is the truth and is read on every ask.
4. **"Is the process alive" is asked once, through `lib/process-identity.ts`'s `isOwnProcess`** with the pid, a marker the run recorded and the recorded start time. No second liveness check is written. The admin's own daemon process is the run's process (builds run inside the daemon), so after an admin restart the old pid is gone or recycled and every run it held reads stopped with the reason "the admin restarted while it ran" or "its process is gone"; a run owned by a still-living process reads running (A10 pins this).
5. **Build after a death asks the documents, not the record.** `startBuild` already picks the step from the plan's files through the existing next-step reader; the change is that a dead record no longer blocks it (the "already building" refusal reads liveness, not the record's `running` flag) and the phase shown is read from the plan every time (`nextBuildStep(readBuildPlan(...))`), never from the record's start-time phase. The record's `phase` field is history.
6. **A release reads released by git, not by the step's exit.** After the release step ends, the reader checks that the plan's branch tip is an ancestor of the trunk (`git merge-base --is-ancestor`); if it is not, the release reads stopped with `plans land`'s own refusal text if one was captured, else "the release ended but the plan is not on main".
7. **The shell guard is one new PreToolUse hook on Bash, `plan-write-guard.js`**, registered in `HOOK_REGISTRATIONS` under `["PreToolUse", "Bash", "plan-write-guard.js"]` only. It follows `looks-approval-guard.js`, the existing Bash write-refusal hook (a tripwire for an agent's ordinary attempt, reading command text, never a script's behaviour), and the test plan's Decision 8 list. It exports `refusalFor(command)` and runs its `main` only when executed, so the unit rows import it and the contract rows run it with a real payload. It takes no part in `trunk-guard.js`'s two-matcher rule: it guards a shell path only (Edit and Write already pass the plan's checks), so one matcher is the whole gate, and the hooks rule file says so.
8. **A hook cannot import the tracer, so its clause verdicts go through the same file hand-off the break inbox uses.** The guard appends one JSON line per decision that involved a plan path (`shell-write-refused` upheld on a refusal; `reads-pass` upheld on an allowed command that named a plan path) to `<machine state>/clause-verdicts.jsonl` through a new port `hooks/_clause-verdicts.js` (the hook-side twin of `lib/promises/clause-verdicts.ts`, pinned equal by the hook-shared-modules test as `_inbox.js` is). The package drains the file with `writeClauseSignals` at the start of any `indusk` command and each admin recorder tick, best-effort, deleting only what it sent. The **broken** side of these two clauses is not observable from inside the guard (it cannot see a write that got past it, nor a read a person abandoned after a refusal); the compensating control is the one in the test plan's U1. Stated, not hidden.
9. **The impl's clause rules go through the contract command, not a second reader in the hook.** The hooks' own rule is that a check needing a brief or the registry runs through `indusk promises contract` (`validate-impl-structure.js` already hands it the impl as it would be written, `--impl-stdin`). So the two new rules are added beside `lib/promises/clause-rules.ts` in a new `lib/promises/clause-signal-rules.ts` and called from the contract check; no `_`-port and no new hook code. A task "names a clause's signal" when its line, or its folded technical detail, contains the clause's name and the word `signal`, outside a code fence (A39). The refusal lists `promise/clause` per line. **Which impls are judged:** an impl whose `status` is `draft` (being written). An approved, in-progress or completed impl is never newly refused for it, which is how an impl saved before the rule and edited later stays editable (A40) without a flag or a migration.
10. **The two landed plans' clauses are reported by the code that keeps them.** `bringTrunkIntoPlan` (merge of trunk), the conflict refusal and the acceptance output report `a-brief-is-accepted-on-current-main/<clause>` through `writeClauseSignals`, from the CLI and from the admin's planning start alike. Nothing is marked by hand; that plan then closes by its ordinary `indusk promises confirm` (live check L2, after landing).
11. **Approval's two readers become one.** The admin's decision card and `plans approve` both call `planReviewState` (in `lib/plans/plan-review.ts`, which uses `planReviewHash` from `lib/audit/review-hash.ts`) with the documents as they now stand. A plan whose impl is written, with no plan review at all or a plan review for different documents, and that no run is still writing, lists as "needs its plan review". The brief's Changes entry is applied in Build Phase 5 with `indusk promises change`, after the code makes the new sentence true.
12. **The patient recorder test waits through one injected rule.** `lib/admin/wait-for-incident.ts` takes the clock, a read of the incident, and a read of whether the admin's scan has finished after the break was loaded; it passes when the incident appears, fails naming the break when the scan has finished and none appeared, and ends after a generous upper bound only to stop a hung admin. How the scan is observed is read from the admin's own recorder tick output (the recorder loop already writes a tick record, see `lib/admin/recorder-loop.ts`); if no tick record can say "scan finished after time T", the build adds one (a `lastScanAt` in the tick record) and records that as a surprise. The test stays in the system tier (it starts Jaeger, the always-on server and the admin) and asserts exactly what it asserted before.
13. **Tiers.** The default tier for the work step is `med` (`workflow.steps.work.tier`). Build Phase 3 (a hook every shell command passes through) and Build Phase 5 (the readiness gate every plan's approval goes through) are `strong` for the same reason `check-gates.js` edits are: a mistake in either silently weakens a gate for every plan. The rest are `med`.
14. **Operational live checks are not clause proofs.** L1–L3 run only after landing and sit in the table as `live check` rows whose `For` is a reason, never a clause (the second clause of `a-plan-with-clauses-carries-its-signals`, applied to itself). Each carries a `manual:` command, so verify reports them unverified, not passed.
15. **The signal tasks are in the phases below, one per split and limit clause (fourteen).** Until Build Phase 4 lands the rule, this plan is held to it by hand: each signal task's fold names `signal`, the clause, and where it is read.
16. **Tests that start a process are system-tier; the rule tests are not.** The repo's rule (`everyday-tests-never-wait`) makes any test that runs a hook as a process a system-tier file. So the rows that prove a rule import the pure function (`refusalFor`, the new clause rules) and are `unit`; the two files that run a hook as Claude Code runs it (`plan-write-guard.contract.test.ts`, `impl-clause-signals.contract.test.ts`) are `contract` and are added to `vitest.tiers.ts`. A consequence: the unit rows for the guard and the clause rules import symbols that do not exist until their build phase, so they are written there and registered below, not written red in Test Phase 1.
17. **Two looks change, and they are approved before the plan is.** The brief's Changes lists `plan.working` (the planning steps gain a Planning audit step after the impl; the build controls name the real phase and a dead run's reason) and `plan.released` (a plan merged to main reads complete, green and not pulsing, with a confirmation list ticked as each signal and live check is confirmed). Both are redrawn as mockups and approved by the person before this plan is approved; drawing them is outside this impl. Build Phase 2, the phase that changes the page, rechecks the looks against the approved mockups, and `nav.expanded` must not break.

## Scope

### In Scope

- A run record on disk for builds, planning runs and releases; the admin reads it; dead runs read stopped with a reason; Build restarts from the documents.
- The build controls and the nav row stating the plan's real situation in words, read from the record and the files.
- A release read as released by git.
- A new Bash hook that refuses a shell command that writes, moves or deletes a plan document.
- The impl rules of the contract check (a signal task per clause, no after-landing proof of a clause), and signal reports for `a-brief-is-accepted-on-current-main`'s three clauses.
- One reader of the plan review for the approval offer and `plans approve`; the changed sentence of `approval-waits-for-a-finished-plan`.
- The patient admin-recorder landing test.

### Out of Scope

- Telling the person outside the admin that a run stopped (`activity-and-graph`).
- Running phases in parallel (`run-the-graph`).
- Guarding writes outside plan folders (A35 pins that they are not refused).
- Reading script files the guard cannot see into (U1).
- A new component in the admin: the existing stop sentence and Build button carry a dead run; the changed looks `plan.working` and `plan.released` are redrawn as mockups before approval (Decision 17), and `nav.expanded` is held as it is.
- Drawing the two mockups: done before approval, outside this impl.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every test that can be written today, red; the register of those that wait | Existing hooks, readers, fixtures (`planLifecycleProject`), `build-host.ts` |
| Build Phase 1 | `lib/run-record/{record,liveness,restart}.ts`; the admin's record writes; Build after death | `process-identity.ts`, `next-step.ts`, the machine-state home |
| Build Phase 2 | `lib/run-record/{shown-phase,landed,situation,next-step}.ts`; the Planning audit step in `lib/plans/steps.ts`; controls and nav wired to them | Build Phase 1's record reader, `plan-review.ts`, the approved `plan.working` and `plan.released` mockups |
| Build Phase 3 | `hooks/plan-write-guard.js`, `hooks/_clause-verdicts.js`, the registration and its drain | `HOOK_REGISTRATIONS`, `_inbox.js` pattern, `looks-approval-guard.js` |
| Build Phase 4 | `lib/promises/clause-signal-rules.ts` called by the contract check; the accept-brief signal reports | `clause-rules.ts`, `contract.ts`, `clause-signal.ts`, `bring-trunk.ts` |
| Build Phase 5 | One plan-review reader behind the offer and `plans approve`; the changed promise | `plan-review.ts`, `read-planning.ts`, `decisions.ts` |
| Build Phase 6 | `lib/admin/wait-for-incident.ts`; the patient recorder test | `recorder-loop.ts`, the existing recorder test |

## Test Trajectory

Rows A65–A72 follow the test plan's sections for `says-what-is-true`, `never-in-progress-when-idle`, `always-a-next-step` and `the-planning-audit-is-a-step` (see Decision 1).

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A build, a planning run and a release, each started, leave a record on disk naming plan, kind, step, phase and process before the first step finishes | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A2 | When a run moves to its next step or phase the record says so at once; reading never shows the step it has left | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A3 | After the admin's in-memory knowledge is dropped, the plan page shows the same step, phase and state for each of the three kinds of run | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A4 | A run that ends on its own (finished, waiting amendment, rate limit, refused gate) has its stop and reason written; the page still shows it after a restart | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A5 | A cut-off or unreadable record reads unknown, never running; the page renders and other plans' records are unaffected | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A6 | Records are per plan and kind; two plans, or one plan's build and release, never read each other's | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A7 | A run whose recorded process is gone with no stop reads stopped, and the sentence says it died | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A8 | A run whose recorded pid is now a different program reads stopped, never running | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A9 | A run whose recorded process is alive still reads running; the dead-run check never stops a live run | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A10 | The admin restarted while the build's process is alive: the run still reads running | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A11 | Build on a dead run starts the step the documents say is next (a build that died in the second phase restarts there), with nothing for the person to clear first | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A12 | Build is not refused as already running by a dead record, and still refused while a live run of the same plan and kind exists | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A13 | A dead planning run restarts at the planning step the documents say is next, never at the release and never at a build step before approval | Build Phase 1 | Build Phase 1 | planned | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A14 | A build started at Test Phase 1 that has since closed three build phases shows the phase the plan is on now, not Test Phase 1 | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A15 | A plan that moves a phase between two page loads shows the new phase on the second load with no run-state change | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A16 | A plan whose current phase cannot be read names no phase, never a wrong one | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A17 | The stop sentence keeps naming the plan's real phase when the run has stopped (waiting amendment, rate limit, dead run) | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A18 | A release whose step ended cleanly while `plans land` refused the plan reads stopped with the refusal's reason, never released | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A19 | A release whose plan is on main reads released, whether run now or found after an admin restart | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A20 | A release whose process died before landing reads stopped saying so, and Build restarts it at the step the plan is at; never released | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A21 | In a real temporary repository the plan's branch merged to the trunk reads released; the same branch not merged reads stopped | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A22 | A shell redirect (`>`, `>>`, `&>`) or `tee` into a plan's impl.md is refused naming impl.md and the Edit tool; the file is unchanged | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A23 | `sed -i` and `perl -pi` on a plan document are refused naming the file and the tool; the checkbox is not ticked | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A24 | `mv`, `cp`, `install` into a plan's folder and `rm`, `truncate` of a plan document are refused naming the file | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A25 | `git mv`, `git rm`, `git checkout --` and `git restore` of a plan document are refused; a plain `git add` or `git commit` of one is not | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A26 | An inline interpreter (`node -e`, `python -c`) whose text names a plan-folder path with a write call is refused; one naming no plan path is not looked at | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A27 | The refusal covers a plan under `archive/` and any document in the folder, not only the impl | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A28 | One write anywhere in a pipeline or `&&` chain (`cat impl.md && echo done >> impl.md`) refuses the whole command, naming the file | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A29 | A malformed, empty or unparsable shell command neither breaks the shell tool nor refuses a read | Test Phase 1 | Build Phase 3 | planned | contract | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts |
| A30 | Given a real shell-tool payload the hook answers in the form Claude Code reads and exits so the command does not run; a write to a plan path leaves the file unchanged | Test Phase 1 | Build Phase 3 | planned | contract | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts |
| A31 | `indusk` commands that change a plan document (`plans accept-brief`, `plans approve`, `promises declare`) are not refused | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A32 | `cat`, `head`, `tail`, `sed -n`, `grep`, `rg`, `wc`, `ls`, `diff`, `git diff`, `git log`, `git show`, `git status`, and `git add`/`git commit` of a plan document are all allowed | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A33 | A command that names a plan path only as text (commit message, `echo` to a file outside plan folders, `cat impl.md > /tmp/copy`) is allowed | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A34 | `2>&1`, `>/dev/null`, `2>/dev/null` and a here-document whose body mentions a plan path are not read as writes to it | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A35 | Writing outside plan folders (`.claude`, source files, `.indusk/current.md`, `.indusk/planning/master.md`) is not refused | Build Phase 3 | Build Phase 3 | planned | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A36 | An impl of a brief with clauses where no phase names a clause's signal is refused, listing each clause lacking one as `promise/clause` | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A37 | With two clauses missing a signal task and one present, the refusal names exactly the two, each on its own line | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A38 | An impl with a task naming every split and limit clause's signal is saved; a resting clause needs none | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A39 | A signal task is found by the clause's name in a task line or its folded detail, not in prose outside a task and not inside a code fence | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A40 | A brief without `clauses: required` is not asked for signals; an impl saved before the rule (approved or in progress), edited in a way that adds no clause, is not refused for it | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A41 | The refusal reaches the person as the save check's message when the agent writes the impl and when the planning run writes it; nothing is saved over it | Test Phase 1 | Build Phase 4 | planned | contract | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/__tests__/impl-clause-signals.contract.test.ts |
| A42 | A row of level `live check` whose `For` names a clause is refused naming that row and clause, saying a live check runs only after landing | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A43 | The same for `smoke` and `promise` levels; a row of level `unit` or `contract` naming the same clause is saved | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A44 | A `live check` row that names a promise, no clause, or a reason is saved | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A45 | A row with several `For` entries, one a clause, is refused for the clause; the refusal names the one entry | Build Phase 4 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A46 | Accepting a brief on a branch behind main reports `main-is-merged-first` upheld, from the code that merges main, in the command line and the admin's planning start alike | Test Phase 1 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A47 | A conflicting acceptance refused with the brief still a draft reports `a-conflict-refuses` upheld; one that let a half-merge through reports it broken | Test Phase 1 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A48 | An acceptance on a branch behind main with no conflict, asking nothing, reports `the-person-never-merges` upheld; a refusal telling the person to merge main reports it broken | Test Phase 1 | Build Phase 4 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A49 | A report that cannot be sent (no daemon) never fails the acceptance or the planning start | Test Phase 1 | Test Phase 1 | planned | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A50 | A plan whose plan review was written for documents that have since changed is not offered for approval; it is listed as needing its plan review | Test Phase 1 | Build Phase 5 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A51 | A plan whose review is current and has every finding answered is offered for approval | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A52 | A plan whose impl is written with no plan review at all and no run writing it is listed as needing its plan review, not as waiting on a session | Test Phase 1 | Build Phase 5 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A53 | A plan whose review has an unanswered finding is not offered | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A54 | `plans approve` and the admin's offer agree for each state above, because they ask one reader of the review | Test Phase 1 | Build Phase 5 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A55 | A plan a session is still writing is not offered and not listed as needing a plan review | Test Phase 1 | Test Phase 1 | planned | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A56 | A build on an accepted, approved plan still runs unasked to review; a run that dies in the middle reads stopped with its reason instead of disappearing | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-build-runs-to-review-unasked | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A57 | Build after a restart or on a dead run of a plan not yet accepted never starts the release; it starts the step the plan is at | Build Phase 1 | Build Phase 1 | planned | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A58 | An accepted brief still starts its planning run on acceptance, and that run has a record on disk like any other | Build Phase 1 | Build Phase 1 | planned | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A59 | With the admin slow to scan because the machine is busy, the production break is still recorded and committed and the test passes: it waits for the incident, not for sixty seconds | Test Phase 1 | Build Phase 6 | planned | contract | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/__tests__/admin-recorder.test.ts |
| A60 | With a break the admin never records, the test fails (does not hang, does not pass) and says which break it waited for | Build Phase 6 | Build Phase 6 | planned | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/wait-for-incident.test.ts |
| A61 | The patient test asserts what the old one did: exactly one incident, committed by the admin with the same subject, with a clean working tree | Test Phase 1 | Test Phase 1 | planned | contract | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/__tests__/admin-recorder.test.ts |
| A62 | An incident that appears after the old fixed minute but before the admin's scan ends passes; none after the scan ends fails | Build Phase 6 | Build Phase 6 | planned | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/wait-for-incident.test.ts |
| A63 | The new shell hook is registered under Bash in the project's settings and synced byte for byte from the package | Test Phase 1 | Build Phase 3 | planned | unit | a regression guard: a hook that is not registered refuses nothing, and no clause test would see it | apps/indusk-mcp/src/__tests__/hook-registration.test.ts, apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts |
| A64 | A run record written by the admin leaves the plan's working tree clean: a record is machine state outside the repository | Build Phase 1 | Build Phase 1 | planned | unit | a regression guard on Decision 3, keeping bookkeeping out of plan documents | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A65 | A plan whose planning run is on a step reads "planning" with that step (writing the test plan, writing the impl, reading the plan cold), on the page and in its nav row | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A66 | A plan whose build is on a phase reads "building" with that phase; one waiting on the person reads what it waits on (review, approval, an amendment, its plan review) | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A67 | A plan merged to main reads complete (green), with no release indicator pulsing, and a confirmation step listing what is still to be confirmed (each clause signal and each live check by name), each ticked when confirmed; it never reads "landed" or "releasing" | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A68 | A plan whose run stopped reads "stopped" with the reason and what starts it again | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A69 | An accepted plan with no release process running, after an admin restart, reads landed, stopped or waiting, never "release in progress" | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/never-in-progress-when-idle | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A70 | For every situation short of closed (planning, waiting for looks, waiting for approval, building, at review, releasing, landed waiting on signals, stopped), the page and the nav row show a next step and who takes it | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/always-a-next-step | apps/indusk-mcp/src/lib/run-record/next-step.test.ts |
| A71 | No open plan in the project's real planning folder reads without a next step (a check over every plan the admin lists) | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/always-a-next-step | apps/indusk-mcp/src/lib/run-record/next-step.test.ts |
| A72 | A plan's planning steps read Research, Brief, Test plan, Decision, Impl, Planning audit; the audit reads in progress while the plan-review step runs, to do when the review is missing or unanswered and nothing runs, and done once it is answered | Build Phase 2 | Build Phase 2 | planned | unit | clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step | apps/indusk-mcp/src/lib/plans/steps.planning-audit.test.ts |
| L1 | After landing, on the installed admin, a build on a scratch plan killed by hand reads stopped with its reason within a page load, and Build starts it again from the phase the plan is on | Build Phase 6 | Build Phase 6 | skipped | live check | a live check after landing, recorded in the retrospective; the clauses are proved by A1–A21 | manual: after landing run `pnpm install:local` and `indusk ui restart`; start a build on a scratch plan, `kill` the admin's session process by hand, reload the plan page and read the stop sentence, press Build and read the phase it names; record date and result in Notes |
| L2 | After landing, `indusk promises confirm a-brief-is-accepted-on-current-main` succeeds and that plan closes | Build Phase 6 | Build Phase 6 | skipped | live check | a live check after landing; the clause the-two-landed-plans-report is proved by A46–A49 | manual: after landing run `indusk promises confirm a-brief-is-accepted-on-current-main` and then its retrospective close; record the result in Notes |
| L3 | After landing, in a real session, a shell command that tries to tick a box in a plan's impl is refused with the file and the tool named | Build Phase 6 | Build Phase 6 | skipped | live check | a live check against the installed hook; the clause shell-write-refused is proved by A22–A30 | manual: after landing, in a new session run `sed -i 's/- \[ \]/- [x]/' .indusk/planning/<scratch>/impl.md` and read the refusal; record in Notes |

### Deferred Verification

- **Script files that write a plan document without naming it (U1)**
  - reason: a rule that reads the command text cannot read a script's body, and a path built at run time defeats any text rule.
  - would require: running every shell command in a recording sandbox, which this plan does not build.
  - mitigation: the phase-boundary check refuses a box ticked without its gates, `indusk verify` detects a premature checkoff, and the change shows in the diff the audit reads.
- **Whether a dead run's stop sentence reads clearly (U2)**
  - reason: wording is a person's judgement.
  - would require: a person reading it on the real page.
  - mitigation: the plan's look `plan.working` is held by its approved mockup and the person reviews the sentence at approval.
- **The broken side of the two shell-guard clauses (Decision 8)**
  - reason: the guard sees only its own decisions, never a write that got past it.
  - would require: a recording of every plan-folder change with the tool that made it.
  - mitigation: the same controls as U1.

## Checklist

### Test Phase 1: Author every test that can be written today, red where today fails it

**Tier**: med — the work step's default

This phase writes the tests the plan commits to before anything changes, so each build phase has a fixed target. Today the shell guard does not exist, the contract check never asks an impl for a signal, accepting a brief reports no clause, and the approval offer does not compare the plan review with the documents, so those tests fail on their own assertions. The tests of things that must stay true (the existing acceptance behaviour, the existing recorder test's assertions) pass from the start and are recorded as guards. Tests of brand-new code (the run record, the shown phase, the landed check, the shell guard's rule, the clause rules, the wait rule) cannot be loaded until the build phase that creates them and are registered below with the reason.

- [ ] Create or confirm this plan's own worktree before any edit.
  <details><summary>Technical</summary>

  `indusk worktree create a-run-can-be-trusted` (records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign a-run-can-be-trusted /Users/the_dusky/code/sandbox/dusk-worktrees/a-run-can-be-trusted`). Worktree-per-plan default; this plan does not set `worktree: none`. The worktree exists (`indusk plans start` made it): `git -C /Users/the_dusky/code/sandbox/dusk-worktrees/a-run-can-be-trusted rev-parse --abbrev-ref HEAD` expects `plan/a-run-can-be-trusted`. Use absolute paths in every command.

  </details>
- [ ] Write the shell guard's two contract tests, which run the hook as Claude Code runs it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts`, headers `// clause: a-plan-document-is-written-through-its-checks/shell-write-refused` (A29, A30). `spawnSync(process.execPath, [hook], { input: JSON.stringify(payload) })` with `hook` = `hooks/plan-write-guard.js`, a payload copied from a captured Claude Code PreToolUse event (`{ session_id, transcript_path, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }`) over a temp project with a plan folder. A30: a write command (`sed -i … impl.md`) expects exit 2, stderr naming `impl.md` and the Edit tool, and the file byte-identical afterwards. A29: an empty, a malformed and an unparsable command expect exit 0 and no stderr refusal. Today the hook file does not exist, so `node` exits non-zero without the expected text and A30 fails on its own assertion; A29 fails the same way (exit is not 0 for the missing file). Run through the repo's hook helper (`runHook`) and list the file in the system tier (it starts a process).

  </details>
- [ ] Write the contract test that a refused impl reaches the person as the save check's message.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/impl-clause-signals.contract.test.ts` (A41, `// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals`): spawn the existing `hooks/validate-impl-structure.js` with a Write payload over a temp plan folder whose brief says `clauses: required` with two clauses and whose draft impl names no clause's signal; expect exit 2, a message listing both as `promise/clause`, and the impl file absent afterwards. Today the check saves the impl, so the test fails on its assertion. System tier, as above.

  </details>
- [ ] Write the tests that accepting a brief reports its three clauses.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts`, header `// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report`. From `planLifecycleProject("accept-brief-signals")` (real git, temp home), `vi.mock("../promises/clause-signal.js")` to record each `writeClauseSignals` call, then run `acceptBrief` for A46 (branch behind main: expect a verdict `{ promise: "a-brief-is-accepted-on-current-main", clause: "main-is-merged-first" }` without `broken`), A47 (conflict: `a-conflict-refuses` without `broken`; a stub that lets a half-merge through gives `broken`), A48 (no conflict, nothing printed to merge: `the-person-never-merges` without `broken`). A46–A48 fail today (no call); A49 (the mocked writer throws, `acceptBrief` still returns its result) passes today and is a guard. The admin's planning start is covered by the same expectation in `apps/indusk-admin/src/lib/build-host.trunk.test.ts` (extend its planning-start cases there with the recorded call).

  </details>
- [ ] Write the tests of the approval offer and that approving agrees with it.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions-reader.approval.test.ts`, header `// promise: approval-waits-for-a-finished-plan`. Build temp plan folders with a written impl and: a plan review hashed over the current documents with every finding answered (A51: offered), a plan review hashed over older documents (A50: not offered, listed as needing its plan review), no plan review and no run (A52), an unanswered finding (A53), a session still writing (A55). A54 calls both the offer (`lib/decisions.ts`) and the approve command's readiness check (`readPlanning`'s `review`, used by `plans approve`) over every state and expects equal answers. A50, A52, A54 fail today; A51, A53, A55 pass and are guards.

  </details>
- [ ] Make the recorder landing test hold what it held, so it can be made patient without weakening.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/admin-recorder.test.ts` already asserts one incident with the same subject and a clean tree (A61): add the headers `// promise: a-production-break-is-recorded-unasked` and `// clause: landing-tests-hold-under-load/recorder-waits-for-its-break` and a competing-load case (A59): start a CPU-bound child process pool for the test's duration (`node -e` busy loops, one per core, killed in `finally`) and expect the same pass. Today A59 can fail by the fixed one-minute wait; it is a system-tier test (already listed in `vitest.tiers.ts`).

  </details>
- [ ] Add the guard test that the new hook is registered and synced.
  <details><summary>Technical</summary>

  Extend `apps/indusk-mcp/src/__tests__/hook-registration.test.ts` so `HOOK_REGISTRATIONS` must contain `["PreToolUse", "Bash", "plan-write-guard.js"]` and `plan-write-guard.js` must exist in both `hooks/` and the project's `.claude/hooks/` (A63; `skill-sync-parity.test.ts` already pins byte equality of installed copies). Red today: the registration is absent.

  </details>
- [ ] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every test written here imports only symbols that exist today (`acceptBrief`, `planLifecycleProject`, the offer in `lib/decisions.ts`, `readPlanning`, the hook paths as strings given to `spawnSync`). Run each new file once: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run <the new files>` and `pnpm --filter @infinitedusky/indusk-admin exec vitest run <the new admin file>`; the red ones must fail on an assertion, never on an import or fixture error. A missing hook file is the spawned process's non-zero exit, which the assertion reads.

  </details>

#### Deferred to Build Phase 1

- **A1–A13, A56–A58, A64** — their subjects are `record.ts`, `liveness.ts` and `restart.ts` under `lib/run-record/` and the admin's `build-host.record.test.ts` wiring, which Build Phase 1 creates; a test importing them today fails to load, not to assert. Body reviewed (A8, representative; the record is read by a reader that takes the process reads as inputs):

  ```typescript
  // clause: a-run-is-read-from-its-record/dead-reads-stopped
  import { runStatus } from "./liveness.js";

  it("A8: a recorded pid that is now a different program reads stopped", () => {
  	const record = { plan: "p", kind: "build", pid: 4242, startedAt: "2026-10-19T10:00:00.000Z", stop: null };
  	const status = runStatus(record, {
  		alive: () => true,
  		command: () => "/usr/bin/vim notes.txt", // not the process we started
  		startTime: () => new Date("2026-10-19T12:00:00.000Z"),
  	});
  	expect(status).toEqual({ state: "stopped", reason: expect.stringContaining("died") });
  });
  ```

#### Deferred to Build Phase 2

- **A14–A21, A65–A72** — their subjects are `shown-phase.ts`, `landed.ts`, `situation.ts` and `next-step.ts`, which Build Phase 2 creates, and the Planning audit step that Build Phase 2 adds to the planning steps, whose state reads the planning record Build Phase 1 creates; a test importing them today fails to load, not to assert. Body reviewed (A14):

  ```typescript
  // clause: a-run-is-read-from-its-record/shows-where-it-is
  import { shownPhase } from "./shown-phase.js";

  it("A14: a build started at Test Phase 1 shows the phase the plan is on now", () => {
  	const plan = planWith({ closed: ["Test Phase 1", "Build Phase 1", "Build Phase 2", "Build Phase 3"], open: ["Build Phase 4"] });
  	expect(shownPhase(plan, { startedAtPhase: "Test Phase 1" })).toBe("Build Phase 4");
  });
  ```

#### Deferred to Build Phase 3

- **A22–A28, A31–A35** — their subject is `refusalFor`, exported by `hooks/plan-write-guard.js`, which Build Phase 3 creates; a unit test importing it today fails to load, and one that spawns the hook instead is a system-tier file (Decision 16), which A29 and A30 already are. Body reviewed (A23, representative):

  ```typescript
  // clause: a-plan-document-is-written-through-its-checks/shell-write-refused
  import { refusalFor } from "../../hooks/plan-write-guard.js";

  it("A23: sed -i on a plan document is refused, naming the file and the Edit tool", () => {
  	const refusal = refusalFor("sed -i 's/- \\[ \\]/- [x]/' .indusk/planning/some-plan/impl.md");
  	expect(refusal).toMatch(/impl\.md/);
  	expect(refusal).toMatch(/Edit tool/);
  });
  ```

#### Deferred to Build Phase 4

- **A36–A40, A42–A45** — their subject is the clause rules in `lib/promises/clause-signal-rules.ts`, which Build Phase 4 creates. Body reviewed (A42):

  ```typescript
  // clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause
  import { afterLandingClauseRows } from "./clause-signal-rules.js";

  it("A42: a live check row naming a clause is refused naming the row and the clause", () => {
  	const rows = [{ id: "L1", level: "live check", forCell: "clause: p/c" }];
  	expect(afterLandingClauseRows(rows)).toEqual([{ row: "L1", clause: "p/c" }]);
  });
  ```

#### Deferred to Build Phase 6

- **A60, A62** — their subject is `waitForIncident` in `lib/admin/wait-for-incident.ts`, created in Build Phase 6. Body reviewed (A62):

  ```typescript
  // clause: landing-tests-hold-under-load/recorder-waits-for-its-break
  import { waitForIncident } from "./wait-for-incident.js";

  it("A62: an incident after the old minute but before the scan ends passes", async () => {
  	const clock = fakeClock();
  	const result = await waitForIncident({
  		now: clock.now,
  		sleep: clock.sleep,
  		incident: () => (clock.elapsed() > 75_000 ? "incident-1" : null),
  		scanFinishedAfterBreak: () => clock.elapsed() > 90_000,
  		upperBoundMs: 300_000,
  	});
  	expect(result).toEqual({ found: "incident-1" });
  });
  ```

- **L1–L3** — each runs only after landing against the installed admin and hook, so it cannot be authored as an everyday or landing test; each is a `manual:` row and, by Decision 14, proves no clause.

#### Regression Guards

- **A49** — a report that cannot be sent never fails the acceptance: already true today (nothing is reported), and the build must not break it; it has no red window.
- **A51** — a plan whose review is current and answered is offered: already true, the build must keep it.
- **A53** — a plan whose review has an unanswered finding is not offered: already true, the build must keep it.
- **A55** — a plan a session is still writing is neither offered nor listed as needing a plan review: already true, the build must keep it.
- **A61** — the recorder test's existing assertions (one incident, same subject, clean tree); it passes today and is the baseline the patient test must keep.

#### Test Phase 1 Verification

- [ ] The tests this phase writes exist, and each red one fails on its own assertion rather than on a missing file.
  <details><summary>Technical</summary>

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.contract.test.ts src/__tests__/impl-clause-signals.contract.test.ts src/lib/plans/accept-brief-signals.test.ts src/__tests__/hook-registration.test.ts` and `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/decisions-reader.approval.test.ts`: A29, A30, A41, A46–A48, A50, A52, A54, A63 are red on assertions (write the red items, `(write red)`); A49, A51, A53, A55 pass. A59 and A61 are run once in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/admin-recorder.test.ts`). The whole suite runs at landing, not here.

  </details>
- [ ] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body reviewed against both questions: will it compile at the phase it names (its imports are exactly the exports that phase creates), and does it assert what it claims (A8, A14, A23, A42 and A62 above).

  </details>

#### Test Phase 1 Context

- [ ] Record in the shared part of the current-work file that this plan's tests are written red and which Stabilize item it is.
  <details><summary>Technical</summary>

  `current.md: ## Project (shared)` — one line under the Stabilize list: `a-run-can-be-trusted: tests written red; build in flight` via `mcp__indusk__update_current_section`; committed like any file. Destination tier: current.md (operational state, not a rule).

  </details>

#### Test Phase 1 Document

- [ ] Write the three after-landing checks, with the commands that run them, into this impl's Notes so the retrospective runs them.
  <details><summary>Technical</summary>

  Notes section: L1, L2, L3 as numbered steps copied from their `manual:` cells, each with a blank "date / result" line; the retrospective reads this list.

  </details>

### Build Phase 1: Keep every run on disk, read it back, and let Build start a dead run again

**Tier**: med — the work step's default

This phase makes the admin's builds, planning runs and releases leave a record on disk and read it back, which is what every later promise in this plan stands on. A run writes its step, phase, process and stop as they change; a reader returns what the record says, or "unknown" when the file is cut off; a run whose process is gone, or is now another program, reads stopped saying it died; and Build on such a run starts the step the plan's own documents say is next. The next phase uses the same record to name the phase and to judge a release.

- [ ] Add the run record: a file per plan and kind in machine state, written whole and read safely.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/run-record/record.ts`: `writeRunRecord(home, record)` (temporary file in the same directory then `renameSync`), `readRunRecord(home, plan, kind)` returning `RunRecord | "unknown" | null` (null: no file), `RunRecord = { plan, kind: "build" | "planning" | "release", step, phase, pid, startedAt, stop, stopReason, updatedAt }`. The home is the machine-state directory `indusk eval home` prints (`lib/bookkeeping/home`); a path join under `runs/`. Never throws on a bad file. Header `// clause: a-run-is-read-from-its-record/kept-on-disk`.

  </details>
- [ ] Add the one rule that says whether a run is alive, using the existing process-identity reader.
  <details><summary>Technical</summary>

  New `lib/run-record/liveness.ts`: `runStatus(record, deps: ProcessDeps)` → `{ state: "running" | "stopped" | "unknown", reason? }`. A record with a `stop` reads stopped with that reason; otherwise `isOwnProcess(record.pid, markers, deps, record.startedAt)` from `lib/process-identity.ts` — alive reads running, anything else reads stopped with "the run's process is gone" (a recycled pid included). Nothing in the file calls `process.kill(pid, 0)` itself (`lesson: identify-a-process-by-what-it-cannot-rewrite`). `readRunRecord` returning "unknown" yields unknown, never running. Header `// clause: a-run-is-read-from-its-record/dead-reads-stopped`; the limit `never-in-progress-when-idle` is proved where the situation is stated, in Build Phase 2 (A69).

  </details>
- [ ] Add the rule that picks the step Build starts from the plan's documents.
  <details><summary>Technical</summary>

  New `lib/run-record/restart.ts`: `restartStep(kind, plan)` over the existing `nextBuildStep(await readBuildPlan(root, plan))` and `nextPlanningStep` (`lib/build/next-step.ts`, `next-planning-step.ts`). A build never answers `release` unless the plan is accepted (`nothing-ships-until-accepted`); a planning kind never answers a build step or release. Export `restartStep` and the record functions from the package's `build` export so the admin imports them.

  </details>
- [ ] Make the admin write the record as a run starts, advances and stops, and read it on every ask.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`: in `startBuild`, `startRelease` and `startPlanning` write the record before the first step finishes; `onStep` rewrites it on each step and phase; the `.then`/`.catch`/`.finally` handlers write `stop` and `stopReason`; `buildState` and `planningState` merge the in-memory entry with `readRunRecord` + `runStatus` (the record wins when the entry is absent, as after a restart). The pid is the admin daemon's `process.pid`; the marker is the daemon's start command read from `ps` once at startup, as `process-identity` records it.

  </details>
- [ ] Make a dead run stop blocking Build.
  <details><summary>Technical</summary>

  `startBuild`'s `existing?.running` and `planningState(...).running` checks, and `startRelease`'s, read `runStatus(...).state === "running"`, not the flag. A still-live run of the same plan and kind is still refused ("already building"); a dead one starts again from `restartStep`. `decisions-reader.ts`' `stoppedAt` reads the merged state.

  </details>
- [ ] Report the signal for the clause that a run is kept on disk.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/kept-on-disk` — read in the run record and what the admin shows after a restart. After each start/advance/stop write, read the file back through a fresh reader and call `writeClauseSignals(root, "run.record", plan, { plan: "a-run-can-be-trusted", phase: "Build Phase 1" }, [{ promise: "a-run-is-read-from-its-record", clause: "kept-on-disk", ...(same ? {} : { broken: "<plan> <kind> record differs from the run" }) }])` in `lib/run-record/signals.ts`; best-effort, never failing the run.

  </details>
- [ ] Report the signal for the clause that a dead run reads stopped.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/dead-reads-stopped` — read in the stop sentence and Build's answer. When `runStatus` finds a gone process with no stop, report the clause upheld if the state returned is `stopped` and Build then starts a new run; `broken` with the plan if Build was refused as "already running" for a gone process. Same helper file.

  </details>
- [ ] Report the signal for the limit that nothing reads in progress while idle.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/never-in-progress-when-idle` — read wherever the admin shows a plan as in progress. The merged state reports `broken` naming the plan when it would show running with `runStatus` not running; upheld otherwise, at most once per plan per tick.

  </details>

#### Build Phase 1 Verification

- [ ] The run record, the liveness rule, the restart rule and the admin's wiring are proved.
  <details><summary>Technical</summary>

  A1–A13, A56–A58, A64 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/run-record && pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/build-host.record.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/build-host.ts`) — the whole suite runs at landing, not here. The existing `build-host*.test.ts` files stay green.

  </details>

#### Build Phase 1 Context

- [ ] Write the Key Decisions line in the root context file and the run-record rule in the package's context file.
  <details><summary>Technical</summary>

  root (Key Decisions): `- A run is read from its record: ... — see /decisions/a-run-can-be-trusted` — always-on because it states design intent every session's agent must not contradict (a run's truth lives on disk, not in the admin's memory). `apps/indusk-mcp/CLAUDE.md` (the `lib/build/` entry or a new Runs entry): "A run's state is `lib/run-record`'s record; liveness is asked only through `process-identity.ts`; the admin's in-memory map is a cache" — destination tier: the area's own file, loaded when a file there is read.

  </details>

#### Build Phase 1 Document

- [ ] Document the run record on the admin reference page.
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/admin-ui/overview.md`: where a run's record lives, what "stopped — the run's process is gone" means, and that Build restarts it. Mermaid sequence of start → record → read-after-restart is optional.

  </details>

### Build Phase 2: Show the real phase, the real situation, and a release that landed

**Tier**: med — the work step's default

This phase makes the admin say true things from the record the last phase keeps. The build controls name the phase the plan is on, read from the plan's files each time; the plan page and its nav row state the plan's situation in words from one reader; and a release reads released only when the plan is on main, otherwise stopped with the reason. Every plan that is not closed shows its next step and who takes it; the planning steps gain a Planning audit step after the impl; and a plan merged to main reads complete, with a list of what is still to be confirmed, ticked as each is. The page is then checked against the two looks the person approved before the plan did.

- [ ] Make the build controls name the phase the plan is on, read from the plan each time.
  <details><summary>Technical</summary>

  New `lib/run-record/shown-phase.ts`: `shownPhase(plan, { startedAtPhase })` returns the first phase with work left from `nextBuildStep` (never the record's phase), or `null` when unreadable. The admin's build controls (the component that renders the stop sentence on the plan page; find it with `grep -rn "buildState" apps/indusk-admin/src/app apps/indusk-admin/src/components`) call it; the record's phase is shown nowhere.

  </details>
- [ ] Make a release read released only when the plan has landed.
  <details><summary>Technical</summary>

  New `lib/run-record/landed.ts`: `releaseOutcome({ stepResult, landedOnMain, landError })` with `landedOnMain` from `git merge-base --is-ancestor <plan branch tip> <trunk>` run by the admin (the trunk branch from `lib/trunk-branch.ts`); not landed reads `{ state: "stopped", reason: landError ?? "the release ended but the plan is not on main" }`. In `startRelease`'s handlers replace the `r.released` reading with it; capture `plans land`'s refusal text from the release step's output. A release found after a restart is judged the same way.

  </details>
- [ ] Add the one sentence that states a plan's situation, and use it on the page and the nav row.
  <details><summary>Technical</summary>

  New `lib/run-record/situation.ts`: `situation({ record, status, plan, files })` → a sentence for planning (and its step), building (and its phase), waiting on the person (and for what: review, approval, an amendment, its plan review), complete (merged to main), or stopped (and why, and what starts it again). An accepted plan with no live release process never reads "release in progress" (A69). The plan page and `nav.expanded`'s plan row call it; the wording of existing sentences is kept. Rows A65, A66, A68, A69 in `situation.test.ts`. Header `// clause: a-run-is-read-from-its-record/says-what-is-true` and `// clause: a-run-is-read-from-its-record/never-in-progress-when-idle`.

  </details>
- [ ] Show a plan merged to main as complete, with a confirmation list of what is still to be confirmed.
  <details><summary>Technical</summary>

  In `situation.ts`, a plan whose branch is an ancestor of the trunk (the `landed.ts` check) reads complete: green, no release indicator pulsing, never "landed" or "releasing". It carries `confirmations: { name, kind: "clause signal" | "live check", confirmed }[]` — each split and limit clause of the brief's promises, confirmed once its signal has reported upheld in a real run (the promise reader `indusk promises confirm` uses), and each `live check` row of the impl, confirmed once its Notes result is recorded. The plan page renders it as the confirmation step of `plan.released`, a tick per confirmed item. Row A67 in `situation.test.ts`.

  </details>
- [ ] Give every plan that is not closed a next step and who takes it.
  <details><summary>Technical</summary>

  New `lib/run-record/next-step.ts`: `nextStepFor(situation)` → `{ text, by: "system" | "person" | "event" }` for every situation short of closed (planning: "the system is writing the impl"; waiting for looks or approval: "you approve it"; building; at review; releasing; complete with confirmations open: "closes when its clauses report from a real run"; stopped: what starts it again). It never returns nothing for an open plan. The plan page and the `nav.expanded` row show it beside the situation. Rows A70 (every situation) and A71 (over every plan `indusk plans` lists in this repo's `.indusk/planning/`) in `next-step.test.ts`. Header `// clause: a-run-is-read-from-its-record/always-a-next-step`.

  </details>
- [ ] Add the planning audit to the plan page's planning steps, after the impl.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`: add `{ name: "Planning audit", … }` after Impl in `PLANNING` (extend `PlanningStepName`). Its state is read from the plan review (`lib/plans/plan-review.ts`'s `planReviewState`, the reader Build Phase 5 makes the only one) and the planning run's record from Build Phase 1: in progress while the planning run is on its plan-review step, to do when the review is missing or unanswered and nothing runs, done once every finding is answered for the documents as they stand. Row A72 in `steps.planning-audit.test.ts`. Header `// clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step`.

  </details>
- [ ] Report the signal for the clause that the controls show where the plan is.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/shows-where-it-is` — read in the build controls' text. Each render compares the phase shown with `shownPhase`; `broken` names the plan, the phase shown and the phase read. Reported through `lib/run-record/signals.ts` with `phase: "Build Phase 2"`.

  </details>
- [ ] Report the signal for the clause that a release reads released only when landed.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/released-only-when-landed` — read in the release's state. When the admin marks a release released, the ancestor check is run again and `broken` names the plan if it fails; upheld otherwise.

  </details>
- [ ] Report the signal for the clause that the page says what is true.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/says-what-is-true` — read where the sentence is shown. The page and the nav row each pass their sentence to the reporter; `broken` names the plan, the words shown and what the record says when they differ from the record and the files (a running process for planning or building, a merge on main for complete).

  </details>
- [ ] Report the signal for the clause that every open plan has a next step.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/always-a-next-step` — read where the page and the nav row are read. Upheld when every open plan shown has a next step naming who takes it; `broken` names the plan shown with none. Reported through `lib/run-record/signals.ts`, at most once per plan per read.

  </details>
- [ ] Report the signal for the clause that the planning audit is a step.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/the-planning-audit-is-a-step` — read where the planning steps are shown. Upheld when a plan with an impl shows a Planning audit step whose state matches its plan review; `broken` names the plan and the step state shown. Same reporter.

  </details>

#### Build Phase 2 Verification

- [ ] The shown phase, the landed check, the situation sentence, the next step, the confirmation list and the Planning audit step are proved, and the existing release and steps tests still pass.
  <details><summary>Technical</summary>

  A14–A21, A65–A72 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/run-record src/lib/plans/steps.planning-audit.test.ts src/lib/plans/steps.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/build-host.release.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/build-host.ts`).

  </details>
- [ ] The page matches the two looks the person approved, and the nav look still holds.
  <details><summary>Technical</summary>

  `plan.working` and `plan.released` are checked by value in Chromium against the mockups the person approved before this plan's approval (drawn outside this impl); `nav.expanded` is unchanged and still passes. Run the admin's look checks over the changed components (`pnpm --filter @infinitedusky/indusk-admin exec vitest related <the changed components>`); a look that does not match its approved mockup is a defect in this phase, never a reason to redraw the mockup here.

  </details>

#### Build Phase 2 Context

- [ ] Record in the admin's context file that a plan's situation has one reader.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: "A plan's situation sentence comes from `situation()` in the package; the page and the nav row never compose their own" — destination: the app's own file, loaded when a file there is read.

  </details>

#### Build Phase 2 Document

- [ ] Document what the plan page's stop sentence can say and why.
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/admin-ui/overview.md` with the situation sentences (planning, building, waiting, complete, stopped), the next step and who takes it, the Planning audit step, the confirmation list of a merged plan, and the rule that a release reads released only when on main.

  </details>

### Build Phase 3: Refuse a shell command that writes a plan document

**Tier**: strong — a hook every shell command in every session passes through; a mistake either blocks reads or lets writes by

This phase adds a hook on the shell tool that reads each command and refuses one that writes, moves or deletes a file in a plan's folder, naming the file and the tool to use instead. It never refuses a read, a command that only mentions a plan's path as text, or an indusk command (those write through the checks themselves). Each decision is also written to a small file the package reports from, because a hook cannot send a signal itself.

- [ ] Write the shell guard hook, reading the command's text.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/hooks/plan-write-guard.js`, modelled on `looks-approval-guard.js`, exporting `refusalFor(command)` and running `main` only when executed (`import.meta.url === pathToFileURL(process.argv[1]).href`). Split the command on `&&`, `||`, `;`, `|` and newlines, keeping quotes and here-documents intact; per segment refuse a redirect (`>`, `>>`, `>|`, `&>`) whose target resolves under `.indusk/planning/<plan>/` (including `archive/<plan>/`), `tee`, `sed -i`, `perl -pi`, `mv`, `cp`, `install`, `rm`, `truncate`, `dd of=`, `git mv`, `git rm`, `git checkout --`, `git restore` of such a path, and `node -e`/`python -c` text naming such a path with a write call. Not refused: `2>&1`, `>/dev/null`, `2>/dev/null`, text in a `-m` message or here-document body, `indusk` commands, reads, other git commands. A parse failure allows the command. Stderr: `refused: <file> is a plan document; use the Edit tool (or the indusk command for it) so its checks run`; exit 2. `_hook-paths.js` supplies the plan-folder test. Write the unit tests (A22–A28, A31–A35) in `src/__tests__/plan-write-guard.test.ts` importing `refusalFor`, headers `// clause: a-plan-document-is-written-through-its-checks/shell-write-refused` and `…/reads-pass`.

  </details>
- [ ] Register the guard under the shell tool and install it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/hook-command.ts`: add `["PreToolUse", "Bash", "plan-write-guard.js"]` to `HOOK_REGISTRATIONS` with a comment on why one matcher is the whole gate; run `indusk update` in this worktree so `.claude/hooks/plan-write-guard.js` and `.claude/settings.json` are written from the package (never edited by hand; `skill-sync-parity.test.ts`, A63).

  </details>
- [ ] Write the hook-side verdict port and the package side that drains it.
  <details><summary>Technical</summary>

  New `hooks/_clause-verdicts.js` (`appendVerdict(home, verdict)`; appends one JSON line to `<machine state>/clause-verdicts.jsonl`) mirroring new `lib/promises/clause-verdicts.ts` (`drainClauseVerdicts(root)` → `writeClauseSignals` per line, then removes the lines it sent), pinned equal by `hook-shared-modules.test.ts` as `_inbox.js` is (add the pair there and bump the pinned `_`-module count). The drain runs at the start of an `indusk` command and on each admin recorder tick, best-effort.

  </details>
- [ ] Report the signal for the clause that a shell write is refused.
  <details><summary>Technical</summary>

  signal: `a-plan-document-is-written-through-its-checks/shell-write-refused` — read in the refusal and the verdict file. The hook appends the clause `upheld` for each refusal; the clause's `broken` is not observable from the hook (Decision 8, Deferred Verification).

  </details>
- [ ] Report the signal for the limit that reads pass.
  <details><summary>Technical</summary>

  signal: `a-plan-document-is-written-through-its-checks/reads-pass` — read in the shell tool's answer to reading commands. The hook appends `upheld` when it allows a command that names a plan path; the contract test (A29) and the read corpus (A32–A35) hold the limit at landing.

  </details>
- [ ] Add the two contract test files to the system tier.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/vitest.tiers.ts`: add `src/__tests__/plan-write-guard.contract.test.ts` and `src/__tests__/impl-clause-signals.contract.test.ts` to `SYSTEM` (they run a hook as a process, as Claude Code runs it; `everyday-tests-never-wait` fails them otherwise); landing runs both tiers.

  </details>

#### Build Phase 3 Verification

- [ ] The guard refuses every writing form, allows every read, and is registered.
  <details><summary>Technical</summary>

  A22–A35, A63 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.test.ts src/__tests__/hook-registration.test.ts src/__tests__/skill-sync-parity.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related hooks/plan-write-guard.js`); A29 and A30 pass in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.contract.test.ts`).

  </details>
- [ ] This session's own shell is now guarded.
  <details><summary>Technical</summary>

  From this worktree run `sed -i 's/Build Phase 1/Build Phase 1/' .indusk/planning/a-run-can-be-trusted/impl.md`; expect the refusal naming `impl.md` and the Edit tool, `git status --porcelain` unchanged. Tick this box with the Edit tool.

  </details>

#### Build Phase 3 Context

- [ ] Record the hook and its single matcher in the hooks rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: "`plan-write-guard.js` is registered under Bash only — it guards a shell path, Edit/Write already pass the plan's checks; it reads command text, never a script, as `looks-approval-guard.js` does; verdicts go through `_clause-verdicts.js`" — and update the `_`-prefixed module count line. Planning template: `apps/indusk-mcp/templates/planning/CLAUDE.md` gains "A shell command that writes a plan document is refused; use the Edit tool or the `indusk` command — guarded by `plan-write-guard.test.ts`" (never edit `.indusk/planning/CLAUDE.md`).

  </details>

#### Build Phase 3 Document

- [ ] Document the shell guard, what it refuses and its one honest gap.
  <details><summary>Technical</summary>

  Update the hooks reference page under `apps/docs/src/reference/` (find it with `grep -rln "trunk-guard" apps/docs/src/reference`) with the refused forms (the test plan's Decision 8 list), what is allowed, and the script-file gap with its compensating controls.

  </details>

### Build Phase 4: Refuse an impl without its clause signals, and let the landed plan's clauses report

**Tier**: med — the work step's default

This phase makes the project's contract check ask two more things of an impl being written for a brief that states clauses: every split and limit clause has a task that reports its signal, and no row that can only run after landing is a clause's proof. The impl hook already hands the impl to that check, so no second reader is added. It also makes the code that accepts a brief report the three clauses of the plan that taught the project to accept briefs on current main, so that plan can close.

- [ ] Add the rules that find clauses without a signal task and rows that cannot prove a clause.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/promises/clause-signal-rules.ts`: `missingSignalTasks(brief, impl)` → `promise/clause[]`; `afterLandingClauseRows(rows)` → `{ row, clause }[]` for rows of level `live check`, `smoke` or `promise` whose `For` names `clause:` (one entry among several still counts). A task names a signal when its line or its folded detail contains the clause name and `signal`, outside a code fence (`fencedLineMask`). A resting clause needs none. Judged only for an impl whose `status` is `draft` (Decision 9). Headers `// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals` and `…/a-live-check-proves-no-clause`.

  </details>
- [ ] Call the rules from the contract check so the impl hook's refusal carries them.
  <details><summary>Technical</summary>

  `lib/promises/clause-rules.ts` / `contract.ts`: call the two rules when the brief says `clauses: required`; each refusal is one line per clause (`promise/clause`) and one per row, the row message saying a live check runs only after landing so it blocks the clause at close. `validate-impl-structure.js` already passes the impl through `indusk promises contract --impl-stdin`; add nothing to the hook beyond what the hook rules file says a hook may add.

  </details>
- [ ] Make accepting a brief report the three clauses.
  <details><summary>Technical</summary>

  `lib/plans/bring-trunk.ts` (merge of trunk → `main-is-merged-first`), the conflict refusal in `accept-brief.ts` (→ `a-conflict-refuses`, `broken` if a half-merge remains) and the output path (→ `the-person-never-merges`, `broken` when the message tells the person to merge): each calls `writeClauseSignals(root, "plan.accept-brief", plan, { plan: "a-brief-is-accepted-on-current-main", phase: "Build Phase 1" }, [...])`, best-effort. The admin's planning start calls the same function, so both lanes report.

  </details>
- [ ] Report the signal for the clause that an impl is refused without signals.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/refused-without-signals` — read in the refusal printed on save. The contract check reports `upheld` through `writeClauseSignals` when it refuses a missing signal, and `broken` naming the plan and clause when an impl is later found, at a phase boundary, to hold a split or limit clause no task reports.

  </details>
- [ ] Report the signal for the clause that a live check proves no clause.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause` — read in the refusal printed on save. Same reporter; `broken` names the row and clause when a saved impl holds such a row.

  </details>
- [ ] Report the signal for the clause that the two landed plans report.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report` — read as that plan's three clauses by the promise reader. Upheld when `a-brief-is-accepted-on-current-main/<clause>` has reported in a real run since this plan landed (live check L2 confirms it); the reporting calls above are its proof at landing.

  </details>

#### Build Phase 4 Verification

- [ ] Saving an impl is refused without signals and with an after-landing proof, and acceptance reports its clauses.
  <details><summary>Technical</summary>

  A36–A40, A42–A49 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-signal-rules.test.ts src/lib/plans/accept-brief-signals.test.ts src/lib/plans/accept-brief*.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/clause-rules.ts`); A41 passes in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/impl-clause-signals.contract.test.ts`). The contract check's existing tests stay green.

  </details>
- [ ] This plan's own impl passes its own rule.
  <details><summary>Technical</summary>

  `indusk promises contract a-run-can-be-trusted` reports no clause without a signal task and no live check naming a clause.

  </details>

#### Build Phase 4 Context

- [ ] Record the two rules in the planning template.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/templates/planning/CLAUDE.md` (not the installed copy): "An impl being written for a brief with clauses names each split and limit clause's signal in a task, and no `live check`, `smoke` or `promise` row names a clause — guarded by `clause-signal-rules.test.ts`" — destination: planning rules, delivered where a plan is written.

  </details>

#### Build Phase 4 Document

- [ ] Document the two rules and the signal task shape for authors.
  <details><summary>Technical</summary>

  Update `apps/docs/src/guide/test-trajectory.md` and `apps/docs/src/reference/skills/plan.md` (and the planner skill's section for impl.md in `apps/indusk-mcp/skills/planner.md`, then sync with `indusk update`; never edit `.claude/skills/` directly): what a signal task is, why a live check proves no clause.

  </details>

### Build Phase 5: Offer approval only for a plan review that matches the documents

**Tier**: strong — the readiness gate every plan's approval goes through; a mistake offers or withholds approval for every plan

This phase makes the admin's offer of approval and the approve command ask one reader of the plan review, comparing what the review was written for with the documents now. A plan whose review is out of date is not offered and is listed as needing its plan review, and a plan with an impl and no review at all, that no run is still writing, is listed the same way. It then records the new sentence of the existing promise.

- [ ] Make the approval offer and the approve command ask one reader of the plan review.
  <details><summary>Technical</summary>

  `lib/plans/plan-review.ts`'s `planReviewState` (using `planReviewHash` from `lib/audit/review-hash.ts` over `{ brief, testPlan, adr, impl }` as `read-planning.ts` does) becomes the only reader; `apps/indusk-admin/src/lib/decisions.ts` and `apps/indusk-mcp/src/lib/plans/approve.ts` both call it. Delete any second comparison. States: current and answered (offer), stale or missing with no run writing (needs its plan review), unanswered finding (not offered), a session writing (neither).

  </details>
- [ ] Record the changed promise sentence now that the code makes it true.
  <details><summary>Technical</summary>

  `indusk promises change approval-waits-for-a-finished-plan --plan a-run-can-be-trusted --statement "A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written for the documents as they stand with every finding answered; a plan whose impl is written without such a plan review, and that no run is still writing, is listed as needing its plan review." --reason "the offer read a plan review as answered without checking it was written for the documents as they stand"` (the planner's `change_promise` tool does the same).

  </details>

#### Build Phase 5 Verification

- [ ] Approval is offered and withheld as the promise now says, by one reader.
  <details><summary>Technical</summary>

  A50–A55 pass (`pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/decisions-reader.approval.test.ts src/lib/decisions-reader.planning.test.ts src/app/api/plans/approve/route.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/plan-review.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/decisions.ts`); then `indusk promises contract a-run-can-be-trusted` passes.

  </details>

#### Build Phase 5 Context

- [ ] Record that the plan review has one reader.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (its `lib/audit/` entry already says `planReviewState` is the one reading; add that `plans approve` calls it too): "guarded by `decisions-reader.approval.test.ts` (`promise: approval-waits-for-a-finished-plan`)" — destination: the package's area file.

  </details>

#### Build Phase 5 Document

- [ ] Document when a plan is offered for approval and what needing its plan review means.
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/cli/plans.md` (the `plans approve` entry) and the admin overview page: the three states and the single reader.

  </details>

### Build Phase 6: Make the recorder landing test wait for its incident

**Tier**: med — the work step's default

This phase replaces the recorder landing test's fixed one-minute wait with a rule that waits for the incident the admin was expected to commit, or for the admin to finish a scan after the break was loaded and find none, so the test passes on a busy machine and fails only for what it tests. It then records what the person runs after landing.

- [ ] Add the wait rule that takes the clock and its reads as inputs.
  <details><summary>Technical</summary>

  New `lib/admin/wait-for-incident.ts`: `waitForIncident({ now, sleep, incident, scanFinishedAfterBreak, upperBoundMs })` → `{ found }` or throws naming the break; a generous upper bound (default 5 minutes) only ends a hung admin. Header `// clause: landing-tests-hold-under-load/recorder-waits-for-its-break`.

  </details>
- [ ] Make the recorder test use it, asserting exactly what it asserted before.
  <details><summary>Technical</summary>

  `src/__tests__/admin-recorder.test.ts`: replace the fixed `MINUTE` wait with `waitForIncident`, `scanFinishedAfterBreak` read from the recorder's tick record (`lib/admin/recorder-loop.ts` writes it; if it has no `lastScanAt` add one and say so in Notes). Keep: one committed incident, same subject, clean tree, system tier.

  </details>
- [ ] Report the signal for the clause that the recorder test waits for its break.
  <details><summary>Technical</summary>

  signal: `landing-tests-hold-under-load/recorder-waits-for-its-break` — read in the landing test's result across landings. Reported through the existing landing-test record, not a new mark: a landing whose recorder test fails or times out under load is `broken` naming the landing and the wait given up on; a pass is `upheld`.

  </details>

#### Build Phase 6 Verification

- [ ] The wait rule and the patient test hold, alone and on a busy machine.
  <details><summary>Technical</summary>

  A59–A62 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/admin/wait-for-incident.test.ts` and, in the system tier, `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/admin-recorder.test.ts` once alone and once with another build running).

  </details>
- [ ] The three after-landing checks are listed with their commands for the retrospective.
  <details><summary>Technical</summary>

  Notes lists L1, L2, L3 (skipped here by design, `live check`; each proves no clause).

  </details>

#### Build Phase 6 Context

- [ ] Record the waiting rule for landing tests.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Tests section): "a landing test that waits for the admin waits for the thing it expects (`waitForIncident`), never a fixed minute" — destination: the package's area file; guard: `wait-for-incident.test.ts` carries `lesson: everyday-tests-never-wait`.

  </details>

#### Build Phase 6 Document

- [ ] Document the patient recorder test on the testing page.
  <details><summary>Technical</summary>

  Update `apps/docs/src/guide/test-levels.md`: a system-tier test waits on the event it expects and keeps an upper bound only to end a hung process.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/run-record/{record,liveness,restart,shown-phase,landed,situation,next-step,signals}.ts` | New: the run record and the rules that read it |
| `apps/indusk-mcp/src/lib/plans/steps.ts` | The Planning audit step after Impl |
| `apps/indusk-admin/src/lib/build-host.ts` | Write and read the record; liveness not the flag; release by git |
| `apps/indusk-admin/src/lib/decisions.ts`, `decisions-reader.ts` | One reader of the plan review; merged run state |
| `apps/indusk-mcp/hooks/plan-write-guard.js`, `_clause-verdicts.js` | New: shell guard, verdict port |
| `apps/indusk-mcp/src/lib/promises/clause-signal-rules.ts`, `clause-rules.ts`, `contract.ts`, `clause-verdicts.ts` | New rules called by the contract check; verdict drain |
| `apps/indusk-mcp/src/lib/hook-command.ts` | Registration under Bash |
| `apps/indusk-mcp/src/lib/plans/{bring-trunk,accept-brief,plan-review,approve}.ts` | Report the three clauses; one review reader |
| `apps/indusk-mcp/src/lib/admin/wait-for-incident.ts`, `recorder-loop.ts` | New wait rule; scan time in the tick record |
| `apps/indusk-mcp/src/__tests__/admin-recorder.test.ts`, `vitest.tiers.ts` | Patient test; two contract files added to the system tier |
| `apps/indusk-mcp/hooks/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/templates/planning/CLAUDE.md`, root `CLAUDE.md` | Rules and the Key Decisions line |
| `apps/docs/src/reference/**`, `guide/**` | Pages named in each Document gate |

## Dependencies

- `a-brief-is-accepted-on-current-main` lands first (Stabilize order); this plan touches the admin's build host too.
- Node 22; real git in temporary repositories; no daemon for the everyday tests.

## Notes

- Before approval (Decision 17): the person approves redrawn mockups of `plan.working` and `plan.released`; drawing them is outside this impl.
- Open decision (Decision 8): the broken side of the two shell-guard clauses is not observable from inside the hook.
- Open decision: the test plan's list of refused shell forms (its Decision 8) is the author's; a form the person wants added or allowed changes the guard's list before Build Phase 3.
- After landing, run and record: **L1** (kill a scratch build, read "stopped", press Build), **L2** (`indusk promises confirm a-brief-is-accepted-on-current-main`), **L3** (try to tick a box with `sed -i`; read the refusal). Date / result: ______
