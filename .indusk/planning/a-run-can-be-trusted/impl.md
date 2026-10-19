---
title: "A run can be trusted — Impl"
date: 2026-10-19
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "a05844d75bfa4eeaf8f04e3736e3e8f253e6b5d74e7cab00e0f23e22620c0866"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-19T18:56:46.038Z"
---

# A run can be trusted — Impl

## Goal

What an unattended run says about itself is true. The admin keeps each build, planning run and release as a record on disk and shows that record, so a run whose process died reads as stopped with its reason and Build starts it again from where the plan stands; the build controls name the phase the plan is really on; a release reads released only when the plan is on main; a shell command can no longer write a plan document around its checks; an impl for a brief with clauses is refused unless a task reports each clause's signal and no after-landing check is a clause's proof; the three clauses of `a-brief-is-accepted-on-current-main` report so that plan can close; approval is offered only for a plan review written for the documents as they stand; and the admin-recorder landing test waits for its incident instead of a fixed minute.

## Decisions made while writing this plan

This impl was written unattended (`INDUSK_GATE_POLICY=auto`): nobody could be asked, so each choice is the author's, with its reason. The person reads them at the single approval after this document.

1. **The rows for the first promise's later clauses follow the test plan.** The brief now states eight clauses under `a-run-is-read-from-its-record`, and the test plan has a section for each: `says-what-is-true` (A65–A68, a merged plan reading complete with its confirmation list among them), `never-in-progress-when-idle` (A69), `always-a-next-step` (A70, A71) and `the-planning-audit-is-a-step` (A72). An earlier draft of this impl invented rows A65–A68 for two of them; those are replaced by the test plan's, with the same IDs. All eight are built in Build Phase 2, where the plan page's situation words are built.
2. **Pure rules live in the package, wiring in the admin.** Which step a dead run restarts at, which phase to show, whether a release is landed and what the situation sentence says are inputs-in, answer-out functions in a new `apps/indusk-mcp/src/lib/run-record/` folder (the clock, the process reads and git are inputs, `lesson: code-that-decides-takes-its-clock-and-its-reads`), exported through the package's existing `build` export the admin already imports. The admin's `build-host.ts` only supplies the reads and writes the record. This keeps nearly every row a `unit` test that starts nothing.
3. **A run's record is one JSON file per plan and kind in machine state**, `<indusk eval home>/runs/<plan>.<kind>.json`, written whole by temporary file and rename, read by one reader that returns `unknown` for a missing, cut-off or unreadable file. It holds `{ plan, kind, step, phase, pid, startedAt, stop, stopReason, updatedAt }`. Machine state is outside the repository, so a record never shows as a change in the plan's tree (`/decisions/bookkeeping-lives-where-it-is-read`). The in-memory map in `build-host.ts` stays as a cache; the record is the truth and is read on every ask.
4. **"Is the process alive" is asked once, through `lib/process-identity.ts`'s `isOwnProcess`**, of the run's own process: the step session's `claude` child the host spawns for each step, never the admin daemon's pid. The record takes the session manager's own `SessionRecord` for that child (`pid`, `bin` as the marker, `startedAt` written just after spawn, so within `isOwnProcess`'s 5 s tolerance of the process's real start time) through a new `onSession` callback on `runStepSession`, rewritten each time a step starts its session. Alive is that pid, still running that program, with that start time. Between two steps of a live run (one session ended, the next not yet spawned) the run is alive because this daemon holds it in memory as running: the in-memory entry is read only for the daemon's own runs, and after a restart there is none, so the record alone decides. `indusk ui start` ends a crashed daemon's recorded sessions (`reapRecorded`), so after a restart a run normally reads stopped, "its process is gone"; a step session still alive with its recorded start time reads running (A10). The earlier draft recorded the daemon's `process.pid` against the run's start time, which read every run started more than 5 s after the daemon booted as dead (plan review, impl.md:370); A73 starts a real child and checks alive, then dead.
5. **Build after a death asks the documents, not the record.** `startBuild` already picks the step from the plan's files through the existing next-step reader; the change is that a dead record no longer blocks it (the "already building" refusal reads liveness, not the record's `running` flag) and the phase shown is read from the plan every time (`nextBuildStep(readBuildPlan(...))`), never from the record's start-time phase. The record's `phase` field is history. A plan whose dead run is a planning run, or whose impl is not yet approved, is sent by `startBuild` to `startPlanning` (the admin's Build route calls only `startBuild`), so Build restarts a dead planning run at its next planning step (A13, A74).
6. **A release reads released, and a plan reads complete, from the landing on main, never from branch containment.** `plans land` merges with the subject `Merge plan/<plan>: <plan> landed` and then deletes the branch, so the branch is not there to ask. Landed is: a commit on the trunk whose subject is that landing subject (`git log <trunk> --merges --format=%s`, exact match), or the plan's archive folder on the trunk (`git cat-file -e <trunk>:.indusk/planning/archive/<plan>`). A branch with no landing merge is never complete, including a branch just made from main with no commits, which is an ancestor of main (A87). If not landed, the release reads stopped with `plans land`'s own refusal text if one was captured, else "the release ended but the plan is not on main".
7. **The shell guard is one new PreToolUse hook on Bash, `plan-write-guard.js`**, registered in `HOOK_REGISTRATIONS` under `["PreToolUse", "Bash", "plan-write-guard.js"]` only. It follows `looks-approval-guard.js`, the existing Bash write-refusal hook (a tripwire for an agent's ordinary attempt, reading command text, never a script's behaviour), and the test plan's Decision 8 list. It exports `refusalFor(command)` and runs its `main` only when executed, so the unit rows import it and the contract rows run it with a real payload. It takes no part in `trunk-guard.js`'s two-matcher rule: it guards a shell path only (Edit and Write already pass the plan's checks), so one matcher is the whole gate, and the hooks rule file says so. A second hook, `plan-write-witness.js` (PostToolUse on Bash), refuses nothing; it only records what the plan folders hold after each command, for the signals (Decision 8).
8. **The hook records decisions; the package judges them against sources the hook does not use.** A hook cannot import the tracer, and a verdict the guard gives itself can never read broken (plan review, impl.md:570). So the guard writes no verdict: for each command that names a plan path, or runs with its working directory inside a plan folder, it appends one decision line (`{ command, cwd, decision: "refused" | "allowed", files, before }`, where `before` is the size and modified time of every file under the project's `.indusk/planning/`, read by `stat`) to `<machine state>/plan-write-decisions.jsonl` through a new port `hooks/_clause-verdicts.js` (pinned equal to `lib/promises/clause-verdicts.ts` by the hook-shared-modules test, as `_inbox.js` is). A second new hook, `plan-write-witness.js` (PostToolUse on Bash), appends the same `stat` read taken after the command ran (`after`), keyed by the payload's tool-use id. The package's drain (`drainPlanWriteDecisions`, at the start of any `indusk` command and each admin recorder tick, best-effort, deleting only what it sent) judges each decision from two sources the guard's text rule never touches: what changed on disk between `before` and `after`, and a real shell parser from npm (`shell-quote`'s `parse`, chosen over writing a second hand parser) reading the command's redirects, commands and arguments. A refusal of a command the parser reads as writing a plan path reports `shell-write-refused` upheld; a refusal of a command the parser reads as only reading reports `reads-pass` broken, naming the command; an allowed command after which a plan document changed on disk reports `shell-write-refused` broken, naming the file and the command (except an `indusk` command, and the git commands that move between committed states, below); an allowed command with nothing changed reports `reads-pass` upheld. A script file whose text names no plan path still writes unseen by the guard, but the on-disk comparison sees the change and reports it broken (U1 is detected, not prevented). **Git commands:** `git mv`, `git rm`, `git checkout -- <path>`, `git restore`, and `git apply` or `patch` naming a plan path are refused; `git merge`, `git pull`, `git checkout <branch>`, `git switch`, `git reset --hard` and `git stash pop` are allowed, because they move a checkout between committed states and write no new plan-document text (the test plan's Decision 8, an open decision for the person). **Shell forms:** the guard tracks `cd` within the command and resolves relative paths against the payload's `cwd`; it reads the text of `bash -c` and `sh -c` as a command; it refuses `sed -i` and `sed --in-place`, `perl` with `-i`, `python`/`python3`/`node`/`ruby`/`perl` inline text (`-c`/`-e`) that names a plan path or runs in a plan folder with a write call, and `find` over a plan path with `-delete` or `-exec rm`. A raw `mv` of a plan folder is refused naming `indusk plans archive <plan>`, the package command the retrospective now uses to archive a plan (Build Phase 3).
9. **The impl's clause rules go through the contract command, not a second reader in the hook.** The hooks' own rule is that a check needing a brief or the registry runs through `indusk promises contract` (`validate-impl-structure.js` already hands it the impl as it would be written, `--impl-stdin`). So the two new rules are added beside `lib/promises/clause-rules.ts` in a new `lib/promises/clause-signal-rules.ts` and called from the contract check; no `_`-port and no new hook code. A task "names a clause's signal" when its line, or its folded technical detail, contains the clause's name, the word `signal`, and the repo path of the source file that reports it, outside a code fence (A39, A83). A word match cannot prove a report is emitted, so the rule's own signal reads an independent source: `indusk promises confirm` on a `clauses: required` plan reports `refused-without-signals` broken for each split or limit clause still at no-signal (A84), the case where the rule let through a task that reports nothing. The refusal lists `promise/clause` per line. **Which impls are judged on save:** an impl whose `status` is `draft` (being written). An approved, in-progress or completed impl is never newly refused for it, which is how an impl saved before the rule and edited later stays editable (A40) without a flag or a migration. Because that leaves this plan's own impl unjudged once approved, this plan's self-check is a unit test that runs the two rule functions on its own brief and impl whatever their status (A85).
10. **The two landed plans' clauses are reported by the code that keeps them.** `bringTrunkIntoPlan` (merge of trunk), the conflict refusal and the acceptance output report `a-brief-is-accepted-on-current-main/<clause>` through `writeClauseSignals`, from the CLI and from the admin's planning start alike. Nothing is marked by hand. The unit rows (A46–A48) assert the spans through the package's in-memory capture tracer (`lib/promises/capture-tracer.ts`), not a mock of the writer, so they read the span attributes the promise reader reads; A86 runs `indusk plans accept-brief` as a process against a local Jaeger and finds the span delivered before the process exits. `a-conflict-refuses` reports only when an acceptance meets a conflict, which unattended work rarely does, so the after-landing check L2 makes one real conflicting acceptance on a scratch plan before running `indusk promises confirm a-brief-is-accepted-on-current-main`; that plan then closes by its ordinary confirm.
11. **Approval's readers become one, and it compares the hash.** Today `plans approve` (`lib/plans/approve.ts`) checks no plan review at all, the admin's offer is decided in `lib/plans/waiting.ts` (`planWaiting`, from `plan.planReview`), which the admin's `planning-reader.ts` fills with `readPlanReview` (text only, no hash), and only the planning run's stop (`read-planning.ts`' `readReview`) compares the recorded `read:` hash. `planReviewState(text, documentsHash)` in `lib/plans/plan-review.ts` becomes the one reader, returning `missing`, `stale` (the recorded `read:` is not `planReviewHash` of the documents now), `unanswered` or `answered`; `readPlanReview(planDir)` reads the four documents and hashes them, so `planning-reader.ts` gets the hash-aware state with no change to its call; `planWaiting` offers approval only on `answered` and lists `stale` and `missing` as needing the plan review; `read-planning.ts`' `readReview` and `approve.ts` call the same function. A plan whose impl is written, with no plan review at all or a plan review for different documents, and that no run is still writing, lists as "needs its plan review". The brief's Changes entry is applied in Build Phase 5 with `indusk promises change`, after the code makes the new sentence true.
12. **The patient recorder test waits through one injected rule, on a scan record the loop is given to write.** `lib/admin/wait-for-incident.ts` takes the clock, a read of the incident, and a read of whether the admin's scan has finished after the break was loaded; it passes when the incident appears, fails naming the break when the scan has finished and none appeared, and ends after a generous upper bound only to stop a hung admin. The recorder loop writes nothing today (`recorder-loop.ts` drops a pass's result and only logs a pass that throws), so this is new work: the loop writes a scan record per project to machine state (`<machine state>/recorder-scan.json`: `{ startedAt, endedAt, ok, error? }` for the last pass). A scan "finished after the break" is a pass that started after the break was loaded and ended `ok`; a pass that threw (a Jaeger query timed out under load) is not a finished scan, so the wait goes on to its upper bound and the failure then names the break and the last pass's error. The upper bound (default 4 minutes) is one exported constant, and the test's own vitest timeout is that bound plus its setup margin, so vitest never ends the test before the rule decides. The load case no longer saturates the machine: it stops the admin daemon (`SIGSTOP`) for longer than the old minute after the break is loaded and resumes it (`SIGCONT`), which delays the scan exactly as a busy machine does while adding no load to other landings. The clause's signal is reported by `plans land` from its clause-test runner, a real command run rather than a test: when the runner's results include a file carrying `clause: landing-tests-hold-under-load/recorder-waits-for-its-break`, it reports upheld for a pass and broken, naming the plan landing, for a failure (A90). It reports at each landing whose clause tests include the recorder test, which is this plan's own landing and any later plan whose rows name it; between those landings the clause reads no-signal, which is the honest reading. The test stays in the system tier (it starts Jaeger, the always-on server and the admin) and asserts exactly what it asserted before.
13. **Tiers.** The default tier for the work step is `med` (`workflow.steps.work.tier`). Build Phase 3 (a hook every shell command passes through) and Build Phase 5 (the readiness gate every plan's approval goes through) are `strong` for the same reason `check-gates.js` edits are: a mistake in either silently weakens a gate for every plan. The rest are `med`.
14. **Operational live checks are not clause proofs, and what they would have caught is moved into rows that run real reads.** L1–L3 run only after landing and sit in the table as `live check` rows whose `For` is a reason, never a clause (the second clause of `a-plan-with-clauses-carries-its-signals`, applied to itself). Each carries a `manual:` command, so verify reports them unverified, not passed. Because the unit rows inject their reads, the parts L1 and L2 alone exercised now have landing rows of their own: A73 runs liveness against a real child process and real `ps` start times, A21 and A87 run the landed check after a real `plans land` in a temporary repository, and A86 delivers a real accept-brief span from a process.
15. **Nothing reads in progress without a live process, in every place that can.** The planning steps (`lib/plans/steps.ts`), the Planning audit step, the Build step, the release indicator and the situation sentence each take the run's live state: a step whose documents say it is active reads in progress only while a live process runs for that plan and kind; with none it reads to do (the existing not-yet rendering, so no new look), and the situation says stopped or waiting (A69, A81, A82).
16. **The Planning audit is a step whose order holds.** The Planning audit step is kept wherever the impl step is (it filters with the impl, since a plan review is not a required document). While the plan review is missing, stale, unanswered or being written, the Impl step reads done (written) rather than "you approve it", and the Planning audit step is the step the plan is at; once the review is answered for the documents as they stand, the Planning audit reads done and the Impl step reads "you approve it". So the page never asks for approval while the audit runs (A72, A88).
17. **Signals read a source independent of the code they judge.** A signal that compares a display with the function that produced it can never read broken. So: `shows-where-it-is` compares the phase shown with the phase the live step session was started for, read from the runner's own step report, and reports only while a build runs; `says-what-is-true` and `never-in-progress-when-idle` re-derive each claim from raw sources at report time, with no call to the situation reader or the run record: a running claim needs a process in the process table (`psAll`) whose pid and start time equal a session the session manager holds for that plan and kind (its own sessions file), or this daemon's in-memory running entry; a complete claim needs the landing subject in `git log <trunk>`; `released-only-when-landed` runs the same git read when the admin marks a release released.
18. **The signal tasks are in the phases below, one per split and limit clause (fourteen).** Until Build Phase 4 lands the rule, this plan is held to it by hand: each signal task's fold names `signal`, the clause, where it is read, and the source file that reports it; A85 then checks it by running the rule on this impl.
19. **Tests that start a process are system-tier; the rule tests are not.** The repo's rule (`everyday-tests-never-wait`) makes any test that runs a hook or a child as a process a system-tier file. So the rows that prove a rule import the pure function (`refusalFor`, the new clause rules) and are `unit`; the files that start a process (`plan-write-guard.contract.test.ts`, `impl-clause-signals.contract.test.ts`, `run-liveness.contract.test.ts`, `accept-brief-signals.contract.test.ts`) are `contract` and are added to `vitest.tiers.ts`. A consequence: the unit rows for the guard and the clause rules import symbols that do not exist until their build phase, so they are written there and registered below, not written red in Test Phase 1.
20. **Two looks change, and they are approved before the plan is.** The brief's Changes lists `plan.working` (the planning steps gain a Planning audit step after the impl; the build controls name the real phase and a dead run's reason) and `plan.released` (a plan merged to main reads complete, green and not pulsing, with a confirmation list ticked as each signal and live check is confirmed). Both are redrawn as mockups and approved by the person before this plan is approved; drawing them is outside this impl. Build Phase 2, the phase that changes the page, rechecks the looks against the approved mockups, and `nav.expanded` must not break.

## Scope

### In Scope

- A run record on disk for builds, planning runs and releases; the admin reads it; dead runs read stopped with a reason; Build restarts from the documents.
- The build controls and the nav row stating the plan's real situation in words, read from the record and the files.
- A release read as released by git.
- A new Bash hook that refuses a shell command that writes, moves or deletes a plan document, a witness hook that records what changed, and `indusk plans archive` so the release archives through the package.
- The impl rules of the contract check (a signal task per clause, no after-landing proof of a clause), and signal reports for `a-brief-is-accepted-on-current-main`'s three clauses.
- One reader of the plan review for the approval offer and `plans approve`; the changed sentence of `approval-waits-for-a-finished-plan`.
- The patient admin-recorder landing test.

### Out of Scope

- Telling the person outside the admin that a run stopped (`activity-and-graph`).
- Running phases in parallel (`run-the-graph`).
- Guarding writes outside plan folders (A35 pins that they are not refused).
- Reading script files the guard cannot see into (U1).
- A new component in the admin: the existing stop sentence and Build button carry a dead run; the changed looks `plan.working` and `plan.released` are redrawn as mockups before approval (Decision 20), and `nav.expanded` is held as it is.
- Drawing the two mockups: done before approval, outside this impl.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Every test that can be written today, red; the register of those that wait | Existing hooks, readers, fixtures (`planLifecycleProject`), `build-host.ts` |
| Build Phase 1 | `lib/run-record/{record,liveness,restart}.ts`; the admin's record writes; Build after death | `process-identity.ts`, `next-step.ts`, the machine-state home |
| Build Phase 2 | `lib/run-record/{shown-phase,landed,situation,next-step}.ts`; the Planning audit step in `lib/plans/steps.ts`; controls and nav wired to them | Build Phase 1's record reader, `plan-review.ts`, the approved `plan.working` and `plan.released` mockups |
| Build Phase 3 | `hooks/plan-write-guard.js`, `hooks/plan-write-witness.js`, `hooks/_clause-verdicts.js`, the registrations and the drain; `indusk plans archive` and the retrospective's use of it | `HOOK_REGISTRATIONS`, `_inbox.js` pattern, `looks-approval-guard.js`, `shell-quote` |
| Build Phase 4 | `lib/promises/clause-signal-rules.ts` called by the contract check; confirm-time reports; the accept-brief signal reports | `clause-rules.ts`, `contract.ts`, `confirm.ts`, `clause-signal.ts`, `capture-tracer.ts`, `bring-trunk.ts` |
| Build Phase 5 | One hash-aware plan-review reader behind the waiting list and `plans approve`; the changed promise | `plan-review.ts`, `read-planning.ts`, `waiting.ts`, `planning-reader.ts`, `approve.ts` |
| Build Phase 6 | `lib/admin/wait-for-incident.ts`; the recorder loop's scan record; the landing's report of the clause; the patient recorder test | `recorder-loop.ts`, `land.ts`, the existing recorder test |

## Test Trajectory

Rows A65–A72 follow the test plan's sections for `says-what-is-true`, `never-in-progress-when-idle`, `always-a-next-step` and `the-planning-audit-is-a-step` (see Decision 1).

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A build, a planning run and a release, each started, leave a record on disk naming plan, kind, step, phase and process before the first step finishes | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A2 | When a run moves to its next step or phase the record says so at once; reading never shows the step it has left | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A3 | After the admin's in-memory knowledge is dropped, the plan page shows the same step, phase and state for each of the three kinds of run | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A4 | A run that ends on its own (finished, waiting amendment, rate limit, refused gate) has its stop and reason written; the page still shows it after a restart | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A5 | A cut-off or unreadable record reads unknown, never running; the page renders and other plans' records are unaffected | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A6 | Records are per plan and kind; two plans, or one plan's build and release, never read each other's | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/kept-on-disk | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A7 | A run whose recorded process is gone with no stop reads stopped, and the sentence says it died | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A8 | A run whose recorded pid is now a different program reads stopped, never running | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A9 | A run whose recorded step-session process is alive with its recorded start time reads running, however long after the admin started; the dead-run check never stops a live run | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A10 | The admin restarted while the build's step-session process is alive: the run still reads running, judged by that process, never by the admin's own | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/liveness.test.ts |
| A11 | Build on a dead run starts the step the documents say is next (a build that died in the second phase restarts there), with nothing for the person to clear first | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A12 | Build is not refused as already running by a dead record, and still refused while a live run of the same plan and kind exists | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A13 | A dead planning run restarts at the planning step the documents say is next, never at the release and never at a build step before approval | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A14 | A build started at Test Phase 1 that has since closed three build phases shows the phase the plan is on now, not Test Phase 1 | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A15 | A plan that moves a phase between two page loads shows the new phase on the second load with no run-state change | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A16 | A plan whose current phase cannot be read names no phase, never a wrong one | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A17 | The stop sentence keeps naming the plan's real phase when the run has stopped (waiting amendment, rate limit, dead run) | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/shows-where-it-is | apps/indusk-mcp/src/lib/run-record/shown-phase.test.ts |
| A18 | A release whose step ended cleanly while `plans land` refused the plan reads stopped with the refusal's reason, never released | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A19 | A release whose plan is on main reads released, whether run now or found after an admin restart | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A20 | A release whose process died before landing reads stopped saying so, and Build restarts it at the step the plan is at; never released | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A21 | In a real temporary repository a plan landed through the package's landing (its branch deleted afterwards) reads released and complete, found by its landing merge or its archive folder on the trunk; the same plan before landing reads stopped | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A22 | A shell redirect (`>`, `>>`, `&>`) or `tee` into a plan's impl.md is refused naming impl.md and the Edit tool; the file is unchanged | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A23 | `sed -i` and `perl -pi` on a plan document are refused naming the file and the tool; the checkbox is not ticked | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A24 | `mv`, `cp`, `install` into a plan's folder and `rm`, `truncate` of a plan document are refused naming the file; a `mv` of a whole plan folder names `indusk plans archive` as the command to use | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A25 | `git mv`, `git rm`, `git checkout --` and `git restore` of a plan document are refused; a plain `git add` or `git commit` of one is not | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A26 | An inline interpreter (`node -e`, `python -c`) whose text names a plan-folder path with a write call is refused; one naming no plan path is not looked at | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A27 | The refusal covers a plan under `archive/` and any document in the folder, not only the impl | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A28 | One write anywhere in a pipeline or `&&` chain (`cat impl.md && echo done >> impl.md`) refuses the whole command, naming the file | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A29 | A malformed, empty or unparsable shell command neither breaks the shell tool nor refuses a read | Test Phase 1 | Build Phase 3 | passing | contract | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts |
| A30 | Given a real shell-tool payload the hook answers in the form Claude Code reads and exits so the command does not run; a write to a plan path leaves the file unchanged | Test Phase 1 | Build Phase 3 | passing | contract | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts |
| A31 | `indusk` commands that change a plan document (`plans accept-brief`, `plans approve`, `promises declare`) are not refused | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A32 | `cat`, `head`, `tail`, `sed -n`, `grep`, `rg`, `wc`, `ls`, `diff`, `git diff`, `git log`, `git show`, `git status`, and `git add`/`git commit` of a plan document are all allowed | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A33 | A command that names a plan path only as text (commit message, `echo` to a file outside plan folders, `cat impl.md > /tmp/copy`) is allowed | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A34 | `2>&1`, `>/dev/null`, `2>/dev/null` and a here-document whose body mentions a plan path are not read as writes to it | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A35 | Writing outside plan folders (`.claude`, source files, `.indusk/current.md`, `.indusk/planning/master.md`) is not refused | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A36 | An impl of a brief with clauses where no phase names a clause's signal is refused, listing each clause lacking one as `promise/clause` | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A37 | With two clauses missing a signal task and one present, the refusal names exactly the two, each on its own line | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A38 | An impl with a task naming every split and limit clause's signal is saved; a resting clause needs none | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A39 | A signal task is found by the clause's name in a task line or its folded detail, not in prose outside a task and not inside a code fence | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A40 | A brief without `clauses: required` is not asked for signals; an impl saved before the rule (approved or in progress), edited in a way that adds no clause, is not refused for it | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A41 | The refusal reaches the person as the save check's message when the agent writes the impl and when the planning run writes it; nothing is saved over it | Test Phase 1 | Build Phase 4 | passing | contract | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/__tests__/impl-clause-signals.contract.test.ts |
| A42 | A row of level `live check` whose `For` names a clause is refused naming that row and clause, saying a live check runs only after landing | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A43 | The same for `smoke` and `promise` levels; a row of level `unit` or `contract` naming the same clause is saved | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A44 | A `live check` row that names a promise, no clause, or a reason is saved | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A45 | A row with several `For` entries, one a clause, is refused for the clause; the refusal names the one entry | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A46 | Accepting a brief on a branch behind main reports `main-is-merged-first` upheld, from the code that merges main, in the command line and the admin's planning start alike | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A47 | A conflicting acceptance refused with the brief still a draft reports `a-conflict-refuses` upheld; one that let a half-merge through reports it broken | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A48 | An acceptance on a branch behind main with no conflict, asking nothing, reports `the-person-never-merges` upheld; a refusal telling the person to merge main reports it broken | Test Phase 1 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A49 | A report that cannot be sent (no daemon) never fails the acceptance or the planning start | Test Phase 1 | Test Phase 1 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts |
| A50 | A plan whose plan review was written for documents that have since changed is not offered for approval by the admin's waiting list (read through the admin's planning reader); it is listed as needing its plan review | Test Phase 1 | Build Phase 5 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A51 | A plan whose review is current and has every finding answered is offered for approval | Test Phase 1 | Test Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A52 | A plan whose impl is written with no plan review at all and no run writing it is listed as needing its plan review, not as waiting on a session | Test Phase 1 | Build Phase 5 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A53 | A plan whose review has an unanswered finding is not offered | Test Phase 1 | Test Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A54 | `plans approve` and the admin's offer agree for each state above, because they ask one reader of the review | Test Phase 1 | Build Phase 5 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A55 | A plan a session is still writing is not offered and not listed as needing a plan review | Test Phase 1 | Test Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A56 | A build on an accepted, approved plan still runs unasked to review; a run that dies in the middle reads stopped with its reason instead of disappearing | Build Phase 1 | Build Phase 1 | passing | unit | promise: a-build-runs-to-review-unasked | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A57 | Build after a restart or on a dead run of a plan not yet accepted never starts the release; it starts the step the plan is at | Build Phase 1 | Build Phase 1 | passing | unit | promise: nothing-ships-until-accepted | apps/indusk-mcp/src/lib/run-record/restart.test.ts |
| A58 | An accepted brief still starts its planning run on acceptance, and that run has a record on disk like any other | Build Phase 1 | Build Phase 1 | passing | unit | promise: an-accepted-brief-is-planned-unasked | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A59 | With the admin's scan delayed past the old minute (the daemon paused, then resumed, adding no load to the machine), the production break is still recorded and committed and the test passes: it waits for the incident, not for sixty seconds | Test Phase 1 | Build Phase 6 | passing | contract | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/__tests__/admin-recorder.test.ts |
| A60 | With a break the admin never records, the test fails (does not hang, does not pass) and says which break it waited for | Build Phase 6 | Build Phase 6 | passing | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/wait-for-incident.test.ts |
| A61 | The patient test asserts what the old one did: exactly one incident, committed by the admin with the same subject, with a clean working tree | Test Phase 1 | Test Phase 1 | passing | contract | promise: a-production-break-is-recorded-unasked | apps/indusk-mcp/src/__tests__/admin-recorder.test.ts |
| A62 | An incident that appears after the old fixed minute but before the admin's scan ends passes; none after a scan that ended cleanly fails; a scan that threw is not a finished scan, and the wait goes on to its upper bound | Build Phase 6 | Build Phase 6 | passing | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/wait-for-incident.test.ts |
| A63 | The new shell hook is registered under Bash in the project's settings and synced byte for byte from the package | Test Phase 1 | Build Phase 3 | passing | unit | a regression guard: a hook that is not registered refuses nothing, and no clause test would see it | apps/indusk-mcp/src/__tests__/hook-registration.test.ts, apps/indusk-mcp/src/__tests__/skill-sync-parity.test.ts |
| A64 | A run record written by the admin leaves the plan's working tree clean: a record is machine state outside the repository | Build Phase 1 | Build Phase 1 | passing | unit | a regression guard on Decision 3, keeping bookkeeping out of plan documents | apps/indusk-mcp/src/lib/run-record/record.test.ts |
| A65 | A plan whose planning run is on a step reads "planning" with that step (writing the test plan, writing the impl, reading the plan cold), on the page and in its nav row | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A66 | A plan whose build is on a phase reads "building" with that phase; one waiting on the person reads what it waits on (review, approval, an amendment, its plan review) | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A67 | A plan merged to main reads complete (green), with no release indicator pulsing, and a confirmation step listing what is still to be confirmed (each clause signal and each live check by name), each ticked when confirmed; it never reads "landed" or "releasing" | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A68 | A plan whose run stopped reads "stopped" with the reason and what starts it again | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A69 | An accepted plan with no release process running, after an admin restart, reads landed, stopped or waiting, never "release in progress" | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/never-in-progress-when-idle | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A70 | For every situation short of closed (planning, waiting for looks, waiting for approval, building, at review, releasing, landed waiting on signals, stopped), the page and the nav row show a next step and who takes it | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/always-a-next-step | apps/indusk-mcp/src/lib/run-record/next-step.test.ts |
| A71 | No open plan in the project's real planning folder reads without a next step (a check over every plan the admin lists) | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/always-a-next-step | apps/indusk-mcp/src/lib/run-record/next-step.test.ts |
| A72 | A plan's planning steps read Research, Brief, Test plan, Decision, Impl, Planning audit; the audit reads in progress while the plan-review step runs, to do when the review is missing or unanswered and nothing runs, and done once it is answered | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step | apps/indusk-mcp/src/lib/plans/steps.planning-audit.test.ts |
| A73 | A real child process recorded as a run's process (its pid, its program and its start time read from the process table just after it started) reads running while it lives, minutes after any other start time, and stopped once it is killed | Build Phase 1 | Build Phase 1 | passing | contract | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-mcp/src/__tests__/run-liveness.contract.test.ts |
| A74 | Build pressed on a plan whose dead run was a planning run starts the planning run again at its next planning step, never the build | Build Phase 1 | Build Phase 1 | passing | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A75 | A write to a relative path after `cd` into a plan folder, or to a bare file name while the shell's working directory is a plan folder, is refused naming the file | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A76 | The text of `bash -c` and `sh -c` is read as a command; `python3 -c`, `perl -i -pe`, `sed --in-place` and `find` with `-delete` or `-exec rm` over a plan path are refused | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A77 | `git apply` or `patch` naming a plan path is refused; `git merge`, `git pull`, `git checkout <branch>`, `git switch`, `git reset --hard` and `git stash pop` are allowed, since they move between committed states | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A78 | The drain reports a refused command a real shell parser reads as a write to a plan path as `shell-write-refused` upheld, and an allowed command after which a plan document changed on disk as broken, naming the file and the command | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/lib/promises/clause-verdicts.test.ts |
| A79 | The drain reports a refused command a real shell parser reads as only reading as `reads-pass` broken, naming the command, and an allowed command that changed nothing on disk as upheld | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/lib/promises/clause-verdicts.test.ts |
| A80 | `indusk plans archive <plan>` moves the plan's folder into the archive through git and is not refused by the guard, and the retrospective skill's archival step uses it | Build Phase 3 | Build Phase 3 | passing | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/lib/plans/archive.test.ts |
| A81 | A planning step, and the Planning audit step, read in progress only while a live planning process runs for the plan; with none, the step the plan is at reads to do | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/never-in-progress-when-idle | apps/indusk-mcp/src/lib/plans/steps.planning-audit.test.ts |
| A82 | A building or releasing plan whose process is gone never reads building or releasing, and its Build step and release indicator neither read in progress nor pulse | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/never-in-progress-when-idle | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A83 | A task that names a clause and the word signal but no source file that reports it does not count as the clause's signal task | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/clause-signal-rules.test.ts |
| A84 | Confirming the promises of a plan written with clauses reports `refused-without-signals` broken for each split or limit clause still without a report, naming it | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/confirm-signal-rules.test.ts |
| A85 | This plan's own brief and impl pass the two rules when the rule functions are run on them directly, whatever the impl's status | Build Phase 4 | Build Phase 4 | passing | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/own-impl-signals.test.ts |
| A86 | `indusk plans accept-brief` run as a process on a branch behind main, against a local Jaeger, delivers the `main-is-merged-first` span before the process exits | Test Phase 1 | Build Phase 4 | passing | contract | clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report | apps/indusk-mcp/src/__tests__/accept-brief-signals.contract.test.ts |
| A87 | A plan branch just made from main with no commits of its own, and any branch with no landing merge, never reads complete | Build Phase 2 | Build Phase 2 | passing | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A88 | A plan whose review is stale for the documents shows the Planning audit to do and its Impl step not asking for approval | Build Phase 5 | Build Phase 5 | passing | unit | clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step | apps/indusk-mcp/src/lib/plans/steps.planning-audit.test.ts |
| A89 | The recorder loop writes each pass's start, end and outcome to its scan record, and a pass that throws is recorded as not finished | Build Phase 6 | Build Phase 6 | passing | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/recorder-loop.scan.test.ts |
| A90 | Landing reports `recorder-waits-for-its-break` from its clause-test results: upheld when the recorder test passed, broken naming the landing when it failed | Build Phase 6 | Build Phase 6 | passing | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/plans/land-recorder-signal.test.ts |
| A91 | A run that ended on its own at a wait the person has since answered (a planning run stopped `ready-for-approval`, then approved from the command line) never reads "Stopped — ready-for-approval. Build starts the planning again."; it reads the step the plan is at, and its next step is that step's, not "press Build" | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A92 | A plan on main whose confirmation list was not read (the nav row, which loads none) or could not be read (the promise registry unreadable) never says "everything is confirmed" or "Everything it promised is confirmed"; it says the list is on the plan's page, or that it could not be read | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/next-step.test.ts |
| A93 | A live check whose Notes line holds a date beside a failed result, and a promise the plan makes with no clauses that is still `declared`, are listed as still to confirm, never ticked | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/says-what-is-true | apps/indusk-mcp/src/lib/run-record/situation.test.ts |
| A94 | In a real temporary repository whose root checkout is on a branch other than the trunk, a plan landed on the trunk reads complete and its recorded release reads released, never flipped to "not on main" | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A95 | A workbench plan whose landing merge is in its code repository, its documents not yet archived at the workbench root, reads complete | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/released-only-when-landed | apps/indusk-mcp/src/lib/run-record/landed.test.ts |
| A96 | While a just-pressed build is still finding its worktree (before its first step session spawns), the plan reads running, never "the run died", and a second Build press is refused as already building, so one plan never has two builds | Build Phase 7 | Build Phase 7 | written | unit | clause: a-run-is-read-from-its-record/dead-reads-stopped | apps/indusk-admin/src/lib/build-host.record.test.ts |
| A97 | These shell writes to a plan document are refused naming the file: `perl -0pi -e`, `python3 - <<'PY'` (and `node -`, `bash <<EOF`) whose here-document writes a plan path, `node -e "…writeFileSync(process.argv[1])" <plan path>`, `F=<plan path>; echo x >> $F`, `find` over a plan folder piped to `xargs sed -i`, `gsed -i`, `awk -i inplace`, `sponge`, `ed`, `ex`, `vim -c`, `curl -o`, `wget -O`, `tar -C` or `unzip -d` into a plan folder, and `git apply <patch>` whose patch headers name a plan path | Build Phase 7 | Build Phase 7 | written | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A98 | Reads from an inline interpreter (`node -e "process.stdout.write(fs.readFileSync('<plan>/impl.md'))"`, `python3 -c "sys.stdout.write(open('<plan>/impl.md').read())"`) and `git clean -n` or `--dry-run` in a plan folder are allowed | Build Phase 7 | Build Phase 7 | written | unit | clause: a-plan-document-is-written-through-its-checks/reads-pass | apps/indusk-mcp/src/__tests__/plan-write-guard.test.ts |
| A99 | A shell command that starts with `cd` into another checkout of the same project and only reads (the guard run with the first checkout's working directory, the witness with the other's) reports nothing changed and no `shell-write-refused` break | Build Phase 7 | Build Phase 7 | written | contract | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts |
| A100 | A plan document written by the Edit or Write tool while a shell command runs (two tool calls in one turn) is not blamed on that command; a change no tool write accounts for still reports `shell-write-refused` broken | Build Phase 7 | Build Phase 7 | written | unit | clause: a-plan-document-is-written-through-its-checks/shell-write-refused | apps/indusk-mcp/src/lib/promises/clause-verdicts.test.ts |
| A101 | The contract check refusing a draft impl on the two clause-signal rules sends no upheld report of `refused-without-signals` or `a-live-check-proves-no-clause`: the rule never reports its own verdict (Decisions 8 and 17) | Build Phase 7 | Build Phase 7 | written | unit | clause: a-plan-with-clauses-carries-its-signals/refused-without-signals | apps/indusk-mcp/src/lib/promises/confirm-signal-rules.test.ts |
| A102 | A recorder pass whose production read failed (`recordBreaks` resolving with `error` set, as a Jaeger timeout under load does) is written to the scan record as not finished, so the patient test goes on waiting instead of failing "finished a scan … found no incident" | Build Phase 7 | Build Phase 7 | written | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/admin/recorder-loop.scan.test.ts |
| A103 | A landing whose clause-test results carry the recorder clause only in unit files (`wait-for-incident.test.ts`, `recorder-loop.scan.test.ts`), the recorder landing test not among them, reports nothing for `recorder-waits-for-its-break`, never upheld | Build Phase 7 | Build Phase 7 | written | unit | clause: landing-tests-hold-under-load/recorder-waits-for-its-break | apps/indusk-mcp/src/lib/plans/land-recorder-signal.test.ts |
| L1 | After landing, on the installed admin, a build on a scratch plan killed by hand reads stopped with its reason within a page load, and Build starts it again from the phase the plan is on | Build Phase 6 | Build Phase 6 | skipped | live check | a live check of the whole story on the installed admin, recorded in the retrospective; liveness against a real process and real start times is proved at landing by A73, so this proves no clause | manual: after landing run `pnpm install:local` and `indusk ui restart`; start a build on a scratch plan, `kill` its step session's `claude` process by hand, reload the plan page and read the stop sentence, press Build and read the phase it names; record date and result in Notes |
| L2 | After landing, one real conflicting acceptance on a scratch plan, then `indusk promises confirm a-brief-is-accepted-on-current-main` succeeds and that plan closes | Build Phase 6 | Build Phase 6 | skipped | live check | a live check after landing for another plan's close; span delivery from a real process is proved at landing by A86, so this proves no clause | manual: after landing, make a scratch plan whose brief conflicts with main and run `indusk plans accept-brief <scratch>` (expect the refusal, the brief still a draft), accept one scratch brief behind main with no conflict, then run `indusk promises confirm a-brief-is-accepted-on-current-main` and its retrospective close; delete the scratch plans; record the result in Notes |
| L3 | After landing, in a real session, a shell command that tries to tick a box in a plan's impl is refused with the file and the tool named | Build Phase 6 | Build Phase 6 | skipped | live check | a live check against the installed hook; the clause shell-write-refused is proved by A22–A30 | manual: after landing, in a new session run `sed -i 's/- \[ \]/- [x]/' .indusk/planning/<scratch>/impl.md` and read the refusal; record in Notes |

### Deferred Verification

- **Script files that write a plan document without naming it (U1)**
  - reason: a rule that reads the command text cannot read a script's body, and a path built at run time defeats any text rule.
  - would require: running every shell command in a recording sandbox, which this plan does not build.
  - mitigation: the on-disk comparison taken before and after every shell command (Decision 8) reports such a write as `shell-write-refused` broken, naming the file and the command; the phase-boundary check refuses a box ticked without its gates, `indusk verify` detects a premature checkoff, and the change shows in the diff the audit reads.
- **Whether a dead run's stop sentence reads clearly (U2)**
  - reason: wording is a person's judgement.
  - would require: a person reading it on the real page.
  - mitigation: the plan's look `plan.working` is held by its approved mockup and the person reviews the sentence at approval.

## Checklist

### Test Phase 1: Author every test that can be written today, red where today fails it

**Tier**: med — the work step's default

This phase writes the tests the plan commits to before anything changes, so each build phase has a fixed target. Today the shell guard does not exist, the contract check never asks an impl for a signal, accepting a brief reports no clause, and the approval offer does not compare the plan review with the documents, so those tests fail on their own assertions. The tests of things that must stay true (the existing acceptance behaviour, the existing recorder test's assertions) pass from the start and are recorded as guards. Tests of brand-new code (the run record, the shown phase, the landed check, the shell guard's rule, the clause rules, the wait rule) cannot be loaded until the build phase that creates them and are registered below with the reason.

- [x] Create or confirm this plan's own worktree before any edit.
  <details><summary>Technical</summary>

  `indusk worktree create a-run-can-be-trusted` (records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign a-run-can-be-trusted /Users/the_dusky/code/sandbox/dusk-worktrees/a-run-can-be-trusted`). Worktree-per-plan default; this plan does not set `worktree: none`. The worktree exists (`indusk plans start` made it): `git -C /Users/the_dusky/code/sandbox/dusk-worktrees/a-run-can-be-trusted rev-parse --abbrev-ref HEAD` expects `plan/a-run-can-be-trusted`. Use absolute paths in every command.

  </details>
- [x] Write the shell guard's two contract tests, which run the hook as Claude Code runs it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/plan-write-guard.contract.test.ts`, headers `// clause: a-plan-document-is-written-through-its-checks/shell-write-refused` (A29, A30). `spawnSync(process.execPath, [hook], { input: JSON.stringify(payload) })` with `hook` = `hooks/plan-write-guard.js`, a payload copied from a captured Claude Code PreToolUse event (`{ session_id, transcript_path, cwd, hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command } }`) over a temp project with a plan folder. A30: a write command (`sed -i … impl.md`) expects exit 2, stderr naming `impl.md` and the Edit tool, and the file byte-identical afterwards. A29: an empty, a malformed and an unparsable command expect exit 0 and no stderr refusal. Today the hook file does not exist, so `node` exits non-zero without the expected text and A30 fails on its own assertion; A29 fails the same way (exit is not 0 for the missing file). Run through the repo's hook helper (`runHook`) and list the file in the system tier (it starts a process).

  </details>
- [x] Write the contract test that a refused impl reaches the person as the save check's message.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/impl-clause-signals.contract.test.ts` (A41, `// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals`): spawn the existing `hooks/validate-impl-structure.js` with a Write payload over a temp plan folder whose brief says `clauses: required` with two clauses and whose draft impl names no clause's signal; expect exit 2, a message listing both as `promise/clause`, and the impl file absent afterwards. Today the check saves the impl, so the test fails on its assertion. System tier, as above.

  </details>
- [x] Write the tests that accepting a brief reports its three clauses.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts`, header `// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report`. From `planLifecycleProject("accept-brief-signals")` (real git, temp home), with the package's in-memory capture tracer (`lib/promises/capture-tracer.ts`) as the tracer, never a mock of the writer, so each expectation reads the span's own `indusk.promise`, `indusk.clause` and outcome attributes as the promise reader does; then run `acceptBrief` for A46 (branch behind main: expect a verdict `{ promise: "a-brief-is-accepted-on-current-main", clause: "main-is-merged-first" }` without `broken`), A47 (conflict: `a-conflict-refuses` without `broken`; a stub that lets a half-merge through gives `broken`), A48 (no conflict, nothing printed to merge: `the-person-never-merges` without `broken`). A46–A48 fail today (no span); A49 (a tracer that throws on `startSpan`, `acceptBrief` still returns its result) passes today and is a guard. The admin's planning start is covered by the same expectation in `apps/indusk-admin/src/lib/build-host.trunk.test.ts` (extend its planning-start cases there with the captured span).

  </details>
- [x] Write the contract test that accepting a brief from the command line delivers its signal before the command exits.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/accept-brief-signals.contract.test.ts` (A86), header `// clause: a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report`. Start a local Jaeger with the existing helper (`helpers/local-jaeger.js`), make a temp project whose plan branch is behind main, run `indusk plans accept-brief <plan>` with `runCli` pointed at that Jaeger, and after the process has exited query Jaeger for a span carrying `indusk.clause = main-is-merged-first`. Red today on its assertion (no span). System tier: add it to `vitest.tiers.ts`.

  </details>
- [x] Write the tests of the approval offer and that approving agrees with it.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/decisions-reader.approval.test.ts`, header `// promise: approval-waits-for-a-finished-plan`. Build temp plan folders with a written impl and: a plan review hashed over the current documents with every finding answered (A51: offered), a plan review hashed over older documents (A50: not offered, listed as needing its plan review), no plan review and no run (A52), an unanswered finding (A53), a session still writing (A55). The offer is read where it is decided: the admin's planning reader (`apps/indusk-admin/src/lib/planning-reader.ts`) builds each plan's snapshot and the package's `planWaiting` (`lib/plans/waiting.ts`) turns it into the waiting list, so A50 and A52 assert on that list (an approval entry, or a needs-its-plan-review entry). A54 calls both the offer (`lib/decisions.ts` over `planWaiting`) and the approve command's readiness check (`readPlanning`'s `review`, used by `plans approve`) over every state and expects equal answers. A50, A52, A54 fail today; A51, A53, A55 pass and are guards.

  </details>
- [x] Make the recorder landing test hold what it held, so it can be made patient without weakening.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/admin-recorder.test.ts` already asserts one incident with the same subject and a clean tree (A61): add the headers `// promise: a-production-break-is-recorded-unasked` and `// clause: landing-tests-hold-under-load/recorder-waits-for-its-break` and a delayed-scan case (A59): after the break is loaded, pause the admin daemon (`process.kill(adminPid, "SIGSTOP")`, its pid from the `indusk ui` record) for 75 seconds and resume it (`SIGCONT`, also in `finally`), then expect the same pass. This delays the scan past the old minute as a busy machine does, without the per-core busy loops an earlier draft used, which would have loaded every other landing running at the same time. Today A59 fails by the fixed one-minute wait; it is a system-tier test (already listed in `vitest.tiers.ts`).

  </details>
- [x] Add the guard test that the new hook is registered and synced.
  <details><summary>Technical</summary>

  Extend `apps/indusk-mcp/src/__tests__/hook-registration.test.ts` so `HOOK_REGISTRATIONS` must contain `["PreToolUse", "Bash", "plan-write-guard.js"]` and `["PostToolUse", "Bash", "plan-write-witness.js"]`, and both hook files must exist in both `hooks/` and the project's `.claude/hooks/` (A63; `skill-sync-parity.test.ts` already pins byte equality of installed copies). Red today: the registration is absent.

  </details>
- [x] Make sure no test fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Every test written here imports only symbols that exist today (`acceptBrief`, `planLifecycleProject`, the offer in `lib/decisions.ts`, `readPlanning`, the hook paths as strings given to `spawnSync`). Run each new file once: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run <the new files>` and `pnpm --filter @infinitedusky/indusk-admin exec vitest run <the new admin file>`; the red ones must fail on an assertion, never on an import or fixture error. A missing hook file is the spawned process's non-zero exit, which the assertion reads.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules; nothing to change.
- [x] Shape — review a file this phase changed and leave it as it is
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/accept-brief-signals.test.ts`: calls acceptBrief through a loosely typed alias because the third argument (a tracer) is the seam Build Phase 4 creates; the alias is removed in that phase, when the real signature exists.

  </details>

#### Deferred to Build Phase 1

- **A1–A13, A56–A58, A64, A73, A74** — their subjects are `record.ts`, `liveness.ts` and `restart.ts` under `lib/run-record/` and the admin's `build-host.record.test.ts` wiring, which Build Phase 1 creates; a test importing them today fails to load, not to assert. Body reviewed (A8, representative; the record is read by a reader that takes the process reads as inputs):

  ```typescript
  // clause: a-run-is-read-from-its-record/dead-reads-stopped
  import { runStatus } from "./liveness.js";

  it("A8: a recorded pid that is now a different program reads stopped", () => {
  	const record = {
  		plan: "p",
  		kind: "build",
  		process: { pid: 4242, bin: "claude", startedAt: "2026-10-19T10:00:00.000Z" },
  		stop: null,
  	};
  	const status = runStatus(
  		record,
  		{
  			alive: () => true,
  			command: () => "/usr/bin/vim notes.txt", // not the program we started
  			startTime: () => new Date("2026-10-19T10:00:00.000Z"),
  		},
  		false, // not held in memory by this daemon
  	);
  	expect(status).toEqual({ state: "stopped", reason: expect.stringContaining("gone") });
  });
  ```

#### Deferred to Build Phase 2

- **A14–A21, A65–A72, A81, A82, A87** — their subjects are `shown-phase.ts`, `landed.ts`, `situation.ts` and `next-step.ts`, which Build Phase 2 creates, and the Planning audit step that Build Phase 2 adds to the planning steps, whose state reads the planning record Build Phase 1 creates; a test importing them today fails to load, not to assert. Body reviewed (A14):

  ```typescript
  // clause: a-run-is-read-from-its-record/shows-where-it-is
  import { shownPhase } from "./shown-phase.js";

  it("A14: a build started at Test Phase 1 shows the phase the plan is on now", () => {
  	const plan = planWith({ closed: ["Test Phase 1", "Build Phase 1", "Build Phase 2", "Build Phase 3"], open: ["Build Phase 4"] });
  	expect(shownPhase(plan, { startedAtPhase: "Test Phase 1" })).toBe("Build Phase 4");
  });
  ```

#### Deferred to Build Phase 3

- **A22–A28, A31–A35, A75–A80** — their subjects are `refusalFor`, exported by `hooks/plan-write-guard.js`, the drain in `lib/promises/clause-verdicts.ts` and the `plans archive` command, which Build Phase 3 creates; a unit test importing it today fails to load, and one that spawns the hook instead is a system-tier file (Decision 19), which A29 and A30 already are. Body reviewed (A23, representative):

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

- **A36–A40, A42–A45, A83–A85** — their subject is the clause rules in `lib/promises/clause-signal-rules.ts` and the confirm-time report, which Build Phase 4 creates. Body reviewed (A42):

  ```typescript
  // clause: a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause
  import { afterLandingClauseRows } from "./clause-signal-rules.js";

  it("A42: a live check row naming a clause is refused naming the row and the clause", () => {
  	const rows = [{ id: "L1", level: "live check", forCell: "clause: p/c" }];
  	expect(afterLandingClauseRows(rows)).toEqual([{ row: "L1", clause: "p/c" }]);
  });
  ```

#### Deferred to Build Phase 5

- **A88** — its subject is the stale state of the one plan-review reader, which Build Phase 5 adds; the Planning audit step reads it once it exists.

#### Deferred to Build Phase 6

- **A60, A62, A89, A90** — their subjects are `waitForIncident` in `lib/admin/wait-for-incident.ts`, the recorder loop's scan record and the landing's report of the clause, created in Build Phase 6. Body reviewed (A62):

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

#### Deferred to Build Phase 7

- **A91–A103** — falsification hypotheses formed by `/falsify` on 2026-10-19, after this phase had closed, so they could not be written here; Build Phase 7 (the Falsification phase) writes each red against the code as it stands before its fixes. Their subjects all exist today except the tool-write record A100 reads, which Build Phase 7 adds.

#### Regression Guards

- **A49** — a report that cannot be sent never fails the acceptance: already true today (nothing is reported), and the build must not break it; it has no red window.
- **A51** — a plan whose review is current and answered is offered: already true, the build must keep it.
- **A53** — a plan whose review has an unanswered finding is not offered: already true, the build must keep it.
- **A55** — a plan a session is still writing is neither offered nor listed as needing a plan review: already true, the build must keep it.
- **A61** — the recorder test's existing assertions (one incident, same subject, clean tree); it passes today and is the baseline the patient test must keep.

#### Test Phase 1 Verification

- [x] The tests this phase writes exist, and each red one fails on its own assertion rather than on a missing file. (write red)
  <details><summary>Technical</summary>

  Result (run with the system config for the contract files: `pnpm exec vitest run --config vitest.system.config.ts <files>` in `apps/indusk-mcp`; the admin file with `pnpm exec vitest run` in `apps/indusk-admin`, after `pnpm build` in `apps/indusk-mcp` made `dist/`): A29, A30, A41, A46, A47, A48, A50, A54, A59, A63, A86 fail on their own assertions today; A49, A51, A53, A55, A61 pass as guards. A52 also passes today (a plan with no review is already listed as needing its plan review), so it is kept `written` and stays a guard until Build Phase 5 changes the reader beneath it. A59 and A61 ran once in the system tier (the admin bundle was built first with `pnpm --filter indusk-admin build` and `node scripts/bundle-admin.js`): A61 green, A59 red by the fixed minute.

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.contract.test.ts src/__tests__/impl-clause-signals.contract.test.ts src/__tests__/accept-brief-signals.contract.test.ts src/lib/plans/accept-brief-signals.test.ts src/__tests__/hook-registration.test.ts` and `pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/decisions-reader.approval.test.ts`: A29, A30, A41, A46–A48, A50, A52, A54, A63, A86 are red on assertions (write the red items, `(write red)`); A49, A51, A53, A55 pass. A59 and A61 are run once in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/admin-recorder.test.ts`). The whole suite runs at landing, not here.

  </details>
- [x] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Judged unattended (decisions, each with its reason). A8: did not compile against Build Phase 1's own task (a flat `pid` where the record holds `process: { pid, bin, startedAt }`, no third `heldHere` argument, and a start time that differed from the recorded one, which would have hidden a marker bug), and expected "died" where the rule's reason reads "the run's process is gone"; the body above is corrected to the task's shape and to `gone`, and the "died" wording is the situation sentence's (A7, Build Phase 2). A14: sound, but it uses a `planWith` helper that does not exist; Build Phase 2 writes it beside `shown-phase.test.ts`. A23: imports `refusalFor` from `../../hooks/plan-write-guard.js`, which resolves from `src/__tests__/` to the package's hooks folder and is the export Build Phase 3 creates; asserts the file and the Edit tool as claimed. A42: its row shape (`id`, `level`, `forCell`) and function name are the ones Build Phase 4 creates; asserts the claim. A62: the fake-clock call matches `waitForIncident`'s inputs as Decision 12 gives them and asserts a pass between the old minute and the scan's end, as claimed.

  Each body reviewed against both questions: will it compile at the phase it names (its imports are exactly the exports that phase creates), and does it assert what it claims (A8, A14, A23, A42 and A62 above).

  </details>

#### Test Phase 1 Context

- [x] Record in the shared part of the current-work file that this plan's tests are written red and which Stabilize item it is.
  <details><summary>Technical</summary>

  Done by a direct edit of the `## Project (shared)` region, which any agent may edit: `update_current_section` writes only a per-session section, never the shared one.

  `current.md: ## Project (shared)` — one line under the Stabilize list: `a-run-can-be-trusted: tests written red; build in flight` via `mcp__indusk__update_current_section`; committed like any file. Destination tier: current.md (operational state, not a rule).

  </details>

#### Test Phase 1 Document

- [x] Write the three after-landing checks, with the commands that run them, into this impl's Notes so the retrospective runs them.
  <details><summary>Technical</summary>

  Notes section: L1, L2, L3 as numbered steps copied from their `manual:` cells, each with a blank "date / result" line; the retrospective reads this list.

  </details>

#### Test Phase 1 Forward Intelligence

- **Trajectory**: A29, A30, A41, A46, A47, A48, A50, A54, A59, A63, A86 are `written` (red on assertions); A49, A51, A53, A55, A61 are `passing`. A52 is `written` but passes today: a plan with no review is already listed as needing its plan review, so its red window is empty until Build Phase 5 changes the reader; do not read its green as the build's doing.
- **Decision**: `acceptBrief(anyCheckout, plan, { tracer })` is the seam A46–A49 assume (third argument, optional). Build Phase 4 must create exactly that, then drop the loosely typed alias in `accept-brief-signals.test.ts`. A47's second half (a stub that lets a half-merge through reports `broken`) and the admin's planning-start lane (`build-host.trunk.test.ts` reading the captured span) need that seam and a git seam, so Build Phase 4 writes them; no tracer seam existed in the admin's lane to inject today.
- **Decision**: A41's contract test judges a `draft` impl (Decision 9's rule) over the clause-plan fixture; the impl save check skips the contract for drafts today, which is the red.
- **Decision**: A59's pause uses a `setTimeout` resume plus a `finally` resume so a failing run never leaves the admin stopped; both admin-recorder suites start their own two sources and admin.
- **Watch out**: the work session's `INDUSK_BUILD_STEP=work` is in the environment; any test that runs `plans accept-brief` as a process must unset it (A86 does), and the unit tests delete it in `beforeEach`.
- **Watch out**: the admin tests need `apps/indusk-mcp/dist/` (`pnpm build` there), and the recorder test needs the bundled admin (`pnpm --filter indusk-admin build`, then `node scripts/bundle-admin.js` in `apps/indusk-mcp`); both are untracked build output. `everyday-tests-never-wait` already fails on files from earlier plans (accept-brief-conflict, accept-brief-main, accept-brief-verb, test-run, build-host.trunk) and none of this phase's.
- **Watch out**: the plan's own Test Phase 1 first item was ticked by a shell `sed -i` before the shell guard exists (nothing refuses it yet); later items went through the Edit tool.
- **Assumption**: the system-tier files added to `vitest.tiers.ts` are `plan-write-guard.contract`, `impl-clause-signals.contract`, `accept-brief-signals.contract` and `accept-brief-signals`; Build Phase 1 adds `run-liveness.contract`.

### Build Phase 1: Keep every run on disk, read it back, and let Build start a dead run again

**Tier**: med — the work step's default

This phase makes the admin's builds, planning runs and releases leave a record on disk and read it back, which is what every later promise in this plan stands on. A run writes its step, phase, process and stop as they change; a reader returns what the record says, or "unknown" when the file is cut off; a run whose process is gone, or is now another program, reads stopped saying it died; and Build on such a run starts the step the plan's own documents say is next. The next phase uses the same record to name the phase and to judge a release.

- [x] Add the run record: a file per plan and kind in machine state, written whole and read safely.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/run-record/record.ts`: `writeRunRecord(home, record)` (temporary file in the same directory then `renameSync`), `readRunRecord(home, plan, kind)` returning `RunRecord | "unknown" | null` (null: no file), `RunRecord = { plan, kind: "build" | "planning" | "release", step, phase, process: { pid, bin, startedAt } | null, startedAt, stop, stopReason, updatedAt }` — `process` is the current step session's `claude` child (Decision 4), `startedAt` is when the run began. The home is the machine-state directory `indusk eval home` prints (`lib/bookkeeping/home`); a path join under `runs/`. Never throws on a bad file. Header `// clause: a-run-is-read-from-its-record/kept-on-disk`.

  </details>
- [x] Add the one rule that says whether a run is alive, using the existing process-identity reader.
  <details><summary>Technical</summary>

  New `lib/run-record/liveness.ts`: `runStatus(record, deps: ProcessDeps, heldHere: boolean)` → `{ state: "running" | "stopped" | "unknown", reason? }`. A record with a `stop` reads stopped with that reason; `heldHere` (this daemon holds the run in memory as running, the gap between two step sessions) reads running; otherwise `isOwnProcess(record.process.pid, [record.process.bin], deps, record.process.startedAt)` from `lib/process-identity.ts` — the step session's own pid, program and start time, never the daemon's or the run's start — alive reads running, anything else (no process recorded, gone, a recycled pid) reads stopped with "the run's process is gone". Write A73 in `src/__tests__/run-liveness.contract.test.ts` (system tier): spawn `node -e "setTimeout(()=>{},120000)"`, record its pid, `process.execPath` as the marker and its start time read by `realProcessReads.startTime`, set the run's `startedAt` ten minutes earlier, expect running with the real reads; kill it, wait for exit, expect stopped. Nothing in the file calls `process.kill(pid, 0)` itself (`lesson: identify-a-process-by-what-it-cannot-rewrite`). `readRunRecord` returning "unknown" yields unknown, never running. Header `// clause: a-run-is-read-from-its-record/dead-reads-stopped`; the limit `never-in-progress-when-idle` is proved where the situation is stated, in Build Phase 2 (A69).

  </details>
- [x] Add the rule that picks the step Build starts from the plan's documents.
  <details><summary>Technical</summary>

  New `lib/run-record/restart.ts`: `restartStep(kind, plan)` over the existing `nextBuildStep(await readBuildPlan(root, plan))` and `nextPlanningStep` (`lib/build/next-step.ts`, `next-planning-step.ts`). A build never answers `release` unless the plan is accepted (`nothing-ships-until-accepted`); a planning kind never answers a build step or release. Export `restartStep` and the record functions from the package's `build` export so the admin imports them.

  </details>
- [x] Make the admin write the record as a run starts, advances and stops, and read it on every ask.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`: in `startBuild`, `startRelease` and `startPlanning` write the record before the first step finishes; `onStep` rewrites it on each step and phase; the `.then`/`.catch`/`.finally` handlers write `stop` and `stopReason`; `buildState` and `planningState` merge the in-memory entry with `readRunRecord` + `runStatus` (the record wins when the entry is absent, as after a restart). The process is the step session's: add `onSession?(record: SessionRecord)` to `BuildSessionOptions` in `apps/indusk-mcp/src/lib/build/build-session.ts`, called by `oneSession` right after `manager.start` with the manager's own `SessionRecord` (`pid`, `bin`, `startedAt`), and have the host's `run` closures (build, release and planning) rewrite the record's `process` with it. Never the admin daemon's `process.pid`.

  </details>
- [x] Make a dead run stop blocking Build.
  <details><summary>Technical</summary>

  `startBuild`'s `existing?.running` and `planningState(...).running` checks, and `startRelease`'s, read `runStatus(...).state === "running"`, not the flag. A still-live run of the same plan and kind is still refused ("already building"); a dead one starts again from `restartStep`. When the plan's dead run is a planning run, or its impl is not yet approved, `startBuild` calls `startPlanning(project, plan)` instead of `runBuild`, since the admin's Build route (`apps/indusk-admin/src/app/api/plans/build/route.ts`) calls only `startBuild` (A74 in `build-host.record.test.ts`). `decisions-reader.ts`' `stoppedAt` reads the merged state.

  </details>
- [x] Report the signal for the clause that a run is kept on disk.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/kept-on-disk` — read in the run record and what the admin shows after a restart. Reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`. After each start/advance/stop write, read the file back with a plain `JSON.parse(readFileSync(...))` (not `readRunRecord`) and compare with the in-memory run that was written, and call `writeClauseSignals(root, "run.record", plan, { plan: "a-run-can-be-trusted", phase: "Build Phase 1" }, [{ promise: "a-run-is-read-from-its-record", clause: "kept-on-disk", ...(same ? {} : { broken: "<plan> <kind> record differs from the run" }) }])` in `lib/run-record/signals.ts`; best-effort, never failing the run.

  </details>
- [x] Report the signal for the clause that a dead run reads stopped.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/dead-reads-stopped` — read in the stop sentence and Build's answer. Reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`, judged against the process table, not `runStatus`: when Build is pressed, read `psAll()` for the record's step-session pid and start time; if no such process lives and Build was refused as "already running", report `broken` naming the plan; if none lives and the state shown was `stopped` and Build started a new run, report upheld; a process that lives while the state shown is `stopped` is `broken` too (a live run called dead).

  </details>
- [x] Report the signal for the limit that nothing reads in progress while idle.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/never-in-progress-when-idle` — read wherever the admin shows a plan as in progress, reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`. Judged against raw sources with no call to `runStatus` or the run record (Decision 17): each plan shown in progress needs a process in `psAll()` whose pid and start time equal a session the session manager holds for that plan and kind (its own sessions file), or this daemon's in-memory running entry; with neither, `broken` naming the plan and what was shown; upheld otherwise, at most once per plan per tick.

  </details>
- [x] Shape — give the build host's inline record reader a name of its own.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`: `buildState` held an inline function that read the newest build or release record; it is now the named `buildStateOnDisk` (rule: an inline block should be a named function, and the named piece is what a test of the page can reach).

  </details>
- [x] Shape — review the two step wrappers in the build host and leave them as they are.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/build-host.ts`: the build's and the planning run's `run` closures each wrap `runStepSession` with the same record write before and after. Two occurrences, not three (the release shares the build's through `depsFor`); whether a shared wrapper is worth it is `/cleanup`'s at close.

  </details>

#### Build Phase 1 Verification

- [x] The run record, the liveness rule, the restart rule and the admin's wiring are proved.
  <details><summary>Technical</summary>

  A1–A13, A56–A58, A64, A74 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/run-record && pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/build-host.record.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/build-host.ts`); A73 passes in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/run-liveness.contract.test.ts`, added to `vitest.tiers.ts`) — the whole suite runs at landing, not here. The existing `build-host*.test.ts` files stay green.

  </details>

#### Build Phase 1 Context

- [x] Write the Key Decisions line in the root context file and the run-record rule in the package's context file.
  <details><summary>Technical</summary>

  root (Key Decisions): `- A run is read from its record: ... — see /decisions/a-run-can-be-trusted` — always-on because it states design intent every session's agent must not contradict (a run's truth lives on disk, not in the admin's memory). `apps/indusk-mcp/CLAUDE.md` (the `lib/build/` entry or a new Runs entry): "A run's state is `lib/run-record`'s record; liveness is asked only through `process-identity.ts`; the admin's in-memory map is a cache" — destination tier: the area's own file, loaded when a file there is read.

  </details>

#### Build Phase 1 Document

- [x] Document the run record on the admin reference page.
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/admin-ui/overview.md`: where a run's record lives, what "stopped — the run's process is gone" means, and that Build restarts it. Mermaid sequence of start → record → read-after-restart is optional.

  </details>

#### Build Phase 1 Forward Intelligence

- **Trajectory**: A1–A13, A56–A58, A64, A73 and A74 are `passing`. A1, A2, A4–A6 and A64 passed from the moment `record.ts` existed (the record is the first item), so their red window was empty; the rest were red on assertions against stubs of `liveness.ts` and `restart.ts` (the build-host rows against a host that wrote no record).
- **Decision**: the record is its own package export, `@infinitedusky/indusk-mcp/run-record`, not only the `build` export the task named. The admin's existing tests mock `@infinitedusky/indusk-mcp/build` whole (`build-host.release.test.ts` returns a fixed list of names), so a record function imported from there would be undefined under that mock. The `build` export re-exports the same names for callers that read it as one surface.
- **Decision**: a record's `stop` is the runner's own stop object (`{ step, ...}`) and `stopReason` its `why`; the page rebuilds `BuildState.stop` from it, so the stop sentence and the Needs you card read the same after a restart. A run whose process is gone with no stop reads `stop: { step: "cannot-continue", why: "the run's process is gone" }`, the shape the page already words; Build Phase 2 words it as "died".
- **Decision**: `runStatus` order is unknown record, then held-here, then no record, then a written stop, then the process. An unreadable record is unknown even when this daemon holds the run, as the task says (never running); the host reads its own in-memory entry first, so a live run in this daemon is unaffected.
- **Decision**: a run's process is cleared in the record after each step session ends (`process: null`), so a daemon that dies between two steps reads dead (no process, no stop, nothing held). A daemon that dies mid-step leaves the pid, which the process table then shows gone or reused.
- **Decision**: `startBuild` consults the documents only when a dead record exists (`deadRun`); a plan with no record starts exactly as before. This keeps the existing host tests, whose mocked `readBuildPlan` returns `{}`, unchanged. A dead record means: no stop written, liveness reads stopped. The newest such record among planning, release and build picks the route: planning (or any plan whose impl is not past `approved`/`in-progress`/`completed`) goes to the planning run, a release of an accepted plan restarts the release, everything else the build.
- **Decision**: the admin's tests now run in a temporary `INDUSK_HOME` (set in `apps/indusk-admin/vitest.config.ts`). Without it the existing host tests wrote records into the person's real `~/.indusk/projects`; four such folders made while building this phase were removed.
- **Decision**: the signals take their inputs through `lib/run-record/signals.ts` and are called from `build-host.ts`: kept-on-disk after every record write (read back with `JSON.parse`), dead-reads-stopped when Build is pressed over a record with a recorded process (psAll), never-in-progress-when-idle at most once per plan and kind every 15 seconds while a run reads as running (psAll beside `sessionManager().running()`). Build Phase 2 widens the last to every place the page shows in progress.
- **Watch out**: `INDUSK_BUILD_STEP=work` is in a build session's environment; `plans-land.test.ts` and any test that runs `plans accept` as a process fail with "not accepted from inside a build step" unless it is unset (`env -u INDUSK_BUILD_STEP`). Not a regression.
- **Watch out**: `indusk plans tests --phase 1` reports `admin-recorder.test.ts` failing: it holds A59, the delayed-scan case written red in Test Phase 1 and made to pass in Build Phase 6. It is the expected red, not this phase's. `context-tiers-register.test.ts` (root under 80% of its budget) was already red before this phase (root 14839 bytes against 14745); this phase's root line is the shortest one that says it (+186 bytes).
- **Watch out**: `decisions-reader.planning.test.ts` (A13, from an earlier plan) fails with no `bringTrunkIntoPlan` on its `plans` mock, which `startPlanning` calls; it predates this phase and is not caused by it.
- **Assumption**: the Context item's pointer to `/decisions/a-run-can-be-trusted` is `.indusk/planning/a-run-can-be-trusted/brief.md` for now, since the decision page is written at the retrospective; the retrospective's compaction swaps it.

### Build Phase 2: Show the real phase, the real situation, and a release that landed

**Tier**: med — the work step's default

This phase makes the admin say true things from the record the last phase keeps. The build controls name the phase the plan is on, read from the plan's files each time; the plan page and its nav row state the plan's situation in words from one reader; and a release reads released only when the plan is on main, otherwise stopped with the reason. Every plan that is not closed shows its next step and who takes it; the planning steps gain a Planning audit step after the impl; and a plan merged to main reads complete, with a list of what is still to be confirmed, ticked as each is. The page is then checked against the two looks the person approved before the plan did.

- [x] Make the build controls name the phase the plan is on, read from the plan each time.
  <details><summary>Technical</summary>

  New `lib/run-record/shown-phase.ts`: `shownPhase(plan, { startedAtPhase })` returns the first phase with work left from `nextBuildStep` (never the record's phase), or `null` when unreadable. The admin's build controls (the component that renders the stop sentence on the plan page; find it with `grep -rn "buildState" apps/indusk-admin/src/app apps/indusk-admin/src/components`) call it; the record's phase is shown nowhere.

  </details>
- [x] Make a release read released only when the plan has landed.
  <details><summary>Technical</summary>

  New `lib/run-record/landed.ts`: `landedOnMain(trunk, plan, git)` (git is an input) is true only when the trunk's history has a merge whose subject is exactly `Merge plan/<plan>: <plan> landed` (`git log <trunk> --merges --format=%s`; the workbench landing uses `Merge <code branch>: <plan> landed`, matched by its ` <plan> landed` ending on a merge) or the trunk holds `.indusk/planning/archive/<plan>` (`git cat-file -e <trunk>:.indusk/planning/archive/<plan>`). It never asks whether the branch is an ancestor: `plans land` deletes the branch, and a fresh branch with no commits is already an ancestor (Decision 6). `releaseOutcome({ stepResult, landedOnMain, landError })`, with the trunk branch from `lib/trunk-branch.ts`; not landed reads `{ state: "stopped", reason: landError ?? "the release ended but the plan is not on main" }`. In `startRelease`'s handlers replace the `r.released` reading with it; capture `plans land`'s refusal text from the release step's output. A release found after a restart is judged the same way. A21 builds a temp project with `planLifecycleProject`, lands the plan with the package's `landPlan` (clause tests injected as passing), confirms the branch is gone, and expects released; A87 makes a branch from main with no commits and expects not landed.

  </details>
- [x] Add the one sentence that states a plan's situation, and use it on the page and the nav row.
  <details><summary>Technical</summary>

  New `lib/run-record/situation.ts`: `situation({ record, status, plan, files })` → a sentence for planning (and its step), building (and its phase), waiting on the person (and for what: review, approval, an amendment, its plan review), complete (merged to main), or stopped (and why, and what starts it again). An accepted plan with no live release process never reads "release in progress" (A69). The plan page and `nav.expanded`'s plan row call it; the wording of existing sentences is kept. Rows A65, A66, A68, A69 in `situation.test.ts`. Header `// clause: a-run-is-read-from-its-record/says-what-is-true` and `// clause: a-run-is-read-from-its-record/never-in-progress-when-idle`.

  </details>
- [x] Show a plan merged to main as complete, with a confirmation list of what is still to be confirmed.
  <details><summary>Technical</summary>

  In `situation.ts`, a plan whose landing is on the trunk (the `landed.ts` check: its landing merge or its archive folder, never branch containment) reads complete: green, no release indicator pulsing, never "landed" or "releasing". It carries `confirmations: { name, kind: "clause signal" | "live check", confirmed }[]` — each split and limit clause of the brief's promises, confirmed once its signal has reported upheld in a real run (the promise reader `indusk promises confirm` uses), and each `live check` row of the impl, confirmed once its Notes result is recorded. The plan page renders it as the confirmation step of `plan.released`, a tick per confirmed item. Row A67 in `situation.test.ts`.

  </details>
- [x] Give every plan that is not closed a next step and who takes it.
  <details><summary>Technical</summary>

  New `lib/run-record/next-step.ts`: `nextStepFor(situation)` → `{ text, by: "system" | "person" | "event" }` for every situation short of closed (planning: "the system is writing the impl"; waiting for looks or approval: "you approve it"; building; at review; releasing; complete with confirmations open: "closes when its clauses report from a real run"; stopped: what starts it again). It never returns nothing for an open plan. The plan page and the `nav.expanded` row show it beside the situation. Rows A70 (every situation) and A71 (over every plan `indusk plans` lists in this repo's `.indusk/planning/`) in `next-step.test.ts`. Header `// clause: a-run-is-read-from-its-record/always-a-next-step`.

  </details>
- [x] Add the planning audit to the plan page's planning steps, after the impl.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/steps.ts`: add `{ name: "Planning audit", … }` after Impl in `PLANNING` (extend `PlanningStepName`). It is filtered with the impl, never as a document of its own: `planSteps` keeps it whenever the workflow's required documents include the impl (`requiredDocuments` never lists a plan review, so filtering it as a document would drop it). Its state reads the snapshot's `planReview` (today missing, unanswered or answered; Build Phase 5 adds stale) and the planning run's live state from Build Phase 1, passed into `PlanSnapshot`: in progress while a live planning process is on its plan-review step, to do when the review is missing or unanswered and nothing runs, done once every finding is answered. The Impl step changes with it (Decision 16): a draft impl whose review is not answered reads done (written), not `needs-you`, so `stepAt` lands on the Planning audit; once the review is answered the Impl step reads `needs-you`. Rows A72 in `steps.planning-audit.test.ts`, which also asserts `stepAt` names the Planning audit, never Impl, while the audit is open. Header `// clause: a-run-is-read-from-its-record/the-planning-audit-is-a-step`.

  </details>
- [x] Make every step, indicator and situation read in progress only while a process runs for it.
  <details><summary>Technical</summary>

  `steps.ts`' `planningStep` and `releaseStep` take the run's live state for the plan (Decision 15): an `active` segment reads `current` only while a live process of that kind runs, else `not-yet` (the step the plan is at, to do; no new state, no new look). `situation()` and the release indicator read the same live state: a build or release with no live process never reads building, releasing or pulsing. Rows A81 in `steps.planning-audit.test.ts` (planning steps and the Planning audit) and A82 in `situation.test.ts` (Build step, release indicator, sentence). Header `// clause: a-run-is-read-from-its-record/never-in-progress-when-idle`.

  </details>
- [x] Report the signal for the clause that the controls show where the plan is.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/shows-where-it-is` — read in the build controls' text, reported from `apps/indusk-mcp/src/lib/run-record/signals.ts` with `phase: "Build Phase 2"`. Judged against the process doing the work, not `shownPhase` (Decision 17): while a build runs, the phase shown is compared with the phase the live step session was started for, taken from the runner's own `onStep` report for that session; `broken` names the plan, the phase shown and the phase the session works; upheld when they match. Nothing is reported while no build runs.

  </details>
- [x] Report the signal for the clause that a release reads released only when landed.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/released-only-when-landed` — read in the release's state, reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`. When the admin marks a release released, the trunk's own log is read again with a plain `git log <trunk> --merges --format=%s` for the landing subject (not through `landed.ts`); `broken` names the plan if it is absent; upheld otherwise.

  </details>
- [x] Report the signal for the clause that the page says what is true.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/says-what-is-true` — read where the sentence is shown, reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`. The page and the nav row each pass their sentence to the reporter, which re-derives each claim from raw sources with no call to `situation()` or the run record (Decision 17): "planning", "building" or "releasing" needs a live process in `psAll()` matching a session the session manager holds for that plan and kind, or this daemon's in-memory running entry; "complete" needs the landing subject in `git log <trunk>`; "stopped" needs neither a live process nor a landing. `broken` names the plan, the words shown and what the raw source said.

  </details>
- [x] Report the signal for the clause that every open plan has a next step.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/always-a-next-step` — read where the page and the nav row are read. Upheld when every open plan shown has a next step naming who takes it; `broken` names the plan shown with none. Reported through `apps/indusk-mcp/src/lib/run-record/signals.ts`, at most once per plan per read.

  </details>
- [x] Report the signal for the clause that the planning audit is a step.
  <details><summary>Technical</summary>

  signal: `a-run-is-read-from-its-record/the-planning-audit-is-a-step` — read where the planning steps are shown. Upheld when a plan with an impl shows a Planning audit step whose state matches its `plan-review.md` read directly from disk (absent, its `read:` against the documents' hash, every finding answered); `broken` names the plan and the step state shown. Reported from `apps/indusk-mcp/src/lib/run-record/signals.ts`.

  Built in `apps/indusk-mcp/src/lib/run-record/situation-signals.ts` with the other four of this phase (one file for the five, beside Build Phase 1's `signals.ts`). The disk read here compares done against not-done by whether the file is written with every finding answered; the `read:` hash comparison joins it in Build Phase 5, when the step itself learns a stale review.

  </details>
- [x] Shape — give the per-plan reads of the situation reader a name of their own.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/plan-situation.ts`: the loop body of `withSituations` read what runs, the run, the phase, the landing, the confirmations, the sentence and then reported signals (rule: a unit has one reason to change; an inline block that does a job should be a named function a test can reach); it is now `situatedPlan`, and the loop only decides archived or not.

  </details>
- [x] Shape — review the situation sentence, the planning step and the build view, and leave them as they are.
  <details><summary>Technical</summary>

  `situation()` in `run-record/situation.ts` is one ordered list of rules (landed, running, waiting, stopped, idle), each commented, and splitting it would hide the precedence that is its whole content. `planningStep` in `plans/steps.ts` has grown a draft-impl branch, but the audit's own logic is already its own function (`planningAudit`). `buildView` in `build-host.ts` reads the view and reports one signal; the reporting is a single throttled call. Cross-file questions (a shared throttle with `checkInProgress`) are `/cleanup`'s. Note: the mechanical Shape step reported skipped because the phase's second verification item (the looks, a person's) is unchecked; the review above was made by hand against the same rules.

  </details>

#### Build Phase 2 Verification

- [x] The shown phase, the landed check, the situation sentence, the next step, the confirmation list and the Planning audit step are proved, and the existing release and steps tests still pass.
  <details><summary>Technical</summary>

  A14–A21, A65–A72, A81, A82, A87 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/run-record src/lib/plans/steps.planning-audit.test.ts src/lib/plans/steps.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/build-host.release.test.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/build-host.ts`).

  </details>
- [x] The page matches the two looks the person approved, and the nav look still holds.
  <details><summary>Technical</summary>

  Checked by hand 2026-10-19: the blocker this item carried ("the browser tier fails 90 of 99 in every file") did not hold — the admin's whole browser project ran 341 of 343 in this worktree, the two failures being `workflows.test.tsx` A9/A10 expecting the planning list without "Planning audit" (updated: six steps); the look contract `cockpit-redraw.contract.test.ts` (plan.working, plan.released by value in Chromium, on the worktree's own build) passes.

  `plan.working` and `plan.released` are checked by value in Chromium against the mockups the person approved before this plan's approval (drawn outside this impl); `nav.expanded` is unchanged and still passes. Run the admin's look checks over the changed components (`pnpm --filter @infinitedusky/indusk-admin exec vitest related <the changed components>`); a look that does not match its approved mockup is a defect in this phase, never a reason to redraw the mockup here.

  </details>

#### Build Phase 2 Context

- [x] Record in the admin's context file that a plan's situation has one reader.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md`: "A plan's situation sentence comes from `situation()` in the package; the page and the nav row never compose their own" — destination: the app's own file, loaded when a file there is read.

  </details>

#### Build Phase 2 Document

- [x] Document what the plan page's stop sentence can say and why.
  <details><summary>Technical</summary>

  Update `apps/docs/src/reference/admin-ui/overview.md` with the situation sentences (planning, building, waiting, complete, stopped), the next step and who takes it, the Planning audit step, the confirmation list of a merged plan, and the rule that a release reads released only when on main.

  </details>

#### Build Phase 2 Forward Intelligence

- **Trajectory**: A14–A21, A65–A72, A81, A82 and A87 are `passing`. They were authored beside the code in the same pass, so no red window was observed; the check-gates hook refused the first checkoff while they read `planned`, and their states were set with `updateRowState` once the tests ran green. `indusk plans tests --phase 2` runs 25 files; 24 pass and `admin-recorder.test.ts` (A59, written red for Build Phase 6) is the expected red.
- **Unattended: left open for a person.** The Verification item "The page matches the two looks the person approved" is a by-value check in Chromium against mockups; it is left unchecked. Two reasons it cannot be ticked here: it needs a person's judgement against the approved `plan.working` and `plan.released` mockups, and the admin's browser tier (`|browser (chromium)|` files such as `Badge.test.tsx` and `workflows.test.tsx`) fails identically at the Build Phase 1 commit (checked in a scratch worktree), so it gives no signal in this environment. Because that item is open, the mechanical Shape step reports "verification is not green" and skipped; the Shape review above was made by hand against the same rules.
- **Decision**: A step reads in progress only when a `live` fact is given. `PlanSnapshot.live` absent means the caller did not look and a step reads as its documents say (so the older steps tests stay as they were); the admin always passes it (`withSituations`), so nothing it shows reads in progress without a process. `planReview` absent likewise keeps the old Impl reading ("you approve it"); the admin always passes it.
- **Decision**: `plans land` captures no refusal text, so a release stopped after a clean step reads the step's own error, else "the release ended but the plan is not on main". `releaseOutcome` takes a `landError` so a later change can carry the refusal in.
- **Decision**: the nav row does not carry the confirmation count (the page does): the nav reads "Complete — merged to main" and shows the next step on hover; the list needs a promise-standing read per plan, which the nav would pay on every render.
- **Decision**: the Planning audit's signal compares done against not-done by whether `plan-review.md` is written with every finding answered, read from disk; the `read:` hash comparison joins it in Build Phase 5, when the step itself learns `stale` (A88). Until then a stale-but-answered review reads done in both places, so the signal cannot disagree with the page about it.
- **Decision**: Build and release rows A21 and A87 run a real landing in a temporary repository through the package's `acceptPlan` and `landPlan` with the clause tests injected; both refuse inside a build step, so the test deletes `INDUSK_BUILD_STEP` for its run.
- **Decision**: items 1 and 2 are one commit and items 3–5 another (and the five signal items a third): the admin build host and the run-record export are shared between them, so they cannot be committed apart without a tree that does not build.
- **Watch out**: a page test that mocks `@/lib/decisions-reader` must now answer `withSituations` (the shared `decisionsReaderMock` does; `page.test.tsx` and `plan/[name]/page.test.tsx` mock it inline and now do too); a missing answer fails the page at import.
- **Watch out**: the admin imports the package's built `dist/`; after any package change run `pnpm build` in `apps/indusk-mcp` before the admin's type check or tests.
- **Watch out**: `decisions-reader.approval.test.ts` (A50, A54) and `decisions-reader.planning.test.ts` stay red as before; the first two are Build Phase 5's.
- **Assumption**: Build Phase 5 turns the Planning audit's `planReview` input from three states to four (`stale`); `planSteps` and `planningAudit` already treat anything that is not `answered` as an open audit, so `stale` needs no change there.

### Build Phase 3: Refuse a shell command that writes a plan document

**Tier**: strong — a hook every shell command in every session passes through; a mistake either blocks reads or lets writes by

This phase adds a hook on the shell tool that reads each command and refuses one that writes, moves or deletes a file in a plan's folder, naming the file and the tool to use instead. It never refuses a read, a command that only mentions a plan's path as text, or an indusk command (those write through the checks themselves). Each decision is also written to a small file, with what the plan folders looked like on disk before and after the command, and the package judges it from those files and a real shell parser, because a hook cannot send a signal itself and must not judge its own decisions. Archiving a plan, which the release used to do with a raw move, gets its own package command so the release still runs with the guard installed.

- [x] Write the shell guard hook, reading the command's text.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/hooks/plan-write-guard.js`, modelled on `looks-approval-guard.js`, exporting `refusalFor(command, cwd)` (`cwd` from the payload) and running `main` only when executed (`import.meta.url === pathToFileURL(process.argv[1]).href`). Split the command on `&&`, `||`, `;`, `|` and newlines, keeping quotes and here-documents intact; track `cd <dir>` across segments and resolve every relative path against the current directory (A75); read the quoted text of `bash -c` / `sh -c` as a command (A76). Per segment refuse a redirect (`>`, `>>`, `>|`, `&>`) whose target resolves under `.indusk/planning/<plan>/` (including `archive/<plan>/`), `tee`, `sed -i` and `sed --in-place`, `perl` with any `-i` flag, `mv`, `cp`, `install`, `rm`, `truncate`, `dd of=`, `find` over such a path with `-delete` or `-exec rm`, `git mv`, `git rm`, `git checkout -- <path>`, `git restore`, `git apply` / `patch` naming such a path (A77), and `node -e`, `python -c`, `python3 -c`, `perl -e`, `ruby -e` text naming such a path, or run with the current directory inside a plan folder, with a write call (A76). A `mv` whose source is a whole plan folder is refused naming `indusk plans archive <plan>` (A24). Not refused: `2>&1`, `>/dev/null`, `2>/dev/null`, text in a `-m` message or here-document body, `indusk` commands, reads, and the git commands that move between committed states (`merge`, `pull`, `checkout <branch>`, `switch`, `reset --hard`, `stash pop`; Decision 8). A parse failure allows the command. Stderr: `refused: <file> is a plan document; use the Edit tool (or the indusk command for it) so its checks run`; exit 2. `_hook-paths.js` supplies the plan-folder test. Write the unit tests (A22–A28, A31–A35, A75–A77) in `src/__tests__/plan-write-guard.test.ts` importing `refusalFor`, headers `// clause: a-plan-document-is-written-through-its-checks/shell-write-refused` and `…/reads-pass`.

  </details>
- [x] Register the guard under the shell tool and install it.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/hook-command.ts`: add `["PreToolUse", "Bash", "plan-write-guard.js"]` and `["PostToolUse", "Bash", "plan-write-witness.js"]` to `HOOK_REGISTRATIONS` with a comment on why one matcher is the whole gate; run `indusk update` in this worktree so `.claude/hooks/plan-write-guard.js` and `.claude/settings.json` are written from the package (never edited by hand; `skill-sync-parity.test.ts`, A63).

  </details>
- [x] Record each shell decision with the plan folders' state before and after, and judge it in the package.
  <details><summary>Technical</summary>

  New `hooks/_clause-verdicts.js` (`appendDecision(home, line)`; appends one JSON line to `<machine state>/plan-write-decisions.jsonl`) mirroring new `lib/promises/clause-verdicts.ts`, pinned equal by `hook-shared-modules.test.ts` as `_inbox.js` is (add the pair there and bump the pinned `_`-module count). The guard writes `{ toolUseId, command, cwd, decision, files, before }` for each command that names a plan path or runs inside a plan folder, `before` being `{ path: [size, mtimeMs] }` for every file under `.indusk/planning/` read by `statSync`. New `hooks/plan-write-witness.js`, registered `["PostToolUse", "Bash", "plan-write-witness.js"]`, appends `{ toolUseId, after }` the same way (a refused command never runs, so it has no `after`). `drainPlanWriteDecisions(root)` in `clause-verdicts.ts` pairs the lines by tool-use id and judges each from two sources the guard never uses (Decision 8): the change between `before` and `after`, and `shell-quote`'s `parse` (add `shell-quote` to the package's dependencies) reading the command's operators and arguments for a write to a plan path. It calls `writeClauseSignals` per decision as A78 and A79 assert, then removes the lines it sent. An allowed `indusk` command or tree-moving git command is never judged a write. The drain runs at the start of an `indusk` command and on each admin recorder tick, best-effort. Rows A78, A79 in `src/lib/promises/clause-verdicts.test.ts`.

  </details>
- [x] Give archiving a plan its own package command, and make the release use it.
  <details><summary>Technical</summary>

  New `indusk plans archive <plan>` in `apps/indusk-mcp/src/bin/commands/plans.ts` over a new `apps/indusk-mcp/src/lib/plans/archive.ts`: `git mv .indusk/planning/<plan> .indusk/planning/archive/<plan>` run by the package (creating `archive/` first), refused when the plan's promises are not confirmed (the retrospective's Step 8 order) or the target exists. Reuse the folder-move helper behind `plans archive-dead` where it fits. Change Step 9 of `apps/indusk-mcp/skills/retrospective.md` from the raw `mv` to `indusk plans archive {plan-name}`, then run `indusk update` in this worktree so `.claude/skills/retrospective/` is synced from the package (never edited directly; `skill-sync-parity.test.ts`). Row A80 in `src/lib/plans/archive.test.ts`: the command moves the folder in a temp repo, the guard's `refusalFor("indusk plans archive x", cwd)` is null, and the skill's Step 9 names the command and no `mv`.

  </details>
- [x] Report the signal for the clause that a shell write is refused.
  <details><summary>Technical</summary>

  signal: `a-plan-document-is-written-through-its-checks/shell-write-refused` — read in the decision file and the plan folders on disk, reported from `apps/indusk-mcp/src/lib/promises/clause-verdicts.ts` by the drain, never by the hook. Upheld for a refusal the shell parser reads as a write to a plan path; `broken`, naming the file and the command, for an allowed command after which a plan document changed on disk (Decision 8).

  </details>
- [x] Report the signal for the limit that reads pass.
  <details><summary>Technical</summary>

  signal: `a-plan-document-is-written-through-its-checks/reads-pass` — read in the decision file and the plan folders on disk, reported from `apps/indusk-mcp/src/lib/promises/clause-verdicts.ts` by the drain. `broken`, naming the command, for a refusal the shell parser reads as only reading; upheld for an allowed command that named a plan path and changed nothing on disk. A wrongful refusal of a read is never counted for the other clause.

  </details>
- [x] Add the two contract test files to the system tier.
  <details><summary>Technical</summary>

  Already done: all four files were in `SYSTEM` before this phase (Test Phase 1 added the guard's, the clause-signals' and accept-brief's contracts; Build Phase 1 added `run-liveness.contract`), so nothing was added here.

  `apps/indusk-mcp/vitest.tiers.ts`: add `src/__tests__/plan-write-guard.contract.test.ts` and `src/__tests__/impl-clause-signals.contract.test.ts` to `SYSTEM` (and, if their own phases have not already, `run-liveness.contract.test.ts` and `accept-brief-signals.contract.test.ts`) (they run a hook as a process, as Claude Code runs it; `everyday-tests-never-wait` fails them otherwise); landing runs both tiers.

  </details>
- [x] Shape — give the drain's rewrite of the decision file a name of its own.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/promises/clause-verdicts.ts`: `drainPlanWriteDecisions` ends with an inline block that keeps the unsent lines and the lines a hook appended meanwhile, and replaces the file by rename or removes it. It becomes `rewriteDecisionFile(path, readText, keep)` (rule: an inline block that does a job should be a named function; the race it handles — a hook appending while the drain runs — is the part a test should be able to reach).

  </details>
- [x] Shape — review the guard's per-segment rule and the parser's reading, and leave them as they are.
  <details><summary>Technical</summary>

  `judgeSegment` in `hooks/plan-write-guard.js` is one ordered list of verb rules (redirects first, then `cd`, `indusk`, each writer), with `find`, `git` and the interpreters already their own functions; splitting the rest would scatter one decision table. `lex` is long but does one job (shell text to tokens, here-documents and substitutions included). `parserReadsWrite` in `clause-verdicts.ts` is the same table read independently through `shell-quote`, deliberately not shared with the guard (Decision 8: the judge must not reuse the rule it judges). Whether the guard file (about 800 lines) should split into a lexer module is a cross-file question for `/cleanup`.

  </details>

#### Build Phase 3 Verification

- [x] The guard refuses every writing form, allows every read, and is registered.
  <details><summary>Technical</summary>

  Run 2026-10-19: the six files 206 of 206, `vitest related hooks/plan-write-guard.js` 137 of 137, the contract file in the system tier (`pnpm exec vitest run --config vitest.system.config.ts …` in `apps/indusk-mcp`; the plain `exec vitest run` finds no file, since the everyday config excludes the system tier) 10 of 10. `indusk plans tests a-run-can-be-trusted --phase 3`: 24 of 26; the two reds are not this phase's — `admin-recorder.test.ts` (A59, Build Phase 6) and `plans-land.test.ts`, which passes 9 of 9 with `INDUSK_BUILD_STEP` unset (the build step's own environment refuses a landing, Build Phase 1's Watch out).

  A22–A35, A63, A75–A80 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.test.ts src/lib/promises/clause-verdicts.test.ts src/lib/plans/archive.test.ts src/__tests__/hook-registration.test.ts src/__tests__/skill-sync-parity.test.ts src/__tests__/hook-shared-modules.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related hooks/plan-write-guard.js`); A29 and A30 pass in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/plan-write-guard.contract.test.ts`).

  </details>
- [x] This session's own shell is now guarded.
  <details><summary>Technical</summary>

  Run 2026-10-19 in the build session, after `indusk update` installed the hook: the `sed -i` below was refused by `.claude/hooks/plan-write-guard.js` naming `.indusk/planning/a-run-can-be-trusted/impl.md` and the Edit tool, and `git status --porcelain` was empty after it.

  From this worktree run `sed -i 's/Build Phase 1/Build Phase 1/' .indusk/planning/a-run-can-be-trusted/impl.md`; expect the refusal naming `impl.md` and the Edit tool, `git status --porcelain` unchanged. Tick this box with the Edit tool.

  </details>

#### Build Phase 3 Context

- [x] Record the hook and its single matcher in the hooks rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/hooks/CLAUDE.md`: "`plan-write-guard.js` is registered under Bash only — it guards a shell path, Edit/Write already pass the plan's checks; it reads command text, never a script, as `looks-approval-guard.js` does; it records decisions, never verdicts, through `_clause-verdicts.js`, and `plan-write-witness.js` (PostToolUse) records what changed, so the package judges both" — and update the `_`-prefixed module count line. Planning template: `apps/indusk-mcp/templates/planning/CLAUDE.md` gains "A shell command that writes a plan document is refused; use the Edit tool or the `indusk` command — guarded by `plan-write-guard.test.ts`" (never edit `.indusk/planning/CLAUDE.md`).

  </details>

#### Build Phase 3 Document

- [x] Document the shell guard, what it refuses and its one honest gap.
  <details><summary>Technical</summary>

  Written 2026-10-19: the search found no hooks page under `reference/` beyond `reference/tools/indusk-mcp.md`'s Hooks section, which now carries the guard (refused forms, allowed forms, the script-file gap and its compensating controls); the guide's hook table (`guide/index.md`) lists the guard and its witness; `reference/cli/plans.md` documents `plans archive`, and `reference/skills/retrospective.md`'s Step 9 uses it.

  Update the hooks reference page under `apps/docs/src/reference/` (find it with `grep -rln "trunk-guard" apps/docs/src/reference`) with the refused forms (the test plan's Decision 8 list), what is allowed, and the script-file gap with its compensating controls.

  </details>

#### Build Phase 3 Forward Intelligence

- **Trajectory**: A22–A35, A63 and A75–A80 are `passing`. A78–A80 were written red on their own assertions against stubs (`clause-verdicts.ts`, `archive.ts`) before the work, which the check-gates hook required; A22–A28, A31–A35 and A75–A77 import `refusalFor`, which did not exist, so they were written with the guard in the same pass and no red window was observed. A29 and A30 (system tier) were red from Test Phase 1 and pass.
- **Decision**: the guard's `before` reads every file in each active plan folder and only the archived plans the command names, not the whole archive: the archive is about 800 files, which made each decision line tens of kilobytes; an archived plan is closed. A write to an archived plan the command does not name is not seen on disk.
- **Decision**: the guard leaves the before-state for every allowed shell command in `<home>/plan-write-pending/<tool use>.json`, not only for named ones, and the witness records an unnamed command only when a plan document changed under it. This is how a script the guard cannot read (U1) is seen, as the Deferred Verification's mitigation says, without a line per shell command. Pending files older than an hour (a command that failed, or another hook refused) are swept by the guard. A command that exits non-zero gets no PostToolUse, so a failing script's write is not seen.
- **Decision**: the drain keeps a decision without its after line for ten minutes, then drops it unjudged; with no daemon it sends and removes nothing (it never deletes what it did not send). It runs from a `preAction` hook on every `indusk` command except `promises contract` (the impl hook runs that on every edit), at most once a minute; the CLI now ends with `await program.parseAsync()` so the hook is awaited before the action.
- **Decision**: the drain also treats `rebase`, `cherry-pick`, `revert` and `am` as moving between committed states (no broken report for a plan document they change), beyond Decision 8's list; the guard allows them as it allows `merge`.
- **Decision**: an inline interpreter whose text names a plan path and contains any write call is refused even when the write goes elsewhere (`node -e` reading `impl.md` and writing `/tmp/x`); Decision 8 words it that way and the Read tool or a script file serves that read.
- **Decision**: `plans archive-dead`'s mover was not reused for `plans archive`: it renames with `fs`, and the archive must move through `git mv`. `archivePlan` takes git and the declared-promise read as inputs, so A80 stays a unit test.
- **Decision**: `hooks-record-parity.test.ts` learned the words eleven to fourteen; the guide's hook count is "Twelve", and the Dawn master's keep/shed record classifies the guard and the witness as not wired in the thin lane.
- **Watch out**: this phase's shell is guarded from the moment `indusk update` ran; every later session edits plan documents only with the Edit tool. `indusk update` here means the worktree's own build (`node apps/indusk-mcp/dist/bin/cli.js update` after `pnpm build`); the global `indusk` is an older install. It reformats `.claude/settings.json` (spaces for tabs) and bumps `.indusk/config.json`'s version: the first is restored with `biome format`, the second reverted.
- **Watch out**: the session's own environment (`INDUSK_BUILD_STEP=work`, `INDUSK_GATE_POLICY=auto`) turns `plans-land.test.ts` and the `lib/run/` loop tests red; with both unset they pass. Pre-existing reds not this phase's: `contract-resolver-single-definition` (`incident-signal.ts`), `promise-marks-one-query` (`mark.ts`), `steps-name-project-commands` (`work.md`), `everyday-tests-never-wait` (earlier plans' files), `context-tiers-register` (root budget).
- **Watch out**: a hook test that runs the guard or the witness sets `INDUSK_HOME`; the system config does not, and the decision would land in the real home.
- **Assumption**: Claude Code's hook payload carries `tool_use_id` in both PreToolUse and PostToolUse (seen in this session's pending files); without it the pairing key falls back to a hash of the session and the command, which both payloads carry.

### Build Phase 4: Refuse an impl without its clause signals, and let the landed plan's clauses report

**Tier**: med — the work step's default

This phase makes the project's contract check ask two more things of an impl being written for a brief that states clauses: every split and limit clause has a task that reports its signal, and no row that can only run after landing is a clause's proof. The impl hook already hands the impl to that check, so no second reader is added. It also makes the code that accepts a brief report the three clauses of the plan that taught the project to accept briefs on current main, so that plan can close.

- [x] Add the rules that find clauses without a signal task and rows that cannot prove a clause.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/promises/clause-signal-rules.ts`: `missingSignalTasks(brief, impl)` → `promise/clause[]`; `afterLandingClauseRows(rows)` → `{ row, clause }[]` for rows of level `live check`, `smoke` or `promise` whose `For` names `clause:` (one entry among several still counts). A task names a signal when its line or its folded detail contains the clause name, `signal`, and a repo path ending in a source extension (the file that reports it), outside a code fence (`fencedLineMask`) (A39, A83). A resting clause needs none. Judged on save only for an impl whose `status` is `draft` (Decision 9); the two functions themselves take no status, so `src/lib/promises/own-impl-signals.test.ts` (A85) runs them on this plan's own brief and impl. Headers `// clause: a-plan-with-clauses-carries-its-signals/refused-without-signals` and `…/a-live-check-proves-no-clause`.

  </details>
- [x] Call the rules from the contract check so the impl hook's refusal carries them.
  <details><summary>Technical</summary>

  Done 2026-10-19. Decision (unattended): `validate-impl-structure.js` skipped a draft impl entirely, so Decision 9's "judged on save while a draft" needed one hook addition beyond the task text, not a second reader: for a `draft` impl whose sibling `brief.md` says `clauses: required`, the hook runs `indusk promises contract <plan> --impl-stdin --clause-signals-only` (a new flag that asks only these two rules, since the rest of the contract is not yet a draft's to hold). A draft of any other plan is left alone, so an older `indusk` on a machine never blocks a plan that states no clauses. The sweep (`skipDraft`) never asks the rules of a draft. A `rule` field on `ContractRefusal` names which rule refused so the CLI reports it (upheld) beside the refusal.

  `lib/promises/clause-rules.ts` / `contract.ts`: call the two rules when the brief says `clauses: required`; each refusal is one line per clause (`promise/clause`) and one per row, the row message saying a live check runs only after landing so it blocks the clause at close. `validate-impl-structure.js` already passes the impl through `indusk promises contract --impl-stdin`; add nothing to the hook beyond what the hook rules file says a hook may add.

  </details>
- [x] Make accepting a brief report the three clauses.
  <details><summary>Technical</summary>

  Done 2026-10-19. Decisions (unattended): the reports sit inside `bringTrunkIntoPlan` itself (verdicts in `plans/bring-trunk-signals.ts`), not in `accept-brief.ts`, because that one function is what both the command line and the admin's planning start call; so both lanes report with no second call site. Each verdict is read from git after the code ran: `main-is-merged-first` from `git merge-base --is-ancestor <trunk> HEAD`, `a-conflict-refuses` broken when a merge, unmerged files or a moved head remain after the refusal, `the-person-never-merges` broken when a refusal's own words tell the person to merge, rebase or pull the trunk. The tracer seam is `bringTrunkIntoPlan(…, after, { tracer })`, `acceptBrief(…, { tracer })` and `startPlanning(project, plan, { tracer })`; absent, the commands' one tracer. A47's half-merge case needed no code seam: the test wraps `git` with `vi.mock` so `merge --abort` does nothing. `a-conflict-refuses` reports upheld on a refused conflict in the admin's planning start too, where the brief is already accepted: its check is that nothing of the merge remains, not the brief's status.

  `lib/plans/bring-trunk.ts` (merge of trunk → `main-is-merged-first`), the conflict refusal in `accept-brief.ts` (→ `a-conflict-refuses`, `broken` if a half-merge remains) and the output path (→ `the-person-never-merges`, `broken` when the message tells the person to merge): each calls `writeClauseSignals(root, "plan.accept-brief", plan, { plan: "a-brief-is-accepted-on-current-main", phase: "Build Phase 1" }, [...])`, best-effort. The admin's planning start calls the same function, so both lanes report.

  </details>
- [x] Report the signal for the clause that an impl is refused without signals.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/refused-without-signals` — read in the daemon's reports at confirm, an independent source from the impl's text. Reported from `apps/indusk-mcp/src/lib/promises/confirm.ts`: when `indusk promises confirm` runs on a `clauses: required` plan whose impl passed the rule, each split or limit clause still at no-signal is reported `broken`, naming the plan and the clause (the rule let through a task that reports nothing), and each clause that has reported counts as upheld (A84 in `src/lib/promises/confirm-signal-rules.test.ts`, the reads injected). The contract check also reports upheld through `writeClauseSignals` when it refuses a missing signal task.

  </details>
- [x] Report the signal for the clause that a live check proves no clause.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/a-live-check-proves-no-clause` — read in the impl as it is confirmed, reported from `apps/indusk-mcp/src/lib/promises/confirm.ts`: confirm re-reads the trajectory table itself and reports `broken`, naming the row and clause, when a saved impl holds a `live check`, `smoke` or `promise` row naming a clause; upheld otherwise. The contract check reports upheld when it refuses one on save.

  </details>
- [x] Report the signal for the clause that the two landed plans report.
  <details><summary>Technical</summary>

  signal: `a-plan-with-clauses-carries-its-signals/the-two-landed-plans-report` — read as that plan's three clauses by the promise reader, reported from `apps/indusk-mcp/src/lib/promises/confirm.ts` when `indusk promises confirm a-brief-is-accepted-on-current-main` runs: upheld when each of the three has reported in a real run, `broken` naming each still at no-signal. The span delivery from a real process is proved at landing by A86; L2 makes the one conflicting acceptance `a-conflict-refuses` needs before that confirm.

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules by hand; nothing to change.
  <details><summary>Technical</summary>

  The mechanical `prepareShapeReview` returned `review` with 18 files and no unreadable extension rules (read 2026-10-19 after Verification was green); the review was made by hand against its four in-scope questions. `clause-signal-rules.ts` is pure functions of text and rows with one reason to change, and its refusals carry the rule name so the CLI can report which rule refused. `bring-trunk-signals.ts` holds each verdict as a pure function of what git was asked (the merge's ancestry, what a conflict left, a refusal's words), so `bringTrunkIntoPlan` only reads git and reports. `signalRuleVerdicts` in `confirm.ts` is pure over the close's result and the impl text, and `reportSignalRules` is its one writer.

  </details>
- [x] Shape — review the function that brings the trunk into a branch and leave it as it is.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/plans/bring-trunk.ts`, `bringTrunkIntoPlan`: it now reads git, merges, undoes and reports in one body. Considered splitting the reporting into a wrapper around the merge. Left as is: each report sits at the exact decision point that makes it true (the merge refused, the merge kept after `after`, the merge undone), and a wrapper would have to re-derive which of those happened from the thrown error. The verdict rules are already out in `bring-trunk-signals.ts`; what stays is the call order.

  </details>

#### Build Phase 4 Verification

- [x] Saving an impl is refused without signals and with an after-landing proof, and acceptance reports its clauses.
  <details><summary>Technical</summary>

  Run 2026-10-19 (with `INDUSK_BUILD_STEP` and `INDUSK_GATE_POLICY` unset, the known environment artefact): the rules, confirm-time, own-impl and accept-brief files 28 of 28; `accept-brief*.test.ts` and `bring-trunk` files in the system config 12 of 12 (A41 and A86 among them, A86 against a local Jaeger); `vitest related clause-rules.ts confirm.ts` 18 files, 115 of 115; admin `build-host.trunk.test.ts` 9 of 9 (the admin's planning-start lane reads the same spans). `indusk plans tests a-run-can-be-trusted --phase 4`: 25 of 26; the one red is `admin-recorder.test.ts` (A59, Build Phase 6, expected). A40's second half (an approved, in-progress or completed impl is not refused; the sweep leaves a draft alone) is asserted in `clause-signal-rules.test.ts`, the one file A40's row names.

  A36–A40, A42–A49, A83, A84 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/clause-signal-rules.test.ts src/lib/promises/confirm-signal-rules.test.ts src/lib/plans/accept-brief-signals.test.ts src/lib/plans/accept-brief*.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/promises/clause-rules.ts src/lib/promises/confirm.ts`); A41 and A86 pass in the system tier (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/impl-clause-signals.contract.test.ts src/__tests__/accept-brief-signals.contract.test.ts`). The contract check's existing tests stay green.

  </details>
- [x] This plan's own impl passes its own rule, judged whatever its status.
  <details><summary>Technical</summary>

  Run 2026-10-19: `own-impl-signals.test.ts` 3 of 3 (A85): fourteen split and limit clauses read from the brief, each with a task naming its clause, the word signal and a repo source file, and no live check, smoke or promise row names a clause. The rule found no gap in this impl, so no task's fold was changed. `indusk promises contract a-run-can-be-trusted` also holds (it does not judge the approved impl for signals, by Decision 9).

  `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/own-impl-signals.test.ts` passes (A85): the test reads this plan's `brief.md` and `impl.md` (from `.indusk/planning/a-run-can-be-trusted/`, or its `archive/` folder once archived) and calls `missingSignalTasks` and `afterLandingClauseRows` directly, expecting both empty. `indusk promises contract a-run-can-be-trusted` alone does not prove this: by Decision 9 it judges only a draft impl, and this impl is approved by then.

  </details>

#### Build Phase 4 Context

- [x] Record the two rules in the planning template.
  <details><summary>Technical</summary>

  Done 2026-10-19: one entry in `apps/indusk-mcp/templates/planning/CLAUDE.md` (the destination named below, planning rules), synced to `.indusk/planning/CLAUDE.md` by this worktree's `indusk update`; `skill-sync-parity.test.ts` and the context-tiers tests pass.

  `apps/indusk-mcp/templates/planning/CLAUDE.md` (not the installed copy): "An impl being written for a brief with clauses names each split and limit clause's signal in a task, and no `live check`, `smoke` or `promise` row names a clause — guarded by `clause-signal-rules.test.ts`" — destination: planning rules, delivered where a plan is written.

  </details>

#### Build Phase 4 Document

- [x] Document the two rules and the signal task shape for authors.
  <details><summary>Technical</summary>

  Done 2026-10-19: a subsection in `apps/docs/src/guide/test-trajectory.md` ("A task reports each clause's signal"), a paragraph in `apps/docs/src/reference/skills/plan.md` under the clause plan, and a paragraph in `apps/indusk-mcp/skills/planner.md` beside the rule that a row names its clause, synced to `.claude/skills/planner/` by `indusk update` (never edited there).

  Update `apps/docs/src/guide/test-trajectory.md` and `apps/docs/src/reference/skills/plan.md` (and the planner skill's section for impl.md in `apps/indusk-mcp/skills/planner.md`, then sync with `indusk update`; never edit `.claude/skills/` directly): what a signal task is, why a live check proves no clause.

  </details>

#### Build Phase 4 Forward Intelligence

- **Trajectory**: A36–A48, A83–A86 are `passing` (A41 and A86 in the system tier, A86 against a local Jaeger; A49 stayed passing from Test Phase 1). The rows were written alongside the code in one pass (their subjects `clause-signal-rules.ts`, `confirm.ts`'s report and the `{ tracer }` seam did not exist), so no red window was observed for A36–A40, A42–A45, A83–A85; A46–A48 and A41/A86 were red from Test Phase 1. `indusk plans tests --phase 4`: 25 of 26 files pass; `admin-recorder.test.ts` (A59, Build Phase 6) is the expected red.
- **Decision**: the tracer seam Test Phase 1 named is `bringTrunkIntoPlan(anyCheckout, plan, how, after, { tracer })`, passed through `acceptBrief(anyCheckout, plan, { tracer })` and the admin's `startPlanning(project, plan, { tracer })`; the loosely typed alias in `accept-brief-signals.test.ts` is gone. The three clause reports live in `bringTrunkIntoPlan` (verdicts in `plans/bring-trunk-signals.ts`), because both lanes call it, so no call site is duplicated. Each verdict is read from git after the code ran (trunk an ancestor of the branch; no merge, unmerged file or moved head left after a conflict; a refusal's words never tell the person to merge).
- **Decision**: A47's second half (a half-merge let through reports `a-conflict-refuses` broken) and the admin's planning-start lane (`build-host.trunk.test.ts`) are written. The half-merge case uses a `vi.mock` of `../git.js` that swallows `merge --abort`, not a code seam. The admin test uses a small inline tracer (the admin's type check cannot take the package's `captureTracer`) and the new third parameter of `startPlanning`.
- **Decision**: the impl hook did skip a draft impl entirely, so Decision 9's "judged on save while a draft" needed a hook change: for a draft impl whose sibling `brief.md` says `clauses: required`, `validate-impl-structure.js` runs `indusk promises contract <plan> --impl-stdin --clause-signals-only`. That new flag asks only these two rules; the contract check itself judges them for a `draft` impl when it is not the sweep (`skipDraft`). The brief check keeps a machine whose `indusk` predates the flag from blocking a plan that states no clauses.
- **Decision**: the contract-time report of each rule (upheld when it refuses) is written by the `promises contract` command (`reportRefusedSignalRules` in `bin/commands/promises.ts`), not by `checkPlanContract`, which stays pure and is also called by the sweep and the planning reader. The close-time reports (`refused-without-signals` per clause, `a-live-check-proves-no-clause` from the saved impl, `the-two-landed-plans-report` when the closing plan is `a-brief-is-accepted-on-current-main`) are `signalRuleVerdicts` / `reportSignalRules` in `confirm.ts`, called by `promisesConfirm` beside `markClosing`. "No signal" is read from a new `noSignal` list on the signal half (`clause-proof.ts`); an unreadable daemon is not a clause with no signal and reports nothing broken.
- **Decision**: items 1 and 2 are one commit and items 4–6 with the CLI flag are another (the contract check, the hook, the CLI and the confirm report call each other, so they cannot be committed apart without a tree that does not build); item 3 is its own commits, mcp then admin. The `contract-clause-signals.test.ts` file written first was folded into `clause-signal-rules.test.ts`, the one file A40's row names.
- **Decision**: A85 found no gap in this impl, so no task's fold was edited. It is a count-guarded test (fourteen split and limit clauses read from the brief), so an empty read cannot pass as "none missing".
- **Watch out**: `everyday-tests-never-wait.test.ts` lists `run-record/landed.test.ts` (Build Phase 2, its `git(` helper calls) beside the earlier plans' accept-brief files; none of this phase's files. A cleanup candidate for Build Phase 2's file, not fixed here.
- **Watch out**: a plan that opts in to `clauses: required` now gets a draft refusal at save for any split or limit clause without a signal task; a plan being planned by an older `indusk` (before `--clause-signals-only`) fails with "the plan's contract could not be checked" (the gate that cannot run is never a pass) until it is updated.
- **Watch out**: `indusk update` here rewrote `.indusk/config.json`'s version, reverted by hand (as Build Phase 3's Watch out says); the installed `.claude/hooks/validate-impl-structure.js` and `.claude/skills/planner/SKILL.md` copies are committed with the package sources.
- **Assumption**: L2 (Build Phase 6, after landing) still has to make one real conflicting acceptance before `indusk promises confirm a-brief-is-accepted-on-current-main`, because `a-conflict-refuses` reports only when an acceptance meets a conflict.

### Build Phase 5: Offer approval only for a plan review that matches the documents

**Tier**: strong — the readiness gate every plan's approval goes through; a mistake offers or withholds approval for every plan

This phase makes the admin's offer of approval and the approve command ask one reader of the plan review, comparing what the review was written for with the documents now. A plan whose review is out of date is not offered and is listed as needing its plan review, and a plan with an impl and no review at all, that no run is still writing, is listed the same way. It then records the new sentence of the existing promise.

- [x] Make the approval offer and the approve command ask one reader of the plan review.
  <details><summary>Technical</summary>

  Done 2026-10-19. Decisions (unattended): `planReviewState(text, documentsHash)` reads stale before unanswered (a review of other documents is read again whatever its answers say), and a review recording no `read:`, or frontmatter that cannot be read, is stale. `readReview` in `read-planning.ts` keeps `complete` as "every finding answered" (`planReviewAnswered`, the same module) and takes `stale` from `planReviewState`, so the planning run's stop can still tell an open review from an old one; its own `read:` comparison is gone. `approvePlan` (normal and workbench) refuses after the looks check and before the trunk check, naming which of missing, stale or unanswered, and names `/audit <plan> --before-approval`. The 30 CLI approvals in the system-tier tests now write a current answered review first through one fixture (`__tests__/helpers/plan-review-fixture.ts`, `approveWithReview`); their assertions are unchanged, and `plans-approve.test.ts` gains the refusal case (A54). The Planning audit's signal (`situation-signals.ts`, Build Phase 2's Forward Intelligence) now compares the review's `read:` with `planReviewHash` of the four documents read from disk, by its own pattern rather than the reader it judges; the admin's `plan-situation.ts` hands it `readDocumentsHash`. `decisions-reader.planning.test.ts`'s mock of the `plans` export gained `bringTrunkIntoPlan` (a mock gap since `a-brief-is-accepted-on-current-main`, as its sibling build-host tests have it). The waiting list's plan-review sentence now says "written for the documents as they stand".

  `lib/plans/plan-review.ts`: `planReviewState(text, documentsHash)` returns `missing | stale | unanswered | answered` (stale: the review's `read:` frontmatter is not `documentsHash`); `readPlanReview(planDir)` reads `brief.md`, `test-plan.md`, `adr.md` and `impl.md` beside it and passes `planReviewHash` of them (`lib/audit/review-hash.ts`), so the admin's `apps/indusk-admin/src/lib/planning-reader.ts` (which calls `readPlanReview` for each plan's snapshot) gets the stale state without a new call; widen `PlanSnapshot.planReview` in `lib/plans/steps.ts` to the new union. `apps/indusk-mcp/src/lib/plans/waiting.ts`' `planWaiting` offers approval only on `answered` and lists `stale` and `missing` through its existing needs-its-plan-review entry. `read-planning.ts`' `readReview` derives `complete` and `stale` from the same function, and `apps/indusk-mcp/src/lib/plans/approve.ts`, which checks no review today, refuses unless it reads `answered`. `apps/indusk-admin/src/lib/decisions.ts` keeps reading the waiting list. Delete any second comparison. States: current and answered (offer), stale or missing with no run writing (needs its plan review), unanswered finding (not offered), a session writing (neither). The Planning audit step reads stale as to do, and the Impl step does not ask for approval (A88 in `steps.planning-audit.test.ts`).

  </details>
- [x] Record the changed promise sentence now that the code makes it true.
  <details><summary>Technical</summary>

  Done 2026-10-19 with the worktree's CLI (`node apps/indusk-mcp/dist/bin/cli.js promises change …`, exactly the command below); the promise's owner moves to this plan and its History keeps the old sentence. `indusk promises check` then refused two citations in Build Phase 4's `clause-signal-rules.test.ts` (row fixtures spelling a bare `promise: q` and `promise: some-promise`, which the scanner reads as citations of promises that do not exist); they are now written `${"promise"}: …` as `citations.test.ts` does, the same strings at run time, and the check passes.

  `indusk promises change approval-waits-for-a-finished-plan --plan a-run-can-be-trusted --statement "A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written for the documents as they stand with every finding answered; a plan whose impl is written without such a plan review, and that no run is still writing, is listed as needing its plan review." --reason "the offer read a plan review as answered without checking it was written for the documents as they stand"` (the planner's `change_promise` tool does the same).

  </details>
- [x] Shape — reviewed the files this phase changed against the enabled extensions' craft rules by hand; nothing to change.
  <details><summary>Technical</summary>

  `prepareShapeReview` returned `review` with 24 files and no unreadable extension rules (read 2026-10-19 after Verification was green). `plan-review.ts` holds one reading with three small named parts (`planReviewRead`, `planReviewAnswered`, `planDocumentsHash`), each reachable by a test without the others; `refuseUnreadyPlanReview` in `approve.ts` is the one refusal for both the normal and the workbench approval and names which state refused; `readReview` in `read-planning.ts` now only maps the reader's answer onto the run's shape. The test fixture `approveWithReview` has one job, writing the review for the documents as they stand before the CLI approves.

  </details>
- [x] Shape — leave the signal's own reading of the review's hash beside the reader it judges.
  <details><summary>Technical</summary>

  `situation-signals.ts` reads the documents' hash (`readDocumentsHash`) and the review's `read:` line (`recordedRead`, a pattern) itself rather than calling `planDocumentsHash` / `planReviewRead` in `plan-review.ts`. Considered sharing them. Left as is: Decision 17 makes a signal read a source independent of the code it judges, and a signal that called the reader would agree with the page by construction. Whether the two hash-of-four-documents readers should share a file-reading helper is a cross-file question for `/cleanup`.

  </details>

#### Build Phase 5 Verification

- [x] Approval is offered and withheld as the promise now says, by one reader.
  <details><summary>Technical</summary>

  Run 2026-10-19 (with `INDUSK_BUILD_STEP` and `INDUSK_GATE_POLICY` unset, the known environment artefact). The command below names the admin package `@infinitedusky/indusk-admin`, which matches no project (the admin's name is `indusk-admin`): pnpm prints "No projects matched" and exits 0, so its three admin parts were run again with `--filter indusk-admin`. Results: the three admin files 17 of 17 (A50–A55 among them; `decisions-reader.planning.test.ts` green after its mock gained `bringTrunkIntoPlan`); `plan-review.test.ts` and `steps.planning-audit.test.ts` 19 of 19 (A88); `vitest related waiting.ts approve.ts` 45 of 45; admin `vitest related decisions.ts` 87 of 87; admin `vitest related planning-reader.ts` every node file passes (121 tests), and 64 tests in eleven `|browser (chromium)|` files fail because their pages render nothing in this environment — the same files failed 30 of 30 with the source checked out at `ce6d3bf` (this phase's start), as Build Phase 2's Forward Intelligence found. The approval's system-tier files (`plans-approve`, `plans-workbench`, `plans-*-looks`, `amendments`, `archived-plan-found`, `check-gates-amendments`, `brief-looks`, `plans-audit-inputs` and five more) 123 of 123 in the system config. `indusk plans tests a-run-can-be-trusted --phase 5`: 21 of 22; the one red is `admin-recorder.test.ts` (A59, Build Phase 6, expected). `indusk promises contract a-run-can-be-trusted` holds (4 made, 4 kept, 1 changed); `promises check` passes; `tsc --noEmit` clean in both packages; Biome clean on every changed file.

  A50–A55, A88 pass (`pnpm --filter @infinitedusky/indusk-admin exec vitest run src/lib/decisions-reader.approval.test.ts src/lib/decisions-reader.planning.test.ts src/app/api/plans/approve/route.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/plans/plan-review.test.ts src/lib/plans/steps.planning-audit.test.ts && pnpm --filter @infinitedusky/indusk-mcp exec vitest related src/lib/plans/waiting.ts src/lib/plans/approve.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/planning-reader.ts && pnpm --filter @infinitedusky/indusk-admin exec vitest related src/lib/decisions.ts`); then `indusk promises contract a-run-can-be-trusted` passes.

  </details>

#### Build Phase 5 Context

- [x] Record that the plan review has one reader.
  <details><summary>Technical</summary>

  Done 2026-10-19: the `lib/audit/` entry of `apps/indusk-mcp/CLAUDE.md` now names the four states (stale defined there), every asker (`plans approve` among them) and the guard `decisions-reader.approval.test.ts`. The file is already past its nested budget (about 29.6 KB of 16 KB), so the budget hook allows only a shrinking edit: the entry's earlier "goes stale when its `read:` hash…" clause was folded into this sentence and the pointer to `cockpit-single-definition.test.ts` dropped (that test still guards the export), leaving the file 39 bytes smaller. The fixture for CLI approvals in tests is named in this phase's Forward Intelligence instead.

  `apps/indusk-mcp/CLAUDE.md` (its `lib/audit/` entry already says `planReviewState` is the one reading; add that `plans approve` calls it too): "guarded by `decisions-reader.approval.test.ts` (`promise: approval-waits-for-a-finished-plan`)" — destination: the package's area file.

  </details>

#### Build Phase 5 Document

- [x] Document when a plan is offered for approval and what needing its plan review means.
  <details><summary>Technical</summary>

  Done 2026-10-19: `reference/cli/plans.md`'s `plans approve` lists the plan-review refusal with its three states and the one reader the admin shares; `reference/admin-ui/overview.md` says the Planning audit reads stale as to do, and gains "When a plan is offered for approval": the four states, which one offers Approve, and that a plan still being written is listed as neither.

  Update `apps/docs/src/reference/cli/plans.md` (the `plans approve` entry) and the admin overview page: the three states and the single reader.

  </details>

#### Build Phase 5 Forward Intelligence

- **Trajectory**: A50, A52, A54 and A88 are `passing`; A51, A53 and A55 stayed passing. A88 was written red on its own assertion (a real plan folder read through `readPlanReview`, an answered review recording another hash reading done) before the reader changed; A52 had no red window, as Test Phase 1's Forward Intelligence said. `indusk plans tests --phase 5`: 21 of 22 files; `admin-recorder.test.ts` (A59, Build Phase 6) is the expected red.
- **Decision**: stale outranks unanswered, and a review with no `read:` (or frontmatter that cannot be read) is stale. A review written by an older `/audit --before-approval` that recorded no hash now needs a new cold read before approval; the planning run already treated it so.
- **Decision**: `plans approve` refuses without an answered review, for normal and workbench plans alike (Decision 11). Every system-tier test that approves through the CLI now writes a current answered review first through `__tests__/helpers/plan-review-fixture.ts` (`approveWithReview`, `writeCurrentPlanReview`, `answeredPlanReview`); the review is written after the documents, since it goes stale with them, and approval commits it with the plan's other `.indusk/` files. A new test that approves through the CLI must use it, or it is refused "needs its plan review".
- **Decision**: approval sets the impl's `status: approved`, which changes the impl and so the hash: every approved plan's review reads stale afterwards. Nothing asks the review after approval for a decision (the waiting list needs a draft impl; the Planning audit step and its signal read an approved impl as done; the planning run is over), so this is harmless today. A later reader that asks the review of an approved plan must not take stale as "needs its plan review".
- **Decision**: the Verification command filters the admin as `@infinitedusky/indusk-admin`, which matches no package (its name is `indusk-admin`); pnpm exits 0 having run nothing. The admin parts were run with `--filter indusk-admin`. Build Phase 6's Verification names only the package filter, so it is unaffected; the retrospective should not copy that filter.
- **Watch out**: admin `vitest related src/lib/planning-reader.ts` reaches eleven `|browser (chromium)|` files whose pages render nothing in this environment (64 tests); the two checked at this phase's start commit fail the same 30 of 30. Read only the node project's results there.
- **Watch out**: `apps/indusk-mcp/CLAUDE.md` is past its nested budget (about 29.6 KB of 16 KB); the budget hook refuses any edit that grows it. Build Phase 6's Context item adds a line there, so it must also remove at least as many bytes (fold a narrative behind a pointer).
- **Watch out**: `biome check --write` over a glob of `src/__tests__/*.test.ts` reformats unrelated files; name the changed files.


### Build Phase 6: Make the recorder landing test wait for its incident

**Tier**: med — the work step's default

This phase replaces the recorder landing test's fixed one-minute wait with a rule that waits for the incident the admin was expected to commit, or for the admin to finish a scan after the break was loaded and find none, so the test passes on a busy machine and fails only for what it tests. It then records what the person runs after landing.

- [x] Add the wait rule that takes the clock and its reads as inputs.
  <details><summary>Technical</summary>

  New `lib/admin/wait-for-incident.ts`: `waitForIncident({ now, sleep, incident, scanFinishedAfterBreak, upperBoundMs })` → `{ found }` or throws naming the break; `scanFinishedAfterBreak` is true only for a pass that started after the break was loaded and ended `ok` (a thrown pass is not finished, A62); a generous upper bound, exported as `INCIDENT_WAIT_UPPER_BOUND_MS` (4 minutes), only ends a hung admin, and its failure names the break and the last pass's error. Header `// clause: landing-tests-hold-under-load/recorder-waits-for-its-break`.

  </details>
- [x] Make the recorder loop write down each scan it makes.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/admin/recorder-loop.ts` writes nothing today. Add a `scanRecord?(root, { startedAt, endedAt, ok, error? })` option, called by `tick` after each pass (in `finally`, `ok: false` with the message when the pass threw); the admin's wiring writes it whole (temp file and rename) to `<machine state>/recorder-scan.json`. Row A89 in `src/lib/admin/recorder-loop.scan.test.ts` with faked time and a pass that resolves and one that throws. Header `// clause: landing-tests-hold-under-load/recorder-waits-for-its-break`.

  </details>
- [x] Make the recorder test use it, asserting exactly what it asserted before.
  <details><summary>Technical</summary>

  `src/__tests__/admin-recorder.test.ts`: replace the fixed `MINUTE` wait with `waitForIncident`, `scanFinishedAfterBreak` read from the scan record the previous task adds (under the test's `INDUSK_HOME`). Set the test's vitest timeout to `INCIDENT_WAIT_UPPER_BOUND_MS` plus the setup and pause margin (the 75 s pause, startup), derived from the constant, so vitest never ends it before the rule decides. Keep: one committed incident, same subject, clean tree, system tier; the delayed-scan case pauses the admin with `SIGSTOP`/`SIGCONT`, never a CPU load.

  </details>
- [x] Report the signal for the clause that the recorder test waits for its break.
  <details><summary>Technical</summary>

  signal: `landing-tests-hold-under-load/recorder-waits-for-its-break` — read in the landing's clause-test results, reported from `apps/indusk-mcp/src/lib/plans/land.ts`. No landing-test record exists today, so this is new: after `refuseFailingClauseTests` runs, `plans land` calls `writeClauseSignals` for each result whose file carries `clause: landing-tests-hold-under-load/recorder-waits-for-its-break` — upheld on a pass, `broken` naming the plan being landed and the failure on a fail — before it throws any refusal. `plans land` is a real command run, so its span is not dropped as a test run's. It reports at each landing whose clause tests include the recorder test (this plan's, and any later plan naming it); between them the clause reads no-signal. Row A90 in `src/lib/plans/land-recorder-signal.test.ts`, the runner injected and the spans captured.

  </details>
- [x] Shape: report the recorder clause once per landing, broken when any file carrying it failed.
  <details><summary>Technical</summary>

  Shape found in `apps/indusk-mcp/src/lib/plans/land-recorder-signal.ts` (rule: one reason to change, name says what it is for): `markRecorderClause` built a verdict per carrying file and then kept only the first, so a later failing file would have been reported upheld. It now picks the first failing result, else the first, and reports that one; the A90 file gained a case for one failing file among several. Reviewed the other changed files and left them as they are: `wait-for-incident.ts` (one rule, all reads injected), `scan-record.ts` (three small functions over one file), `recorder-loop.ts`'s `tick` (the record call is a short `finally` step, and splitting it would hide the order the loop's test pins), the `land.ts` result-collecting wrapper (four lines, one job).

  </details>

#### Build Phase 6 Verification

- [x] The wait rule and the patient test hold, alone and on a busy machine.
  <details><summary>Technical</summary>

  Run 2026-10-19 (`INDUSK_BUILD_STEP` and `INDUSK_GATE_POLICY` unset for the plan-command tests; the admin bundle rebuilt first with `pnpm --filter indusk-admin build` and `node scripts/bundle-admin.js`). The three unit files and `land-clause-tests.test.ts`, `recorder-loop.test.ts` 19 of 19. `admin-recorder.test.ts` in the system config, **alone**: both cases green, 92.3 s (the plain case 6.4 s, the paused-admin case 81.5 s). **Busy** (started beside the whole everyday suite, 383 files): both cases green, 95.9 s (7.6 s and 81.6 s). `indusk plans tests a-run-can-be-trusted --phase 6`: 31 of 31 twice; two earlier runs of it, right after the everyday suite, failed `admin-recorder.test.ts` with only the config warning in the output (the JSON report is deleted by the runner) and passed on the next two runs and in four direct runs, so the cause was not found; it is the only unexplained red, and the retrospective should watch for it. Biome clean on every changed file; `tsc --noEmit` clean in both packages. The everyday suite (run with the build step's env set) had ten red files: the six `run/` loop files pass 75 of 75 with the env unset (the known artefact), and the other four (`everyday-tests-never-wait`, `promise-marks-one-query`, `contract-resolver-single-definition`, `steps-name-project-commands`) are earlier phases' (they name `accept-brief-conflict.test.ts`, `build-host.trunk.test.ts`, `mark.ts`, `incident-signal.ts`), none of this phase's files.

  A59–A62, A89, A90 pass (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/admin/wait-for-incident.test.ts src/lib/admin/recorder-loop.scan.test.ts src/lib/plans/land-recorder-signal.test.ts` and, in the system tier, `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/__tests__/admin-recorder.test.ts` once alone and once with another build running).

  </details>
- [x] The three after-landing checks are listed with their commands for the retrospective.
  <details><summary>Technical</summary>

  Confirmed 2026-10-19: Notes (end of this file) already lists L1, L2 and L3 as numbered steps with their `manual:` commands and a blank date / result line each; the rows stay `skipped` (`live check`, each proves no clause).

  Notes lists L1, L2, L3 (skipped here by design, `live check`; each proves no clause).

  </details>

#### Build Phase 6 Context

- [x] Record the waiting rule for landing tests.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (Tests section): "a landing test that waits for the admin waits for the thing it expects (`waitForIncident`), never a fixed minute" — destination: the package's area file; guard: `wait-for-incident.test.ts` carries `lesson: everyday-tests-never-wait`.

  </details>

#### Build Phase 6 Document

- [x] Document the patient recorder test on the testing page.
  <details><summary>Technical</summary>

  Update `apps/docs/src/guide/test-levels.md`: a system-tier test waits on the event it expects and keeps an upper bound only to end a hung process.

  </details>

#### Build Phase 6 Forward Intelligence

- **Trajectory**: A59, A60, A62, A89 and A90 are `passing`; L1–L3 stay `skipped` by design. A60, A62, A89 and A90 were authored beside their code in one pass (their subjects did not exist), so no red window was observed; A59 was red from Test Phase 1 by the fixed minute and is green now. Every row of the plan is now `passing` or `skipped`.
- **Decision**: the scan record is one file, `<INDUSK_HOME>/recorder-scan.json`, a map from project root to the last pass `{ startedAt, endedAt, ok, error? }` (Decision 12 said "per project" and gave one path); written whole through `writeFileDurably` (the existing temp-file-and-fsync-rename writer) by `scanRecord`, an option on `startRecorderLoops`; the admin wires `writeScanRecord` through a new package export `./admin/scan-record`. A write that throws is logged and never fails the pass.
- **Decision**: `waitForIncident` reads the scan before the incident in each loop turn, so a scan seen finished means an incident, if one was recorded, is already visible; it takes optional `breakName`, `lastScanError` and `pollMs` beyond Decision 12's inputs, so the failure names the break and the last pass's error.
- **Decision**: the recorder test finds the scan record by the latest `startedAt` in the test's own `INDUSK_HOME`, not by project path, because the registry stores a resolved path (macOS `/private/var`) that need not equal the fixture's path. Its vitest timeout is `INCIDENT_WAIT_UPPER_BOUND_MS` plus 120 s of setup and pause margin. Assertions (one incident, the admin's subject, a clean tree) are unchanged; only the title dropped "within a minute".
- **Decision**: `refuseFailingClauseTests` takes an optional `tracer` (for A90) and reports through `markRecorderClause` (`lib/plans/land-recorder-signal.ts`) after the tests half and before it throws, from the results the runner returned (collected by a wrapper, so `clauseTestsHalf` is untouched). The report is one span per landing: broken if any carrying file failed, else upheld. Its span `plan` is `a-run-can-be-trusted`, the promise's owner; the broken symptom names the landing plan. It reports only at a landing whose clause rows name the recorder test.
- **Decision**: Context item was a net-shrinking edit to `apps/indusk-mcp/CLAUDE.md` (29649 to 29645 bytes): tightened four neighbouring Tests lines to make room; the file is still far over its 16 KB nested budget, for the retrospective's compaction.
- **Watch out**: `indusk plans tests a-run-can-be-trusted --phase 6` failed `admin-recorder.test.ts` twice in a row right after the full everyday suite finished (only the vitest config warning in its output; the runner deletes the JSON report) and passed on the next two runs and in four direct runs, alone and beside the suite. Cause not found; if it recurs at landing, run the file alone and read `test-results/system.junit.xml`.
- **Watch out**: the admin bundle must be rebuilt (`pnpm --filter indusk-admin build`, then `node scripts/bundle-admin.js` in `apps/indusk-mcp`) for the recorder test to see `instrumentation.ts`'s `scanRecord` wiring; a stale bundle makes the test fail at the upper bound naming no finished scan.
- **Watch out**: four everyday-suite reds that are earlier phases', not this one's: `everyday-tests-never-wait` (names `accept-brief-conflict.test.ts` and `build-host.trunk.test.ts` as starting git), `promise-marks-one-query` (`lib/promises/mark.ts` builds a tag query), `contract-resolver-single-definition` (`incident-signal.ts` builds a path to the promises folder), `steps-name-project-commands` (the work.md step is not found). They go to `/falsify` and `/cleanup`; the six `run/` loop files fail only with `INDUSK_BUILD_STEP` set.
- **Decision (checked after the phase closed)**: of those four, only one was this plan's: `everyday-tests-never-wait` also named `run-record/landed.test.ts` (Build Phase 2; A21 and A87 run a real landing with git). It is now in `vitest.tiers.ts` `SYSTEM` (passes 11 of 11 there), as Decision 19 requires of a test that starts a process; its rows' level and assertions are unchanged. The other three, and the remaining files `everyday-tests-never-wait` names, predate this plan: `mark.ts`, `incident-signal.ts` and `skills/work.md` are unchanged since the branch left main, and the accept-brief and `timing/test-run` files were listed as pre-existing in Test Phase 1's Forward Intelligence.
- **Assumption**: L1–L3 and the first real report of `recorder-waits-for-its-break` come after landing; between landings that include the recorder test, the clause reads no signal.

### Build Phase 7: Falsification — what a run, the shell guard and the signals say, against the inputs that make them say it wrongly

**Tier**: strong — this phase changes the shell guard every command passes through and the build host's start of a run, the same reason Build Phases 3 and 5 are strong (Decision 13)

This phase tests the finished plan against the cases where what it shows or reports is false: a stopped run whose wait was already answered, a merged plan claiming everything is confirmed when nothing was read, a landing looked for on the wrong branch, a build pressed twice, shell writes the guard lets through and reads it refuses, a witness that blames a command for changes it did not make, a rule that reports its own success, and a recorder test that still fails under load. Each case was checked against the code before it was written down, and three were seen on this machine on 2026-10-19. When the phase closes, each case has a test that failed before its fix and passes after, and the page, the guard and the signals say only what is true in each of them.

- [x] Write each of this phase's tests first, and see each one fail for the reason it names before any fix below.
  <details><summary>Technical</summary>

  Rows A91–A103 (registered under Test Phase 1's `#### Deferred to Build Phase 7`). Each is authored red against today's code, apart from A100, whose tool-write record is added below (it is red on the missing exclusion). A99 is a contract row in the already-system-tier `plan-write-guard.contract.test.ts`; A94 and A95 go in `landed.test.ts`, already in `vitest.tiers.ts` `SYSTEM`. Everything else is a unit row.

  Run 2026-10-19, each red on its own assertion: A91 (the stopped sentence), A92 nav case (the "everything is confirmed" text) and its unreadable case (a `TypeError` inside `situation()`, which cannot hold a list that was not read: a failure of the subject, not a load error), A93, A94 (a branch made before the landing, checked out in the root: not complete), A95 (false), A96 (not running while the worktree is found), A97 (`perl -0pi` allowed, first of the list), A98 (refused), A99 (two files changed), A100 (`broken`), A101 (one upheld span), A102 (`ok: true`), A103 (a span, and `broken` from a unit file).

  </details>
- [x] Make a run that stopped at a wait the person has since answered read the step the plan is at, not "stopped".
  <details><summary>Technical</summary>

  Hypothesis A91. `situation()` (`apps/indusk-mcp/src/lib/run-record/situation.ts`) reads any `run.status.state === "stopped"` as `kind: "stopped"`, and `runStatus` (`liveness.ts:36`) words a clean stop by its step (`record.stopReason ?? record.stop.step`). A planning run that stopped at `ready-for-approval` and was then approved by `indusk plans approve` (so no build record is newer and `waitingOn` is null) reads "Stopped — ready-for-approval. Build starts the planning again." Fix: a stop whose step is one of the runners' clean ends (planning `ready-for-approval`, `wait-for-looks`; build `review`, `released`) is not a stopped run once `waitingOn` is null: fall through to the `idle` branch (`At <step>; nothing is running`), so `nextStepFor` gives that step. A death (`PROCESS_GONE`), `cannot-continue`, `amendment`, `judgement`, a rate limit and `release-failed` still read stopped. Raised by the audit (`situation.ts:156`).

  </details>
- [x] Stop a merged plan from claiming everything is confirmed when its confirmation list was never read or could not be read, and stop a failed live check or an unconfirmed plain promise from being ticked.
  <details><summary>Technical</summary>

  Hypotheses A92, A93. `plan-situation.ts:132` loads confirmations only for the plan's own page, and `readStanding(...).catch(() => [])` (line 154) turns an unreadable registry into an empty list; `situation()` and `nextStepFor` (`next-step.ts:59`) read an absent or empty list as "everything is confirmed; the retrospective closes it", and `PlanStatusCard.tsx:55` as "Everything it promised is confirmed." Fix: `SituationInput.confirmations` distinguishes not read (`undefined`) and unreadable (a `{ unreadable: reason }` value) from an empty list; the complete branch and `nextStepFor` say "see the plan's page for what is left to confirm" (nav) or "the promise registry could not be read: <reason>" (page), never "everything is confirmed"; `PlanStatusCard` renders the same words through its existing text slot (no new markup, so `plan.released` holds). In `confirmationsOf` (`situation.ts`), a promise with no split or limit clause is one confirmation of kind `clause signal` named by the promise, confirmed only when the registry has it in force; in `liveCheckRecorded`, a Notes line counts as confirmed only when it holds the row's id, a date, and none of `fail`, `failed`, `red`, `broken`, `refused` (case-insensitive). Raised by the audit (`next-step.ts:59`, `PlanStatusCard.tsx:55`).

  </details>
- [x] Read whether a plan landed from the project's trunk, and from the code repository for a workbench plan, never from whatever branch the checkout is on.
  <details><summary>Technical</summary>

  Hypotheses A94, A95. `planLandedOnMain` (`landed.ts:91`) asks `git branch --show-current` of the root checkout, and the admin's `landedAsker` (`plan-situation.ts:78`) asks `"HEAD"`. With the root checkout on any other branch every landed plan reads not complete, and `buildStateFromRecord` (`build-host.ts:201`) re-judges a recorded `released` on every poll and flips it to `release-failed: … not on main`. A workbench plan merges its code in the code repository (`land.ts` `landWorkbenchPlan`), which neither reader asks, so it reads stopped until its documents are archived at the root. Fix: both callers name the trunk through the package's one trunk reader (`src/lib/trunk-branch.ts`), never `HEAD` or the current branch; for a workbench plan the merge subjects are read from the code repository its `code.json` names (`resolveExecutionRoots`), the archive folder from the root. Raised by the audit (`landed.ts:91`).

  </details>
- [x] Hold a just-pressed build as running from the moment it is pressed, so the page never calls it dead and a second press cannot start a second build.
  <details><summary>Technical</summary>

  Hypothesis A96. `startBuild` (`apps/indusk-admin/src/lib/build-host.ts:570`) writes the build record with no process and no stop, then awaits `depsFor` (which resolves `planLocation`), and only then sets `builds()` (line 583). In that window `buildState` and `runOfPlan` read the record through liveness as dead ("Stopped: the run died"), and a second press passes the "already building" check, finds the record dead, and starts a second build; `admitBuild` adds to a `Set`, so it does not refuse the second admission, and the first build's `free()` releases the place the second still holds. Fix: set the `builds()` entry (running) before the first await, as `startRelease` and `startPlanning` already do ("held before the first await"), delete it if `depsFor` throws, and open the record after it is set. Raised by the audit (`build-host.ts:570`).

  </details>
- [ ] Make the shell guard refuse the common ways of writing a plan document it lets through today, including the one an audit session used on this plan.
  <details><summary>Technical</summary>

  Hypothesis A97, observed: the machine's decision file (`~/.indusk/projects/dusk-2f1b1d2f/plan-write-decisions.jsonl`, 2026-10-19T21:40:12Z) shows `python3 -I - <<'PY'` writing this plan's `audit.md`, allowed. Each form in A97 was run through `judgeCommand` on 2026-10-19 and allowed. In `apps/indusk-mcp/hooks/plan-write-guard.js`: the in-place flag test accepts bundled flags with digits (`-0pi`, `-i.bak` for `perl`); an interpreter (`INTERPRETERS`, and `SHELLS`) given `-` or no script argument reads its here-document or here-string body as inline text, judged as `-e`/`-c` text is; an interpreter whose inline text has a write call and whose arguments include a plan path is refused; simple `NAME=value` assignments earlier in the command are substituted into `$NAME` and `${NAME}` words; `xargs` running an in-place editor or remover is refused when an earlier segment of the pipeline names a plan path or folder; `gsed`, `awk -i inplace`/`gawk -i inplace`, `sponge`, `ed`, `ex`, `vim`/`vi`/`nvim` with `-c` or `+`, `curl -o`/`--output`, `wget -O`/`--output-document`, `tar` with `-C`/`--directory` and `unzip -d` naming a plan path are writers; `git apply` and `patch` read the patch file named (when it exists and is under 1 MB) and are refused when a `---`/`+++`/`diff --git` header names a plan path. Mirror each in the drain's independent reading, `parserReadsWrite` (`src/lib/promises/clause-verdicts.ts`), so a refusal of each still reports `shell-write-refused` upheld. Raised by the audit (`plan-write-guard.js:486`), whose answer was detection only.

  </details>
- [ ] Stop the shell guard refusing reads that an inline interpreter or a dry run makes.
  <details><summary>Technical</summary>

  Hypothesis A98, each refused by `judgeCommand` on 2026-10-19. `WRITE_CALL` (`plan-write-guard.js:63`) counts any `.write(`, so `process.stdout.write(`, `process.stderr.write(`, `sys.stdout.write(` and `sys.stderr.write(` refuse a read; and `git clean` in a plan folder is refused whatever its flags. Fix: strip standard-stream writes from the text before `WRITE_CALL` is tested; allow `git clean` with `-n` or `--dry-run`. Keep the drain's `parserReadsWrite` reading the same, so these allowed reads report `reads-pass` upheld. Raised by the audit (`plan-write-guard.js:68`).

  </details>
- [ ] Make the witness compare the plan folders of the checkout the guard looked at, not of wherever the command left the shell.
  <details><summary>Technical</summary>

  Hypothesis A99, observed: on 2026-10-19T21:44:02Z the decision file paired a read-only `cd /Users/the_dusky/code/sandbox/dusk && find .indusk/planning …` run from this worktree with an after snapshot of the main checkout, so all 55 active plan files read changed; the drain will report `shell-write-refused` broken for a `find`. `plan-write-witness.js` takes `planRootOf(event.cwd)`, and a PostToolUse payload's `cwd` is the shell's working directory after the command. Fix: the guard's pending file records `root`; the witness snapshots that root (and the home it was found under), never one derived from the after payload. Not raised by the audit.

  </details>
- [ ] Keep a plan document that the Edit or Write tool changed during a shell command from being blamed on that command.
  <details><summary>Technical</summary>

  Hypothesis A100. The drain (`judgeDecision`, `src/lib/promises/clause-verdicts.ts`) blames every change between the guard's before snapshot and the witness's after on the shell command; Claude Code runs tool calls of one turn concurrently, so an Edit to `impl.md` beside a long `pnpm test` reads `shell-write-refused` broken naming the test run. Fix: register `plan-write-witness.js` also as PostToolUse on `Edit|Write|MultiEdit|NotebookEdit` (the `HOOK_REGISTRATIONS` entry in `src/lib/hook-command.ts`, and its byte-equal `.claude/hooks/` sync); for such a payload whose file is under a plan folder it appends `{ kind: "tool-write", at, file, stat }` to the decision file; the drain leaves out of `changed` each file whose after `stat` equals a tool write recorded between the decision's `at` and its after line. A change no tool write accounts for is still broken (U1 stays detected). Raised by the audit (`clause-verdicts.ts:320`).

  </details>
- [ ] Remove the report that the clause-signal rules give of their own refusals.
  <details><summary>Technical</summary>

  Hypothesis A101. `reportRefusedSignalRules` (`apps/indusk-mcp/src/bin/commands/promises.ts:230`) reports `refused-without-signals` and `a-live-check-proves-no-clause` upheld whenever the contract check refuses a draft: the verdict a check gives itself, which Decisions 8 and 17 rule out because it can never read broken. Fix: delete it and its call; the clauses' signals stay `promises confirm`'s independent reports (`confirm.ts`). The test drives `promisesContract` on a refused draft with the package's capture tracer (`lib/promises/capture-tracer.ts`) as the commands' tracer and asserts no span for either clause. Raised by the audit (`promises.ts:230`), left there for this ritual.

  </details>
- [ ] Count a recorder pass whose production read failed as not finished, so the patient landing test keeps waiting under load.
  <details><summary>Technical</summary>

  Hypothesis A102. `recordBreaks` (`src/lib/promises/record.ts:140`) never throws when the production read fails: `pass` returns `failed(...)`, a result with `error` set and `mark.outcome` broken. The admin's loop (`apps/indusk-admin/src/instrumentation.ts`) returns that result, and `startRecorderLoops`'s `tick` (`src/lib/admin/recorder-loop.ts`) records `ok: true` for any pass that resolves. So a Jaeger query that timed out under load writes a finished scan, and `waitForIncident` fails "the admin finished a scan after it was loaded and found no incident": the failure under load this clause exists to end, and what Decision 12 says cannot happen ("a pass that threw … is not a finished scan"). Fix: `RecorderLoopOptions` takes `outcomeOf?(result) → { ok, error? }`; the admin passes one that reads `result.error` (and a `refused` result as not ok); `tick` records it. Not raised by the audit.

  </details>
- [ ] Report the recorder clause at a landing only from the recorder landing test's own result.
  <details><summary>Technical</summary>

  Hypothesis A103. `markRecorderClause` (`src/lib/plans/land-recorder-signal.ts:41`) takes any result whose file carries the clause token; `wait-for-incident.test.ts` and `recorder-loop.scan.test.ts` carry it too, so a landing that ran only those reports `recorder-waits-for-its-break` upheld although the test that waits under load never ran. Fix: count only the result for `src/__tests__/admin-recorder.test.ts` (the file `vitest.tiers.ts` `SYSTEM` lists for this clause; one exported constant beside the clause name); with no such result, report nothing. Raised by the audit (`land-recorder-signal.ts:41`), left for cleanup there; it is a false upheld signal, so it is fixed here.

  </details>
- [ ] Show the release steps in the order they run: build, audit, falsify, cleanup, review, release.
  <details><summary>Technical</summary>

  Added by hand 2026-10-19 (Sandy; `says-what-is-true`): since `audit-concerns-are-answered` the build runs the audit when the build phases close, before falsification, but the plan page lists the old order. `RELEASE_STEPS` in `apps/indusk-mcp/src/lib/plans/steps.ts` becomes Build, Audit, Falsify, Cleanup, Review, Release; `workflows.test.tsx` A9 expects that order. No mockup draws the release list's order.

  </details>

#### Build Phase 7 Verification

- [ ] Every test this phase wrote failed before its fix and passes after it, and the plan's earlier tests still pass.
  <details><summary>Technical</summary>

  A91–A103 pass; each was seen red first. `indusk plans tests a-run-can-be-trusted --phase 7` passes, and the files of Build Phases 1–6 it names stay green (the guard, situation, landed, build-host record and recorder-loop files are shared). In the system tier: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/plan-write-guard.contract.test.ts src/lib/run-record/landed.test.ts`. `skill-sync-parity.test.ts` and `hook-registration.test.ts` pass after the witness's new registration is synced.

  </details>
- [ ] The guard refuses every write form listed for it and allows every read form, judged by running the guard itself.
  <details><summary>Technical</summary>

  Re-run the probe this ritual used (each A97 form refused, each A98 form allowed, through `judgeCommand` from `apps/indusk-mcp/hooks/plan-write-guard.js`), and the existing A22–A35 and A75–A77 rows unchanged.

  </details>

#### Build Phase 7 Context

- [ ] Add to the hooks' rules that the witness compares the checkout the guard recorded, and that edits by the editing tools are recorded so they are not blamed on a shell command.
  <details><summary>Technical</summary>

  Destination: `apps/indusk-mcp/hooks/CLAUDE.md`, the `plan-write-guard.js` entry — "the witness snapshots the root the guard recorded, never one read from the after payload's `cwd`; it also records Edit and Write tool writes under plan folders, and the drain leaves those out of a shell command's changes". Guard: `plan-write-guard.contract.test.ts` (A99) and `clause-verdicts.test.ts` (A100).

  </details>
- [ ] Add to the package's rules that a recorder pass counts as finished only when its read succeeded.
  <details><summary>Technical</summary>

  Destination: `apps/indusk-mcp/CLAUDE.md`, Tests section, beside the `waitForIncident` line — "a scan is finished only when its pass read production: `recordBreaks` resolves with `error` on a failed read, so the loop's `outcomeOf` reads it". Guard: `recorder-loop.scan.test.ts` (A102).

  </details>

#### Build Phase 7 Document

- [ ] Update the shell guard's reference and hook table with the forms it now refuses and the reads it now allows.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/tools/indusk-mcp.md` ("A plan document is written through its checks"): the here-document, argument and variable forms, `xargs`, the extra editors and downloaders, `git apply` reading its patch; standard-stream writes and dry runs allowed; "the honest gap" keeps script files and paths built at run time, and says the witness compares the checkout the guard looked at and leaves out editing-tool writes. `apps/docs/src/guide/index.md` hook table: the same list in its `plan-write-guard` row; the `plan-write-witness` row gains its Edit/Write matcher.

  </details>

#### Build Phase 7 Forward Intelligence

- **Decision (falsify, unattended, 2026-10-19)**: the audit's guard bypass finding was answered "signal" (the witness reports it). It is fixed here as well, because the clause says a shell write is refused, not reported, and one of the forms (a `python3 -` here-document) was used on this plan by the audit session the same day. Script files and paths built at run time stay U1, detected and not prevented.
- **Decision**: the audit findings answered "nothing — left for /falsify" are each either a hypothesis above or recorded here as not taken: the interactive-admin-session reading of Falsify, Cleanup and Audit (`steps.ts:205`) is outside the brief's "run" (a build, a planning run, a release), as the audit answered; the hook-side brief reader (`validate-impl-structure.js:164`) and the plan attribution of later plans' spans (`promises.ts:241`, `land-recorder-signal.ts:23`) are `/cleanup`'s, since no case was found where either gives a false verdict today; the drain's latency at the start of an `indusk` command was not measured (no specific failing input formed without a stalled daemon to time against).
- **Searched, no hypothesis formed**: the run record's writer and reader (`record.ts`: whole-file rename, `unknown` on a cut-off file, plan-name sanitising), `restartStep` (a release restarts only for an accepted plan; anything short of approved restarts planning), `shownPhase` (reads the plan's live copy through `readBuildPlan`'s `livePlanCopy`, not the root checkout), `isLandingOf` (the `: <plan> landed` suffix cannot match another plan's name), the plan-review reader and the waiting list (stale reads `stale`; an approved impl reads the Planning audit done), `waitForIncident`'s order of reads, and the clause-signal rule's task matching (fences masked, a clause matched on word boundaries).
- **Not investigated**: the four everyday-suite reds Build Phase 6 traced to earlier plans; the admin's page components beyond the confirmation card's words (layout is the looks' and was approved).

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/run-record/{record,liveness,restart,shown-phase,landed,situation,next-step,signals}.ts` | New: the run record and the rules that read it |
| `apps/indusk-mcp/src/lib/plans/steps.ts` | The Planning audit step after Impl, filtered with the impl; steps in progress only with a live process |
| `apps/indusk-mcp/src/lib/build/build-session.ts` | `onSession` callback handing the step session's own process to the record |
| `apps/indusk-admin/src/lib/build-host.ts` | Write and read the record; liveness of the step session, not the flag; release by the landing on main; Build on a dead planning run starts planning |
| `apps/indusk-admin/src/lib/decisions.ts`, `decisions-reader.ts`, `planning-reader.ts` | Merged run state; the hash-aware plan-review state reaches the snapshot |
| `apps/indusk-mcp/hooks/plan-write-guard.js`, `plan-write-witness.js`, `_clause-verdicts.js` | New: shell guard, after-command witness, decision port |
| `apps/indusk-mcp/src/lib/promises/clause-signal-rules.ts`, `clause-rules.ts`, `contract.ts`, `clause-verdicts.ts`, `confirm.ts` | New rules called by the contract check; decision drain judged by disk and `shell-quote`; confirm-time reports |
| `apps/indusk-mcp/package.json` | `shell-quote` dependency for the drain |
| `apps/indusk-mcp/src/lib/hook-command.ts` | Registrations under Bash (Pre and Post) |
| `apps/indusk-mcp/src/lib/plans/{bring-trunk,accept-brief,plan-review,approve,waiting,archive,land}.ts`, `src/bin/commands/plans.ts` | Report the three clauses; one hash-aware review reader for the offer and approve; `plans archive`; landing reports the recorder clause |
| `apps/indusk-mcp/skills/retrospective.md` (synced to `.claude/skills/` by `indusk update`) | Step 9 archives with `indusk plans archive` |
| `apps/indusk-mcp/src/lib/admin/wait-for-incident.ts`, `recorder-loop.ts` | New wait rule; a scan record written per pass |
| `apps/indusk-mcp/src/__tests__/admin-recorder.test.ts`, `vitest.tiers.ts` | Patient test; two contract files added to the system tier |
| `apps/indusk-mcp/hooks/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/templates/planning/CLAUDE.md`, root `CLAUDE.md` | Rules and the Key Decisions line |
| `apps/docs/src/reference/**`, `guide/**` | Pages named in each Document gate |

## Dependencies

- `a-brief-is-accepted-on-current-main` lands first (Stabilize order); this plan touches the admin's build host too.
- Node 22; real git in temporary repositories; no daemon for the everyday tests.

## Notes

- Before approval (Decision 20): the person approves redrawn mockups of `plan.working` and `plan.released`; drawing them is outside this impl.
- Decided (Sandy, 2026-10-19): the git commands that move between committed states (`merge`, `pull`, `checkout <branch>`, `switch`, `reset --hard`, `stash pop`) are allowed by the shell guard — landing, accepting a brief and worktrees use them, and what they bring in was checked when it was first written. The rest of the refused-forms list is the author's.
- After landing, run and record these three live checks (each proves no clause; the retrospective reads this list):
  1. **L1** — after landing run `pnpm install:local` and `indusk ui restart`; start a build on a scratch plan, `kill` its step session's `claude` process by hand, reload the plan page and read the stop sentence, press Build and read the phase it names. Date / result: ______
  2. **L2** — after landing, make a scratch plan whose brief conflicts with main and run `indusk plans accept-brief <scratch>` (expect the refusal, the brief still a draft), accept one scratch brief behind main with no conflict, then run `indusk promises confirm a-brief-is-accepted-on-current-main` and its retrospective close; delete the scratch plans. Date / result: ______
  3. **L3** — after landing, in a new session run `sed -i 's/- \[ \]/- [x]/' .indusk/planning/<scratch>/impl.md` and read the refusal (it names the file and the Edit tool). Date / result: ______
