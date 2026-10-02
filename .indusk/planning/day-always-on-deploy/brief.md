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

## Added 2026-10-02: recording and handling never wait for a person to think of it

Found during the local smoke on numero-workbench (Sandy, 2026-10-02).
`indusk promises watch` is one pass, not a watcher: an incident file exists
only because someone ran it. Between runs a violation sits in Jaeger as
*unrecorded* — visible to `status`, `promise_health` and Slack, but owning no
incident and reopening no plan. On a laptop that is a habit; for a deployed
system broken at three in the morning it means the loop stops at the Slack
message. The server still never writes to the repository; the gap is that
nothing else does either unless a person remembers to.

10. **Recording runs on a schedule on the always-on instance, through one
    reviewable writer** (Sandy, 2026-10-02: the schedule runs on the Fly
    instance). Beside the announce pass, the instance runs
    `indusk promises watch --source deployed` against its own Jaeger on a
    timer and lands what it wrote — incidents, the promise's incident list,
    the owner's Maintenance phase — as a **pull request** to the plan
    repository. This amends the guide's "the server never writes back": it
    still never writes to a branch anyone works on and never commits behind a
    person's back; its only write is a reviewable PR. `watch` is already safe
    to repeat (a recorded trace is never counted twice; an open incident is
    extended, not duplicated), so the schedule can be tight — but the PR must
    be too: one open recording PR per workbench, updated in place, never one
    per pass.
11. **Locally, catchup records instead of suggesting.** When `promise_health`
    reports unrecorded violations, `/catchup` runs `watch` itself and reports
    what it opened, rather than telling the user to run it.
12. **An open incident stays loud until it is handled.** Recording is
    mechanical; fixing is judgement, and stays agent work through the
    Maintenance phase. What must not happen is an incident that is recorded
    and then forgotten: catchup, `promise_health` and the admin show each open
    incident with its age and its owner's Maintenance phase; open incidents
    rank above the roadmap as unrecorded violations already do; and one open
    past a threshold is announced again. A session-start hook may guarantee
    the reading happens; it never does the fixing.

13. **Every workbench gets its own always-on instance, provisioned when the
    workbench is created** (Sandy, 2026-10-02). `indusk init --workbench`
    (and its equivalents) stands up the instance — volume, secrets, the
    announce + recording schedule — and writes `promises.jaeger` (URL +
    `credential_env` name, never the credential) into the new workbench's
    config, so a workbench is watched from its first commit rather than from
    whenever someone remembers to deploy. One instance per workbench keeps
    each one's traces, announcements and recording PRs scoped to one plan
    repository.
14. **The instance reaches the plan repository through a GitHub connection
    made at workbench creation** (Sandy, 2026-10-02: "connect to GitHub").
    Creation includes a connect-to-GitHub step that grants the instance access
    to that workbench's plan repository and nothing else; the instance opens
    its recording PR through that connection, never through a person's token.
    The permissions are the minimum a PR needs — push its own recording
    branch, open/update a pull request, read metadata — and because a GitHub
    write permission cannot be narrowed to one branch, the plan repository's
    protected branches must refuse a direct push from the connection, so the
    PR stays its only path in.

Open for the test plan: the connection's shape (a GitHub App installation,
whose short-lived tokens and per-repo install fit "this repo only", vs. a
fine-grained token), the re-announce threshold, how
creation behaves without a Fly account or Slack workspace (refuse by name vs.
create the workbench unwatched and say so), and the cost of one instance per
workbench.

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
- A violation on the deployed system becomes an incident and a Maintenance
  phase in a pull request, opened by the always-on instance's own schedule,
  without anyone running `watch` by hand.
- Creating a workbench provisions its always-on instance and points the new
  workbench's `promises.jaeger` at it.
- The instance's GitHub connection can open and update its recording PR on
  its own workbench's plan repository, and a direct push to a protected branch
  through that connection is refused.
- An incident left open past the threshold is announced again, and every
  reader shows its age.
