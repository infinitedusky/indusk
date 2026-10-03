---
title: "Always-on deploy — run the server somewhere real"
status: accepted
date: 2026-09-20
workflow: bugfix
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
6. **Show the promise's history as a timeline** (Sandy, 2026-10-03: the
   deploy has to demonstrate its value visually). On the admin's Promises
   page, one row per promise: time left to right, a green mark for every
   upheld run and a red one for every violation, each incident a band from
   the time it opened to the time it was fixed — the uptime chart a status
   page shows. The data already exists: every evaluation marks its span
   upheld or violated in Jaeger, and `promises status` reads both; what is
   missing is a reader that returns every mark with its time (today
   `readPromiseMarks` keeps every violation but only the newest upheld) and
   the chart. It belongs to this plan rather than beside it because the
   deployed server is where the history lasts: the local daemon keeps traces
   in memory and loses them on restart, while the server keeps them on its
   volume — a timeline read from the deployed Jaeger shows weeks, not the
   hours since the last restart. Only a promise whose code emits marks has a
   line; a hollow promise says so rather than drawing an empty row as health.

   **Grouped and collapsible** (Sandy, 2026-10-03). The rows group two ways,
   chosen on the page: **by plan** — every promise a plan owns under that
   plan — or **by domain**. A group collapses to one summary row, its runs
   combined so a red anywhere in the group shows red at that time, and opens
   to its promises; a promise opens to its own timeline and incidents. A
   viewer starts at "is anything broken, and where" and drills down to which
   promise and when.

   **A red stays visible until it is fixed, whatever the window** (Sandy,
   2026-10-03). A busy display may show only the last twelve hours, and a
   violation older than that would scroll off and leave the row looking
   green. So the window decides what is drawn, never what is reported:
   a promise with an **unfixed** violation — an open incident, or a violation
   not yet recorded as one — carries an unfixed marker on its row and on
   every group above it, naming how long ago it broke ("violated 2 d ago —
   open"), until the incident is fixed. The marker comes from the incident's
   state, not from the marks inside the window, so no window length can hide
   it.

   First real data to show: `every-commit-evaluated` — red through the
   evening of 2026-10-02 (`i-2026-10-03-every-commit-evaluated`), green from
   05:40 on 2026-10-03.

## Split out on 2026-10-02

Items 6–14, added here on 2026-10-01 and 2026-10-02, moved verbatim to their
own plans so this one stays the smallest plan that verifies the two artifacts:
[watcher-heartbeat](../watcher-heartbeat/brief.md) (the watcher proves it is
watching), [incident-recording](../incident-recording/brief.md) (recording and
handling never wait for a person) and
[workbench-watch-provisioning](../workbench-watch-provisioning/brief.md) (an
instance per workbench, a GitHub connection at creation).

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
- The admin's Promises page shows each marked promise's upheld and violated
  runs over time, read from the deployed Jaeger, with incidents as bands —
  and after the procedure's break-and-recover step, the chart shows the red
  and the return to green.
