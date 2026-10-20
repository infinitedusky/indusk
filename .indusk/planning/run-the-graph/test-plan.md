---
title: "Run the graph — Test Plan"
date: 2026-10-19
status: draft
---

# Run the graph — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean slice 1 is working: within one approved plan that is not a workbench plan, every phase whose dependencies are done runs at once, each in its own worktree on its own branch, and joins the plan's branch only when green. The brief opts into `clauses: required`, so this is the clause plan: one section per clause, each with its signal, the ways it could fail and its assertions. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it. The assertions become the source rows of the impl's `## Test Trajectory`.

**Rebuilt around the inventory (Sandy, 2026-10-19).** The plan is the seven-item smallest change set at the end of [research.md](research.md) ("Inventory: where the code assumes one phase at a time"), plus what the brief's promises and clauses strictly require beyond it, plus `indusk run` refusing a plan the graph is running. Earlier versions of this file are in its history (the full design at commit `0842d3fdf`, the first slice at `0a4d7a091`).

## Behavioral Assertions

**Every assertion is observable from outside the system:** which phases of a plan are running at a moment, what a phase's worktree holds when it starts, what a join into the plan's branch does, and what a session or a refusal says. A "phase" is a test or build phase of the plan's impl; "the graph step" is the build's work step, which starts phase sessions inside the admin's build; "the join" is what brings a finished phase into its plan's branch.

**How the levels were chosen (decision).** The scheduler decides from a graph, a list of running sessions and a cap, so each of its rules is a `unit` test over those inputs (`lesson: code-that-decides-takes-its-clock-and-its-reads`). Branches and joins are tested against real throwaway git repositories, still `unit` (a temp directory, no server). The graph step is tested with the real session manager and a stand-in process that spends no model call. One `live check` builds a real plan through the admin's build host with a scripted agent; it runs in the system tier at landing and release, never in a phase's loop, and so proves no clause — it is the real run each clause's signal must report from before the plan closes.

**What the clauses are judged over (decision).** The graph runs only inside the admin's build of a plan. A clause about launching (`ready-phases-start`, `graph-is-current`) is judged while that build runs. A build that is not running — never started, stopped on a recorded stop, or ended by an admin restart (which reads stopped with its reason, as `a-run-can-be-trusted` built) — launches nothing and is not judged; a build that resumes by itself is the later slice the brief calls "nothing stops". Approving in the admin starts the build; a terminal approval names the next session as today.

## `the-work-runs-as-a-graph`

Within an approved plan that is not a workbench plan, every phase whose dependencies are done is running, up to the session cap, and no phase waits on one it does not depend on. A workbench plan builds one phase at a time, as today (the brief's Not promised).

### `a-phase-names-what-it-needs` — each phase names the phases it depends on; one that names none depends on the phase before it

A phase is named by its kind and number only: `Test Phase N` or `Build Phase N`, with `Phase N` meaning `Build Phase N` (as `### Phase N:` headings already do); the words after a heading's colon are never part of the name. Dependency lines, the graph's nodes, branch names and signals all use that one key.

- Signal: a span on every graph read, from the graph reader's signal file, judging each node's dependencies against a plain scan of the impl's headings and dependency lines (outside fenced blocks), never through the reader's parser. Upheld when every phase's dependency list matches its line, or the phase before it when it has none (plus Test Phase 1 for every build phase when the impl has one); broken names the plan, the phase and both lists.
- Fails when:
  - the reader parses a line wrongly, or misses one beside a fence — the span's plain scan disagrees.
  - a phase with no line gets no dependency, or the first phase gets one — the span's expected list says otherwise.
  - a line names a phase that does not exist, the phase itself, or closes a loop, and the graph runs anyway — the span names the unknown phase or the loop.
  - the gate hook reads the lines differently from the graph — the hook's reader is held equal to the package's by a parity test (A3); a hook that disagrees refuses a phase session's tick, and the gate hook records every refusal it makes in a phase session with the phase that blocked it, which the `no-needless-wait` span reads against its own plain scan (a refusal by a phase the ticked one does not depend on is broken, naming both).
- Measure: phases, over the next twenty run by the graph, whose recorded dependencies differ from what their impl declared; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A plan with six build phases where Phases 1 and 3 name nothing (`none`), Phase 2 names 1 and Phase 5 names 2 and 3 shows exactly those dependencies; in an impl with a Test Phase 1, every build phase also depends on it, even one marked `none`. | unit |
| A2 | A plan written before this one, whose phases name nothing, shows each phase depending on the one before it, and the first on nothing. | unit |
| A3 | `Phase 6` and `Build Phase 6` name the same phase whether its heading is written `### Phase 6:` or `### Build Phase 6:`; the gate hook's reader and the package's reader give the same dependencies and files for the same text. | unit |
| A4 | A plan whose impl names a phase that does not exist, a phase depending on itself, or a loop is not run: the build stops naming the phase and the problem, and launches nothing. | unit |

### `ready-phases-start` — a phase becomes ready when the last phase it depends on finishes, and its session is launched within one minute while the session cap has room

- Signal: a span from the graph step's signal file at each launch and on each 30-second tick, while the plan's build runs. The ready time is read from git, not from the graph step: the time the plan's branch first held the last dependency's work, from the plan branch's reflog (a fast-forward and a merge commit read alike), or, for a phase with no dependency left to wait for, the build run's start in the run record. The launch time is when the phase's session actually started: its `startedAt` in the session manager's sessions file, read at each launch and tick and kept in the signal's own log (so a session that has since ended is still known) — never the branch's creation, which comes before the worktree's install and before the session starts. Whether the cap had room is read from the session manager's sessions file against `sessions.max` at each tick and kept in the signal's own log. Upheld when every phase was launched within sixty seconds of becoming ready whenever the cap had room, and every phase that ended ticked boxes only in its own section; broken names the phase, the ready time and the launch time or none, or the section it ticked outside. A phase waiting on a person (a declared judgement or blocker) is listed as waiting, never as late. **A session with no phase working in the plan's own worktree leaves the plan no room** (the brief's changed `a-session-belongs-to-its-plan`, Sandy, 2026-10-20): while the sessions file shows one — a session of the plan with no phase whose directory is the plan's worktree — the signal's log records the plan as having no room, exactly as a full cap, so a ready phase held by it is not ready to launch and never reads late; the sixty seconds count from when that session ends. The promise's "up to the session cap" reads the same way: the plan's own worktree, taken by a session with no phase, is a place the plan does not have.
- Fails when:
  - a ready phase with cap room is launched late — the launch span (a gap over sixty seconds while the signal's own readings showed room).
  - a phase-less session in the plan's worktree is read as room, so a correctly held phase reads late, or is not read as no room once it has ended, so a late phase reads held — the launch and tick spans read that session from the sessions file themselves, beside the cap (A48).
  - a phase's branch is cut on time but its session starts late (a slow install, several starts in one pass run one after another) — the launch span: the launch time is the session's own start, not the branch's.
  - a ready phase with cap room is never launched (a missed phase end, the scheduler judging it not ready, a refused launch) — the tick span: ready over a minute by git's time, room now, no phase branch.
  - a join check that runs longer than a minute holds up a launch the cap has room for — the same launch and tick spans: the gap is measured whatever the graph step was doing.
  - a phase branch is cut but its session never starts (setting up its worktree failed silently, the session was refused) — the tick span: a phase branch older than fifteen minutes with no session in the sessions file and no stop for it in the graph record.
  - a session works a phase other than the one it was launched for — the phase-end span: a plain diff of the impl between the plan's branch and the phase's branch shows a box ticked outside the launched phase's section.
  - the plan branch's reflog is missing (reflogs turned off) — the span reports unknown, never upheld.
  - the admin is not running or its restart ended the build, so nothing launches — no signal: the clause is judged while the build runs (see "What the clauses are judged over"); the run record reads stopped with its reason, and resuming unasked is a later slice.
- Measure: seconds from ready to launch for every phase in the next twenty run by the graph that had cap room; expect under sixty for all.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | Building the six-phase plan starts Phases 1 and 3 at once; Phase 2 starts when 1 has joined the plan and not before; Phase 5 starts only once both 2 and 3 have joined. | unit |
| A6 | A ready phase is not started while the cap is full, and is started when a session ends. | unit |
| A7 | Run with the real session manager and a stand-in process, the plan's second ready phase gets its own session while the first runs, and a session beyond the cap is refused and started later. | unit |
| A8 | When a phase's session ends with its phase finished, the phase is joined into the plan's branch and the phases that were waiting only for it are launched, without anyone running a command. | unit |
| A9 | A phase session is told the one phase it works and to work only that phase, its environment names the phase, and the gate hook refuses its tick of any other phase's item, naming the session's phase; a session sent back after a failed join is told why. | unit |
| A48 | While a session with no phase of the plan runs in the plan's own worktree, a ready phase with cap room is not launched and the scheduler gives it the reason that the plan's worktree is in use, as it would the cap; once that session ends the phase is launched; and the ready-phases signal, fed the same sessions file, reads the held phase as having had no room, never late. | unit |
| A10 | A real approved plan with two independent phases and a third depending on both, built from the admin's build host with a scripted agent, runs the first two at once and ends with all three on the plan's branch. | live check |

### `no-needless-wait` — no phase is held back by a phase of its plan it does not depend on, except that two phases of one plan that touch the same file never run at the same time

- Signal: a span from the scheduler's signal file after each scheduling call (the graph step calls it; the scheduler stays pure), re-deriving each waiting phase's reason from its own reads, not the call's inputs: dependencies by a plain scan of the impl at the plan branch's tip, running phases from the session manager's sessions file, overlap three ways, never by the scheduler's overlap function: the declared strings against each other (equal, or one a glob the other's literal path matches), both declared sets expanded against the plan branch's files (`git ls-files`), and the files each running phase's branch has actually changed (`git diff --name-only` from the plan's branch), so a new file two phases both write is seen. It also reads the gate hook's refusal record — each tick the hook refused in a phase session, with the session's phase, the ticked phase and the phase that blocked it — and judges each new refusal by its own plain scan of the dependency lines. Upheld when every waiting phase's reason is one of: a dependency not done, a running phase of the plan sharing a file (a phase with no files line shares with every phase), the cap, the plan waiting on a question, an amendment or a session with no phase working in the plan's worktree, or a judgement or blocker the phase itself declares; and every hook refusal was by a phase the ticked phase depends on, or a tick of another phase's item. Broken names the phase and its reason, or the refusal and both phases.
- Fails when:
  - a waiting phase has no reason, or a reason naming a phase it neither depends on nor shares a file with — the span.
  - a ready phase with none of the reasons is not started — the span.
  - two declared file sets are judged overlapping when they are not, or not when they are — the span re-checks on the declared strings and on concrete paths.
  - two running phases of one plan touch the same file, including one neither declared or one not yet created — the span compares their branches' changed files.
  - two phases that declare no files run at once — the span (an undeclared phase shares with every phase).
  - the gate hook refuses a phase session's ticks because an earlier phase it does not depend on is open — the span reads the hook's refusal record: the blocking phase is not among the ticked phase's dependencies by its plain scan. A16 holds the hook's rule.
  - the installed gate hook is older than the package's (a project not yet updated), so it refuses every independent phase's ticks — the graph step does not run on a stale installed hook (A46), and any refusal it would make is the same refusal record's.
  - one phase's declared judgement or blocker stops the plan's other phases — the span: the other phases wait with no reason of their own.
  - the first open phase in document order carries a judgement or a blocker and the build stops before the graph runs, so a ready independent phase never starts — the span's stop reading: whenever the build stops on a judgement or a blocker, a plain scan of the impl at the plan branch's tip must find no other open phase whose dependencies are all closed there and which the graph record does not list as stopped; one found is broken, naming it and the judgement. A47 holds the build's real path.
- Measure: minutes a phase waited whose reason was none of the listed; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A11 | A phase later in the document than a running phase, which does not depend on it and shares no file with it, starts without waiting for it. | unit |
| A12 | A ready phase that shares a file with a running phase of its plan waits, and its reason names that phase and that file. | unit |
| A13 | A phase that declares no files shares a file with every other phase of its plan: it waits for its plan's running phases and says so, no phase of its plan starts beside it, and two such phases never run at once. | unit |
| A14 | Only the plan's own impl is never counted as a shared file (it is joined by phase section and test row); the changelog, a `CLAUDE.md` file and a docs page count like any other file. | unit |
| A15 | With the cap at one and phases naming nothing, the order and the result are those of today's one-phase-at-a-time build. | unit |
| A16 | In a phase's own worktree, the gate hook lets the phase's items be ticked and the phase close while an earlier phase it does not depend on is open, and refuses while a phase it depends on is open; an impl with no dependency lines is refused exactly as today. | unit |
| A17 | A ready phase carrying a blocker or an item a person must judge is not launched; the plan's other phases go on; once nothing else can run, the build stops on that judgement or blocker as it does today. | unit |
| A46 | The graph step does not run a plan whose installed gate hook is not the package's: the build stops naming `indusk update` and launches nothing. | unit |
| A47 | Through the build's real path (the step loop choosing the next step, then the graph step), a plan whose first open phase in document order carries an item a person must judge, or a blocker, still starts an independent later phase that is ready; the build stops on the judgement only once nothing else can run. | unit |

### `graph-is-current` — when a phase ends or a plan is approved, the plan's graph is read again before its next phase starts

- Signal: a span from the graph step's signal file at each launch, reading the impl at the plan branch's tip with git and a plain scan: the launched phase is still open there, every phase it depends on is finished there, and no session for that phase is already in the session manager's sessions file. Upheld when every launch holds all three; broken names the launch and which failed. A ready phase never launched after a phase end or a build start is the `ready-phases-start` tick span's to report.
- Fails when:
  - a stale graph launches a phase already joined into the plan — the span.
  - a phase is launched before a dependency has joined the plan — the span.
  - one phase is launched twice — the span.
  - a phase end or a build start is not followed by a read, so a ready phase waits — the `ready-phases-start` tick span.
- Measure: launches that failed any of the three checks; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A18 | Each phase end is followed by a fresh read of the plan before the next launch, and the 30-second tick launches a ready phase whose end event was missed; a join check that has not returned holds up no launch the cap has room for. | unit |
| A19 | Two phases ending at the same moment are joined one after the other, and the phase waiting for both starts once, with both in its worktree; a tick firing while a phase end is being handled launches each ready phase once, because one launcher does every launch. | unit |

### `within-the-cap` — rests on `sessions-are-capped`

- Signal: the promise it rests on, `sessions-are-capped`, read where that promise is read; the clause is upheld while that promise is in force.
- Fails when:
  - a plan's phase sessions are exempted from the cap because its build was admitted once — no signal of its own: `sessions-are-capped` covers every session the manager starts, and A20 holds that each phase session after the first takes its own place.
  - a phase session is started outside the admin's session manager — no signal: the graph step runs only in the admin's build host, and `indusk run` refuses a plan the graph is building (A33).

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A20 | With the cap at four and one admitted build, the build's first phase session takes the place its admission holds and each further phase session takes a place of its own, so a fifth session on the machine is refused. | unit |

### `reviews-are-phases` — the phases falsify, cleanup, the audit and an incident write are build phases of the graph like any other; the steps that write them are not phases

- Signal: two spans. On every graph read, from the graph reader's signal file: a plain scan of the impl's headings finds each open Falsification, Cleanup, Audit and Maintenance phase, and each has a node with its declared (or default) dependencies and files; no node is a step. When the build starts a ritual step, from the graph step's signal file: every phase of the impl at the plan branch's tip is finished, so no review phase was left for a step to skip. Broken names the plan and the missing node, the step shown as a node, or the open phase a step started over.
- Fails when:
  - a review phase in the impl is missing from the graph — the read span.
  - a step that writes a phase appears as a node or takes a phase session — the read span.
  - a ritual step starts while a phase it or another step wrote is open — the step span.
  - a review phase written with no dependency line runs before the phases it reviews — no signal needed: with no line it depends on the phase before it, which the read span checks like any other.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A21 | A Falsification, a Cleanup, an Audit and a Maintenance phase are listed in the graph with the dependencies they name, or the phase before them when they name none; the audit, falsify and cleanup steps themselves are not phases. | unit |
| A22 | Once every phase is finished the build runs its next ritual step, and a phase that step writes is run by the graph before the step after it starts. | unit |

## `a-phase-builds-on-its-own-branch`

Each phase works in its own worktree off its plan's branch, merges in what came before it when it starts, and merges into the plan's branch only when its check is green; only the plan's branch reaches the trunk, once its promises are verified.

### `own-worktree` — every running phase has its own worktree and branch, cut from its plan's branch

- Signal: a span from the phase-branch signal file each time a phase starts or resumes, read with plain git (`git worktree list --porcelain`, `git merge-base`, the phase branch's reflog), not the layout code. Upheld when the phase's branch is the name the signal's own plain rule gives its kind and number (`phase/<plan>/test-<n>` or `phase/<plan>/build-<n>`), its worktree and branch are held by no other running phase, its branch was cut from the plan's branch, the plan's assigned worktree is still the plan's own, and a resumed phase's branch tip is the one it had before; broken names the phase and the shared worktree, the wrong name or base, the phase worktree assigned as the plan's, or the lost commits.
- Fails when:
  - two running phases share a worktree or a branch — the span.
  - a test phase and a build phase with the same number resolve to one branch, so the second "resumes" the first's — the span: the branch's name does not carry the starting phase's kind.
  - a phase is cut from the trunk or another branch — the span checks the base.
  - a phase worktree is recorded as the plan's worktree, so every reader of the plan reads the phase's copy or the trunk's — the span reads the assignment.
  - a resumed phase is cut fresh and loses its work — the span compares the branch tip before and after, and reads a re-creation in the branch's reflog.
  - the worktree is not set up (its install fails) — no signal: the phase stops with the failing command named, and its check cannot pass, so it never joins (`green-before-merging`).
  - a joined phase's worktree is left behind — no signal: housekeeping that changes no running phase's work.
- Measure: running phases sharing a worktree, branched off something other than their plan's branch, or resumed without their earlier commits; expect zero.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A23 | Two phases of one plan running together are in two worktrees on two branches named for the plan and the phase's kind and number, both cut from the plan's branch, and one's work is not visible in the other's worktree; Test Phase 2 and Build Phase 2 get different branches; neither worktree is assigned as the plan's, so the plan still reads from its own worktree. | unit |
| A24 | A phase started again (after a red check, a question or a stopped build) carries on in its own worktree and branch with its earlier commits; a branch whose worktree was removed gets its worktree back from the branch, never a fresh cut. | unit |
| A25 | A new phase worktree is set up as `indusk worktree create` sets one up — the same `.mcp.json`, environment and install steps, through one function both call — and a failed setup stops the phase naming the command. | unit |

### `starts-from-its-dependencies` — a phase starts with every finished phase it depends on merged into its worktree

- Signal: a span from the phase-branch signal file each time a phase starts, read with git: each dependency's last joined tip (from the plan branch's reflog) is an ancestor of the new worktree's head, and the worktree has no unmerged paths. Upheld when every dependency's work is present; broken names the phase and the dependency missing.
- Fails when:
  - a finished dependency's work is missing (the phase was started before the dependency joined the plan, or cut from a stale tip) — the span.
  - a start leaves half a merge — the span (`git ls-files -u`).
- Measure: phases started without a dependency's work in their worktree; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A26 | Phase 5, depending on 2 and 3, starts with both phases' files present in its worktree. | unit |

### `green-before-merging` — a phase merges into its plan's branch only when, with the merge made, its own tests and the tests of every clause the plan's branch has touched pass

- Signal: a span from the join's signal file after each join and on each graph-step tick, reading every move of the plan's branch since the last judged one from its reflog. A move that brings a phase's work must have a test runner report in machine state, written by the check for exactly that commit, in which every test expected to pass passed, recomputed by a plain scan and not by the check's selector: the test file of every row of the joined phase and of the phases finished at that commit whose Passes-at phase is finished there, the test files of every row whose `For` names a clause those rows name, the `tests:` listed in the promise file of every promise or clause whose `clause:` or `promise:` marker is in a file changed on the plan's branch since it left the trunk (read as text), the test file of every row of this trajectory whose `For` names such a promise or one of its clauses, and the test files each Must-not-break promise's own file lists — exactly the set the check's selector resolves, part for part. A join the check refused as red is judged too: when every failing test in its report is a row whose Passes-at phase has not joined, or a test phase's row written for a later phase failing on its assertion, the refusal was wrong and is broken, naming the phase and the rows. For a test phase, each row it writes that passes at a later phase must be in the report and failing on a test's assertion, never on a file that did not load. A move that brings no phase's work while one of the plan's phase sessions is running is broken: something moved the branch outside the join. Broken names the commit and the red, missing or left-out tests, or the outside move.
- Fails when:
  - the branch moves with a red run, or to a different commit than the one checked — the span.
  - the run leaves out a clause touched through another phase — the span's own scan finds its test file absent from the report.
  - the run leaves out a promise touched only through a marker in a changed source file, one this trajectory never names — the span's own list includes that promise's registered tests and finds them absent.
  - the run leaves out a row of this trajectory whose `For` names a promise or clause touched only through a marker in a changed source file — the span's own list includes every such row's test file and finds it absent.
  - the run leaves out the phase's own rows that name no clause, or the Must-not-break tests — the span's own list finds them absent.
  - the check counts a row that is red by design (written now, passing at a phase not yet joined) as a failure, so Test Phase 1 or a later phase can never join — the span judges each refused join: a refusal whose only failures are red by design is broken, whether or not the phase has dependents. A29 and A30 hold the selection.
  - two phases add or remove lines of the impl in different phase sections and the join cannot combine them, so the phase is sent back to a conflict its session cannot see — A32; two notes appended to one section, or two rows added with one new ID, join without a session; a change both sides made inside one part that still cannot be combined is a failed attempt — the phase goes back to its session told to merge the plan's branch in and resolve that part of the impl, within its three attempts (A31, A32).
  - something commits on the plan's branch from the plan's own worktree while phases build (a planning session, a build session with no phase) — refused: no session with no phase starts in the plan's worktree while the plan's phase sessions run, and the graph launches no phase while one runs there (A37); a person's commit from a terminal is the tick span's outside move.
  - a test phase's red row fails because its file does not load, and is taken as red on its assertion — the span reads that file's result in the report.
  - the join claims a run it never made — the span finds no report for that commit.
  - the branch is moved during a run by something else (Dawn's `indusk run`, a person's commit) — the tick span; `indusk run` also refuses such a plan (A33), and a session with no phase is refused in the plan's worktree while the plan's phases build (A37).
  - a phase whose check stays red is joined after its attempts run out — the span.
- Measure: moves of a plan's branch, during graph runs, with a red, absent or partial check; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A27 | A phase whose tests pass alone but fail once the plan's branch is merged into it is not joined; of two phases that break something only together, the first stays joined and the second is sent back with the failing tests named. | unit |
| A28 | A green phase is joined into the plan's branch, the plan's worktree shows its files, and the phase's worktree is removed while its branch is kept. | unit |
| A29 | The join check's real test selection, on a real plan's trajectory and changed files, picks the phase's own tests that pass at it, the tests of every clause named by a finished phase's row, the registered tests of every promise or clause whose marker (`promise:` or `clause:`) is in a file changed on the plan's branch — resolved through the promise registry as `plans tests` resolves Must-not-break, so a promise this trajectory never names is still included — and the Must-not-break tests; it leaves out rows not yet written and rows written at a finished phase that pass only at a phase not yet joined. | unit |
| A30 | A test phase joins when each row it owns passes and each row it writes for a later phase fails on its own assertion; a row whose file fails to load refuses the join, naming it. | unit |
| A31 | A phase whose check is red goes back to its own session told why; one whose merge conflicts outside the impl, or inside a part of the impl both sides changed that will not combine, goes back told to merge the plan's branch in and resolve the named files or part; after its third failed attempt it is stopped and listed with the reason, its dependents keep waiting, and phases that do not need it go on. | unit |
| A32 | Two phases that tick boxes and fill result cells on neighbouring lines of the impl, add or remove lines in their own phase sections (a blocker line, a note, a deferral body), add trajectory rows, both append notes to the impl's Notes, or both add a trajectory row with the same new ID, join without a conflict reaching a session: two appends to one part keep both, the plan's first; two rows with one ID and the same content are kept once, and with different content the joining phase's row takes the next free ID, rewritten wherever the joining phase's own section names it. A change both made inside one part that still cannot be combined goes back to the session as a failed attempt, told to merge the plan's branch in and resolve that part. | unit |
| A33 | `indusk run` refuses a plan the admin is building with the graph, naming the build. | unit |

### `every-phase-is-checked` — a phase that runs no test never merges, and the plan carries a signal for every clause it touches

**Decision (2026-10-20): signals are judged for the whole plan, not at each join.** A join that required each touched clause's signal task in the phase or a finished phase deadlocked every plan written as clauses: Test Phase 1 writes rows for clauses whose signal tasks sit in the build phases, and every build phase depends on it. The join checks only that tests ran. That the plan carries a signal for every clause it touches is judged over the whole plan: for the brief's own clauses, by the contract check's rule (`indusk promises contract`, which refuses an impl missing a clause's signal task) at approval and at the plan's close; for a clause the plan touches through a `clause:` marker in a file it changed, by this clause's signal.

- Signal: a span from the join's signal file after each join, reading the run's test count from the test runner's own report (not the graph record), and judging every clause the plan touches at the new tip: the clauses of the plan's brief, plus every clause whose `clause:` marker is in a file changed on the plan's branch since it left the trunk (`git diff --name-only`, read as text). A clause of the brief is carried when the contract check's signal-task rule finds its signal task in the impl. A marker-touched clause of another promise is carried when this impl has a signal task naming it, or a source file at the new tip that is not a test reports it (a plain text search for `<promise>/<clause>` beside a clause-signal call, where the plan that made it put its signal). Upheld when every joined phase ran a test and every touched clause is carried; broken names the phase and "no test ran", or the clause and that no signal carries it.
- Fails when:
  - a phase joins having run no test, or only skipped ones — the span.
  - a phase whose rows are all deferred joins — the same span (no test ran).
  - a clause of the brief has no signal task anywhere in the plan — the span, and the contract check refuses the impl at approval and at close.
  - a phase changes a file carrying another promise's `clause:` marker and that clause has no signal anywhere — the span: the clause is in its touched set and neither this impl nor any source file reports it.
  - a marker the plan's changes add or move names a clause the registry does not have — the span names the marker and the unknown clause.

- Measure: phases joined with no test run over the next twenty; expect none.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A34 | A phase whose check runs no test, or whose rows are all deferred, is not joined and is listed as unchecked. | unit |
| A35 | A test phase whose rows name clauses whose signal tasks sit in later build phases joins once its rows hold the test-phase rule; the join reads no signal task. | unit |

### `only-the-plan-lands` — nothing reaches the trunk from a phase's branch; only a plan's branch, once its promises are verified

- Signal: a span from the join's signal file after each landing, each approval merge and on each graph-step tick, read with plain git: every phase tip — each `git for-each-ref refs/heads/phase/` tip, and each tip a plan branch's reflog records being merged in (git's own reflog entry naming the `phase/` ref, kept after the branch is deleted) — that is in the trunk's history belongs to a plan whose landing brought it, i.e. it is in the history of the landing merge's plan-side parent. It judges by history, never by commit subjects, so an approval merge, which brings only documents, reads upheld. At a landing it also reads, at the landing merge's plan-side parent, the file of each promise the plan's brief makes and requires it confirmed (`state: enforced`). Broken names the phase tip and the trunk commit that brought it, or the promise not confirmed.
- Fails when:
  - a phase branch is merged into the trunk by hand or by a tool — the tick span, or the span at the next landing or approval.
  - a phase branch is merged into the trunk and deleted before the next landing — the tick span reads its tip from the plan branch's reflog.
  - a plan lands with its promises not verified — the landing span: a promise the brief makes whose file is not confirmed at the landed commit; landing also runs the plan's clause tests, unchanged here.
- Measure: phase branches that reached the trunk other than through their plan's landing; expect none, ever.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A36 | A phase's finished work is on the plan's branch and not on the trunk until the plan lands; no command this plan adds moves the trunk. | unit |

## Not for a promise of this plan

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A37 | A plan's session starts whatever other plans' sessions are running; only a second session of the same kind on the same phase is refused, naming the one running; while the plan's phase sessions run, a session with no phase (a planning session, a build session started from the plan page) whose directory is the plan's own worktree is refused, naming the running phases, and the graph launches no phase while such a session runs there. | unit | The changed promise `a-session-belongs-to-its-plan`, whose sentence the brief now gives (amended and approved by Sandy, 2026-10-20): "only a second session of the same kind on the same phase is refused … while its phases build, a session with no phase in the plan's own worktree is refused, naming the running phase". |
| A38 | A build's run record keeps each running phase's process, reads running while any of them is alive, and a record written before this still reads. | unit | A regression guard on `a-run-is-read-from-its-record`, which one process per run would break once phases run together: the admin would read the plan stopped as soon as one phase ended and offer Build again. |
| A39 | A plan whose impl is a draft has no phase in the graph; one whose impl is approved, in progress, or completed with an open phase has its open phases in it. | unit | Must-not-break: `a-plan-builds-only-after-approval`; and the work skill moves a plan's status on, which must not drop it from the graph. |
| A40 | Phases branch from the plan's branch, never the trunk. | unit | Must-not-break: `a-plan-is-written-on-its-own-branch`. |
| A41 | Approving a plan and closing a phase still end by naming the command for what runs next. | unit | Must-not-break: `a-plan-boundary-names-the-next-session`; the existing tests hold it. |
| A42 | A phase session that stops on a question that holds holds its whole plan: no new phase of it starts, its running phases finish and join, the build stops on the question, and the answer resumes the asking phase in its own worktree, told the answer — no other phase's session is told it. An answer given while the plan's other phases are still finishing is kept: it is not refused as already building, the asking phase resumes in the same run, and no answered question is held. Two phase sessions of one plan asking at the same moment get two questions with two ids, each naming its phase. | unit | Must-not-break: `the-cost-sets-the-wait` — in this slice a held question holds its plan. |
| A43 | A held question still frees its plan's place under the cap and resumes on the answer, and the check that it freed the place judges the asking session alone, not a sibling phase's session still finishing. | unit | Must-not-break: `the-cost-sets-the-wait`, its clause `a-hold-frees-the-slot`, which would read broken whenever a sibling ran. |
| A44 | The manual one-phase `/work` path gives the same next step as today when no graph run is active. | unit | A regression guard: the graph step is added beside the manual path. |
| A45 | While an amendment to the brief waits, the graph launches no phase, lets running phases finish, and the build stops on the amendment as it does today. | unit | A regression guard on `a-change-to-what-was-agreed-needs-the-person`: today the step loop checks for an amendment before each step, and the graph step runs many phases inside one step. |

## Expectations

| ID | Expectation | How it is read | When |
|----|-------------|----------------|------|
| E1 | A plan finishes in about the time of its longest chain of dependent phases, not the sum of its phases. | For the next plan with independent phases, approval to review against the sum of its phases' durations and its longest chain, from the launch and join times in the graph record. | When that plan reaches review. |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A plan finishes in about the time of its longest chain. | Depends on real phases' durations over hours or days. | E1, read from the graph record when that plan reaches review. |

## Notes

- **Decision: a phase with no files line shares a file with every other phase of its plan** (A13). An unknown set cannot be shown free; treating it as empty lets two phases collide unseen. It costs parallelism only where a phase did not say what it touches, and every plan written before this already runs as a chain.
- **Decision: only the plan's impl is exempt from overlap** (A14). The changelog, `CLAUDE.md` files and docs pages are declared by the phase that edits them, so two phases that would append at the same point never run at once.
- **Decision: a phase is ready when its dependencies' work is on the plan's branch**, read from the impl at the plan branch's tip (a joined phase's boxes are ticked there). A phase that finished in its worktree but has not joined is not done; its dependents wait for the join.
- **Decision: a join check runs the tests expected to pass at that join** (A29, A30). A row whose Passes-at phase is not yet joined is red by design and is never a failure; a test phase is judged by the test-phase rule, its later rows failing on their own assertions.
- **Decision: a declared judgement or blocker holds only its own phase while others can run** (A17), then stops the build as today; a question still holds the whole plan (A42). The step loop hands an open plan to the graph whatever its first open phase carries; only the graph stops on a judgement or blocker, and only for a phase it would otherwise launch (A47).
- **Decision: the impl is joined by part** (A32): the trajectory rows by their ID (one new ID added on both sides: kept once when equal, else the joining phase's row renumbered to the next free ID within its own section), each phase section and each other part whole when only one side changed it, both sides' appended lines kept when each only appended, and a three-way merge inside a part both changed otherwise. The gate hook holds a session's ticks to its phase but not its other edits, so a part that still will not combine is a failed attempt like any conflict: the session is told to merge the plan's branch in and resolve it.
- **Decision: while a plan's phases build, its own worktree belongs to the graph** (A37): a session with no phase is refused there, so nothing commits on the plan's branch outside a join. One started before the build leaves the plan no room until it ends (A48): its ready phases are not ready to launch, so `ready-phases-start` never reads them late.
- **Decision: a red check or a conflict sends the phase back to its own session, three attempts in all**, then stops it (A31). No question is raised for it in this slice; the build stops with `cannot-continue` naming the phase once nothing else can run.
- **Decision: a bad dependency line stops the build when the graph is read** (A4), rather than being refused when the impl is saved: the read is the one place every run passes, and a save-time refusal is a later convenience.
- **Decision: the one live check (A10) runs in the system tier** at landing and release, with a scripted agent, and proves no clause; it is the real run the clause signals report from.
