---
title: "Admin pages load fast — Impl"
date: 2026-10-20
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "791be80e5ad1a18b594ec3747ee6a7d5258b2dc88495382048a49ee78251e0d6"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-20T02:59:49.810Z"
---

# Admin pages load fast — Impl

## Goal

Every admin page answers in under a second. Today a plan page takes 17 seconds, the promises page 18 to 23 and the looks page 30, because each page, and each five-second live refresh of it, starts other programs one after another and waits for each while the whole server stands still: `ps` once per run (4.1 s of the 17.1 s), `git` once per plan, a port check. This plan reads the machine's process list and the trunk's landing history once per page for all the plans on it, keeps each reading for a few seconds so the live refresh and the other pages reuse it, and starts those programs without stopping the server.

## Decisions made while writing this plan

This document was written with nobody to ask, so each choice below is the author's, with its reason. The person reads them at the single approval after this document.

1. **There is no ADR, and the approach is this impl's.** The workflow is a bugfix (brief, test plan, impl). The one design question, how to make the reads once-per-page, kept and non-blocking without rewriting every caller, is settled in decision 2.
2. **The asynchronous work is done once, at the top of a page, and the existing synchronous rules read the result.** The package's rules (`situation`, `runStatus`, `landedOnMain`) are pure functions fed their reads, and many callers use them. Rewriting each as `async` would touch dozens of call sites. Instead a new module reads the process list and the trunk history asynchronously, keeps them, and hands the rules a table and a list of subjects in the same shapes they take today. Reason: smallest change that removes every program start from the page path, and every rule keeps its existing unit tests.
3. **The synchronous readers (`psAll`, `ps`, `landedAsker`, `trunkMergeSubjects`) stay for the command line and the daemon's own checks; the admin stops importing them.** Command-line callers are not on a page path and are not slowed by a blocked event loop. The scan row (A13) covers the admin's source and the package's page-path modules, not every file in the package. Reason: a wider change is not what the brief promises.
4. **"A few seconds" is 8 seconds** (`KEPT_FOR_MS = 8000`, one exported constant). The admin's live refresh fires every 5 seconds; a window shorter than that would make the refresh read fresh every time and the clause `kept-briefly` would hold on paper only. Eight seconds also keeps the brief's other limit: a run that dies reads stopped within that time. The tests inject the clock and assert the shape, not the number.
5. **A kept reading is keyed by the project's root path and, for the trunk history, the repository and trunk branch.** Two projects (or a workbench's two repositories) never share a reading (A11). A read already in flight is shared by every request that arrives while it runs (A9); a read that failed or timed out is never kept (A10).
6. **A read that does not answer stops waiting after 3 seconds** (`READ_TIMEOUT_MS = 3000`) and the program is killed. For the process list the page then reads each run from its record with liveness unknown, which the situation words already have a state for (`unknown`); for the trunk history every plan reads "not landed" as `landedOnMain` already does when git cannot be read. Reason: a stuck `ps` must not hold a page open (A15).
7. **Liveness comes from the one process table, not from a `ps` per run.** `runStatus` asks three questions of a process (alive, its command, its start time). A table-backed set of those reads answers all three from the table's row for the pid. `process.kill(pid, 0)` for "alive" starts no program and stays.
8. **The signal for the three clauses is a page-reads report through the existing clause-signal writer, not a tracer.** The admin has no OpenTelemetry of its own, and the brief's Not promised section rules out new telemetry beyond page timing. Each page load records how many process-list reads and trunk-history reads it made, whether each was fresh or reused and its age, and the longest time the event loop was blocked (measured with `perf_hooks.monitorEventLoopDelay`); a page-reads report judges that against the three clauses and writes it with `writeClauseSignals`, throttled like the other reports in `build-host.ts` (the existing `throttled` helper) and never raising. The 100 ms bound from the test plan is the first limit and a constant. The live read of that report is also the continuing measure the test plan's untestable row relies on.
9. **The port check is found, not guessed.** The brief names a port check, but the admin's own source has no port check of its own, and the only `lsof` start in the package is in `telemetry/daemon-reads.ts`. Build Phase 2's first task is to trace which call on a page path starts it (the run-record reports or the daemon address read are the likely callers) and move it behind the kept reads or make it asynchronous. If it turns out to be called from a path no page reaches, the task records that and removes nothing. Reason: the evidence for it is a profile frame, not a call site, so the build locates it before changing it.
10. **The scan test (A13) lists page-path files by what the admin imports, not by a hand-kept list, and also bans the old readers by name.** It reads the admin's non-test sources (a file imported only by tests, such as `git-only-path.ts`, is not a page file) and follows their imports into `@infinitedusky/indusk-mcp/*` entry points to find the package modules on the path, then fails on `spawnSync`, `execSync` or `execFileSync` in them. Because the package's `run-record` entry also re-exports the command line's synchronous readers, the scan has a second part: no admin source may import `psAll`, `ps`, `landedAsker`, `planLandedOnMain`, `trunkMergeSubjects` or `realProcessReads`. A package module may be put on the scan's allow-list only with a reason and only when the admin imports none of its synchronous exports, so the allow-list can never hide a page calling an old reader again. Reason: a new reader added later (the failure the clause names) is caught by the same scan, and the allow-list has no hole (plan review, question 2).
11. **Where the package's synchronous start is shared with the command line, the package gets an asynchronous twin and the synchronous one stays.** `gitCommonDirOf` (`worktree/layout.ts`, reached by the looks page), the impl-hook `spawnSync` in `build/read-planning.ts` (reached through the `build` entry) and `lsof` in `telemetry/daemon-reads.ts` each get an `…Async` twin the admin uses. No command-line caller changes. Reason: the plan review found these starts on a page's path that no task named; decision 3 still holds.
12. **A kept reading is dropped at the moments it is known to be stale.** Pressing Build and a release ending forget the kept process table and the kept landing reading, so a run that has just started never reads stopped from a table taken before it existed, and a release that has just landed never reads "not on main". A pid that is alive but absent from the table reads liveness unknown, not stopped, since the table may predate it. Reason: the brief's must-not-break promise that a live run reads running (plan review, question 2).
13. **The window follows the live refresh.** The admin passes `max(KEPT_FOR_MS, 1.5 × admin.refresh_ms)` as the window, so a project with a refresh longer than eight seconds still reuses the reading. Reason: otherwise the clause holds on paper only for such a project.
14. **Each page's report carries the page's elapsed time, and a broken report is never throttled.** The page-reads report records the time from the page's first read to the end of its reads; a page over one second reports `never-freezes` broken naming it. Upheld reports go through the existing throttle; broken ones always send, and a broken report writes `elapsed` and `blocked` as separate fields so a slow program (long elapsed, no blocking) is told apart from a frozen loop. Reason: the headline sentence is a duration and the reports carried none; the throttle would drop most reports at a five-second refresh (plan review, question 5).
15. **Every program start on a page's path goes through one wrapper that counts it.** The asynchronous readers start programs through a single `startProgram` helper that adds one to the request's count; `one-read-per-page` is upheld only while the count of starts does not grow with the plan count (a fixed bound, `PAGE_STARTS_LIMIT = 6`). The per-plan archive-folder check is replaced by one `git ls-tree` of the trunk's archive folder. Reason: counting only the process list and the merge list left per-plan `git` starts unseen.
16. **The kept readings live on `globalThis`, are cleared by an exported `resetKept` between tests, and carry the window they were read with.** Next can load a module once per bundle, so a module-level map could be several; one `Symbol.for` slot on `globalThis` is one map. The process table is machine-wide (one key); its window is `max(KEPT_FOR_MS, 1.5 × the longest admin.refresh_ms of any project read)`, and `refreshedEarly` is judged against the window stored in the entry, not the calling project's. Reason: plan review round 2, questions 1, 2 and 4 (A14 must not be fooled by a table an earlier test kept).
17. **The scan's allow-list names functions, and Build Phase 2 inventories what the scan reaches.** The package modules the admin imports include some with synchronous starts in functions no page calls (for example `git.ts`, `health.ts`, `version-check.ts`). An allow-list entry names the synchronous functions it excuses and a reason, and is valid only while no admin page-path source calls any of them; the Build Phase 2 task below lists every reached module and either converts it (decision 11) or allow-lists it that way, and the result goes in Notes. Reason: the review found more reached modules than the plan named; the allow-list rule must hold for modules the admin imports for other exports.
18. **Every `statusOfRecord` and `runOfPlan` caller on any route (pages, `/api/sessions`, events, decisions) takes the request's table; none keeps `realProcessReads`.** A13's second part already bans the name; the situation task also covers the API routes and the decisions readers, with `tableUnreadable` defaulting to the old behaviour only for command-line callers. A18 and A19 (approval and Needs you) are re-run after the signature change. Reason: plan review round 2, question 4.
19. **The report is sent off the page path, and the background pass is traced.** `reportPageReads` runs inside `after()` (or after the page's reads settle), its exporter flush is bounded to one second, and its failure never reaches the page. The background recorder pass in `instrumentation.ts` (`recordBreaks`, `recorder-loop`) blocks the same event loop, so any program start it makes moves onto the same asynchronous readers. The archive check is one non-recursive `git ls-tree --name-only <trunk> <archive>/` (a list of plan folders), not a recursive listing. Reason: plan review round 2, questions 2, 4 and 5.
20. **Plan review round 3 closes these gaps (all inside the approved brief).** (a) The window is capped: `min(15 s, max(KEPT_FOR_MS, 1.5 × refresh_ms))` (`KEPT_CEILING_MS = 15000`), so a project with a 60 s refresh reads fresh each tick rather than keeping a dead run for 90 s; this narrows toward the brief's "a few seconds at most" and applies to decisions 13 and 16 alike. (b) `readLandings` and `trunkMergeSubjectsAsync` read through one kept key (repository + trunk branch), so a page makes one `git log … --merges`. (c) The page-reachable `holders()` and `processes: psAll` in `telemetry/daemon-reads.ts` read the process list through the kept table and the per-port `lsof` goes through `startProgram`, so the promises page's starts are counted; Build Phase 2's decision 9 and 11 task covers them. (d) `getCommitMessages` in `lib/vcs.ts` becomes one `git log --no-walk` of all the page's commit ids through `startProgram`, and the scorecards, research, draft and home pages call `finishPage` so they report (a page with no reads reports zero counts and its elapsed time). (e) `checkInProgress` and `reportBuildPressed` in `build-host.ts`, which run outside a request, read the kept table through `keptRead` directly (a timer tick within the window starts no `ps`). (f) The page-reads report carries the age of each reading it used, and `judgePageReads` reads a reading older than its stored window as `kept-briefly` broken. (g) New rows A24 to A27 in the trajectory: A24 asserts `finishPage` calls `reportPageReads` with the page's real counts, early-refresh flags, ages and elapsed time; A25 asserts a `git log` and `git ls-tree` that never answer stop waiting at `READ_TIMEOUT_MS`; A26 asserts a window above the ceiling is clamped to 15 s; A27 asserts `readLandings` and `trunkMergeSubjectsAsync` share one read. (h) `looks/check.ts` (`execFileSync("sh")`) joins decision 17's inventory: the Build Phase 2 task checks whether the looks page reaches it and converts or allow-lists it by function. Reason: plan review round 3, questions 1, 2, 4 and 5.
21. **Plan review round 4 closes these gaps (all inside the approved brief).** (a) `PAGE_STARTS_LIMIT` scales with the repositories the page reads: the bound is `6 × max(1, repositories)`, still independent of the plan count, so a workbench with several repos is not reported broken for correct reads; `judgePageReads` takes `repositories` in its input (A22 covers a three-repo page at 18 starts upheld and a start count growing with plans broken). (b) A page's elapsed time runs from the top of the page function (`startPage`, called first, hands back the `finishPage` closure), not from its first read, so plan-file reading and rendering around the reads are measured; A24 asserts the elapsed time passed is counted from the page's start. (c) The archive check is non-recursive in the Build Phase 1 task as in decision 19 (the task text said recursive; corrected). (d) The elapsed-over-one-second judgement stays filed under `never-freezes` with the separate `elapsed` field (decision 14): the brief's promises are the three clauses plus the headline sentence the person reads from the per-page elapsed times; adding a fourth clause would change the approved promises. Reason: plan review round 4, questions 2 and 5.

## Scope

### In Scope

- A new package module that reads the process list and the trunk's landing history asynchronously, with a timeout, and keeps each reading briefly per project (de-duplicating in-flight reads, never keeping a failure).
- A table-backed set of process reads for `runStatus`, and a landings asker built from one kept reading.
- The admin's page paths (`plan-situation.ts`, `build-host.ts`, the layout and pages that call them, `vcs.ts`, `git-only-path.ts` if on a page path) using only those reads.
- The page-reads signal for the three clauses.
- A source scan, a page-timing live check and the existing-promise guards.

### Out of Scope

- Telemetry on the admin's requests beyond the page-reads signal (the brief's Not promised).
- Faster planning or building runs.
- Turning the command line's synchronous readers asynchronous.
- Any change to how a page looks.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | The tests that can be written now and fail on their own assertion; the register of those that wait | The current readers, `build-host.ts`, `plan-situation.ts` |
| Build Phase 1 | `run-record/kept-reads.ts` (`keptRead`, `KEPT_FOR_MS`), the asynchronous process-table and trunk-history readers, `processReadsFromTable`, `landedAskerFrom` | `process-identity.ts` (`parsePsAll`, `ProcessDeps`), `landed.ts` (`landedOnMain`, `isLandingOf`) |
| Build Phase 2 | The admin's page paths on the kept reads; no synchronous start in the admin or its page-path package modules; the page-reads signal | Build Phase 1's readers |
| Build Phase 3 | The recorded page-timing measurement; docs and context | Build Phase 2's pages |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | Every page route of the real running admin (plan, promises, looks, scorecards, research, draft, home), loaded fresh after the kept reading has expired and then again inside it, answers in under one second | Test Phase 1 | Build Phase 3 | written | live check | the one-second measure on the running admin, recorded in the plan with its result; each clause is proved by the unit and contract rows below, never by this one | manual: node apps/indusk-admin/scripts/measure-pages.mjs |
| A2 | A page showing ten plans, each with a run, asks the machine for its process list once and starts no more programs than a page showing one plan | Test Phase 1 | Build Phase 2 | written | unit | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-admin/src/lib/page-reads.test.ts |
| A3 | A page showing ten plans asks for the trunk's landing history once, answers every plan from it, and starts no per-plan program | Test Phase 1 | Build Phase 2 | written | unit | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-admin/src/lib/page-reads.test.ts |
| A4 | A plan with no run, and a project with no plans, load without asking for the process list | Test Phase 1 | Build Phase 2 | written | unit | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-admin/src/lib/page-reads.test.ts |
| A5 | When the one process-list read fails, every run with a live process reads liveness unknown (not stopped) and the page does not ask again once per run | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-mcp/src/lib/run-record/async-reads.test.ts |
| A6 | Every plan's landed answer from the single trunk reading equals the per-plan question's answer, for a landed plan, a plan never landed, a plan with a similar name, a plan landed in an archive folder, a workbench plan landed in its code repository, and a project whose trunk is `master` beside `main` | Build Phase 1 | Build Phase 1 | planned | contract | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-mcp/src/lib/run-record/landed-once.contract.test.ts |
| A7 | Two page loads a second apart read the process list and trunk history once between them | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A8 | A load after the window reads both fresh, and a run whose process has since died reads stopped | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A9 | Five simultaneous loads on a cold start read the process list once and the trunk history once | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A10 | After one failed read the next load tries again at once and does not reuse the failure | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A11 | Two projects loaded back to back each read their own trunk history; a plan landed in one never reads as landed in the other | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A12 | The plan page, the promises page and the looks page loaded one after another inside the window make one process-list read and one trunk-history read together | Build Phase 2 | Build Phase 2 | planned | contract | clause: admin-pages-load-fast/kept-briefly | apps/indusk-admin/src/lib/page-reads.contract.test.ts |
| A13 | No code on the admin's page paths contains a synchronous program start | Test Phase 1 | Build Phase 2 | written | contract | clause: admin-pages-load-fast/never-freezes | apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts |
| A14 | While one page waits three seconds on a real slow `ps`, the server's event loop never lags past the limit and a request for another page is answered within one second | Test Phase 1 | Build Phase 2 | written | unit | clause: admin-pages-load-fast/never-freezes | apps/indusk-admin/src/lib/page-reads.test.ts |
| A15 | When the process-list program never answers, the page still answers within its time limit with liveness unknown | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/never-freezes | apps/indusk-mcp/src/lib/run-record/async-reads.test.ts |
| A16 | The same fixed process list and trunk history read through the asynchronous readers give the same runs and landings as the synchronous readers (the port reader's equivalence is proved in Build Phase 2, where it is changed) | Build Phase 1 | Build Phase 1 | planned | contract | clause: admin-pages-load-fast/never-freezes | apps/indusk-mcp/src/lib/run-record/async-reads.contract.test.ts |
| A17 | A run that dies reads stopped on the next load after the kept reading expires, and a run that is alive still reads running | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-run-is-read-from-its-record | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A18 | The offer of approval on a finished plan still reads the plan review and the live run, with the same answer as before | Test Phase 1 | Test Phase 1 | passing | unit | promise: approval-waits-for-a-finished-plan | apps/indusk-admin/src/lib/decisions-reader.approval.test.ts |
| A19 | Needs you still lists every plan waiting on the person, the same set as before | Test Phase 1 | Test Phase 1 | passing | unit | promise: decisions-wait-in-one-place | apps/indusk-admin/src/lib/decisions.test.ts |
| A20 | A run started after the kept process table was read reads running or unknown, never stopped, and pressing Build drops the kept table | Build Phase 1 | Build Phase 2 | planned | unit | promise: a-run-is-read-from-its-record | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A21 | A release that ends just after a page read the landing history reads the plan as landed, not "the plan is not on main" | Build Phase 2 | Build Phase 2 | planned | unit | promise: a-run-is-read-from-its-record | apps/indusk-admin/src/lib/build-host.release.test.ts |
| A22 | A page's report carries its elapsed time and its count of program starts, a page over one second or whose starts grow with its plans reports broken (a three-repository page with 18 starts is upheld, the bound being 6 per repository), and a broken report is sent though one was sent a moment before | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/never-freezes | apps/indusk-mcp/src/lib/run-record/page-reads-signal.test.ts |
| A23 | A load that reads fresh although the last fresh reading was inside the window reports the kept-briefly clause broken | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/kept-briefly | apps/indusk-mcp/src/lib/run-record/page-reads-signal.test.ts |
| A24 | A page's finish call hands the report the page's real read counts, early-refresh flags, reading ages and elapsed time counted from the top of the page (not zeros, not from the first read) | Build Phase 2 | Build Phase 2 | planned | unit | clause: admin-pages-load-fast/never-freezes | apps/indusk-admin/src/lib/page-reads.test.ts |
| A25 | A `git log` and a `git ls-tree` that never answer stop waiting at the time limit and the page reads the plan as not landed | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/never-freezes | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A26 | A window longer than the 15-second ceiling (a project with a 60-second refresh) is clamped, so a dead run reads stopped within the ceiling | Build Phase 1 | Build Phase 1 | planned | unit | promise: a-run-is-read-from-its-record | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A27 | The landing reader and the merge-subjects reader share one kept trunk-history read, so a page makes one `git log … --merges` | Build Phase 1 | Build Phase 1 | planned | unit | clause: admin-pages-load-fast/one-read-per-page | apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts |
| A28 | A plan the planning run wrote — brief accepted, test plan and ADR still draft, impl draft, plan review answered and current, no run going — is offered for approval under Needs you with its Approve | Build Phase 2 | Build Phase 2 | planned | unit | a regression guard over approval-waits-for-a-finished-plan, found 2026-10-20 on this plan's own page (Sandy) | apps/indusk-mcp/src/lib/plans/waiting.test.ts |

### Deferred Verification

- **Every page, under a second, on Sandy's machine, whatever the load**
  - reason: a fixed test cannot cover the number of plans, the machine's load or a stuck program in every real state; A1 measures the three slow pages once.
  - would require: a continuing measure of page time on the running admin.
  - mitigation: the page-reads signal (Build Phase 2) reports the longest blocked time, the read and program-start counts and the elapsed time on each page load, and a page over a second reports `never-freezes` broken there; Sandy reads it, nobody guesses.

## Checklist

### Test Phase 1: Author every test that can be written today, red where today fails it

**Tier**: med — the work step's default

This phase writes the tests whose subject exists today, so each fails on its own assertion against the current slow readers, and records why the rest wait for the new reading module that Build Phase 1 introduces. It also writes the page-timing check that reproduces the 17-second plan page. It hands Build Phase 1 a set of red tests that the first build phase must not turn green by accident, and Build Phase 2 the ones that stay red until the admin uses the new reads.

- [x] Create or confirm this plan's own worktree before any code is written. (confirmed: already working in /Users/the_dusky/code/sandbox/dusk-worktrees/admin-pages-load-fast on plan/admin-pages-load-fast)
  <details><summary>Technical</summary>

  `indusk worktree create admin-pages-load-fast` (records the assignment so the admin and plan tools read the plan from it; a worktree made another way needs `indusk worktree assign admin-pages-load-fast <path>`). worktree-per-plan default; skip only if `worktree: none` in frontmatter. The plan's branch is `plan/admin-pages-load-fast`.

  </details>
- [x] Write the page-timing measure so it reports the time of every page route, fresh and kept, and fails when any is over one second.
  <details><summary>Technical</summary>

  A1: `apps/indusk-admin/scripts/measure-pages.mjs`. Takes the admin's address from `indusk ui` (the daemon's stored address, never a guessed port), lists the page routes from the `page.tsx` files under `src/app/p/[project]` (plan, promises, looks, scorecards, research, draft and the home page), fetches each three times waiting `KEPT_FOR_MS` + 1 s between runs so every run reads fresh, then once more straight after (inside the window), prints each page's fresh median and kept time in seconds, exits non-zero when any is over 1.0 s. Today it prints about 17, 18 to 23 and 30 seconds for the three slow pages and exits 1: red on its own assertion. Run by hand at close (`manual:` rows read as unverified until recorded; the result is recorded in Build Phase 3).

  </details>
- [x] Write the tests that count how many times a page reads the process list and the trunk history, against the current readers.
  <details><summary>Technical</summary>

  A2, A3, A4 in `apps/indusk-admin/src/lib/page-reads.test.ts`. Use `vi.mock("@infinitedusky/indusk-mcp/run-record", …)` to wrap `psAll`, `trunkMergeSubjects`, `landedAsker` and `realProcessReads` with counting stubs over a temp project of ten plans each with a run record (use the repo's `planLifecycleProject` helper), call `withSituations` once and assert one process-list read and one trunk read, and also mock `node:child_process` (`spawnSync`, `execFileSync`, `execFile`, `spawn`) and assert the total programs started for ten plans equals the total for one plan, so a per-plan `git cat-file` or `rev-parse` is caught as well as the named readers. Today `psAll()` is called once per plan inside `reportSituation` and `ps` once per run through `realProcessReads`, so A2 fails on a count of ten or more, A3 on a count above one, A4 on a non-zero count for a project with no plans. A14 is the next task.

  </details>
- [ ] Write the test that shows a slow program freezing the server today.
  <details><summary>Technical</summary>

  A14 in `apps/indusk-admin/src/lib/page-reads.test.ts`: put a `ps` shim on `PATH` that sleeps three seconds, start `monitorEventLoopDelay` and a 50 ms interval timer, call `withSituations` over a temp project with one run, and assert the interval's worst lag stays under 100 ms and a second call answers within one second. Today the synchronous `psAll` blocks the loop for the whole three seconds, so it fails on the lag assertion; it passes only when no real reader blocks. (The earlier plan drafted this against an injected asynchronous stub, which would pass whatever the readers do.)

  </details>
- [ ] Write the scan that finds a synchronous program start on the admin's page paths.
  <details><summary>Technical</summary>

  A13 in `apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts`. Reads files only (starts no process, so it is not added to `vitest.tiers.ts`). Collects the admin's non-test sources under `src/` (a file imported only by tests is skipped) and follows their imports of `@infinitedusky/indusk-mcp/*` into the package's source via the package `exports` map, then greps the files reached for `spawnSync`, `execSync`, `execFileSync` outside comments and code fences, with a short allow-list of command-line-only modules named in the test with a reason each (see decision 3), an entry allowed only if no admin source imports a synchronous export of it. Part two bans the admin importing `psAll`, `ps`, `landedAsker`, `planLandedOnMain`, `trunkMergeSubjects` or `realProcessReads` (decision 10). Today `plan-situation.ts` reaches `process-identity.ts` (`spawnSync("ps")`), `landed.ts` and `situation-signals.ts` (`execFileSync("git")`), `vcs.ts` (`execFileSync`) and `git-only-path.ts` (`spawnSync`, if a page reaches it), `worktree/layout.ts` (`gitCommonDirOf`), `build/read-planning.ts` (`spawnSync` of the impl hook) and `telemetry/daemon-reads.ts` (`lsof`), so it fails naming each file.

  </details>
- [ ] Confirm the two existing-promise guards are green now and name them as the baseline.
  <details><summary>Technical</summary>

  A18 (`decisions-reader.approval.test.ts`) and A19 (`decisions.test.ts`) exist and pass today; run them and record that they pass. They are listed under Regression Guards: no red window, and the build must keep them green.

  </details>
- [ ] Make sure no test written here fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  Run `pnpm exec vitest run apps/indusk-admin/src/lib/page-reads.test.ts apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts` from the repo root. Each failure message must be an assertion about counts or about a named synchronous start, never "Cannot find module".

  </details>

#### Deferred to Build Phase 1

- **A5, A6, A7, A8, A9, A10, A11, A15, A16, A17, A20, A22, A23** — A15 stays here on purpose: the existing process-list reader has no time limit to test, so the contract it asserts (answer within the limit with liveness unknown) exists only on the new reader. Their subject is the kept-read module, the asynchronous process-table and trunk-history readers and the table-backed process reads, none of which exist before Build Phase 1; each test file imports them (`keptRead`, `KEPT_FOR_MS`, `readProcessTable`, `readLandings`, `processReadsFromTable`), so it would fail to load rather than fail an assertion. A `.skip()` would not rescue it, since module resolution happens before collection. Their shape is fixed by the Asserts column of the trajectory and each is written, red-then-green, in Build Phase 1 before the code it covers.

#### Deferred to Build Phase 2

- **A12** — it loads the three pages through the page loaders wired to the kept reads; its subject is the admin's page loaders on the new reads, which Build Phase 2 introduces (`readPageReads` in `apps/indusk-admin/src/lib/page-reads.ts`), so the file would not load before then. (A14 was deferred in the first draft; the plan review showed it can be written today against the real synchronous reader with a slow `ps` shim, so it is written in Test Phase 1.)

#### Regression Guards

- **A18** — the approval offer reading the plan review and the live run is already true and the build must keep it; it has no red window.
- **A19** — Needs you listing every plan waiting on the person is already true; the build must keep it.

#### Test Phase 1 Verification

- [ ] The tests this phase writes exist, and each fails on its own assertion against today's readers.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/lib/page-reads.test.ts apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts` exits non-zero; the output names the counts (A2, A3, A4), the event-loop lag under a slow `ps` (A14) and the files with a synchronous start (A13); `node apps/indusk-admin/scripts/measure-pages.mjs` exits 1 with times above one second (A1).

  </details>
- [ ] The two existing guards pass.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/lib/decisions-reader.approval.test.ts apps/indusk-admin/src/lib/decisions.test.ts` exits 0 (A18, A19).

  </details>
- [ ] Every deferral above has a reason that names a symbol which does not exist yet, and none hides a test that could be written today.
  <details><summary>Technical</summary>

  Read the two Deferred blocks against `apps/indusk-mcp/src/lib/run-record/` and `apps/indusk-admin/src/lib/`: `kept-reads.ts` and `page-reads.ts` do not exist, so the imports named would not resolve.

  </details>

#### Test Phase 1 Context

- [ ] Record that a page path's reads are counted by test, so a later page cannot add a per-plan program start unseen.
  <details><summary>Technical</summary>

  guard: `no-sync-starts.contract.test.ts` and `page-reads.test.ts` are the enforcers (their failure messages name the file or the count). No separate CLAUDE.md entry is written in this phase; the rule's home is written in Build Phase 2's Context item.

  </details>

#### Test Phase 1 Document

- [ ] Note in the plan that the page-timing measure exists and where its result will be recorded.
  <details><summary>Technical</summary>

  Add one line under `## Notes` of this impl naming `apps/indusk-admin/scripts/measure-pages.mjs` and that Build Phase 3 records its result.

  </details>

### Build Phase 1: Read the process list and the trunk once, keep them briefly, and never freeze

**Tier**: med — the work step's default

This phase builds the new reading module in the package. It reads the machine's process list and the trunk's landing history without stopping the server, gives up on a program that does not answer, keeps each reading for eight seconds per project, shares a read already under way, and never keeps a failure. It also builds the two adapters the rest of the code needs: process reads for a run's liveness that answer from the one process table, and a "has it landed" question that answers from the one list of landings. Nothing in the admin uses them yet; Build Phase 2 does. The phase hands Build Phase 2 four functions whose tests already pass.

- [ ] Write the tests for the kept reads, the failed and slow reads and the table-backed liveness before the code, and watch them fail.
  <details><summary>Technical</summary>

  `kept-reads.test.ts` (A7–A11, A17, A20), `page-reads-signal.test.ts` (A22, A23), `async-reads.test.ts` (A5, A15), `landed-once.contract.test.ts` (A6) and `async-reads.contract.test.ts` (A16) under `apps/indusk-mcp/src/lib/run-record/`. `keptRead` takes an injected clock and an injected read, so A7–A11 and A17 are `unit` tests with no real time and no program started. A6 and A16 start real `git` and `ps` over a temp repository: `contract`, listed in `apps/indusk-mcp/vitest.tiers.ts` (they start a process). Commit them red.

  </details>
- [ ] Add the module that keeps a reading for a few seconds, per key, shares a read already in flight, and never keeps a failure.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/run-record/kept-reads.ts`:

  ```typescript
  export const KEPT_FOR_MS = 8000;
  export interface Kept<T> { value: T; ageMs: number; reused: boolean; refreshedEarly: boolean; readAt: number }
  export function keptRead<T>(
  	key: string,
  	read: () => Promise<T>,
  	deps?: { now?: () => number; forMs?: number },
  ): Promise<Kept<T>>;
  ```

  A module-level `Map<string, { at: number; value: T } | { pending: Promise<T> }>`. A rejected `read` clears the entry and rethrows (A10); a call while `pending` awaits the same promise (A9); a value older than `forMs` is read again (A8); keys differ by project root, and for landings by repository and trunk (A11). `refreshedEarly` is true when a fresh read was made although the previous successful read of the key was younger than `forMs` (a window that is not holding; A23), and `readAt` is when the value was read. Export `forgetKept(key?)` for tests and for the moments a reading is known stale (decision 12).

  </details>
- [ ] Add the asynchronous reader of the machine's process list, with a time limit.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/run-record/async-reads.ts`: `readProcessTable(): Promise<PsRow[] | null>` runs `execFile("ps", ["-axo", "pid=,lstart=,command="], { env: { ...process.env, LC_ALL: "C" }, maxBuffer: 32 * 1024 * 1024, timeout: READ_TIMEOUT_MS, killSignal: "SIGKILL" })` (`READ_TIMEOUT_MS = 3000`) and parses with the existing `parsePsAll`; a non-zero exit, a timeout or an error resolves `null` (not an empty table, so liveness reads unknown, decision 6). `keptProcessTable(now?)` wraps it in `keptRead("ps", …)` and throws on `null` so a failure is not kept.

  </details>
- [ ] Add the table-backed process reads that answer a run's liveness from the one table.
  <details><summary>Technical</summary>

  `processReadsFromTable(table: PsRow[] | null): Required<ProcessDeps>` in `async-reads.ts`: `alive` = `isAlive(pid)` (signal 0, starts no program); `command(pid)` = the table row's command or `null`; `startTime(pid)` = the row's `startedAt` as a `Date` or `null`. Decided: `runStatus` gains an explicit `tableUnreadable: boolean` input (set when the table is `null`, or when the pid is alive but has no row, since the table may predate the process); with it set and the pid alive `runStatus` returns `{ state: "unknown" }` rather than "stopped" (A5, A20). `isOwnProcess` returns false for a null command today, which reads stopped, so this input is placed where the three reads are combined; read `isOwnProcess` in `process-identity.ts` first and keep `runStatus`'s existing tests green.

  </details>
- [ ] Add the asynchronous reader of the trunk's landing history and the "has it landed" question built from it.
  <details><summary>Technical</summary>

  In `async-reads.ts`: `readMergeSubjects(dir, trunk): Promise<string[]>` runs `execFile("git", ["log", trunk, "--merges", "--format=%s"], { cwd: dir, timeout: READ_TIMEOUT_MS, … })`; `readLandings(root): Promise<(plan: string) => boolean>` resolves the root trunk and a workbench plan's code repository exactly as `landedAsker` in `landed.ts` does (reuse `trunkOf` and `codeRepoOf` by exporting them from `landed.ts`, and make `trunkOf`'s `git branch --show-current` and `rev-parse` asynchronous in the same file or a shared one), reads each repository's subjects once through `keptRead(`landings:${dir}\0${trunk}`, …)`, and answers `landedOnMain(trunk, plan, git)` with `GitReads` backed by the already-read subjects; `hasPath` (the archive-folder check, `git cat-file -e` per plan) is replaced by one non-recursive `git ls-tree --name-only <trunk> .indusk/planning/archive/` read per repository (decision 19; a recursive listing would list every file of every archived plan), kept under its own key, answered per plan from that list. Every program these readers start goes through one `startProgram(args)` helper that counts the start into the request's count (decision 15). The reporting path's `trunkMergeSubjects` unions several trunk branches and falls back to HEAD; `trunkMergeSubjectsAsync` keeps that rule exactly (A6 covers a project with `main` beside `master`). Same results as the synchronous `landedAsker` (A6). `trunkMergeSubjectsAsync(root)` does the same for the reporting path's `trunkMergeSubjects`.

  </details>
- [ ] Report the three clauses' signal from the page's reads.
  <details><summary>Technical</summary>

  signal: `admin-pages-load-fast/one-read-per-page`, `admin-pages-load-fast/kept-briefly` and `admin-pages-load-fast/never-freezes` — read where the page's reads are counted, in the clause signals the daemon reads. Reported from `apps/indusk-mcp/src/lib/run-record/page-reads-signal.ts`: `judgePageReads(input)` is a pure function taking `{ page, plans, processReads, landingReads, programStarts, refreshedEarly: boolean[], maxBlockedMs, elapsedMs }` and returning `{ clause, upheld | broken, why }[]`: `one-read-per-page` upheld when each read count is at most 1 and `programStarts` is at most `PAGE_STARTS_LIMIT = 6` whatever `plans` is, broken naming the page, the counts and the plan count; `kept-briefly` broken when any read was `refreshedEarly` (a fresh read although the previous one was inside the window; a reading older than the window cannot be returned, so this is the condition that shows the window failing, A23); `never-freezes` broken when `maxBlockedMs` is over `BLOCKED_LIMIT_MS = 100` or `elapsedMs` is over `PAGE_LIMIT_MS = 1000` (A22). `reportPageReads(root, input)` calls `judgePageReads` and writes each result with `writeClauseSignals` (`apps/indusk-mcp/src/lib/promises/clause-signal.ts`) filed under this plan's own name, `admin-pages-load-fast`, never under a plan the page shows, and never raises; broken results are written at once, upheld ones may be throttled by the caller (decision 14). The caller is Build Phase 2's page-reads module. A page with no counts reports nothing (reads "no signal").

  </details>
- [ ] Make every test in this phase pass and leave the command line's synchronous readers as they are.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-mcp/src/lib/run-record` and `pnpm exec vitest related` the files changed; export the new functions from `apps/indusk-mcp/src/lib/run-record/index.ts` (the admin imports the package's `run-record` entry), and add the asynchronous twins `gitCommonDirOfAsync` (`worktree/layout.ts`), the asynchronous impl-hook read in `build/read-planning.ts` and the asynchronous `lsof` read in `telemetry/daemon-reads.ts` the admin's page path needs (decision 11; the trace in Build Phase 2 names which). `psAll`, `ps`, `landedAsker`, `planLandedOnMain` and `trunkMergeSubjects` are not removed (decision 3).

  </details>

#### Build Phase 1 Verification

- [ ] The kept reading is reused inside the window, read again after it, shared by simultaneous requests, never kept when it failed, and never shared between projects.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-mcp/src/lib/run-record/kept-reads.test.ts apps/indusk-mcp/src/lib/run-record/page-reads-signal.test.ts`: A7, A8, A9, A10, A11, A17, A20, A22, A23 pass (goes green; A20's admin half, that pressing Build drops the table, passes in Build Phase 2).

  </details>
- [ ] A read that fails or does not answer reads as unknown liveness and not-landed, without a second read per run.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-mcp/src/lib/run-record/async-reads.test.ts`: A5 and A15 pass (goes green).

  </details>
- [ ] The new readers give the same landings, runs and port state as the old ones on a real repository and a real process list.
  <details><summary>Technical</summary>

  `pnpm exec vitest run --config apps/indusk-mcp/vitest.system.config.ts apps/indusk-mcp/src/lib/run-record/landed-once.contract.test.ts apps/indusk-mcp/src/lib/run-record/async-reads.contract.test.ts`: A6 and A16 pass (goes green). Also `pnpm exec vitest related apps/indusk-mcp/src/lib/run-record/liveness.ts apps/indusk-mcp/src/lib/run-record/landed.ts` — the existing run-record tests stay green. The whole suite runs at landing, not here.

  </details>
- [ ] The tests that wait for the admin's wiring are still red.
  <details><summary>Technical</summary>

  A2, A3, A4 and A13 still fail on their own assertions (no phase turns them green early); A12 and A14 are not yet written.

  </details>

#### Build Phase 1 Context

- [ ] Record the rule that a page path reads the process list and the trunk history through the kept reads.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md` (area rules, "Promises and telemetry" neighbourhood or the run-record entry): "A reader a page calls reads through `run-record/kept-reads.ts`: once per page, kept for `KEPT_FOR_MS`, never a synchronous program start. The synchronous `psAll`/`landedAsker` are for the command line." Destination: that file, area tier; it is not always-on, so it is not the root.

  </details>

#### Build Phase 1 Document

- [ ] Add the package-side change to the changelog.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, under the unreleased heading in the file's existing style: "Run liveness and landing are read once per page and kept for eight seconds (asynchronous process-list and trunk-history readers in the package)." The reference page for `run-record`, if one exists under `apps/docs/src/reference/`, gains a short paragraph on `keptRead`; found by search, and if none exists the changelog line is the whole entry.

  </details>

### Build Phase 2: Put every admin page on the kept reads and start no program that freezes the server

**Tier**: med — the work step's default

This phase moves the admin onto Build Phase 1's readers. A page reads the process list and the trunk's landings once at the top, hands the results to the same rules as before, and the reports that ran a process list and a git log for every plan now share the page's reading. It then finds and removes every remaining synchronous program start on a page's path, including the port check, and reports each page's read counts, reuse and blocked time. It hands Build Phase 3 pages that should answer in under a second, ready to be measured.

- [ ] Write the tests for the page-level reads and for a slow program not stopping other pages, and watch them fail.
  <details><summary>Technical</summary>

  A12 in `apps/indusk-admin/src/lib/page-reads.contract.test.ts` (loads the plan, promises and looks page loaders in turn over a temp project with counting readers injected through `readPageReads`' dependency argument; `contract`, listed in `apps/indusk-admin/vitest.tiers.ts` if it starts a server, otherwise left in the everyday suite as the test plan's level says); A21 added to `build-host.release.test.ts` (a landing read kept before the release merged, then a release ending, reads landed). A14 already exists from Test Phase 1 and is made to pass here.

  </details>
- [ ] Add the one place a page gets its reads, with the reads kept and counted.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/page-reads.ts`: `readPageReads(projectPath, deps?): Promise<{ table: PsRow[] | null; landed: (plan: string) => boolean; subjects: string[]; counts: PageCounts }>`. Calls `keptProcessTable`, `readLandings` and `trunkMergeSubjectsAsync` from the package, once, in parallel (`Promise.all`), and records how many reads and program starts it made, whether each was reused or refreshed early, and its age. The layout and the page render separately, so the request's reading is created through React's `cache()` (one per request, shared by the layout and the page), not through an `AsyncLocalStorage` store nobody opens; the kept reading in the package makes the second use free either way. The window passed is `max(KEPT_FOR_MS, 1.5 × admin.refresh_ms)` (decision 13). It is skipped for a project with no plans (A4). Uses `perf_hooks.monitorEventLoopDelay` for the maximum blocked time (process-wide: it measures the server, which is what the limit is about, and is not attributed to one request's code). `withSituations` takes the reading as an argument (or calls `readPageReads` once at its top).

  </details>
- [ ] Make the situation and run-status code use the page's reading instead of starting programs per plan or per run.
  <details><summary>Technical</summary>

  `plan-situation.ts`: replace `landedAsker(projectPath)` with the reading's `landed`, and the `table: psAll()` and `subjects: trunkMergeSubjects(root)` in `reportSituation` with the reading's `table` and `subjects`. `build-host.ts`: `statusOfRecord` uses `runStatus(record, processReadsFromTable(table), false)` (the table passed in by the caller), `judgedRelease` replaces `planLandedOnMain(root, plan)` with an asked landing from `readLandings`, and `reportBuildPressed` replaces `psAll()` with the kept table. The other starts in this file go the same way: `reportNotInProgressWhenIdle` (a `psAll()`), and every other caller of `statusOfRecord` (restart candidates, the build state read from disk, the API routes) receives a table or the kept one and never `realProcessReads`. Pressing Build and a release ending call `forgetKept` for the process table and the landing reading before the next read (decision 12, A20, A21). `runOfPlan` and its callers (the layout, the plan page, the promises and looks pages) receive the reading rather than reading again; read each caller before changing it and keep the signatures that tests use.

  </details>
- [ ] Apply decisions 16 to 19: one shared slot for the kept readings, named allow-list entries, the table on every route, and the report off the page path.
  <details><summary>Technical</summary>

  `kept-reads.ts` stores its map under `globalThis[Symbol.for("indusk.keptReads")]` and exports `resetKept()`, which every test that uses a kept reading calls in `beforeEach` (A14 included, so its `ps` shim always runs). The A13 allow-list in the scan test is `{ module, functions[], reason }`. Search `apps/indusk-admin/src/app/api` and `decisions-reader` for `statusOfRecord`/`runOfPlan` callers and give each the table. In `instrumentation.ts` read what `recordBreaks` and the recorder loop start and move those starts onto the asynchronous readers. `landings.ts` lists the archive with `git ls-tree --name-only`. Record the scan inventory in Notes.

  </details>
- [ ] Find the call that starts the port check on a page's path and remove its freeze.
  <details><summary>Technical</summary>

  Decision 9. Search `apps/indusk-admin/src` and the package modules it imports for `lsof`, `net.connect`, `createServer`, `fetch(` to a health URL and `address`-reading functions; the `lsof` start is in `apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts` (`lsofOrNull`). Make the call on the page path asynchronous with the same time limit, or move it behind a kept read; write what was found and changed (or that no page reaches it) as a line under `## Notes` here. A changed port reader gets its own equivalence test (the same fixed answer through the old and new reader gives the same port state), since the equivalence row for it could not be written in Build Phase 1.

  </details>
- [ ] Remove the other synchronous program starts the admin's own code makes on a page's path.
  <details><summary>Technical</summary>

  `apps/indusk-admin/src/lib/vcs.ts` (`execFileSync("git", ["log", "-1", "--format=%B", id])`) and `apps/indusk-admin/src/lib/git-only-path.ts` (`spawnSync("/bin/sh", ["-c", "command -v git"])`): find their callers; when a page path reaches them, convert to `execFile`/async with the time limit (and, for `git-only-path.ts`, compute once and keep, since PATH does not change), otherwise name them in the scan's allow-list with the reason (`git-only-path.ts` is imported only by tests, so the scan skips it and no allow-list entry is made). `__tests__/helpers/looks-page.ts` is a test helper and is not scanned. `getCommitMessage` in `vcs.ts` is called per commit id by the scorecards page: read all the page's commit messages with one `git log --no-walk` instead of one start per commit.

  </details>
- [ ] Move the package's other synchronous starts that a page reaches onto their asynchronous twins.
  <details><summary>Technical</summary>

  Decision 11. `gitCommonDirOf` in `worktree/layout.ts` (reached by `looks/overview.ts`, the looks page, the slowest at 30 s) and anything in `bookkeeping/roots` that reaches it or `telemetry/status`; the impl-hook `spawnSync` in `build/read-planning.ts` (30 s timeout), reached through the `@infinitedusky/indusk-mcp/build` import in `plan-situation.ts`; `lsof` in `telemetry/daemon-reads.ts` reached through `promises/sources.ts`. Trace each from the admin's imports (run A13 and read what it names), switch the page-path caller to the asynchronous twin from Build Phase 1, and leave the synchronous function for the command line (no command-line caller changes). Record each file changed under `## Notes`.

  </details>
- [ ] Report each page's read counts, reuse, age and blocked time through the clause signals.
  <details><summary>Technical</summary>

  signal: `admin-pages-load-fast/one-read-per-page`, `admin-pages-load-fast/kept-briefly` and `admin-pages-load-fast/never-freezes` — read in the clause signals the daemon holds, one report per page load. Reported from `apps/indusk-admin/src/lib/page-reads.ts` (`finishPage`): a Next server component has no end-of-render hook, so it is called from `after()` of `next/server` when the installed Next version has it (check `apps/indusk-admin/package.json`), and otherwise once the page's reads have all settled, with the page's elapsed time measured from its first read to that point. It calls `reportPageReads` from `apps/indusk-mcp/src/lib/run-record/page-reads-signal.ts` with the request's counts, program starts, early-refresh flags, maximum blocked time and elapsed time. Upheld results go through the existing `throttled(id, send)` helper of `build-host.ts` so a five-second live refresh does not report every time; broken results bypass it (decision 14). It never raises (a failed report must not fail a page).

  </details>
- [ ] Offer a plan for approval once its earlier documents exist, not only once each was accepted by itself.
  <details><summary>Technical</summary>

  Added at approval (Sandy, 2026-10-20): this plan's own page showed "Impl: needs you" with no Approve, because `awaitingApproval` in `apps/indusk-mcp/src/lib/plans/waiting.ts` requires every document before the impl to read finished (`documentFinished`), and the unattended planning run leaves the test plan and ADR `draft` — approving the plan is what accepts them. Require each required document before the impl to exist (as `plans/steps` does for "done"), keeping the plan-review rule. A28.

  </details>
- [ ] Make every test in this phase pass.
  <details><summary>Technical</summary>

  A2, A3, A4, A12, A13, A14, A20 (admin half), A21 pass; A18, A19 and the existing admin tests (`build-host.*.test.ts`, `plan-page.test.ts`, `decisions-reader.*.test.ts`, `page.test.tsx`) stay green. `pnpm exec vitest related` the files changed. No change to `.indusk/promises/` is made here (the brief lists no Changes).

  </details>

#### Build Phase 2 Verification

- [ ] A page showing ten plans reads the process list once and the trunk's landing history once.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/lib/page-reads.test.ts`: A2, A3, A4 pass (goes green), A14 passes.

  </details>
- [ ] The three pages loaded in turn make one read of each between them.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/lib/page-reads.contract.test.ts`: A12 passes (goes green).

  </details>
- [ ] No synchronous program start remains on the admin's page paths.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts`: A13 passes (goes green).

  </details>
- [ ] A run's state, the approval offer and Needs you read as before.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-admin/src/lib/decisions-reader.approval.test.ts apps/indusk-admin/src/lib/decisions.test.ts apps/indusk-admin/src/lib/build-host.record.test.ts apps/indusk-admin/src/lib/build-host.release.test.ts apps/indusk-admin/src/lib/build-host.trunk.test.ts` exits 0 (A18, A19, A17's admin-side neighbours).

  </details>

#### Build Phase 2 Context

- [ ] Record the rule for the admin that a page's program reads are one kept reading and never synchronous.
  <details><summary>Technical</summary>

  `apps/indusk-admin/CLAUDE.md` (area tier): "A page reads the process list and the trunk's landing history through `lib/page-reads.ts` — once per page, kept briefly, no `spawnSync`/`execSync`/`execFileSync` anywhere a page reaches. A new reader that starts a program does it asynchronously with a time limit." Guarded by `no-sync-starts.contract.test.ts`. Not always-on, so not the root.

  </details>

#### Build Phase 2 Document

- [ ] Add the admin-side change to the changelog.
  <details><summary>Technical</summary>

  `apps/docs/src/changelog.md`, under the unreleased heading: "Admin pages answer in under a second: the process list and trunk history are read once per page, kept for eight seconds, and no program start freezes the server." The admin overview page under `apps/docs/src/reference/admin-ui/` gains one sentence if it describes the live refresh.

  </details>

### Build Phase 3: Measure the three slow pages and record the result

**Tier**: med — the work step's default

This phase is the check against the real running admin that the three pages named in the brief now answer in under a second, recorded in this plan with its result. It writes no new behaviour; it hands the plan to its close with a measured claim instead of an expected one.

- [ ] Run the page-timing measure against the running admin and record each page's time in this document.
  <details><summary>Technical</summary>

  A1: `node apps/indusk-admin/scripts/measure-pages.mjs` against the admin daemon (`indusk ui`), with the build run's plans present. Record the three medians and the date under `## Notes` as "Recorded result (A1)". If any page is over one second, do not tick the item: the page-reads signal (decision 8) names which read or blocked interval is responsible; fix it and run again. A row at level live check names no clause; the clauses are proved by the unit and contract rows.

  </details>
- [ ] Confirm the live refresh reuses the kept reading on the running admin.
  <details><summary>Technical</summary>

  With the plan page open for 30 seconds, read the page-reads reports the daemon holds (`indusk promises status admin-pages-load-fast`, or the clause signals it reads): the counts for each load are at most 1 and a refresh inside the window reads "reused".

  </details>

#### Build Phase 3 Verification

- [ ] The plan page, the promises page and the looks page each answer in under one second on the running admin.
  <details><summary>Technical</summary>

  `node apps/indusk-admin/scripts/measure-pages.mjs` exits 0 and prints three medians under 1.0 s (A1 goes green).

  </details>
- [ ] The tests this plan wrote all pass together.
  <details><summary>Technical</summary>

  `pnpm exec vitest run apps/indusk-mcp/src/lib/run-record apps/indusk-admin/src/lib apps/indusk-admin/src/__tests__/no-sync-starts.contract.test.ts` exits 0. The whole suite and the system tier run at landing.

  </details>

#### Build Phase 3 Context

- [ ] Record in the project's operating notes that page speed is read from the page-reads signal.
  <details><summary>Technical</summary>

  `current.md: Project (shared)` — a line that a slow admin page is diagnosed from the page-reads report (read counts, reuse, blocked time) before profiling, and that the 100 ms and 8 s constants live in `page-reads-signal.ts` and `kept-reads.ts`. Operational, so `current.md` and not a CLAUDE.md.

  </details>

#### Build Phase 3 Document

- [ ] Note the measured result in the changelog entry.
  <details><summary>Technical</summary>

  Add the recorded before-and-after (plan page 17.1 s, promises 18 to 23 s, looks 30 s, then the measured times) to the changelog line written in Build Phase 2.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/run-record/kept-reads.ts` | New: `keptRead`, `KEPT_FOR_MS`, `forgetKept` |
| `apps/indusk-mcp/src/lib/run-record/async-reads.ts` | New: asynchronous process-table, merge-subject and landing readers, `processReadsFromTable`, `READ_TIMEOUT_MS` |
| `apps/indusk-mcp/src/lib/run-record/page-reads-signal.ts` | New: `judgePageReads`, `reportPageReads`, `BLOCKED_LIMIT_MS` |
| `apps/indusk-mcp/src/lib/run-record/landed.ts` | Export `trunkOf` and `codeRepoOf`; asynchronous trunk lookup shared with the new reader |
| `apps/indusk-mcp/src/lib/run-record/liveness.ts` / `process-identity.ts` | Liveness unknown when the table could not be read |
| `apps/indusk-mcp/src/lib/run-record/index.ts` | Export the new functions |
| `apps/indusk-mcp/vitest.tiers.ts` | List the two package contract tests that start a process |
| `apps/indusk-mcp/src/lib/run-record/*.test.ts` | New tests (A5–A11, A15–A17) |
| `apps/indusk-admin/src/lib/page-reads.ts` | New: the page's one kept reading and its counts |
| `apps/indusk-admin/src/lib/plan-situation.ts`, `build-host.ts` | Use the page's reading instead of per-plan and per-run starts |
| `apps/indusk-admin/src/lib/vcs.ts`, `git-only-path.ts` | Asynchronous or kept, if on a page path |
| `apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts` | The port check's `lsof` start: asynchronous twin, if a page reaches it |
| `apps/indusk-mcp/src/lib/worktree/layout.ts`, `build/read-planning.ts` | Asynchronous twins (`gitCommonDirOfAsync`, the impl-hook read) for the looks page and the `build` entry; the synchronous functions stay for the command line |
| `apps/indusk-admin/src/lib/build-host.release.test.ts` | New row A21 |
| `apps/indusk-mcp/src/lib/run-record/page-reads-signal.test.ts` | New tests (A22, A23) |
| `apps/indusk-admin/src/app/p/[project]/layout.tsx` and the plan, promises and looks pages | Pass the reading through |
| `apps/indusk-admin/scripts/measure-pages.mjs` | New: the page-timing measure |
| `apps/indusk-admin/src/lib/page-reads.test.ts`, `page-reads.contract.test.ts`, `src/__tests__/no-sync-starts.contract.test.ts` | New tests (A2–A4, A12–A14) |
| `apps/indusk-admin/CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md`, `apps/docs/src/changelog.md` | Rules and changelog |

## Dependencies

- `a-run-can-be-trusted` (in progress): it introduced the per-run liveness and per-plan landing checks this plan speeds up; the files in Files Affected are the ones it changed. Build this plan on top of its landed state.

## Notes

- The brief's promise and its three clauses are already declared in the registry; this plan declares no new promise and the brief lists no Changes, so no `indusk promises change` item exists.
- The test plan's untestable row (every page, under a second, at all times) is covered by the Deferred Verification entry above.
- The `otel.role` in `.indusk/config.json` is `library`, so no OTel gates are written; the page-reads signal in decision 8 is this plan's telemetry.
- Decided (was open): `runStatus` gains an explicit `tableUnreadable` input (Build Phase 1, fourth task). Reason: with a null command `isOwnProcess` reads stopped, so wrapping the table-backed reads could not return unknown; the input is the one place that can. The existing liveness tests must stay green.
- Residual (accepted): a page route that never calls the page-reads module reports nothing, so its slowness reads "no signal"; A1 measures every route at close, and the new-page rule in the admin's CLAUDE.md (Build Phase 2) tells a new page to use the module.
- Plan review round 2: the plan was read cold again after the first answers changed it; decisions 16 to 19 and one Build Phase 2 task are its fixes, and its "nothing" answers are in `plan-review.md`.
- The plan review (`plan-review.md`) was answered by the planning agent without the person; every answer is in that file and each "nothing" is shown at approval.
- A1 is a `manual:` live check: the three clause rows prove the clauses and A1 is the recorded measure of the headline sentence, as the test plan's untestable row U1 states. It is unverified to tools by design.
