---
read: 1cdb24eaf9d94ad8222506e17c701b8d22bd5194e2822cb0f6467c60700a087c
---

# Plan review — admin-pages-load-fast

## Do the planned tests prove each promise's sentence, or something narrower?

- .indusk/planning/admin-pages-load-fast/impl.md:109 — A1, the live-check row for the headline promise, runs each page three times after one warm-up and takes the median. With an 8 s kept reading (impl.md:27), runs two and three reuse the first run's reads, so the median never measures the fresh-read page a person gets once the window lapses. It is also a `manual:` row, which the planning rules read as unverified.
  - breaks when: the first page load after the kept reading expires still takes seconds (cold `ps` plus per-plan `git cat-file`), while the measure prints a sub-second median and exits 0.
  - answer: fix — the measure-pages task in Test Phase 1 now waits KEPT_FOR_MS + 1 s between runs so each is fresh, then times one kept run; the unverified-`manual:` half is accepted by design and recorded in impl Notes (live check is the level the test plan chose for U1).
- .indusk/planning/admin-pages-load-fast/test-plan.md:30 — The promise sentence is "every admin page", but only the plan, promises and looks pages are measured (A1) and read-counted (A12). `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx` calls `getCommitMessage` in `vcs.ts:22`, a synchronous `git log` per commit id; the research, draft and home pages are named by no row.
  - breaks when: the scorecards page (or any unlisted page) loads with many commits and freezes the server for seconds while every named test is green.
  - answer: fix — A1 now measures every page route (listed from the `page.tsx` files), and the vcs.ts task in Build Phase 2 reads all commit messages with one `git log --no-walk`; A13 covers every page's imports.
- .indusk/planning/admin-pages-load-fast/impl.md:115 — A2/A3 count calls to mocked exports (`psAll`, `trunkMergeSubjects`, `landedAsker`, `realProcessReads`), not program starts. Several page-path starts are not among them: `trunkOf`'s `git branch --show-current` and `rev-parse` (`landed.ts:104-117`), `hasPath`'s `git cat-file` per plan (`landed.ts:84-91`, `impl.md:234` "read once per plan"), `gitCommonDirOf` (`worktree/layout.ts:83`).
  - breaks when: a page for N plans still starts N `git cat-file` programs, and the count of "trunk-history reads" stays at 1.
  - answer: fix — A2/A3 now also mock `node:child_process` and assert total starts for ten plans equal those for one; `hasPath` becomes one `git ls-tree` per repository (decision 15, landings task).
- .indusk/planning/admin-pages-load-fast/impl.md:78 — A14 holds one page on an injected reader that answers after three seconds under fake timers. An injected promise cannot block the event loop, so it passes whatever the real readers do; only the A13 text scan (impl.md:77) stands between a real sync start and a green clause, and the scan has a hole (see question 2).
  - breaks when: a real reader keeps a synchronous start (or uses `spawn` then busy-waits) but A14 still passes because its stub is asynchronous.
  - answer: fix — A14 rewritten to use a real `ps` shim on PATH sleeping three seconds and an event-loop lag measure; written in Test Phase 1; A13's hole closed by decision 10.
- .indusk/planning/admin-pages-load-fast/test-plan.md:84 — A16 asserts "port state" is the same through the asynchronous readers, but Build Phase 1 (impl.md:189-248) builds no port reader; decision 9 (impl.md:32) leaves the port check to be found in Build Phase 2.
  - breaks when: Build Phase 1 closes with A16 green on process and landing reads only, and the port check is changed later with no equivalence test.
  - answer: fix — A16 (impl and test plan) drops the port; the Build Phase 2 port task now requires its own equivalence test.
- .indusk/planning/admin-pages-load-fast/test-plan.md:47 — A6 covers three landing cases (landed, never landed, similar name). It does not cover a workbench plan whose landing is in the code repository (`landed.ts:123-136`), the archive-folder path, or the reporting path's `trunkMergeSubjects` (`situation-signals.ts:88-110`), which unions several trunk branches and falls back to HEAD while the planned reader takes one `(dir, trunk)`.
  - breaks when: a workbench plan, or a project with both `main` and `master`, reads landed/not landed differently from before and "must still read true" is violated unseen.
  - answer: fix — A6 now lists the archive-folder, workbench and `main`-beside-`master` cases, and the landings task states `trunkMergeSubjectsAsync` keeps the union and HEAD fallback.
- .indusk/planning/admin-pages-load-fast/test-plan.md:64 — A5 (and impl.md:228) assert a failed process read marks liveness "unknown", but `runStatus` returns "unknown" only for a missing record (`liveness.ts:34-36`); with a null command `isOwnProcess` returns false and the run reads "stopped" (`liveness.ts:39-40`). The mechanism is an open decision (impl.md:471).
  - breaks when: the `ps` read times out and a live run shows "stopped" with a restart offered, while a test written to the weaker "no second read" half of A5 passes.
  - answer: fix — the open decision is closed: `runStatus` gains a `tableUnreadable` input; A5 now asserts the state is unknown, not stopped.

## Does the impl build what each promise claims, and nothing it does not?

- .indusk/planning/admin-pages-load-fast/impl.md:121 — The plan lists five files with synchronous starts that `plan-situation.ts` reaches. Others the admin reaches and that no task fixes: `worktree/layout.ts:83` (`gitCommonDirOf`, via `looks/overview.ts:3,290` — the looks page, the slowest at 30 s), `build/read-planning.ts:90` (`spawnSync` of the impl hook, 30 s timeout, via `@infinitedusky/indusk-mcp/build`, imported by `plan-situation.ts:2`), `telemetry/daemon-reads.ts:96` (`lsof`, via `promises/sources.ts`), `bookkeeping/roots` reaching `telemetry/status` and `worktree/layout`. Build Phase 2's tasks (impl.md:313-330) cover only `plan-situation`, `build-host`, `vcs.ts`, `git-only-path.ts` and a searched port check.
  - breaks when: the build ends with the process-list and landing reads fixed but the looks page still runs `git rev-parse` synchronously, so A13 stays red or is allow-listed away and the looks page stays slow.
  - answer: fix — new decision 11 and a new Build Phase 2 task move these starts onto asynchronous twins; Files Affected lists them and A13's red list names them.
- .indusk/planning/admin-pages-load-fast/impl.md:26 — Decision 3 keeps `psAll`, `ps`, `landedAsker` and their modules in the package and the admin imports `@infinitedusky/indusk-mcp/run-record`, whose `index.ts:7` re-exports `psAll` from `process-identity.ts` (which keeps `spawnSync`). A13 "follows imports into the package source", so those files stay reachable after the admin stops calling them; the only escape is the allow-list of "command-line-only modules".
  - breaks when: `process-identity.ts`, `landed.ts` and `situation-signals.ts` go onto the allow-list to make A13 pass, after which a page that calls `psAll()` again (the failure named at test-plan.md:75) is no longer caught.
  - answer: fix — decision 10 and the A13 task: the scan also bans the admin importing the old synchronous readers by name, and an allow-list entry is valid only if no admin source imports a synchronous export of it.
- .indusk/planning/admin-pages-load-fast/impl.md:316 — The task names `statusOfRecord`, `judgedRelease`, `reportBuildPressed`. Other starts in `build-host.ts` are not named: `psAll()` at line 422 (`reportNotInProgressWhenIdle`, on every page via the situation path), and callers of `statusOfRecord` at lines 236, 382, 395 and 769 that do not come through `withSituations` (restart candidates, `buildStateOnDisk`).
  - breaks when: those callers keep `realProcessReads` (a `ps` per field per pid) or are handed no table, so build state read from API or restart paths still starts programs per run.
  - answer: fix — the situation task in Build Phase 2 now names `reportNotInProgressWhenIdle` and every other `statusOfRecord` caller.
- .indusk/planning/admin-pages-load-fast/impl.md:228 — `command(pid)` comes from the kept table's row, `alive` from a live `process.kill`. A run whose process started after the table was read has no row, so `command` is null and `runStatus` reads "stopped" (`process-identity.ts` `isOwnProcess`, `liveness.ts:39-40`) until the 8 s window lapses.
  - breaks when: a person presses Build and the page refreshes within 8 s of the last table read; the new run shows stopped, violating the must-not-break promise `a-run-is-read-from-its-record` (a live run reads running).
  - answer: fix — decision 12: pressing Build forgets the kept table, and alive-but-no-row reads unknown; new row A20 (Build Phase 1/2) proves it.
- .indusk/planning/admin-pages-load-fast/impl.md:316 — `judgedRelease` (`build-host.ts:151`) decides whether a finished release counts as released from the trunk. Replacing the fresh `planLandedOnMain` with a kept landing reading means a reading taken before `plans land` merged says "not landed".
  - breaks when: a release ends inside 8 s of an earlier page's landing read; the run is recorded stopped with "the release ended but the plan is not on main" though it landed.
  - answer: fix — decision 12: a release ending forgets the kept landing reading; new row A21 in Build Phase 2.
- .indusk/planning/admin-pages-load-fast/impl.md:31 — The never-freezes measure uses `monitorEventLoopDelay`, which is process-wide, not per request; other concurrent requests' blocking is attributed to the page being reported.
  - breaks when: two requests overlap and one blocked the loop; the other page's report reads broken for the first one's blocking.
  - answer: nothing — the clause is about the server not answering other requests, which is exactly a process-wide quantity; a report over-attributing to a concurrent page is a mislabel of which page, not a missed freeze, and the Build Phase 2 task now states this.
- .indusk/planning/admin-pages-load-fast/impl.md:27 — The window is the constant 8 s, while the live refresh is `admin.refresh_ms` (`project-reader.ts:34-55`, default 5000, minimum 1000, no maximum).
  - breaks when: a project sets `refresh_ms` above 8000; every refresh reads fresh and `kept-briefly` holds only on paper.
  - answer: fix — decision 13: the admin passes `max(KEPT_FOR_MS, 1.5 × refresh_ms)` as the window.

## Which skip reason would you not accept?

- .indusk/planning/admin-pages-load-fast/impl.md:143 — A14 is deferred because its subject (`readPageReads`) does not exist. A14 asserts that while one page waits on a slow program another page answers; that can be written today against the current synchronous `psAll` and fails on its own assertion.
  - breaks when: the build is reviewed with the never-freezes "red first" claim unproved, as no failing A14 ever existed against the real readers.
  - answer: fix — A14 is now written in Test Phase 1 against the real readers (new task there); the deferral is removed.
- .indusk/planning/admin-pages-load-fast/impl.md:87 — Deferred Verification accepts "every page, under a second, whatever the load" with the mitigation that the page-reads signal "reports ... so a page over a second is read there". `judgePageReads`'s input (impl.md:240) has read counts, ages and blocked time but no elapsed page time.
  - breaks when: a page takes 3 s because a read waits out the 3 s time limit (impl.md:29); nothing records it and the mitigation never fires.
  - answer: fix — `judgePageReads` now takes `elapsedMs` and reports `never-freezes` broken over one second (decision 14, A22).
- .indusk/planning/admin-pages-load-fast/impl.md:65 — The only direct proof of the headline sentence is a `manual:` row, which the planning rules report as unverified, and no row carries `promise:` level for `admin-pages-load-fast` itself (the three clause rows prove the clauses only).
  - breaks when: all clauses are upheld and the plan closes while the "under a second" sentence was never run by a tool.
  - answer: nothing — a wall-clock test in CI would be the flaky tier the test plan rejected (and the person prefers shipping to waiting); the sentence is proved by the recorded live measure (A1, required to tick Build Phase 3) plus the new elapsed-time report, and the skip is shown in impl Notes.
- .indusk/planning/admin-pages-load-fast/impl.md:139 — The deferral of A5 and A15 says a `.skip()` cannot rescue a test whose import is missing. A15 (a process list that never answers) can be written against the existing `psAll` contract (a stub command that sleeps) without importing new symbols.
  - breaks when: the timeout behaviour is first tested only after the code exists, so no red-first evidence of it.
  - answer: nothing — the existing `psAll` has no time limit, so its "contract" is to wait forever; a test of "answers within the limit with liveness unknown" has no subject until the new reader exists. The deferral now says so.

## What else would have to change for each promise to hold?

- .indusk/planning/admin-pages-load-fast/impl.md:310 — The layout (`app/p/[project]/layout.tsx:136`) and the plan page (`plan/[name]/page.tsx:80`) both call `withSituations`; the plan says "pass the reading through" but defines no request-scoped place where it is created, and Next renders layout and page separately.
  - breaks when: the AsyncLocalStorage store is created nowhere (or per component), so the layout and page each count their own read and `one-read-per-page` reports broken (or the counts are lost).
  - answer: fix — the page-reads task now creates the request's reading with React `cache()`, shared by layout and page.
- .indusk/planning/admin-pages-load-fast/impl.md:334 — `finishPage` "at the end of a page's render" has no place in a Next app-router tree; server components have no end-of-render hook and a layout can finish before its page.
  - breaks when: the report is sent before the page's reads finish, or never, and the signal reads "no signal".
  - answer: fix — the signal task uses `after()` from `next/server` when the installed Next has it, otherwise reports once the page's reads settle.
- .indusk/planning/admin-pages-load-fast/impl.md:240 — `writeClauseSignals` (`clause-signal.ts:21-28`) takes a `plan` and a `signal.phase`; a page's reads belong to no plan, and the project's plans are many.
  - breaks when: the report is filed against an arbitrary plan name (or the layout's), so the clause signal for `admin-pages-load-fast` is read from the wrong place or never.
  - answer: fix — `reportPageReads` files every result under this plan's own name, `admin-pages-load-fast` (signal task, Build Phase 1).
- .indusk/planning/admin-pages-load-fast/impl.md:36 — "`git-only-path.ts` if on a page path" is a test helper imported only by tests (`admin-uses-package-commands.test.ts`, `git-only-path.test.ts`); as a non-test file under `src/` the A13 scan will flag it.
  - breaks when: A13 fails on a file no page reaches and the fix is an allow-list entry that sets the precedent for the real ones.
  - answer: fix — A13 skips files imported only by tests (task and decision 10), and the vcs/git-only-path task says no allow-list entry is made for it.
- .indusk/planning/admin-pages-load-fast/impl.md:392 — The recorded result and the rule for the admin (`apps/indusk-admin/CLAUDE.md`) say "no `spawnSync` anywhere a page reaches", but the package modules in question (`worktree/layout.ts`, `read-planning.ts`) are shared with the command line, which keeps the synchronous readers (decision 3); making them asynchronous changes package callers the plan does not list under Files Affected.
  - breaks when: converting `gitCommonDirOf` for the looks page forces its command-line callers (`worktree/*`) to change and the plan's Files Affected table was the full scope.
  - answer: fix — decision 11: asynchronous twins are added and the synchronous functions stay, so no command-line caller changes; Files Affected lists both files.

## Which way could a clause fail that no signal would see?

- .indusk/planning/admin-pages-load-fast/impl.md:240 — `one-read-per-page`: the signal counts process-list and trunk-history reads. Per-plan `git cat-file` (`hasPath`, impl.md:234), `trunkOf`'s two `git` starts, a per-plan `git` in the idle check, and a fallback to per-plan reading when the one read fails (test-plan.md:38 lists it) are not counted. Shown in: plan page, promises page, looks page, nav, Needs you.
  - breaks when: a page shows 40 plans, makes 40 uncounted `cat-file` starts, and reports upheld with counts of 1.
  - answer: fix — every start goes through a counting `startProgram` helper and the judge breaks over `PAGE_STARTS_LIMIT` (decision 15, A22).
- .indusk/planning/admin-pages-load-fast/impl.md:240 — `kept-briefly`: `judgePageReads` breaks only when a used reading is older than `KEPT_FOR_MS`; `keptRead` cannot return an older one, so that condition never occurs. The failures the test plan lists (refresh reading fresh every time, three pages each making their own reads, a failed read kept, a refresh interval above 8 s) have no breaking condition in the judge.
  - breaks when: every load reports `fresh` (a window that never holds, a kept key that differs per page) and the signal still reads upheld.
  - answer: fix — `keptRead` returns `refreshedEarly` and the judge breaks on it (A23); refresh intervals above 8 s are handled by decision 13.
- .indusk/planning/admin-pages-load-fast/impl.md:334 — All three clauses are reported through `throttled` (`build-host.ts:347-354`, 15 s). With a 5 s refresh, two of every three loads report nothing, and a single upheld report in the window stands for loads that were not measured.
  - breaks when: one slow page load falls inside a window already used by a fast one; it is never reported.
  - answer: fix — decision 14: broken results bypass the throttle (A22).
- .indusk/planning/admin-pages-load-fast/impl.md:31 — `never-freezes`: the blocked-time reading is a process-wide histogram, so it would see a sync start only if it blocks over 100 ms; a sync `git log` of 30-90 ms per plan across forty plans is forty readings under the limit. A started-but-never-ending asynchronous program that waits out the 3 s limit blocks no event loop and is invisible to it.
  - breaks when: many short sync starts add to seconds without one crossing 100 ms, or the page waits 3 s on a timed-out read; `never-freezes` reads upheld.
  - answer: fix — elapsed time over one second and the program-start bound now also break the reports (decisions 14 and 15), so both cases are seen; the source scan (A13) stops short sync starts at test time.
- .indusk/planning/admin-pages-load-fast/impl.md:240 — The parent promise `admin-pages-load-fast` ("every admin page answers in under a second", brief.md:30) has no clause that records page duration; the span carries counts, ages and blocked time, not elapsed time. Every place the promise is shown (plan, promises, looks, scorecards, research, draft, home pages, the `/api/sessions` probe) is reported by none of them except through the layout and pages that call the page-reads module.
  - breaks when: a page is slow for a reason none of the three clauses names (a sync start in an unreached module, a slow Jaeger fetch on the promises page, `getCommitMessage` on scorecards) and every clause reads upheld or "no signal".
  - answer: fix — elapsed time is now in the report and breaks `never-freezes` over one second; the report is made from the shared page-reads module that every page route calls, and A1 now measures every route. A route that never calls the module reads "no signal", which impl Notes record as the residual.
- .indusk/planning/admin-pages-load-fast/impl.md:228 — A live run read as "stopped" because the kept table predates its process (or a null table), and a release read as "not on main" from a kept landing, are state errors that none of the three new clauses reports; the only signal on them is the existing `a-run-is-read-from-its-record` reports, which are themselves read from the same kept table (`build-host.ts:260,422`).
  - breaks when: Build is pressed, the new run reads stopped for up to 8 s, and the check that would catch it reads the same stale table.
  - answer: fix — the cause is removed rather than reported: decision 12 drops the stale readings at those moments and rows A20 and A21 prove it.
