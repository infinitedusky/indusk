---
title: "Admin pages load fast — Test Plan"
date: 2026-10-20
status: draft
---

# Admin pages load fast — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the admin pages load fast. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. The impl's Test Trajectory takes its rows from here.

The brief (`brief.md`, accepted) makes one promise, `admin-pages-load-fast`, stated as three clauses. There is no `research.md`: the measurement that motivated the plan (a plan page 17.1 s, promises page 18–23 s, looks page 30 s; 11.4 s of 17.1 s spent in synchronous child-process starts) is written in the brief itself.

## Decisions made while writing this plan (unattended)

- **Time is measured with a counting stub, not a wall clock, wherever the claim is "read once".** A test that asserts "under a second" on a CI machine is flaky; a test that counts how many times the process list and the trunk history were asked for is exact. The wall-clock measure lives in exactly one place (A1, the page-timing check) with a generous bound taken from the brief's one-second promise. Reason: Sandy would rather ship than wait on a flaky tier (feedback: flow over exhaustive tests).
- **"A few seconds" is fixed at 5 seconds for the test's purposes.** The brief says "a few seconds" and the admin's live refresh is every five seconds; the tests use an injected clock and assert reuse inside the window and a fresh read after it, whatever the exact number the impl picks (the number is the ADR's decision). Reason: the assertion is the shape of the kept read, not its constant.
- **No new telemetry beyond page timing** — the brief's Not promised section excludes it. The signal for each clause is therefore the page's own timing and read counts reported on the page request span (the one piece of telemetry the brief allows), named per clause below.
- **Sections of the brief's "Existing promises → Must not break" are proved by the Regression Guards at the end, not by new clause rows.** They are existing promises with their own tests; this plan only runs them.

## Behavioral Assertions

Every assertion is observable from outside the admin: what a page does when loaded, what a person sees, what an observer measuring the machine counts.

## `admin-pages-load-fast`

Every admin page answers in under a second.

### `one-read-per-page` — a page reads the process list and the trunk's landing history at most once, for all the plans it shows

- Fails when:
  - A page showing several plans asks the machine for its process list once per plan or once per run instead of once.
  - A page showing several plans asks git whether each plan landed, one question per plan, instead of reading the trunk's landing history once.
  - A page that shows a run's live state and a plan's landing state reads each twice (once for the list, once for the detail).
  - The port check is repeated per plan or per run on a page.
  - A plan with no run, or a project with no plans, still triggers a read that nothing needed.
  - The one read fails or returns nothing and the page falls back to reading per plan (the slow path returns silently).
- Signal: the page request's own span (the page timing the brief allows) reports how many process-list reads and how many trunk-history reads the page made; upheld when each is at most 1 for a page showing N plans, broken reports the page, the count and N. A page that made more reads than its plans is the failure; a page with no span reads "no signal".

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | Loading every page route of the real running admin (plan, promises, looks, scorecards, research, draft, home), fresh after the kept reading has expired and again inside it, each answers in under one second. | live check |
| A2 | Loading a page that shows ten plans, each with a run, asks the machine for its process list exactly once, not ten times. | unit |
| A3 | Loading a page that shows ten plans asks for the trunk's landing history exactly once and answers every plan's "has it landed" from that one reading. | unit |
| A4 | A plan with no run, and a project with no plans, load without asking for the process list at all. | unit |
| A5 | When the one process-list read fails, every run on the page reads as its record says with the liveness marked unknown — the page still loads and does not ask again once per run. | unit |
| A6 | Every plan's "has it landed" answer from the single trunk reading equals the answer the per-plan question gave before this change, for a trunk holding a landed plan, a plan never landed, a plan with a similar name, a plan landed in an archive folder, a workbench plan landed in its code repository, and a project whose trunk is `master` beside `main`. | contract |

### `kept-briefly` — those reads are kept for a few seconds, so the page's own live refresh and the other pages reuse them

- Fails when:
  - The page's five-second live refresh reads the process list or trunk history again every time it fires.
  - The plan page, promises page and looks page loaded within the same few seconds each make their own reads.
  - The kept reading never expires, so a run that dies keeps reading as running, or a plan that lands keeps reading as not landed, beyond a few seconds.
  - A failed read is kept, so one bad read hides the true state for the whole window.
  - Concurrent requests arriving while a read is in flight each start their own instead of waiting for it.
  - The kept reading is shared between two projects or two worktrees, so one project's plans read from another's trunk.
- Signal: the page request span reports, beside the read counts, whether each read was taken fresh or reused; upheld when a second page load inside the window reports reused for both, and a load after the window reports fresh; broken reports the page and the age of the reading it used. A reading used older than the window is the failure no test catches in every state, so the age is reported on every page.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | Two page loads a second apart read the process list and trunk history once between them. | unit |
| A8 | A page load after the few-second window has passed reads both fresh, and a run whose process has since died reads stopped. | unit |
| A9 | Five simultaneous page loads on a cold start read the process list once and the trunk history once. | unit |
| A10 | After one failed read, the next page load tries again immediately and does not reuse the failure. | unit |
| A11 | Two projects loaded back to back each read their own trunk history; a plan landed in one never reads as landed in the other. | unit |
| A12 | The plan page, the promises page and the looks page loaded one after another inside the window together make one process-list read and one trunk-history read. | contract |

### `never-freezes` — no page starts another program in a way that stops the server answering other requests while it waits

- Fails when:
  - A reader the admin calls still starts a program synchronously (`spawnSync`, `execSync`, `execFileSync`) on a page's path.
  - A new reader added later reintroduces the synchronous start, or a synchronous start hides in a package function the admin imports.
  - The program the page waits for hangs (a stuck `git` or `ps`) and the server answers nothing else until it ends.
  - The program's start is made asynchronous but the page still awaits it before sending anything, so every page waits for the slowest program.
- Signal: the page request span (page timing) reports the longest time the server's event loop was blocked during the request; upheld when it stays under a bound of 100 ms for a page that waited on a program, broken reports the page and the blocked time. A source scan runs beside it at test time (A13); a hung program is the failure only the blocked-time reading would see.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A13 | No code on the admin's page paths — the admin's own readers and the package's run-record readers it imports — contains a synchronous program start. | contract |
| A14 | While one page waits on a real program (a `ps` that takes three seconds), the server's event loop never lags past the limit and a request for another page is answered within one second. | unit |
| A15 | When the process-list program never answers, the page still answers within its time limit with liveness unknown, rather than waiting forever. | unit |
| A16 | The same fixed process list and trunk history read through the new asynchronous readers give the same runs and landings as the synchronous readers gave (the port reader, changed in the build's second phase, gets its own equivalence test there). | contract |

### Not for a promise

Regression guards over what must not break; each runs an existing promise's tests, not a new one.

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A17 | A run that dies is read as stopped on the next page load after the kept reading expires, and a run that is alive still reads running. | unit | `a-run-is-read-from-its-record` — the brief names this as kept for a few seconds at most |
| A20 | A run started after the kept process table was read reads running or unknown, never stopped. | unit | `a-run-is-read-from-its-record` — a live run reads running |
| A21 | A release that ends just after a page read the landing history reads the plan as landed. | unit | `a-run-is-read-from-its-record` — landing still reads true |
| A22 | A page's report carries elapsed time and program starts; a page over a second or whose starts grow with its plans reports `never-freezes` / `one-read-per-page` broken, and a broken report is never throttled away. | unit | signals for the three clauses report each failure |
| A23 | A fresh read although the last one was inside the window reports `kept-briefly` broken. | unit | the window failing is otherwise invisible |
| A18 | The offer of approval on a finished plan still reads the plan review and the live run, with the same answer as before. | unit | `approval-waits-for-a-finished-plan` stays upheld |
| A19 | Needs you still lists every plan waiting on the person, the same set as before this change. | unit | `decisions-wait-in-one-place` stays upheld |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | Every admin page, on Sandy's machine with a real load of plans, answers under a second at all times. | A fixed test cannot cover the number of plans, the machine's load or a stuck program in every real state; A1 measures the three slow pages once on the running admin. | The page timing on the request span (the one telemetry this brief allows) is the continuing measure; a page over a second is read there, not guessed at. |

## Notes

- Level choices: A1 is the only `live check` (it needs the running admin and real data; it is not run per phase, only at close). The rest are `unit` or `contract` so the plan's own tests stay fast.
- A2/A3/A7/A9 count reads through an injected reader; the impl must expose the process-list and trunk-history readers as replaceable for the tests to do so — the ADR's decision.
- A13's synchronous-start scan covers the package's run-record readers because the brief names them; whether other package code also changes is the ADR's decision.
- The bound of 100 ms in `never-freezes` is a first choice; the impl may tighten it once real timings from the page span exist.
- No blocker: nothing here could not be decided.
