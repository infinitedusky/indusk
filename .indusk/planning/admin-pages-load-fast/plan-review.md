---
read: d2d31ebdd259f690711fe800c1b8f2713cc18b2c4c056a1af2b942da455d117b
---

# Plan review — admin-pages-load-fast

Round 4, read cold by a reader on claude-sonnet-5-5 (the audit tier named `session`). The impl has no ADR; none is needed.

## Do the planned tests prove each promise's sentence, or something narrower?

- test-plan.md:43 and impl.md:75 — A1, the live check asserting every page route answers under one second on the running admin, is the only row that measures the headline sentence; it is a `manual:` script run once at close, "unverified to tools by design" (impl.md:514). Every automated row counts reads or scans source.
  - breaks when: a page reads once, keeps its reading, starts nothing synchronous, and is still over a second (plan files, rendering, a large trunk's `git log`, the 3 s timeout path), and nobody reruns the script after close.
  - answer: nothing — a wall-clock test is the flaky tier the test plan rejected on purpose; every page reports its elapsed time through the page-reads signal (decision 14, now counted from the top of the page by decision 21(b)) and a page over one second breaks `never-freezes` on any single load, so a slow page is seen in a real run after close, not only once by A1.
- impl.md:88 and test-plan.md:83 — A14 (a `ps` shim sleeping three seconds, a 50 ms interval timer, event-loop lag under 100 ms) is a wall-clock bound on a real child process, the flakiness the test plan's first decision says it avoids everywhere but A1.
  - breaks when: CI is loaded and the interval timer lags past 100 ms for reasons unrelated to the readers.
  - answer: nothing — the bound is on event-loop lag while a child runs, which is exactly the freeze the clause names; the 100 ms limit is a constant against a 3 s shim (a blocked loop lags about 3 s, thirty times the limit), so a loaded machine does not produce a false red and a synchronous start cannot pass.
- test-plan.md:35 — the failure "a page that shows a run's live state and a plan's landing state reads each twice (list and detail)" is asserted by A2, A3 and A12; the layout and page sharing one reading through React `cache()` (impl.md:334) is not asserted with the kept reading disabled.
  - breaks when: the layout and the page each call `readPageReads` and the kept reading hides the second call; the counted starts per request are then 2 but the page reports 1 read.
  - answer: nothing — the report counts program starts (decision 15), not calls, so a duplicate call hidden by the kept reading starts nothing and costs nothing; the failure the clause names is a second start, which A2, A3 and A12 catch.
- test-plan.md:75 and impl.md:145 — A13, the contract row asserting no admin page-path code contains `spawnSync`, `execSync` or `execFileSync`, is a text grep for three names; it does not see a synchronous start through another API.
  - breaks when: a later reader starts a program through a name outside the grep list, and A13 stays green.
  - answer: nothing — the clause's failure is a synchronous start, and Node's only synchronous starts are those three plus `spawnSync` (all named); an awaited asynchronous start does not freeze the server, which A14 measures at run time; `execa` and similar are not in the admin's dependencies, and a new dependency is a visible change.
- impl.md:98 — A24 asserts `finishPage` hands `reportPageReads` the right numbers, and A22/A23 assert `judgePageReads`; no row asserts that a report reaches the clause signals the daemon reads from a running admin, or that `after()` fires in a real Next render.
  - breaks when: `after()` is not run for a page, or `writeClauseSignals` writes to a path the daemon does not read; all three signals read "no signal" while every test is green.
  - answer: nothing — that path needs the running admin and daemon, which a unit test cannot stand up; a clause closes only on a report from a real run (mark-first), so a report that never arrives leaves the clause at "no signal" and the plan unclosed, and Build Phase 3's live check reads the signals from the daemon.

## Does the impl build what each promise claims, and nothing it does not?

- impl.md:37 (decision 14) and impl.md:264 — `never-freezes` is the clause "no page starts another program in a way that stops the server answering"; the impl also makes it report broken when `elapsedMs` is over 1000, the headline duration, so a slow non-blocking program is reported under the wrong clause and the headline promise has no judged result of its own.
  - breaks when: a page is slow because `git log` on a large trunk takes 2 s asynchronously; `never-freezes` reads broken though nothing froze.
  - answer: nothing — decision 21(d) records why: a fourth clause would change the approved promises; the report writes `elapsed` and `blocked` as separate fields (decision 14) so a slow program is told apart from a frozen loop, and a slow page is a broken page for the person reading either way.
- impl.md:258 versus impl.md:42 — the archive-folder replacement is a recursive `git ls-tree -r` in Build Phase 1 but non-recursive in decision 19.
  - breaks when: the recursive form is built; a trunk with many archived plans lists every file under every archived plan on each fresh read and can exceed the one-second budget.
  - answer: fix — the Build Phase 1 task text is corrected to the non-recursive form (decision 21(c)).
- impl.md:38 (decision 15) and impl.md:264 — `PAGE_STARTS_LIMIT = 6` is a fixed bound on program starts per page, but a workbench reads a trunk and a code repository per repo.
  - breaks when: a workbench with several repos legitimately starts more than six programs; `one-read-per-page` reports broken for a correct page.
  - answer: fix — decision 21(a) scales the bound to 6 per repository, still independent of the plan count; row A22 now covers a three-repository page at 18 starts upheld.
- impl.md:35 and impl.md:252 — `runStatus` gains `tableUnreadable`; a live pid absent from the table now reads unknown instead of stopped, which changes the existing promise `a-run-is-read-from-its-record` for a pid reused by an unrelated process.
  - breaks when: a run's pid is reused by an unrelated process just after it died; the run reads unknown, not stopped, for up to the window.
  - answer: nothing — unknown for at most one window is the honest reading when the table may predate the process, and the opposite error (a live run read stopped) is the harm the must-not-break promise names; pid reuse inside 15 s is rare, and the command match still rejects a different command.
- impl.md:36, 43 and brief.md:32 — the brief says the reads are kept "a few seconds"; the impl keeps them 8 s by default and up to 15 s, and brief.md:39 says a dead run reads stopped "within that time".
  - breaks when: a project has `admin.refresh_ms` of 10 s or more; a run that died reads running for up to 15 s.
  - answer: nothing — decision 20(a) already narrowed this with the 15 s ceiling; the brief's "a few seconds at most" is read with the live refresh it names, 8 s is under two refresh ticks, and a longer refresh reads fresh each tick rather than keeping.
- impl.md:32 (decision 9) — the port check is named in the brief, but the build task first traces it and may find no page reaches it and remove nothing.
  - breaks when: the port check is reached through a route the trace's search terms (`net.connect`, `fetch(`) miss, and a page still waits on it.
  - answer: nothing — the trace is where the profile frame becomes a call site, and A1's per-page timing and A14's lag test run against the real pages, so a missed wait shows as a slow page; the task records its finding in Notes either way.
- impl.md:42 (decision 19) and impl.md:346 — the impl extends to `instrumentation.ts`, `getCommitMessages` batching, scorecards, research, draft and home pages; the brief's scope sentence names only the admin's server-side readers and the run-record readers.
  - breaks when: commit-message batching or a changed archive listing alters those pages' output and no row asserts it.
  - answer: nothing — the brief names "every admin page", and the batching returns the same messages by commit id through the same reader; the archive listing is covered by A6, which compares the new landing answers with the synchronous `landedAsker`'s.

## Which skip reason would you not accept?

- impl.md:514 and test-plan.md:104 (U1) — "unverified to tools by design" for the headline sentence; the compensating control is the page-reads signal, which reads "no signal" for any route that never calls the module.
  - breaks when: a page does not call `finishPage`; the control and the skipped test fail for the same reason and the headline has neither.
  - answer: nothing — decision 20(d) wires every page, and A24 and the Build Phase 2 page list name them; A1 visits every route, so a page that reports nothing shows as "no signal" beside its measured time.
- impl.md:108 (Deferred Verification mitigation) — "Sandy reads it, nobody guesses" is a reader, not a detector; nothing raises an alarm for a page over a second except the `never-freezes` report.
  - breaks when: nobody opens the daemon's signals after close; a page regressing past a second goes unseen.
  - answer: nothing — the `never-freezes` report is the detector, and a broken clause is raised by the daemon like any broken promise (mark-first), so it does not depend on someone opening it.
- impl.md:154-157 — A5 through A11, A15, A16, A17, A20, A22, A23 are deferred because their imports do not exist; A17 (a dead run reads stopped after expiry) could be written today against `runStatus`.
  - breaks when: the dead-run-reads-stopped behaviour regresses in Build Phase 1 and no red-first test existed to show it.
  - answer: nothing — A17 asserts a dead run reads stopped once the kept table expires, which needs the kept-read module and its injected clock; the existing `runStatus` tests (listed in the regression guards) already cover the behaviour today and must stay green.

## What else would have to change for each promise to hold?

- impl.md:35 (decision 12) — kept readings are dropped only when the admin presses Build or sees a release end; a release ended or run started from the command line does not call `forgetKept`.
  - breaks when: a plan lands from the command line; the page reads "not on main" for up to the window.
  - answer: nothing — the brief accepts "kept for a few seconds at most"; the admin cannot know of a terminal's action, so only the window bounds it (at most 15 s).
- impl.md:27 and test-plan.md:18 — the live refresh fires every 5 s and the window is 8 s, so ticks at 0, 5, 10 s reuse at 5 s and read fresh at 10 s; `kept-briefly` holds for one tick in two.
  - breaks when: the person judges the clause by every refresh reusing.
  - answer: nothing — the clause is that a reading is reused inside the window and not read again, not that every tick reuses; a fresh read after the window is one read (decision 4 chose 8 s so it is at most one in two).
- impl.md:36 (decision 13) — a project with a 60 s refresh gets a 15 s window and a fresh read on every tick, and `refreshedEarly` is false, so no report names it.
  - breaks when: `admin.refresh_ms` exceeds 15 s; each refresh starts its own `ps` and `git`.
  - answer: nothing — one read per refresh is one read per page, which is what `one-read-per-page` promises; a 60 s refresh makes that cheap by itself.
- impl.md:246 — `keptProcessTable` throws on a `null` read so a failure is not kept; with the 3 s timeout, every page load while `ps` hangs waits 3 s.
  - breaks when: `ps` hangs; every page is over a second until it recovers, and A15 asserts only that the page answers within its limit.
  - answer: nothing — a hung `ps` is a real fault the page cannot answer around within a second; the reading falls back to the record with liveness unknown after 3 s (decision 6), and the slow load reports itself as broken.
- impl.md:334 — `readPageReads` runs `readLandings` and `trunkMergeSubjectsAsync` in parallel; a page waits for the slowest read, tied to the `git log --merges` time of the largest repository.
  - breaks when: a trunk's merge history is large enough that one `git log` takes over a second.
  - answer: nothing — that read is kept and shared, so it costs once per window rather than per plan, and a page that is still over a second shows it in its report.
- brief.md:41 — `decisions-wait-in-one-place` is guarded by A19, a pre-existing unit test, while the table argument and `tableUnreadable` default change.
  - breaks when: a decisions reader keeps a path (an API route) that passes no table and silently returns an empty set.
  - answer: nothing — decision 18 gives every caller on every route the table and A13's second part bans `realProcessReads` in any admin source, so a route keeping the old path fails the scan; A19 is re-run after the signature change.

## Which way could a clause fail that no signal would see?

- `one-read-per-page` (shown on every page via the page-reads report)
  - impl.md:511 — a page route that never calls `readPageReads`/`finishPage` reports nothing, and its per-plan starts are invisible; only A1 at close covers it.
    - breaks when: a new page, or an existing page not in the Build Phase 2 list, reads per plan.
    - answer: nothing — it reads "no signal", which keeps the clause from closing (mark-first), and decision 20(d) lists every existing page; a page added later is a later plan's change under A13's scan.
  - impl.md:264 — starts are counted only through `startProgram`; a start made by a function that does not use it is not counted.
    - breaks when: a reader added later starts a program directly; the count stays at its bound and the clause reads upheld.
    - answer: nothing — decision 20(c) and (d) route the known package readers through `startProgram`, and A13 fails a synchronous start anywhere on the path; an unwrapped asynchronous start is outside the freeze the clause names and shows in `elapsed`.
- `kept-briefly`
  - impl.md:264 — judged broken only on `refreshedEarly`; a dead run reading running, or an unlanded release reading not-landed, within or past the window, is not reported.
    - breaks when: a stale reading is served for the whole window after a change made outside the admin.
    - answer: nothing — the window is the accepted staleness (brief: "kept for a few seconds at most"), and decision 20(f) adds reading age so a reading older than its window is reported broken.
  - impl.md:36 and 39 — expiry of a short window against a long refresh is a fresh read, not an early one, so the window failing to cover the refresh is never reported.
    - breaks when: a project's refresh exceeds the ceiling; every refresh reads fresh and nothing reports it.
    - answer: nothing — that is the designed reading for a long refresh (see the answer above): each tick is one read.
- `never-freezes`
  - impl.md:334 — `maxBlockedMs` is process-wide; a block caused by another request or by the background recorder pass is attributed to whichever page was in flight, and a block outside any request is not seen.
    - breaks when: the event loop is blocked between requests and the next report lands after it ends.
    - answer: nothing — the clause is that the server does not freeze, which a process-wide measure detects; misattribution was accepted in the first review, and the recorder pass's starts are moved to the asynchronous readers (decision 19).
  - impl.md:37 — `elapsedMs` runs from the page's first read to the end of its reads, so time before the first read and rendering after it are never measured.
    - breaks when: plans are many or large and the page spends over a second outside the three reads.
    - answer: fix — decision 21(b) counts elapsed time from the top of the page function; A24 asserts it.
  - impl.md:42 — the report is sent from `after()` with a one-second-bounded flush; if the daemon is unreachable or `after()` never runs, reports are dropped and read "no signal", indistinguishable from a page nobody loaded.
    - breaks when: the daemon's stored address is stale; every clause for the plan reads "no signal" while the pages are slow.
    - answer: nothing — "no signal" is the designed reading when reports stop, and a clause closes only on a report from a real run, so silence cannot read as upheld; the daemon's address is found, not guessed (daemon-found-not-guessed).
- `admin-pages-load-fast` (the headline sentence, shown on every page)
  - impl.md:264 — no signal judges the headline duration; elapsed over one second is filed under `never-freezes`, only for pages that call `finishPage`.
    - breaks when: a page over a second is judged `never-freezes` broken while the headline promise stays unjudged.
    - answer: nothing — decision 21(d): a fourth clause would change the approved promises; the broken `never-freezes` report names the page and carries `elapsed`, which is what the person reads.
