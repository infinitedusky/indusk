---
read: 2fdab5feb3a1f66c27b66f12d9d47e5d7dd665f842fd9b6a2fafe77e59ba7d87
---
# Plan review — admin-pages-load-fast

## Do the planned tests prove each promise's sentence, or something narrower?

- test-plan.md:44 — A1, the only row that measures "every admin page answers in under a second", is a `manual:` live check (impl.md:74) that reports each page's fresh median; no test run by `verify` or at landing asserts a duration, so the headline sentence and the clause `never-freezes` are proved only by call counts and event-loop lag on stubs.
  - breaks when: a page is slow for a reason the stubs do not model (a large plan set, a cold first request, one load in several over a second while the median stays under), and every counting and lag row still passes.
  - answer: nothing — a wall-clock test is the flaky tier the test plan rejected on purpose; decision 14 puts each page's elapsed time in the report and breaks `never-freezes` over one second on any single load (not a median), so a slow load is seen in a real run; A1 is the recorded measure.
- impl.md:95 — A22 and A23 test `judgePageReads`, a pure function fed hand-made inputs; no row proves `finishPage` in `page-reads.ts` (impl.md:365) actually calls `reportPageReads` with the page's real counts, early-refresh flags and elapsed time.
  - breaks when: the page wiring passes zero counts or never calls the report; the unit tests stay green and the page reads "no signal".
  - answer: fix — decision 20(g) adds row A24 (Build Phase 2): `finishPage` hands the report the real counts, flags, ages and elapsed time.
- impl.md:88 — A15 proves the time limit only for the process-list reader; the same `READ_TIMEOUT_MS` on `git log` (impl.md:253) and on `git ls-tree` has no row.
  - breaks when: a `git` invocation hangs (a stuck repository, a network filesystem); the page waits on it rather than answering with "not landed".
  - answer: fix — decision 20(g) adds row A25 (Build Phase 1): a `git log` and `git ls-tree` that never answer stop at the time limit.
- impl.md:85 — A12 loads the three page loaders in one vitest process with injected counting readers; it cannot show that the layout and each page, bundled separately by Next, share the one kept reading (decision 16 relies on a `globalThis` slot nothing tests under Next).
  - breaks when: the running admin's route bundles each hold their own map, so the plan, promises and looks pages each read once and A1 is the only thing that notices.
  - answer: nothing — no code exists yet to test under Next; separate bundles each holding a map show as a load that reads fresh inside the window, which the page-reads report judges `kept-briefly` broken (row A23, and decision 20(f) adds reading age), and A1 on the running admin shows it before close.
- test-plan.md:92 — A17 and A8 prove a dead run reads stopped after the window, for the default window only; no row sets a long `admin.refresh_ms` to check the brief's "kept for a few seconds at most" (brief.md:39) against decision 13's `max(8 s, 1.5 × refresh_ms)`.
  - breaks when: a project sets `admin.refresh_ms` to 60 s and a run that died reads running for up to 90 s.
  - answer: fix — decision 20(a) caps the window at 15 s and row A26 (Build Phase 1) asserts the clamp.
- impl.md:94 — A21 covers a release ending through the admin (which calls `forgetKept`); no row covers a landing or release finished from a terminal, so the landing reading's staleness is tested only for the admin's own actions.
  - breaks when: `indusk plans land` or a release runs from the command line and the page, inside the window, still reads the plan as not on main.
  - answer: nothing — the brief accepts "kept for a few seconds at most", and a landing from a terminal is read fresh within the window (at most 15 s after decision 20); the admin cannot know of a terminal's action, so only the window bounds it.

## Does the impl build what each promise claims, and nothing it does not?

- impl.md:36 — Decision 13 sets the window to `max(KEPT_FOR_MS, 1.5 × admin.refresh_ms)` and decision 16 (impl.md:39) takes the longest `refresh_ms` of any project read for the machine-wide process table; the brief says the reads are kept "a few seconds" and a run that dies reads stopped "within that time" (brief.md:32, 39).
  - breaks when: any registered project has a long `refresh_ms`; every project's dead runs read running for that long.
  - answer: fix — decision 20(a) caps the window at 15 s whatever the refresh; row A26 asserts it. A longer refresh simply reads fresh each tick.
- impl.md:329 — `readPageReads` runs `readLandings` and `trunkMergeSubjectsAsync` in parallel, two different functions each reading `git log … --merges` (impl.md:253); nothing says they share one kept key, yet A3/A12 assert exactly one trunk-history read.
  - breaks when: the two functions use different keys; a page makes two `git log` reads and the second is not reused.
  - answer: fix — decision 20(b) puts both on one kept key; row A27 (Build Phase 1) asserts a single read.
- apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts:288 — the page-reachable `holders()` calls `psAll()` again and runs one `lsof` per port, and `processes: psAll` is a second process-list read; impl.md:359 converts only the `lsof` start, not these `psAll` calls, and the per-port starts grow with ports rather than plans.
  - breaks when: the promises page reads sources; it starts its own process-list read outside the kept table and, with more than a few listening ports, exceeds `PAGE_STARTS_LIMIT = 6`.
  - answer: fix — decision 20(c) moves `holders()` and `processes` onto the kept table and the per-port `lsof` through `startProgram`; the Build Phase 2 task for decisions 9 and 11 covers it.
- impl.md:35 — Decision 12 reads an alive pid absent from the table as liveness unknown; a run started from a terminal (`indusk run`) after the table was read is not covered by the Build-press and release-end forgets.
  - breaks when: a run begins outside the admin and the page, within the window, shows it as unknown instead of running.
  - answer: nothing — unknown for at most one window (now capped at 15 s) is the honest reading when the table predates the process; the opposite error, a live run read as stopped, is the harm the must-not-break promise names.
- apps/indusk-admin/src/lib/build-host.ts:260 — `checkInProgress` and `reportBuildPressed` call `psAll()` outside any request, where no per-request `cache()` reading exists (impl.md:329); impl.md:335 says only that they use "the kept one".
  - breaks when: a timer-driven check runs while no page is loading and starts its own `ps` per plan every 15 s, blocking the loop the background recorder shares.
  - answer: fix — decision 20(e): both read the kept table through `keptRead` directly, so a tick within the window starts no `ps`.

## Which skip reason would you not accept?

- impl.md:158 — Deferring A5–A23 to Build Phase 1 on "the file would fail to load rather than fail an assertion" is accepted for the kept-read module, but A20's admin half and A21 (landing and live-run must-not-break rows) are not written until Build Phase 2, so the must-not-break promise `a-run-is-read-from-its-record` has no red test while Build Phase 1 changes `runStatus`.
  - breaks when: Build Phase 1's `tableUnreadable` change turns a stopped run into unknown in a code path the existing run-record tests do not reach, and nothing fails until Build Phase 2.
  - answer: nothing — A20's package half and A26 are written in Build Phase 1, the existing run-record liveness tests must stay green in its verification, and the admin half cannot exist before the admin imports the module; Build Phase 2 closes before the plan does.
- impl.md:74 — A1 left `manual:` and "unverified to tools by design" (impl.md:509) as the sole proof of the duration sentence is not a skip reason I would accept for a promise whose whole statement is a duration.
  - breaks when: the manual script is not run at close or is run against an admin with fewer plans than Sandy's real set; the promise confirms with no duration ever asserted.
  - answer: nothing — the clause rows gate close and a clause is upheld only when its signal has reported in a real run (mark-first); the signal carries each page's elapsed time (decision 14). A1 stays the recorded measure on the author's real plan set, by the person's stated preference for shipping over waiting on slow tiers.
- impl.md:105 — Deferred Verification (every page, at all times) leaves the continuing measure to a report Sandy reads; the report is sent only by pages that call `readPageReads` (impl.md:506 accepts the rest as "no signal").
  - breaks when: a page that never calls the module (scorecards, research, draft, home) becomes slow; nothing reports it.
  - answer: fix — decision 20(d) makes the scorecards, research, draft and home pages call `finishPage`, so they report their elapsed time too.

## What else would have to change for each promise to hold?

- apps/indusk-admin/src/lib/vcs.ts:22 — the scorecards page calls `getCommitMessages` (page.tsx:51), one `git log` per commit id; impl.md:353 plans one `git log --no-walk` but that page does not call `readPageReads`, so its starts are not counted by the `startProgram` helper in the package.
  - breaks when: the scorecards page shows many commits; the page starts one program per commit and no `one-read-per-page` report sees it.
  - answer: fix — decision 20(d): one `git log --no-walk` through `startProgram`, and the page calls `finishPage`.
- apps/indusk-admin/src/__tests__/admin-uses-package-commands.test.ts:34 — the existing guard A25 requires exactly `lib/git-only-path.ts` and `lib/vcs.ts` to import `child_process` in the admin; the plan neither lists this test among the guards to run nor says it stays true if the readers move into the package.
  - breaks when: `vcs.ts` is moved or its import changes; A25 fails at landing.
  - answer: nothing — the plan keeps `vcs.ts` where it is and only changes how it starts git; the test runs with the admin's tests at landing and any import change it flags is fixed then, with the guard's list updated by the same edit.
- apps/indusk-mcp/src/lib/looks/check.ts:249 — `execFileSync("sh", …)` is a synchronous start in a package module under `looks/`; impl.md:359 names `looks/overview.ts` as the looks page's reach but the plan's inventory (decision 17) is left to the build to discover.
  - breaks when: the looks page reaches `looks/check.ts`; A13 goes red late in Build Phase 2 and the page stays at its 30 s.
  - answer: fix — decision 20(h) adds `looks/check.ts` to the inventory the Build Phase 2 task checks up front.
- apps/indusk-admin/src/lib/plan-situation.ts:48 — `runOfPlan` is called twice per plan (`liveOf` and `situatedPlan`, line 108) and, in `build-host.ts:361`, its signature has no table parameter; the plan changes the signature (impl.md:335, 41) for every caller on every route.
  - breaks when: one route (an API handler or event stream) keeps the old signature; it reads liveness through a per-run program and the page-path scan does not name it.
  - answer: nothing — decision 18 already puts the request's table on every `statusOfRecord` and `runOfPlan` caller on every route, and A13's second part bans `realProcessReads` in any admin source, so a route keeping the old path fails the scan.
- impl.md:329 — the window follows `admin.refresh_ms` per project but the live refresh reads per-page; the other pages (promises, looks) are said to share the reading yet only the plan and promises pages poll (admin CLAUDE.md), so the looks page's reuse depends on a navigation inside the window.
  - breaks when: the looks page is opened more than the window after the last page read; it is a fresh read and its A1 time is the cold cost.
  - answer: nothing — the brief promises reuse "instead of reading again" inside the window, not a warm reading for a page opened outside it; a fresh read is one read, and A1 measures that cold cost against the one-second sentence on purpose.

## Which way could a clause fail that no signal would see?

- `one-read-per-page`, test-plan.md:39 — the signal counts reads and `startProgram` starts made through the package helper; starts from the admin's own `vcs.ts`, from `daemon-reads.ts` `holders()` or from `looks/check.ts` are not counted.
  - breaks when: a page starts programs outside `startProgram`; the count stays at 1 and the clause reads upheld.
  - answer: fix — decision 20(c), (d) and (h) route `vcs.ts` and `holders()` through `startProgram` and inventory `looks/check.ts`; A13 stops any other unwrapped start at test time.
- `one-read-per-page`, the scorecards, research, draft and home pages — each is a place the promise is shown; none calls `readPageReads`, so none reports.
  - breaks when: one of those pages reads per plan; it reads "no signal", not broken.
  - answer: fix — decision 20(d): each calls `finishPage` and reports.
- `kept-briefly`, impl.md:259 — the signal reports `refreshedEarly` only; the test plan promised the age of the reading used on every page (test-plan.md:59), and the impl's report input has no age.
  - breaks when: a reading older than the window is served (a window widened by another project's `refresh_ms`); no field shows it.
  - answer: fix — decision 20(f) adds the age to the report and `judgePageReads` reads an over-window age as broken; A24 asserts it is passed.
- `kept-briefly`, concurrent requests — a request that starts its own read while one is in flight is not `refreshedEarly` if the first has not yet completed; nothing counts it.
  - breaks when: the in-flight share fails (key mismatch between layout and page); both reads look fresh and the window never shows broken.
  - answer: nothing — a key mismatch makes the page's read count exceed one, which `one-read-per-page` reports broken through the program-start count (decision 15); A9 asserts the in-flight share.
- `never-freezes`, impl.md:329 — `monitorEventLoopDelay` is process-wide, so a block from an unrelated request is charged to whichever page reports, and a page that does not report (see above) never charges its own.
  - breaks when: a slow page that does not call the module freezes the loop; another page reports `never-freezes` broken and the real cause stays unnamed.
  - answer: nothing — the clause is that the server does not freeze, which a process-wide measure detects; misattribution is accepted (decided in the first review), and after decision 20(d) every page reports so the slow page also names itself by its elapsed time.
- `never-freezes`, impl.md:365 — the report runs from `after()`; if the report itself or its exporter flush blocks, it is the same loop it measures, and a failed report is silent (impl.md:365, "never raises").
  - breaks when: `writeClauseSignals` fails or stalls; no report arrives and the clause reads "no signal" rather than broken.
  - answer: nothing — decision 19 bounds the flush to one second off the page path, and "no signal" is the designed reading when reports stop; a clause closes only on a report from a real run (mark-first), so silence cannot read as upheld.
- every clause — the headline sentence is a duration, and the report flags a page over one second only for pages that report; the cold first request after the admin starts (compile, first import of the package graph) happens before any report exists.
  - breaks when: the first request after `indusk ui` starts takes over a second; nothing reports it.
  - answer: nothing — the first request's elapsed time is reported when it finishes like any other (the report is written after the page), and a dev-compile or first-import cost is outside "pages answer" in steady use; A1 is run after a warm-up and records the cold load beside it.
