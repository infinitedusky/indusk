---
title: "The watcher proves it is watching"
date: 2026-10-02
status: draft
workflow: feature
---

# The watcher proves it is watching — Brief

*Moved verbatim on 2026-10-02 from [day-always-on-deploy's brief](../day-always-on-deploy/brief.md), where it was written, so each piece can run at its own size; item numbers restarted.*

## Problem and direction

Found on 2026-10-01 (Sandy). The promise system depends on telemetry flowing,
and it only checks that telemetry is *reachable*. A test had left a Jaeger
running on the default ports; queries reached it and answered, so
`promise_health` reported this repository's two behaviour promises as
0 violations and nothing needing attention, with no event from either in seven
days of commits and checkoffs. "Nobody could look" read as "nothing broke". A
deployed server with the same blind spot would fail the same way, silently.

1. **A heartbeat through the real path.** The daemon — and the always-on
   server — sends a heartbeat event every 60 seconds into its own OTLP intake,
   so it travels the collector and lands in Jaeger exactly as a promise mark
   does. A heartbeat that proved only that a process exists would have
   reported fine on 2026-10-01, because a Jaeger *was* answering.
2. **The reader checks it first.** `promise_health` reads the newest heartbeat
   before any promise. Older than about three minutes, the answer is "watcher
   blind since <time>" — never promise counts.
3. **Someone hears it.** Catchup states the heartbeat's age on its own line;
   the admin's Promises page shows it; the always-on server, which nobody is
   watching by definition, alerts when its own heartbeat goes stale. The chain
   ends at something that already runs and a person who already reads it — a
   checker for the checker is not needed when silence is the alarm.
4. **Optional per promise: "expect an event at least every X."** Silence with
   the heartbeat alive means nothing happened, which is the good outcome for
   most promises ("an empty form is never submitted"). Only a promise about
   something known to happen regularly (`every-commit-evaluated`) opts in, and
   only then does a quiet window need attention.

The heartbeat applies to the local daemon as much as the server, so it can be
built and proven before the deploy and is part of proving the loop locally, the
gate the master plan puts ahead of the deploy.

## Success criteria

- With the daemon stopped or replaced by a process that is not it,
  `promise_health` and catchup say "watcher blind since <time>", not
  0 violations; with it running, the heartbeat's age is shown.
- The deployed server alerts when its own heartbeat goes stale (when
  [day-always-on-deploy](../day-always-on-deploy/brief.md) has deployed one).
- A promise that opts into "expect at least every X" needs attention after a
  quiet window; one that does not, does not.

## Depends on

- Nothing. Local first; the server's half rides on the same code.

## Blocks

- [incident-recording](../incident-recording/brief.md) and
  [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md): a
  loop that records and announces must first be able to tell it is blind.
