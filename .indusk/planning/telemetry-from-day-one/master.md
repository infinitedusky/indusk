---
title: "Telemetry from day one"
description: "A project InDusk initialises is set up for telemetry, is heard by its server, links each clause to its tests and its telemetry, and reads its expectations when they come due."
date: 2026-10-16
status: living
subplans:
  - daemon-found-not-guessed
  - impl-tasks-are-instructions
  - a-new-project-starts-instrumented
  - mark-first
  - a-plan-page-shows-its-clauses
  - audit-concerns-are-answered
  - production-is-heard
  - production-keeps-only-what-it-should
  - a-look-comes-due
  - a-break-on-the-laptop-closes-its-loop
---

# Telemetry from day one

A child of [promise-core](../promise-core/master.md), in the place
`mark-first` ("Signal first") held until 2026-10-16. Made that day after a
cold audit of `mark-first` against the goal — telemetry integral to a project
built with InDusk from day one, promises failing in production as a critical
part of how the system works, and decisions eventually taken from expectations
and measurements, proved on Homework Gate rather than on InDusk itself. The
audit is in [mark-first's research](../mark-first/research.md), "Audit against
the goal": 41 gaps, none refuted, grouped by the stage a new project reaches.

The finding that made this a parent: `mark-first` is a sound plan for how
InDusk *reads* a signal — closing, standing, a break keyed by its clause, the
audit's seventh question — and it does not touch what a new application is
*handed* or *emits*. After it lands, a project created tomorrow starts exactly
as today: an unwired instrumentation file at a root where no app runs, no
exporter endpoint, no way to write a signal that a reader recognises, promises
declared `state` that no reader asks the daemon about, and a daemon on this
machine that the readers cannot find. So the signal `mark-first` reads has
first to be written — by a daemon that is found, handed to a new project at
`init` — and then heard in production and read when a look comes due. Seven
plans, in the order Homework Gate hits each need. This master is display only;
each child is one plan with one landing.

## Children, in order

1. **`daemon-found-not-guessed`** — first; blocked by nothing; shares no code
   with `run-the-master`. The local daemon (Jaeger and a collector, run by the
   `local-telemetry` extension) is the one every reader, the admin, the editor
   and an application agree on. Today `telemetry register`, run on every
   `init` and `update`, starts a new daemon with bumped ports whenever the
   record reads "not running", then rewrites every registered project's
   `.mcp.json`; a read can delete the record that is the daemon's only
   identity; `start`, `reap` and `stop` cannot recover the state InDusk itself
   made. This machine has three Jaegers and four collectors, no record, and
   every app-side writer still says port 4318 — Homework Gate's own creation
   on 2026-10-12 spawned the third. Closes the audit's gaps about the daemon
   record, the port bump, the recovery commands, the unreadable log (80,230
   self-tracing warnings) and the logs port nothing binds. Landed 2026-10-17.

1b. **`impl-tasks-are-instructions`** ("Impl tasks are written as
   instructions") — blocked by nothing; moved out of `mark-first` on
   2026-10-17 (Sandy) so it lands now rather than behind it. A task in a new
   impl reads as work to do and a verification item as what must hold; the
   planner, its templates and the shipped planning rules say so. Clauses per
   phase stay with 3b, read from the rows.

2. **`a-new-project-starts-instrumented`** ("Init sets up telemetry (New
   Projects)", retitled 2026-10-17) — blocked by `daemon-found-not-
   guessed` (its spans go to the daemon's fixed ports); blocks Signal first,
   which reads what this plan's helper writes, and Homework Gate's `indusk
   init`. A project scaffolded today gets instrumentation that exports to the
   console (Node and browser templates) or to whatever holds port 4318 (the
   Next.js template, by its SDK's default), at the workbench root rather than
   in the code repo, under the service name `unknown-service`, with no way to
   write a signal a reader recognises and an otel skill that says to look in
   Dash0. After this plan: the scaffold sits where the app runs, the service is
   named, its spans reach the daemon, every span says where it ran, the app
   writes its signal from a small helper it owns (plain OpenTelemetry, no
   InDusk dependency, pinned to the package's one vocabulary), a test run
   marks its spans as test-made, and the skills tell the truth. **This plan
   defines what a signal carries** — the vocabulary keys below — because it is
   the first to write one from an application. (The demo's stale test words
   it was to take were fixed in demo-app-template's Maintenance, landed
   2026-10-17.) The largest child; if it stalls, placement, naming, the daemon
   and environment land first.

3. **`mark-first`** ("Tests and telemetry linked to clauses", retitled from
   "Signal first" on 2026-10-17) — blocked by the scaffold plan for the
   keys it reads, and by `daemon-found-not-guessed` because closing asks the
   daemon; still blocks `run-the-master`. Moved behind the scaffold on
   2026-10-16 (Sandy): write before read — a closing rule that asks for a
   signal belongs after something outside InDusk can write one. A clause is
   verified by its tests before release and upheld by its signal in use; a
   break names its clause. The audit's answer to each concern left for 3c,
   and tasks-as-instructions for 1b, on 2026-10-17 (Sandy). The additions the audit forces: readers read a clause's signal
   whatever its promise's kind (today every reader filters to `behaviour`);
   the rule that a signal comes from the clause, not a test, becomes a
   contract check; a phase whose rows name a clause carries a runnable
   per-phase check; and InDusk's own commands get one tracer, so this plan's
   own clauses — and `new_project.create` — emit real spans. A promise's
   standing is read from its clauses; showing clauses on their own page stays
   the later cut's clause views.

   **The seam between the two** (settled 2026-10-16): a signal is a span
   carrying `indusk.promise`, `indusk.clause` (optional), `indusk.promise.outcome`
   (`upheld` or `broken`), on broken an event with `indusk.promise.symptom`,
   optionally `indusk.signal.value` and `indusk.signal.bound`, optionally
   `indusk.signal.plan` and `indusk.signal.phase` (who added it), and
   `indusk.run=test` when a test run made it; every span carries
   `deployment.environment` and `indusk.project` as resource attributes. The
   keys are defined once, in the package's `promises/vocabulary.ts`; the
   scaffold plan adds them and its helper is pinned to them; Signal first's
   readers read them and nothing else.

3b. **`a-plan-page-shows-its-clauses`** — after Signal first (Sandy, 2026-10-16),
   which supplies its last step. A plan page shows its clauses prominently
   wherever they are relevant, in two places first: **each build phase** lists
   the promises and clauses it affects, and **a clause list for the whole
   plan** shows every clause's state as the plan is executed. The state is one
   ladder, read from files and signals, never typed: **not yet addressed** (no
   phase that names it has closed) → **upheld in code** (its phase closed, and
   code carries the clause's token) → **verified** (every test row naming it
   passes, its files carrying the token) → **holding** (its signal reported
   upheld through the daemon). Each step can read broken — code removed, a test
   failing, a signal reporting broken — and the page shows the highest step
   reached and any break below it. A phase's clauses are derived from its rows,
   never declared per phase: phases and clauses are many-to-many. A change to
   the plan page, so its looks are drawn and approved in the cockpit before it
   builds.

3c. **`audit-concerns-are-answered`** ("Audit concerns are answered by the
   plan's agent") — blocked by `mark-first`, since a signal answer names the
   clause it upholds; split out of it on 2026-10-17 (Sandy). The audit finds
   what could go wrong; the plan's agent, with the build's context, answers
   each concern with a fix, a signal or a reason; every "nothing needed" is
   shown to the person. Its brief is a draft: that shape is still to be agreed.

4. **`production-is-heard`** — blocked by `a-new-project-starts-instrumented`;
   before Homework Gate's first deploy; in parallel with the next. Production
   is wired by hand twice today — the application's exporter secrets and the
   project's `promises.jaeger` separately — and nothing checks they name the
   same server; a mismatch reads as "no signal". `server deploy` and `server
   connect` hand the application its wiring; arrival is proved by the
   application's own service, not by the watcher's probe; a mismatch is named.

5. **`production-keeps-only-what-it-should`** — in parallel with the previous;
   before student data reaches a recording server. Homework Gate's founding
   brief promises that telemetry carries no student content, with an allowlist
   at source and a redaction processor as backstop; the daemon's pipeline is
   `otlp → batch → memory`, the always-on image is traces only, and no
   redaction exists anywhere. The project declares what a span may never
   carry; both rendered pipelines enforce it; the log channel is local or it
   is stored.

6. **`a-look-comes-due`** — blocked by nothing; before Homework Gate's first
   release plus thirty days. Expectations are write-only today: parsed,
   displayed, checked for amendments, never read at their look time; the
   admin's expectation row has a `due` field nothing sets. A due look is
   listed; a measurement is recorded in the brief. Trends, shared history and
   retention past ninety days stay [expectations-loop](../expectations-loop/master.md)'s.

7. **`a-break-on-the-laptop-closes-its-loop`** — optional, Sandy's call;
   blocked by `mark-first`'s decision that a signal is keyed by promise and
   clause. For a project naming no production source — Homework Gate's first
   weeks — a break the agent causes while building is a red chip and nothing
   else: the admin's recorder loop runs only for projects with a production
   source, and the catchup's recorder is refused for a local-only project.
   Recording a local break unasked reverses `the-demo-break-is-caught-locally`,
   chosen 2026-10-08 under the demo's framing. The same plan separates a
   failing slow test at release from a production break: today both open the
   same incident, flip the registry to `known-broken`, and tell every agent
   "A promise broke in production" — seven times on 2026-10-16.

## What Homework Gate gets after the first three

One daemon the readers, the admin, the editor and the app agree on. A
`create-next-app` in `homework-gate/` and one `indusk update` write
instrumentation with the service named, an environment file with the live
endpoints, a signal helper with the typed keys and the test marker, and an
`.mcp.json` so the evaluator scores the first commit. `next dev` puts
`homework-gate` in the local Jaeger; a route handler's `signal.upheld(...)`
reads upheld in `promises status`, the promise page and the admin whether the
promise is `state` or `behaviour`; every build phase that names a clause
carries a runnable check. Still by hand until the fourth and fifth land:
production. Still a red chip until the seventh, if chosen: a local break.
Marked server-side, as chosen for the later cut: clauses felt in the browser.
Homework Gate's first plan should be one with server code, or `mark-first`'s
expectation that signals cost little, measured on that first plan, has nothing
to measure.

## Later, named so absence is not oversight

The measurement plans have their own section below.

The editor reading what the admin reads (it draws every `state` promise green
"watched by the tests" by kind alone; it activates only where
`.indusk/config.json` sits, so a window on a workbench's code repo never
activates) — one plan, after the editor's one-release wait on the wire word.
The evaluator asked whether a commit emitted its clause's signal. A clause
carrying its budget or bound machine-readably, with a reader that compares.
A staging source beside production. Sampling and reader cost. The server
writing back to the laptop. A break cascading down a trace to its cause, and
signals from the browser — the later cut, as chosen on 2026-10-15.

## Measurement: from a look to a number (Sandy, 2026-10-16)

The seven children make a signal written, read and heard; none of them
computes a measurement. `a-look-comes-due` lists a look when it comes due and
records what a person measured as a dated `Measured:` line in the brief — the
files are the history, and a trend is the list of dated lines. That holds for a
first look at thirty days: the recording server keeps traces for twenty-eight
days on disk (`DEFAULT_RETENTION_HOURS`, `lib/telemetry/server.ts:65`), so a
look can still count recent traces when it comes due. It runs out at ninety-day
looks, at trends, and at rates and percentiles over time: Jaeger is a trace
viewer, its query API pages with limits, and the laptop daemon keeps nothing
across a restart (memory store, Sandy, 2026-10-16). Settled in conversation the
same day, as the next plans after this master's seven, in this order:

1. **`telemetry-destinations`** (a draft on its own branch since 2026-10-10,
   "backlog, not critical" until now): InDusk always receives an app's
   telemetry, and other destinations are added and removed beside it. Brought
   under this master as the first of the measurement plans: everything below
   is "where telemetry goes".
2. **A `metrics` extension, three ways to run one store.** The loop depends on
   one narrow interface, never on a backend: Prometheus remote-write in (the
   collector's `spanmetrics` connector turning spans into counts, error counts
   and latency histograms as they arrive — the way Jaeger's own service
   performance monitoring works), the PromQL HTTP API out. Then the store is an
   endpoint: **self-hosted open source** (a single binary — VictoriaMetrics
   leaned on, Prometheus the safer-known name — shipped platform-split the way
   the daemon's Jaeger and otelcol are, beside the daemon locally and in the
   recording server's published image); **hosted** (any vendor that accepts
   remote-write and answers PromQL — Grafana Cloud, Dash0, which has an
   extension here already); **managed by InDusk** (the same image, run for
   people). An expectation's Measure may name a query; its look reads one
   number. The `Measured:` lines stay the record and the store a cache that can
   be rebuilt — the open-core rule: a server only for what runs continuously,
   holding nothing the files don't.
3. **Sources as extensions, normalized on intake.** One collector is the
   single intake, with a receiver per source: the app's own OTLP; a platform's
   drains (Vercel's logs and traces, and possibly its speed and analytics data,
   to a custom endpoint — to verify against Vercel's documentation before it is
   planned); a platform's Prometheus-shaped metrics (Fly's, to verify); and the
   collector's existing receivers for HTTP checks, hosts, Kubernetes and
   GitHub. Each source is an extension contributing its receiver and its
   mapping onto OpenTelemetry's semantic conventions (names, units and
   attributes rewritten by the collector's transform processors), and declares
   which conventional metrics it provides. A Measure names only conventional
   metrics, so it reads the same whichever source supplied the number. Not
   everything is piped in: a source is added when an expectation needs a
   number only it has — for Homework Gate, Vercel first, once one does. Every
   source passes through `production-keeps-only-what-it-should`'s redaction
   (Vercel's request logs carry paths and query strings). A platform's metric
   is the platform's view; a clause's signal still comes from where the
   promise is felt, the app's own code.

The danger named with it: general cross-vendor normalization is not solved
anywhere, and a sum across sources that each measure something slightly
different can be confidently wrong. It works when only what an expectation or a
clause reads is normalized. This work belongs with
[expectations-loop](../expectations-loop/master.md), where decisions are taken
from measurements; Homework Gate's first looks run on its own spans and the
`Measured:` lines.

## Where this leads (Sandy, 2026-10-16)

"This is the next big … the place where we describe our app going as we talk
about fundraising for it": InDusk becomes a telemetry play with a software
development setup, and eventually web hosting, all in one. The promise loop is
what joins them — a promise stated in planning, held by its tests before
release, upheld by its signal in use, its breaks reopening the plan that made
it, and its expectations measured into what is built next. The development
setup is where promises are made; the telemetry is where they are proved; the
hosting is where they run and are heard without wiring. The managed metrics
store above and the recording server InDusk already publishes are the first
pieces of the hosted half.

## Decisions this master waits on (Sandy, none taken)

- Widen `mark-first` so readers key by clause regardless of kind, or re-kind
  its two promises as `behaviour` (cheaper, and every Homework Gate `state`
  promise's signal stays unread). The audit recommends the former: the kind
  rule is the defect.
- The per-phase check and the OTel gate text inside `mark-first` now, or in a
  follow-on after `run-the-master`.
- Reverse `the-demo-break-is-caught-locally` (the seventh child) or keep a
  local break as work in progress until the server exists.
- Server-side redaction (the fifth child) before Homework Gate's first deploy,
  or the at-source allowlist alone.
- The scaffold plan as one landing with three promises, or two.
- Applications reach the daemon by a fixed port 4318 the daemon always holds,
  or by an environment file written from the daemon's recorded port.
- Homework Gate's first plan one with server code, so the cost expectation has
  something to measure.
- `a-look-comes-due` now, as `expectations-loop`'s first child, or after
  `run-the-master`.
- Kill this machine's three stray Jaegers and four collectors by hand today
  (it unblocks `mark-first`'s live-check row and Homework Gate), or wait for
  the first child.
- If `mark-first` changes what the promise page shows per clause, amend its
  brief's Changes list with `a-promise-page-shows-its-proof` at the same
  sitting as the clause-plan changes.
