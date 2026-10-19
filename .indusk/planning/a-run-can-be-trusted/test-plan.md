---
title: "A run can be trusted — Test Plan"
date: 2026-10-19
status: draft
---

# A run can be trusted — Test Plan

## Purpose

This document is the clause plan of the brief: the behavioral assertions that, taken together, mean an unattended run can be trusted. A run's step, phase, process and stop are kept on disk and shown as they are; a plan document is changed only through the checks that guard it; a plan whose brief states clauses carries a signal for each; the landing tests pass or fail for what they test; and approval waits for a plan review written for the documents as they stand. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove, and under it by clause.

The assertions here become the rows of the impl's `## Test Trajectory` table, with the same IDs. The brief is `clauses: required`, so each row will name its clause (`clause: <promise>/<clause>`) or its promise (`promise: <promise>`). Ten clauses (nine splits and one limit, across four promises) each need at least one passing row that runs at close, and **the impl must also carry a task in some phase naming each clause's signal** — the very rule `a-plan-with-clauses-carries-its-signals` introduces; this plan is held to it by hand until its own build lands it.

## Decisions made while writing this plan

This plan was written unattended (`INDUSK_GATE_POLICY=auto`): nobody could be asked, so each choice below is the author's judgement, with its reason. The person reads them at the single approval after the impl.

1. **`research.md` does not exist for this plan.** The workflow is `bugfix` (brief + test plan + impl), which does not require one; the brief names each failure and the day it broke. Nothing was skipped that the workflow asks for.
2. **Tests use real git in temporary repositories and a temporary home, not mocks.** Whether a branch has landed on main, and where a run's record is written, are facts git and the filesystem decide. Each such test builds a fresh temp project and `INDUSK_HOME`, starts no server or daemon, and is fast, so everything proving a clause is `unit` or `contract` and runs at landing, never the slow tier (`/decisions/tests-never-make-us-wait`).
3. **Only `unit` and `contract` rows may prove a clause; `live check`, `smoke` and `promise` rows never do.** Landing runs the first two and close reads them; the other three run only after landing, and a skipped row blocks its clause at close (the second clause of `a-plan-with-clauses-carries-its-signals`). Every after-landing check in this plan is therefore listed under "Not for a promise", with the reason it proves no clause. This is the rule the plan makes, applied to itself.
4. **A dead run is told by process identity, never by a bare pid.** A run's record keeps the process it started; a run reads as stopped when that process is gone or is no longer the process that was started (a recycled pid), through the package's existing process-identity reader (`lib/process-identity.ts`, `/CLAUDE.md` single-definition pin). No second way of asking "is it alive" is written. Tests inject the reader's answer rather than start and kill processes.
5. **A run's record lives in machine state, not in the plan.** It is operational state about a process, not a plan document, so it goes in the project's machine-state directory (`indusk eval home`'s directory, `/decisions/bookkeeping-lives-where-it-is-read`), written whole by temporary file and rename, so a crash mid-write never leaves a half record. A record that cannot be read reads as "unknown", never as running and never as a crash of the admin page.
6. **"The phase the plan is on" is read from the plan, every time it is shown.** The controls call the one existing active-phase reader over the plan's own documents; the phase the session was started with is kept only as history. A plan with no readable phase names no phase rather than a wrong one.
7. **A release reads released when `plans land` has put the plan on main, and not otherwise.** The test is git's: the plan's landing commit is an ancestor of main. A release step that exits 0 while the plan is not on main reads stopped, with the reason `plans land` gave (the refusal text), so the second incident (a release that reported "released" after `plans land` refused it) cannot read as success.
8. **The shell refusal reads the command's text, not what an opaque script would do.** It refuses a command that writes, moves or deletes a path under a plan's folder (`.indusk/planning/<plan>/`, including `archive/<plan>/`) by any of: a redirect (`>`, `>>`, `>|`, `&>`) to such a path, `tee`, `sed -i`/`perl -pi`, `mv`, `cp` or `install` into it, `rm`, `truncate`, `dd of=`, `git mv`, `git rm`, `git checkout --`/`git restore` of such a path, and an inline interpreter (`node -e`, `python -c`) whose text names such a path with a write call. The refusal names the file and says to use the Edit tool or the `indusk` command for that document. It does **not** refuse `indusk` commands or other git commands: they write through the checks themselves. A script file that writes a plan document without its text naming one is out of reach of a command-text rule; it is recorded as an untestable assertion (U1) with its compensating control. This is the plan's one honest gap, stated rather than hidden.
9. **A command that merely mentions a plan path is not a write to it.** `git commit -m "fix .indusk/planning/x/impl.md"`, `echo "see .indusk/planning/x/impl.md" > /tmp/note`, `cat .indusk/planning/x/impl.md > /tmp/copy` and `2>&1`/`>/dev/null` add-ons are reads of, or text about, a plan document; refusing them would make the limit clause false.
10. **Signals are reported through the commands' one tracer, as the audit's and the amendment stop's are** (`clause-signal.ts`, best-effort, never failing the command). The decision point reports its clause: `upheld` when the rule held on a run that should have triggered it, `broken` when it let one through. `otel.role` is `library`, there is no production marker, and none of these is something that happens on a schedule, so no clause declares `expect_every`. Each clause's signal below says what is read and what upheld looks like.
11. **The recorder's landing test waits for the incident it expects, not for a minute.** The test already starts a real Jaeger, an always-on server and the admin; the failure came from a fixed one-minute wait while other builds ran. The rule it should hold: the admin has scanned after the mark and the test then judges what it found. The wait ends when the incident appears, or when the admin's own scan has finished after the break was loaded and found none (then it fails naming the break); a generous upper bound exists only so a hung admin ends the test. How the admin's scan is observed is the ADR's question, not this plan's; the assertions below are behavioral. The test stays in the system tier (it starts daemons) and is made patient, not weaker: it still asserts exactly one committed incident with the same subject and a clean tree.
12. **The approval offer and the approve command ask one reading of the plan review.** "Written for the documents as they stand" is the review's recorded hash of the documents compared with the documents now (`planReviewHash`, already used by the planning run's stop). The admin's offer of approval and `plans approve` both ask the same reader, so they cannot disagree; the test pins that they share it.
13. **The two landed plans' clauses are fixed by code, not by hand-marking.** `the-two-landed-plans-report` is made true by the code that keeps each clause (`bringTrunkIntoPlan`, `accept-brief`, and the admin's planning start) reporting through the tracer; the plan `a-brief-is-accepted-on-current-main` then closes by the ordinary `confirm`. No signal is written by hand, and no clause is marked upheld without a run.
14. **Must-not-break promises get a row each only where this plan changes the code next to them** (restart, the unasked build, the planning start, the recorder). The rest is held by their own existing tests, which a landing already runs (`planTestSet` adds each Must-not-break promise's `tests:`).

## Behavioral Assertions

**Every assertion is observable from outside the system:** what the admin shows for a run, what a restart does, what a shell command is answered with, what saving an impl answers, what a test run reports.

## `a-run-is-read-from-its-record`

Every build, planning run and release the admin starts keeps a record on disk of its step, its phase and whether its process is alive, and the admin shows that record, so a run that died reads as stopped with its reason, an admin restart loses nothing, and Build starts it again.

### `kept-on-disk` — a run's step, phase, process and stop are written to disk as they change, and read back after the admin restarts

- Signal: the run's record in the project's machine state and what the admin shows for it after a restart. Upheld when a run started, advanced and stopped is read back identically after the admin's in-memory state is dropped; broken reports the plan and the run kind whose record was missing, partial or different from what was running. Measure: after `startBuild`, `startPlanning` and `startRelease` each, the record on disk holds step, phase, process and (once stopped) the stop, and a fresh reader (no shared memory) returns the same.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A build, a planning run and a release, each started, leave a record on disk naming the plan, the kind of run, its step, its phase and the process it started, before the first step finishes. | unit |
| A2 | When a run moves to its next step or phase, the record on disk says so at once; reading it never shows the step the run has already left. | unit |
| A3 | After the admin restarts (all in-memory knowledge of runs dropped), the plan page shows the same step, phase and state as before the restart for each of the three kinds of run; nothing is lost. | unit |
| A4 | A run that ends on its own (its reason: finished, a waiting amendment, a rate limit, a refused gate) has its stop and the reason written to the record; the plan page still shows that reason after a restart. | unit |
| A5 | A record cut off mid-write or unreadable reads as "unknown", never as running; the plan page still renders and the other plans' records are unaffected. | unit |
| A6 | Records are per plan and kind: two plans running, or one plan's build and its release, never read each other's record. | unit |

### `dead-reads-stopped` — a run whose process is gone without a stop reads as stopped, saying so, and Build starts it again from where the plan stands

- Signal: the plan page's stop sentence for a run and the Build action's answer. Upheld when a run whose recorded process is gone, with no stop written, reads as stopped with a reason that says the run died, and Build then starts the step the plan is at; broken reports the plan whose dead run still read as running, or whose Build was refused as "already running". Measure: with the record's process reported gone, the run state is `stopped` with the reason "the run's process is gone", and `startBuild` returns a new run.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | A run whose recorded process is gone and which wrote no stop reads as stopped, and the sentence says it died (not that it finished). | unit |
| A8 | A run whose recorded pid is now a different program (a recycled pid) reads as stopped as well, never as running. | unit |
| A9 | A run whose process is alive and recorded still reads as running; a dead-run check never stops a live run. | unit |
| A10 | The admin restarted while a build's process is still alive: the run still reads as running after the restart (the restart loses nothing and does not call it dead). | unit |
| A11 | Build on a dead run starts again from where the plan stands: a plan whose build died in the second phase starts the step its documents say is next, not the first and not the step the dead session began with, and it does not need the person to clear anything first. | unit |
| A12 | Build is not refused as "already running" by a dead run's record, and it is still refused while a live run of the same plan and kind exists (a second start of the same owner). | unit |
| A13 | A dead planning run restarts at the planning step the documents say is next, never at the release and never at a build step before the plan is approved. | unit |

### `shows-where-it-is` — the build controls name the phase the plan is on, read from the plan, not the step the session started with

- Signal: the build controls' text on the plan page. Upheld when the phase named is the one the plan's documents say is current, however far the plan moved since the run started; broken reports the plan, the phase shown and the phase read from the plan. Measure: for a plan whose impl has Test Phase 1 closed and Build Phases 1–3 closed, the controls name Build Phase 4 (or the first open phase), never "Test Phase 1".

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A14 | A build started at Test Phase 1 that has since closed three build phases shows the phase the plan is on now (the first phase with work left), not "Test Phase 1". | unit |
| A15 | A plan that moves a phase between two page loads shows the new phase on the second load with no run state change. | unit |
| A16 | A plan whose current phase cannot be read names no phase; it never names a wrong one. | unit |
| A17 | The build controls' stop sentence keeps naming the plan's real phase when the run has stopped (waiting amendment, rate limit, a dead run). | unit |

### `released-only-when-landed` — a release reads released only when the plan has landed on main; otherwise it reads stopped with the reason

- Signal: the release's state on the plan page and in its record. Upheld when every release reading `released` has the plan's landing commit on main, and a release whose landing was refused reads stopped with the refusal's words; broken reports the plan and the release that read released while not on main. Measure: `git merge-base --is-ancestor <landing commit> main` exits 0 for every release the admin marks released.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-----------|
| A18 | A release whose step ended cleanly while `plans land` refused the plan (so it is not on main) reads stopped, with the refusal's reason on the page; it never reads released. | unit |
| A19 | A release whose plan is on main reads released, whether the release was run now or found after an admin restart. | unit |
| A20 | A release whose process died before landing reads stopped saying it died, and Build restarts it at the step the plan is at; never "released". | unit |
| A21 | A release in a real temporary repository: the plan's branch merged to the trunk reads released; the same branch not merged reads stopped. | unit |

### `says-what-is-true` — the plan page and its nav row state the plan's situation in words, read from its record and its files

Added 2026-10-19 (Sandy): `a-brief-is-accepted-on-current-main` read "release in progress" after it had landed and nothing ran for it; a landed plan kept open for its signals has no state of its own.

- Signal: the situation the admin states for each plan, emitted when the page is read. Upheld when the words match the record and the files (a running process for "planning" or "building", a merge on main for "landed"); broken reports the plan, the words shown and what the record says.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-----------|
| A65 | A plan whose planning run is on a step reads "planning" with that step (writing the test plan, writing the impl, reading the plan cold), on the page and in its nav row. | unit |
| A66 | A plan whose build is on a phase reads "building" with that phase; one waiting on the person reads what it waits on (review, approval, an amendment, its plan review). | unit |
| A67 | A plan that has landed on main but is not archived reads "landed" with what it still waits on to close (each clause with no signal), never "releasing". | unit |
| A68 | A plan whose run stopped reads "stopped" with the reason and what starts it again. | unit |

### `always-a-next-step` — every plan that is not closed shows its next step and who takes it

Added 2026-10-19 (Sandy): "there has to be an understood state and next step if it is not closed, or it looks stuck."

- Signal: the same read. Upheld when every open plan shown has a next step naming who takes it (the system now, the person, or an event); broken reports the plan shown with none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-----------|
| A70 | For every situation a plan can be in short of closed (planning, waiting for looks, waiting for approval, building, at review, releasing, landed waiting on signals, stopped), the page and the nav row show a next step and who takes it: "the system is writing the impl", "you approve it", "closes when its clauses report from a real run". | unit |
| A71 | No open plan in the project's real planning folder reads without a next step (a check over every plan the admin lists). | unit |

### `never-in-progress-when-idle` — nothing reads as in progress while no process is running for it

- Signal: the same read. Upheld when every plan shown as planning, building or releasing has a live process in its record; broken reports the plan shown as in progress with none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-----------|
| A69 | An accepted plan with no release process running, after an admin restart, reads landed, stopped or waiting — never "release in progress". | unit |

## `a-plan-document-is-written-through-its-checks`

A shell command that writes a plan document is refused, so every change to a plan document passes the checks that guard it.

### `shell-write-refused` — a shell command that writes, moves or deletes a file under a plan's folder is refused, naming the file and the tool to use instead

- Signal: the refusal the agent receives from the shell tool and the break it leaves. Upheld when each writing form against a plan-folder path is answered with a refusal naming that file and the tool to use, and no file changed; broken reports the plan and the command form that wrote. Measure: for each form in Decision 8, the hook exits with a refusal and `git status --porcelain` is unchanged.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A22 | A shell redirect (`>`, `>>`, `&>`) or `tee` into a plan's `impl.md` is refused naming `impl.md` and saying to use the Edit tool; the file is unchanged. | unit |
| A23 | `sed -i` (and `perl -pi`) on a plan document is refused; the checkbox is not ticked and the refusal names the file and the tool — the way a build session ticked Build Phase 3 off while an amendment waited. | unit |
| A24 | `mv`, `cp` or `install` into a plan's folder, and `rm` or `truncate` of a plan document, is refused naming the file. | unit |
| A25 | `git mv`, `git rm`, and `git checkout --` or `git restore` of a plan document are refused as well; a plain `git add` or `git commit` of one is not (see A32). | unit |
| A26 | An inline interpreter (`node -e`, `python -c`) whose text names a plan-folder path with a write call is refused; one that names no plan path is not looked at. | unit |
| A27 | The refusal covers a plan under `archive/` as well, and any document in the folder (`brief.md`, `test-plan.md`, `adr.md`, `impl.md`, promises' plan files), not only the impl. | unit |
| A28 | A command chained after a read (`cat impl.md && echo done >> impl.md`) is refused for its write; one write anywhere in a pipeline or `&&` chain refuses the whole command, naming the file. | unit |
| A29 | The refusal is a refusal of the shell command, not a crash: a malformed or empty command, and an unparsable one, do not break the shell tool and do not refuse a read. | contract |
| A30 | The hook runs as Claude Code runs it: given the real tool-call payload of the shell tool, it answers with the refusal in the form Claude Code reads, and exits so the command does not run; a write to a plan path really leaves the file unchanged. | contract |
| A31 | `indusk` commands that change a plan document (`plans accept-brief`, `plans approve`, `promises declare`) are not refused: they write through the checks themselves. | unit |

### `reads-pass` — a shell command that only reads a plan document is never refused

- Signal: the shell tool's answer to reading commands. Upheld when no read-only command against a plan-folder path is ever refused; broken reports the command refused and the plan. Measure: every command in the read corpus below (A32–A34) is answered as allowed.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A32 | `cat`, `head`, `tail`, `sed -n`, `grep`, `rg`, `wc`, `ls`, `diff`, `git diff`, `git log`, `git show`, `git status`, and `git add` / `git commit` of a plan document are all allowed. | unit |
| A33 | A command that names a plan path only as text — a commit message, an `echo` to a file outside plan folders, `cat impl.md > /tmp/copy`, `grep x impl.md > /tmp/hits` — is allowed: the write is not under a plan's folder. | unit |
| A34 | `2>&1`, `>/dev/null`, `2>/dev/null` and a here-document whose body mentions a plan path are not read as writes to it. | unit |
| A35 | Writing outside plan folders (`.claude`, source files, `.indusk/current.md`, `.indusk/planning/master.md`) is not refused: guarding writes outside plan folders is not promised. | unit |

## `a-plan-with-clauses-carries-its-signals`

An impl for a brief that states clauses is refused unless a phase reports each split and limit clause's signal, and no live check that can only run after landing is a clause's proof.

### `refused-without-signals` — saving such an impl with no task naming a clause's signal is refused, naming each clause without one

- Signal: the refusal printed when an impl is saved, and the signal-task count the validator reads. Upheld when saving an impl of a `clauses: required` brief with a split or limit clause no task names a signal for is refused, listing every such clause; broken reports the plan and the clause saved without one. Measure: the validator's exit and message for a fixture impl missing one, and two, signal tasks.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A36 | An impl of a brief with clauses where no phase names a clause's signal is refused, and the refusal lists each clause lacking one by `promise/clause`. | unit |
| A37 | With two clauses missing a signal task and one present, the refusal names exactly the two, each on its own line. | unit |
| A38 | An impl with a task naming every split and limit clause's signal is saved. A resting clause needs none. | unit |
| A39 | A signal task is found by the clause's name in a task line or its folded technical detail alike, but not in prose outside a task and not inside a code fence. | unit |
| A40 | A brief that does not state clauses (no `clauses: required`) is not asked for signals; an impl saved before this rule, edited in a way that adds no clause, is not refused for it. | unit |
| A41 | The refusal reaches the person as the save check's message when the impl is written by the agent, and when the planning run writes it; nothing is saved over it. | contract |

### `a-live-check-proves-no-clause` — saving an impl whose row runs only after landing and names a clause is refused, since a skipped row blocks the clause at close

- Signal: the refusal printed when an impl is saved. Upheld when a row of level `live check`, `smoke` or `promise` whose `For` cell names a clause is refused naming the row and the clause, and a row of `unit` or `contract` level naming it is saved; broken reports the plan and the row saved. Measure: the validator's exit and message for each level on a fixture row.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A42 | A trajectory row of level `live check` whose `For` names a clause is refused naming that row and that clause, and saying a live check runs only after landing so it blocks the clause at close. | unit |
| A43 | The same for a row of level `smoke` or `promise`; a row of level `unit` or `contract` naming the same clause is saved. | unit |
| A44 | A `live check` row that names a promise (`promise: <name>`) or no clause, or a reason, is saved: the limit is on a clause's proof only. | unit |
| A45 | A row with several `For` entries, one a clause, is refused for the clause; the refusal names the one entry. | unit |

### `the-two-landed-plans-report` — the three clauses of `a-brief-is-accepted-on-current-main` report their signals from the code that keeps them, so that plan can close

- Signal: that plan's three clauses (`main-is-merged-first`, `a-conflict-refuses`, `the-person-never-merges`) as read by the promise's reader. Upheld when each clause's code path reports its clause when it decides (the merge of trunk, a conflict refused, an acceptance that asked nothing) and the plan's close finds each clause upheld in a real run; broken reports the clause that never reported. Measure: for each of the three, running its code path in a temporary repository emits a clause report naming `a-brief-is-accepted-on-current-main/<clause>`.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A46 | Accepting a brief on a branch behind main reports `main-is-merged-first` as upheld, from the code that merges main, in the command line and the admin's planning start alike. | unit |
| A47 | A conflicting acceptance, refused with the brief still a draft, reports `a-conflict-refuses` as upheld; one that let a half-merge through reports it broken. | unit |
| A48 | An acceptance on a branch behind main with no conflict, which asks nothing and tells the person nothing to merge, reports `the-person-never-merges` as upheld; a refusal that tells the person to merge main reports it broken. | unit |
| A49 | A report that cannot be sent (no daemon running) never fails the acceptance or the planning start: the command's result is unchanged. | unit |

The live confirmation that plan then closes is a check after landing (L2, below), never a row for these clauses.

## Existing promises

### Changes: `approval-waits-for-a-finished-plan`

A plan is offered for approval only when its impl is written, no session is still writing it, and its plan review is written for the documents as they stand with every finding answered; a plan whose impl is written without such a plan review, and that no run is still writing, is listed as needing its plan review.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A50 | A plan whose plan review was written for the documents as they stood, and whose documents have since changed, is not offered for approval; it is listed as needing its plan review. | unit |
| A51 | A plan whose review is current for the documents and has every finding answered is offered for approval. | unit |
| A52 | A plan whose impl is written, with no plan review at all and no run still writing it, is listed as needing its plan review, not as waiting on a session. | unit |
| A53 | A plan whose review has an unanswered finding is not offered, as before. | unit |
| A54 | `plans approve` and the admin's offer agree: for each state above both refuse or both allow, because they ask one reader of the review. | unit |
| A55 | A plan a session is still writing is not offered and not listed as needing a plan review, as before. | unit |

### Must not break: `a-build-runs-to-review-unasked`

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A56 | A build on an accepted, approved plan still runs, unasked, to review; a run that dies in the middle now reads stopped, with its reason, instead of disappearing from the page. | unit |

### Must not break: `nothing-ships-until-accepted`

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A57 | Build after a restart, or on a dead run, of a plan that has not been accepted never starts the release; it starts the step the plan is at. | unit |

### Must not break: `an-accepted-brief-is-planned-unasked`

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-----------|
| A58 | An accepted brief still starts its planning run on acceptance, and that run now has a record on disk like any other. | unit |

### Must not break: `a-production-break-is-recorded-unasked`

Its landing test is the one made patient (the clause `recorder-waits-for-its-break` below); its other tests stand unchanged. The patient test is held to the same assertions as before.

## `landing-tests-hold-under-load`

The tests landing runs pass or fail for what they test, not for how busy the machine is.

### `recorder-waits-for-its-break` — the admin-recorder landing test waits for the incident it expects rather than a fixed minute, and passes with other builds running

- Signal: the admin-recorder landing test's result across landings. Upheld when the test passes on a loaded machine (other builds running) as it does alone, and fails only when no incident is committed after the admin has scanned; broken reports the landing the test failed under load and the wait it gave up on. Measure: the test's result with a competing load (another build running) is the same as alone; a break the admin never records fails the test with the break named.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A59 | With the admin slow to scan because the machine is busy, the production break is still recorded and committed, and the test passes: it waits for the incident, not for the sixty seconds. | contract |
| A60 | With a break the admin never records, the test fails (it does not hang and does not pass), and says which break it waited for. | unit |
| A61 | The patient test asserts what the old one did: exactly one incident, committed by the admin with the same subject, with a clean working tree. | contract |
| A62 | The waiting rule decides from the clock and the reads it is given: an incident that appears after the old fixed minute but before the admin's scan ends passes; none after the scan ends fails. | unit |

## Not for a promise

Assertions that prove no clause, each with why it is still worth a test. Every check that can only run after landing is here, by Decision 3.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| L1 | After landing, on the installed admin, a build started on a scratch plan and killed by hand reads stopped on the plan page with its reason within a page load, and Build starts it again from the phase the plan is on. | live check | The whole story on the real admin; it can only run once the admin has this plan's code, so by Decision 3 it proves no clause. |
| L2 | After landing, `indusk promises confirm a-brief-is-accepted-on-current-main` succeeds and that plan closes. | live check | The outcome `the-two-landed-plans-report` exists for; runs only after landing, so it proves no clause. |
| L3 | After landing, in a real session, a shell command that tries to tick a box in a plan's impl is refused with the file and the tool named. | live check | The real Claude Code session against the installed hook; the contract rows (A29, A30) prove the clause at landing. |
| A63 | Existing guard tests for the shell guard's registration: the new hook is listed where the project's hooks are installed (`.claude/settings.json`) and synced byte for byte from the package (`skill-sync-parity`). | unit | A regression guard: a hook that is not registered refuses nothing, and no clause test would see it. |
| A64 | A promise record written by the admin leaves the working tree of the plan clean: a run's record is machine state outside the repository, never a file git shows as changed. | unit | A regression guard on Decision 5, keeping bookkeeping out of plan documents. |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A script file whose text does not name a plan-folder path can still write one (`./tidy.sh` that loops over `.indusk/planning/*`). | A rule that reads the command cannot read the script; reading every script is not promised, and a path built at run time defeats any text rule. | Every plan document that changes is read by the gates that run later regardless of how it was written: the phase-boundary check (`check-gates.js`) refuses a box ticked without its gates, and `indusk verify` detects a premature checkoff; the change also shows in the diff the audit reads. |
| U2 | Whether the stop sentence for a dead run reads clearly to the person. | Wording is a person's judgement. | The brief's look `plan.working` is held by its approved mockup, and the person approves the look at the plan's approval. |

## Notes

- **Signals need a report each**: ten split and limit clauses (four on `a-run-is-read-from-its-record`, two on `a-plan-document-is-written-through-its-checks`, three on `a-plan-with-clauses-carries-its-signals`, one on `landing-tests-hold-under-load`) and the impl must name each clause's signal in a task. `landing-tests-hold-under-load`'s signal is the test's own result across landings, read by the landing; it reports through the existing landing-test record, not a new mark.
- **Levels chosen to revisit**: A29, A30, A41, A59 and A61 are `contract` because they run a real hook payload, a real save check or a real admin and Jaeger; they sit in the system tier at landing (`vitest.tiers.ts`), where a test that starts a process belongs. If A59 proves too slow for landing, the ADR may move the real-daemon part to a contract and keep the waiting rule (A62) as the unit that proves the clause.
- **Looks**: the brief's `plan.working` look changes no component; the stop sentence's wording is carried by the existing look and U2.
- **Open decision for the person**: Decision 8's list of refused forms is the author's; a form the person wants refused or allowed beyond it is a change to this list before the impl's shell-guard rows are written.
