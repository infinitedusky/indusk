---
title: "Test kinds — research"
date: 2026-10-05
status: complete
workflow: feature
---

# Test kinds — Research

## Question

Why does every phase wait about five minutes on `pnpm test`, and which kind of
test should each question be answered by, and when?

Sandy, 2026-10-05: *"if we look at what is taking so long to build this
thing, a lot of it is waiting for tests"*; *"regression is about testing, not
monitoring"*; *"that's the reason we have promises."*

## Findings

### Where the time goes (measured at promise-timeline's close, 2026-10-05)

| Suite | Wall time | Notes |
|---|---|---|
| mcp `pnpm test` | 49 s | 266 files in parallel |
| admin `pnpm test` | 255 s | 62 files; the node project is serial (`fileParallelism: false`) |
| root `pnpm test` | about 5 min | `turbo test --concurrency=1`: the two packages run **one after the other** |
| `test:system` (mcp) | 147 s | 34 files; run by `pnpm release` |

The admin's 247 s of file time is dominated by 15 files that start `next dev`
(`src/__tests__/helpers/next-dev.ts`), and above all by eight promise files
that also start one or two real Jaeger servers:

| File | Time | Added by |
|---|---|---|
| `http-promise-timeline-sources` | 48 s | promise-timeline |
| `http-promise-timeline-falsify` | 47 s | promise-timeline |
| `http-promise-sources` | 41 s | promise-sources |
| `http-promise-remote` | 21 s | day-always-on |
| `http-promise-health` | 17 s | day-monitor |
| `http-promise-timeline-transfer` | 16 s | promise-timeline |
| `http-watcher-blind` | 13 s | watcher-heartbeat |
| `http-promise-timeline` | 13 s | promise-timeline |

These eight take 216 s. Everything else in the admin suite takes about 30 s.

**The serial root run exists because of them.** Commit `6ffccf28`: *"root
pnpm test runs the packages one at a time — the parallel mcp suite starved the
admin's real-Jaeger HTTP tests."* Their cost is their own 216 s plus the
parallelism they forbid.

### What the slow files assert

Every assertion in the eight files is a rule about what a chip or a cell shows
for a given set of runs:
- red while an incident is open, purple once it is fixed (A9);
- local green once a newer run holds (A10);
- a late violation turns the chip red (A17);
- a repointed server draws only its runs (A16);
- a slow window is drawn after a few refreshes (A19).

None of them is a question about Jaeger, Next or HTTP. The server is the way
the runs are fed in, and real waits (`sleep(6_000)` "past the health cache")
are the way time is moved forward.

Example, A17 (about 9 s on its own):
1. start a server and record a run held an hour ago;
2. start `next dev` and load the page (green);
3. record a violation dated five minutes ago;
4. sleep 6 s;
5. reload and expect red.

The rule underneath it: *covered up to now, a run dated earlier arrives, and
the next read includes it.* That is a function of what has been read, the new
runs and the time.

### Why the code forces the server

- `apps/indusk-admin/src/lib/promise-timeline.ts` `readWindow` calls
  `Date.now()` itself and calls `readTimeline`, which resolves sources and
  queries Jaeger, by name. The only way to give it runs is a real Jaeger.
- `lib/promise-health.ts` `readHealth` does the same through `probeSources`
  plus the store, and caches on wall time (`admin.refresh_ms`).
- Where a rule already takes its inputs, its test is fast. `buildStrip` takes
  `now`, so A14 runs in milliseconds; `violationState` is a pure function.

### Why the tests were written that way: two of our own rules

1. **The test plan's rule** (`skills/planner.md`): every assertion is
   behavioural, "what an outside observer sees". The mechanism column is
   free text ("vitest unit / vitest integration / e2e script / manual…") and
   says nothing about *when* a kind of test runs.
2. **The work skill's "real red" rule** (`skills/work.md`, "Real red vs fake
   red — the boundary rule"): a test that reaches its subject over a boundary
   (HTTP, CLI, a query, a spawned process) gives a genuine red on day one, so
   "when authoring early, prefer the boundary".

Together they turn "behavioural" into "through the outermost door". Each is
reasonable alone; combined, a rule about the store became a test that boots a
web server and two Jaeger servers.

### What already exists

- **A tier list for mcp.** `apps/indusk-mcp/vitest.tiers.ts` `SYSTEM` holds the
  files that start a real outside system (daemon, always-on server, admin
  daemon, packed tarball). They run in `test:system`, which `pnpm release`
  runs before publishing. Its header already states the rule: *"A file that
  starts such a system belongs in SYSTEM, or the everyday suite is slow
  again."* **The admin has no such tier**, so its server-booting tests run
  every time.
- **Phase-scoped verification exists in `verify`.** `skills/verify.md` says to
  run the affected app's tests, not the full suite, and `indusk verify` runs a
  row's named test files. But `/work` phases and the planner template
  (`T1 passes (pnpm test)`) habitually name the whole suite.
- **The fake clock exists.** Vitest has `vi.useFakeTimers()`,
  `vi.setSystemTime()` and `vi.advanceTimersByTime()`. Nothing to build.
- **Earlier research on the cross-service layer**
  (`.indusk/research/test-strategy/induskbrief.md`, 2026-04-20) sets three
  categories, unit / integration / end-to-end, each with an owner and a home.
  It says where cross-service tests live; it does not say when each kind runs
  or which kind an assertion should default to.

### How telemetry projects handle it (from memory, moderate confidence; not re-checked)

- **OpenTelemetry SDKs**: tests replace the exporter with an in-memory one
  (`InMemorySpanExporter`) and read spans back from memory.
- **OpenTelemetry Collector**: components are unit-tested against a recording
  fake next stage (`consumertest.Sink`). Real-backend tests sit behind a Go
  `integration` build tag, use testcontainers and run in separate CI jobs; load
  and correctness testing lives in its own `testbed`.
- **Jaeger**: mostly unit tests; each storage backend's integration suite
  runs in its own CI job.
- Common to all three: **time is injected, not waited for**, and the slow
  kinds run on a different trigger from the everyday suite.

### Questions a real system is genuinely needed for

From this codebase, a test that needs the real thing exists when the behaviour
being checked belongs to something we do not own, so a fake would be our guess
at the answer:

| Question | Real thing | Already where |
|---|---|---|
| The published package installs and works | npm pack + a fresh project | `admin-bundle-pack` (system) |
| A browser shows a login box | a browser | `always-on-browser-login` (system) |
| Daemons start, hold ports, are cleaned up | the OS | telemetry lifecycle files (system) |
| Marks survive a hard restart | Badger | always-on files (system) |
| Jaeger answers our query as we expect | the shipped Jaeger | `promise-timeline-reader`, `promise-sources` (system) |
| Claude Code loads a nested `CLAUDE.md` | Claude Code | `pnpm e2e` context-tiers probe |

Each of those already runs at release or on demand. The admin's eight files
are not on this list.

### Monitoring versus regression

The question "does a real break in a running system reach a person, in time"
is continuous and belongs to the running system, which is what promises are
for. The always-on server already marks a heartbeat every pass
(watcher-heartbeat). A promise InDusk holds about itself ("a violation
reaches the admin within N minutes") would answer it in production,
continuously, rather than in a suite.

## Open Questions

- Should the admin's one remaining Promises-page smoke move to mcp's
  `test:system` (which already starts Jaeger) or get an admin `test:system`
  of its own?
- Does phase verification name its files explicitly (the trajectory row's
  `Test` column) or derive them (`vitest related` on the files the phase
  changed)?
- Is InDusk's promise about itself in this plan or a follow-up?

## Sources

- Measured: the promise-timeline Build Phase 6 run logs, 2026-10-05.
- `package.json` (root `test`), commit `6ffccf28`.
- `apps/indusk-admin/vitest.config.ts`, `apps/indusk-mcp/vitest.tiers.ts`.
- `apps/indusk-mcp/skills/{planner,work,verify}.md`.
- `.indusk/planning/archive/promise-timeline/retrospective.md`.
- `.indusk/research/test-strategy/induskbrief.md`.
