---
title: "Recording and handling never wait for a person to think of it"
date: 2026-10-02
status: draft
workflow: feature
---

# Recording and handling never wait for a person to think of it — Brief

*Moved verbatim on 2026-10-02 from [day-always-on-deploy's brief](../day-always-on-deploy/brief.md), where it was written, so each piece can run at its own size; item numbers restarted.*

## Problem and direction

Found during the local smoke on numero-workbench (Sandy, 2026-10-02).
`indusk promises watch` is one pass, not a watcher: an incident file exists
only because someone ran it. Between runs a violation sits in Jaeger as
*unrecorded* — visible to `status`, `promise_health` and Slack, but owning no
incident and reopening no plan. On a laptop that is a habit; for a deployed
system broken at three in the morning it means the loop stops at the Slack
message. The server still never writes to the repository; the gap is that
nothing else does either unless a person remembers to.

1. **Recording runs on a schedule on the always-on instance, through one
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
2. **Locally, catchup records instead of suggesting.** When `promise_health`
    reports unrecorded violations, `/catchup` runs `watch` itself and reports
    what it opened, rather than telling the user to run it.
3. **An open incident stays loud until it is handled.** Recording is
    mechanical; fixing is judgement, and stays agent work through the
    Maintenance phase. What must not happen is an incident that is recorded
    and then forgotten: catchup, `promise_health` and the admin show each open
    incident with its age and its owner's Maintenance phase; open incidents
    rank above the roadmap as unrecorded violations already do; and one open
    past a threshold is announced again. A session-start hook may guarantee
    the reading happens; it never does the fixing.

Open for the test plan: the re-announce threshold.

The local half (items 2 and 3) needs nothing deployed and can start first; the
scheduled recording PR (item 1) needs a deployed instance and the GitHub
connection from [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).

## Success criteria

- A violation on the deployed system becomes an incident and a Maintenance
  phase in a pull request, opened by the always-on instance's own schedule,
  without anyone running `watch` by hand.
- Locally, catchup records unrecorded violations itself and says what it
  opened.
- An incident left open past the threshold is announced again, and every
  reader shows its age.

## Depends on

- [watcher-heartbeat](../watcher-heartbeat/brief.md).
- For item 1: [day-always-on-deploy](../day-always-on-deploy/brief.md) and
  [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md).
- [watch-reopen-collision](../watch-reopen-collision/brief.md) — a scheduled
  `watch` must not silently fail to reopen an owner.
