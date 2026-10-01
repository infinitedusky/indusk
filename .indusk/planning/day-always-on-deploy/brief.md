---
title: "Always-on deploy — run the server somewhere real"
status: accepted
date: 2026-09-20
---

# Brief

## The problem

`day-always-on` built the always-on server and proved the whole loop against
it: twenty assertions, an end-to-end run where a real application process
marks a promise violated and the server announces it before any developer
machine appears. All of that ran on this laptop.

Two things it did **not** do, and deliberately did not claim to:

- **The image was never built.** `docker/Dockerfile.always-on` installs the
  published package, and the published package predates `indusk telemetry
  serve`. It could not have been built before the release that carries the
  command — and there is no docker daemon on the machine that wrote it.
- **The Fly configuration was never run.** `docker/fly.always-on.toml` is a
  careful guess. Its most important setting — the machine never auto-stops —
  is exactly the kind of thing a provider changes the semantics of, and
  nobody has watched it hold.

Those are U1 and U2 in `day-always-on`'s test plan: manual smoke rows,
deferred because no test in this repository can stand in for a provider.
They need an account, a domain and a Slack workspace, and they need the
release to exist first.

## What this plan is

The smallest plan that turns two written artifacts into two verified ones.

It is deliberately separated from `day-always-on` rather than held inside it,
because holding it would mean the whole of 4b′ — the server, the pass, the
remote source, the admin, the health tool — waits on a Fly login and a
publish. That work is finished and tested; it should land, be used against
real projects, and have its problems found before anything is deployed.

## Proposed direction

1. **Build the image** against the release that carries `telemetry serve`,
   and confirm the entrypoint refuses by name when a setting is missing —
   the same refusals A1–A4 assert locally, now through the container.
2. **Deploy to Fly** from `docker/fly.always-on.toml`, with a volume and its
   secrets.
3. **Run the deploy-and-break procedure** already written in
   [the guide](/guide/always-on#smoke-testing-a-deployment): both doors refuse
   without credentials; a promise broken from outside reaches Slack; the trace
   survives a machine restart; **and a second violation sent after an idle
   hour still gets announced**, which is U2 and the step people skip.
4. **Record what was actually observed**, including anything the written
   configuration got wrong. A guess that survived contact is worth recording
   as a guess that survived.
5. **Correct the artifacts and the docs** — the guide currently marks both
   files as unrun, and that marking comes off only when they have been run.

## Added 2026-10-01: the watcher proves it is watching

Found on 2026-10-01 (Sandy). The promise system depends on telemetry flowing,
and it only checks that telemetry is *reachable*. A test had left a Jaeger
running on the default ports; queries reached it and answered, so
`promise_health` reported this repository's two behaviour promises as
0 violations and nothing needing attention, with no event from either in seven
days of commits and checkoffs. "Nobody could look" read as "nothing broke". A
deployed server with the same blind spot would fail the same way, silently.

6. **A heartbeat through the real path.** The daemon — and the always-on
   server — sends a heartbeat event every 60 seconds into its own OTLP intake,
   so it travels the collector and lands in Jaeger exactly as a promise mark
   does. A heartbeat that proved only that a process exists would have
   reported fine on 2026-10-01, because a Jaeger *was* answering.
7. **The reader checks it first.** `promise_health` reads the newest heartbeat
   before any promise. Older than about three minutes, the answer is "watcher
   blind since <time>" — never promise counts.
8. **Someone hears it.** Catchup states the heartbeat's age on its own line;
   the admin's Promises page shows it; the always-on server, which nobody is
   watching by definition, alerts when its own heartbeat goes stale. The chain
   ends at something that already runs and a person who already reads it — a
   checker for the checker is not needed when silence is the alarm.
9. **Optional per promise: "expect an event at least every X."** Silence with
   the heartbeat alive means nothing happened, which is the good outcome for
   most promises ("an empty form is never submitted"). Only a promise about
   something known to happen regularly (`every-commit-evaluated`) opts in, and
   only then does a quiet window need attention.

The heartbeat applies to the local daemon as much as the server, so it can be
built and proven before the deploy and is part of proving the loop locally, the
gate the master plan puts ahead of the deploy.

## What this plan is not

Not a hosting decision, and not a commitment to Fly. Fly is the reference
because something had to be. If the smoke test shows the provider fights the
always-on requirement, recording that is a successful outcome of this plan,
not a failure — the server needs a container, a disk and TLS, and several
things provide those.

Not a second implementation. If the procedure finds a bug in the server, the
fix belongs here; if it finds a bug in the loop, that is a promise
`day-always-on` made and broke, and it comes back through the usual door.

## Depends on

- `day-always-on` landed on `main` **and published** — the image installs the
  published package by design, so the release is a hard prerequisite rather
  than a convenience.

## Success criteria

- U1 satisfied: the procedure run once by hand, its output recorded here.
- U2 satisfied: a violation sent after a genuine idle period is announced.
- The guide no longer marks the image or the Fly configuration as unrun,
  because both have been.
- With the daemon stopped or replaced by a process that is not it,
  `promise_health` and catchup say "watcher blind since <time>", not
  0 violations; with it running, the heartbeat's age is shown.
- The deployed server alerts when its own heartbeat goes stale.
- A promise that opts into "expect at least every X" needs attention after a
  quiet window; one that does not, does not.
