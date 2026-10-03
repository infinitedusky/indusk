---
title: "The watcher proves it is watching"
date: 2026-10-02
status: accepted
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

1. **Locally, a probe through the real path at read time.** Grounded
   2026-10-03 ([research.md](research.md)): the local daemon is two detached
   binaries and nothing else — no process exists to send a beat every 60
   seconds, and neither rendered config emits anything on a timer. So the
   reader proves the path itself: before reading any promise, it sends one
   span to the daemon's OTLP intake and reads it back from the query API. A
   span that does not come back means "watcher blind" — never promise
   counts. This is the check that would have caught 2026-10-01: a leaked test
   Jaeger answering on the default ports never returns this project's probe.
   It says whether the watcher can hear *now*; it does not say since when it
   has been deaf, which locally is not needed — nothing runs between sessions
   to have missed anything.
2. **On the always-on server, a heartbeat on the clock it already has.**
   `serve()` is a long-running process whose pass runs every 60 s; it also
   sends one heartbeat span into its own OTLP intake, so the beat travels the
   path a promise mark does. The pass reads the newest heartbeat before it
   reads violations; older than about three minutes, it is "watcher blind
   since <time>".
3. **Someone hears it.** `promise_health`, `promises status`, catchup and the
   admin's Promises page each say "watcher blind" in place of counts when the
   probe or the beat fails, with where they looked; the server posts "watcher
   blind since <time>" to Slack once when its heartbeat goes stale, and once
   when it recovers. Slack does not travel the path that broke, so the alert
   cannot be silenced by the failure it reports. The chain ends at something
   that already runs and a person who already reads it — a checker for the
   checker is not needed when silence is the alarm.
4. **Optional per promise: "expect an event at least every X."** Silence with
   the heartbeat alive means nothing happened, which is the good outcome for
   most promises ("an empty form is never submitted"). Only a promise about
   something known to happen regularly (`every-commit-evaluated`) opts in, and
   only then does a quiet window need attention.

**What each signal is about** (Sandy asked, 2026-10-03). The probe and the
beat are about a **backend** — "is the watcher listening". The local daemon is
machine-global, so the projects that read it share its answer; a probe is
tagged with its project's id, the way promise marks are, and tests the Jaeger
*that* project reads (`promises.jaeger` may name another). A server's beat is
per server — per workbench once each has its own instance. Item 4 is about a
**promise** — "is this code still talking" — and is the only per-promise
signal.

The local probe needs nothing deployed, so it can be built and proven first;
the server's beat rides on the same span shape and the pass it already runs.

## Success criteria

- With the daemon stopped, or replaced by a Jaeger that is not it,
  `promise_health`, `promises status`, catchup and the admin say "watcher
  blind", not 0 violations; with it running, they read promises as today.
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
