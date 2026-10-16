---
title: "Telemetry from day one"
description: "A project built with InDusk reports from its first run, is heard by its server, proves each clause by its signal, and reads its expectations when they come due; InDusk's own closing rule (Signal first) is the second of seven steps."
date: 2026-10-16
status: living
subplans:
  - daemon-found-not-guessed
  - mark-first
  - a-new-project-starts-instrumented
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
   self-tracing warnings) and the logs port nothing binds.

2. **`mark-first`** ("Signal first") — as briefed, with about nine rows added
   to its clause plan and proposed ADR; still blocks `run-the-master`. A
   clause is verified by its tests before release and upheld by its signal in
   use; a break names its clause; the audit answers each concern with a
   signal, a fix or a reason. The additions the audit forces: readers read a
   clause's signal regardless of its promise's kind (today every reader of
   signals filters to `behaviour`, and both of this plan's own promises are
   `state`); the rule that a signal is derived from the clause, not a test,
   becomes a contract check; a phase whose rows name a clause carries a
   runnable per-phase check; and the plan's own four non-telemetry signal
   lines are made honest by InDusk's own commands emitting the spans their
   clauses claim. Without the last, the plan cannot close under its own
   closing rule.

3. **`a-new-project-starts-instrumented`** — blocked by `daemon-found-not-
   guessed` for the endpoint it writes and by `mark-first`'s ADR for the
   signal helper's keys; blocks Homework Gate's `indusk init`. A project
   scaffolded today gets instrumentation that exports to the console (Node and
   browser templates) or to whatever holds port 4318 (the Next.js template, by
   its SDK's default), at the workbench root rather than in the code repo,
   under the service name `unknown-service`, with a signal helper that is
   internal to the package, a guide that still writes the old word, and an
   otel skill that says to look in Dash0. After this plan: the scaffold sits
   where the app runs, the service is named, the exporter points at the daemon
   that is running, every span carries its environment and project, the app
   writes its signal from a small helper it owns (plain OpenTelemetry, no
   InDusk dependency, generated from the package's one vocabulary), the test
   runner marks its spans as test-made, and the skills tell the truth. Takes
   the two telemetry gaps `new-project-flow`'s audit parked in
   `known-issues.md`, and the demo's stale test words (its loop works; the
   tests expect the words `one-promise-language` replaced). The largest
   child; if it stalls, placement, naming, endpoint and environment land first.

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

The editor reading what the admin reads (it draws every `state` promise green
"watched by the tests" by kind alone; it activates only where
`.indusk/config.json` sits, so a window on a workbench's code repo never
activates) — one plan, after the editor's one-release wait on the wire word.
The evaluator asked whether a commit emitted its clause's signal. A clause
carrying its budget or bound machine-readably, with a reader that compares.
A staging source beside production. Sampling and reader cost. The server
writing back to the laptop. A break cascading down a trace to its cause, and
signals from the browser — the later cut, as chosen on 2026-10-15.

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
