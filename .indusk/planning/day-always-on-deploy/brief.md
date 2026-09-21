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
