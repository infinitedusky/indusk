---
title: "Recording never waits for a person to think of it"
date: 2026-10-08
status: complete
---

# Recording never waits for a person to think of it — Research

## Question

What has to be true for a promise broken in production to become an incident, with its owner reopened, without anyone running a command; and for an incident left open to keep being heard until it is fixed?

## Background

Found during the local smoke on numero-workbench (Sandy, 2026-10-02), and moved out of day-always-on-deploy's brief on the same day so each piece could run at its own size. `indusk promises watch` is one pass, not a watcher: an incident file exists only because someone ran it. Between runs a violation sits in Jaeger as *unrecorded*: visible to `promises status`, `promise_health` and Slack, but owning no incident and reopening no plan. On a laptop that is a habit; for a deployed system broken at three in the morning it means the loop stops at the Slack message.

The demo makes it concrete. Step 6 of [the demo script](../indusk-demo/master.md) is a production break that "Slack hears; the admin shows it red; `promises watch --source deployed` records the incident and the plan reopens". The 2026-10-04 decision deferred automating that because `watch` could be run by hand; on 2026-10-08 the demo master put it back as the next step, because the step is the watcher catching the break on its own, and a command typed between the break and the reopened plan is exactly what the demo must not show.

Three more things were found on the way:

- **An open incident is quiet.** `i-2026-10-05-every-commit-evaluated` has been open since 2026-10-03T21:01:44Z (five days at the time of writing). Its fix shipped in day-monitor Build Phase 10 and was never confirmed by `promises fix`. Nothing asked how long it had been open: `promise_health` reports a count of open incidents per promise, the admin's incidents table shows `status` and `date`, `promises status` shows no incidents at all, and catchup ranks only *unrecorded* violations ahead of the roadmap.
- **A reopened archived plan cannot get a worktree.** Found 2026-10-03 on the first real incident: `watch` reopens owners in the archive and `list_plans` counts such a plan as active, but `indusk worktree create day-monitor` and `assign` both refuse, "no plan named day-monitor", because `requirePlan` (`lib/worktree/plan-worktree-commands.ts`) looks only under `.indusk/planning/`. The Maintenance phase was worked in a hand-made worktree the admin and plan tools could not see.
- **`watch` commits nothing.** It writes the incident file and the owner's Maintenance phase and leaves them for the person. `indusk-leaves-main-clean` (bookkeeping-lives-where-it-is-read) now promises that nothing InDusk writes is left uncommitted; recording that happens unprompted cannot leave files in someone's working tree.

## Findings

### What runs where today

| Piece | Where it runs | What it knows | What it writes |
|---|---|---|---|
| The always-on server's pass (`lib/always-on/pass.ts`, `schedule.ts`) | the Fly instance, every `passIntervalMs` in its own process | its own Jaeger's spans carrying `indusk.promise`; no registry, no plan repository | an announce-once record on its volume; one Slack message per violation (`INDUSK_SERVER_SLACK_WEBHOOK`, a Fly secret) |
| `promises watch` (`lib/promises/watch.ts`) | a person's terminal, once | the registry, the plan folders, their worktrees (`livePlanCopy`), one source's marks (`readPromiseMarks`, `--source local|smoke|deployed`) | incident files, Maintenance phases; commits nothing |
| `promise_health` (`lib/promises/health.ts`) | the MCP tool, at catchup | every source, through `readSources`; per promise: violations, open-incident count, unrecorded traces | nothing |
| The admin's Promises page (`apps/indusk-admin/src/lib/promise-health.ts`) | the admin daemon, per request, cached for `admin.refresh_ms` (default 5 s) | the same reads; the sidebar's red is the alarm source's | nothing |

The server's own recording is out of reach: it has no registry and no plan repository, and its only sanctioned write is a reviewable PR through a GitHub connection that [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md) has yet to build. Sandy's decision (2026-10-08): the **admin records**, while it runs; the server's PR waits for the connection.

### The admin as the recorder

The admin is "the IDE of the dev system": local, next to the code, connected to the server, one per developer (2026-10-04). It already reads every registered project's sources on request. What it lacks is a **loop**: there is no `setInterval` anywhere in `apps/indusk-admin/src`; health is read when a page asks, and a page is open only while someone looks. A recorder has to run whether or not a page is open, on the admin daemon's own schedule, over every registered project that names a `production` source (`promises.jaeger`): a project with only `local` has nothing to record unprompted, because a local break is work in progress (`the-demo-break-is-caught-locally`, demo step 5).

`watchPromises(planRoot, { source: "deployed" })` is the pass to run. It is safe to repeat: a trace recorded in any incident of the promise is never counted again (`recorded()` in `incidents.ts`), an open incident is extended rather than duplicated, and a reopen that failed earlier is retried every run (watch-reopen-collision A6). One thing it does not do is commit.

### Committing what recording writes

`commitTrunkBookkeeping` (`lib/plans/bookkeeping.ts`) is how approve and land commit InDusk's own files on the trunk, in a commit of their own, and go on. Its list is `current.md`, the highlight queues, `.indusk/eval/` and `.claude/lessons/`; incident files and a reopened owner's `impl.md` are not on it, so today a recorded incident reads as "someone's real work" to the landing's uncommitted-trunk check and stops a merge. The trunk guard allows `.indusk/**` on `main`, so the commit itself is not refused.

Two cases for where the owner's Maintenance phase lands: an archived owner (its impl is on the trunk under `archive/`, nothing else edits it) and an active owner with a worktree (`watch` already writes to the worktree's copy, day-monitor A29, where the plan's own session commits it). The unprompted recorder's commit therefore covers the incident file always, and the owner's impl only when the owner is on the trunk.

### Staying loud

An incident carries `opened:` (ISO) and `last_seen:`. Nothing reads `opened` as an age:

- `promise_health` gives `incidents: <count>` per promise; catchup's rule ranks `unrecorded` and `silence` ahead of the roadmap and says nothing about an open incident's age.
- The admin's incidents table has `status` and `date` columns, no age, no owner, no link to the Maintenance phase.
- `promises status` prints marks per source and no incidents.
- Slack hears a violation once, from the server, when it is new. The server has no incidents to age, and the local side has no Slack webhook at all (the webhook is a server secret, `INDUSK_SERVER_SLACK_WEBHOOK`).

The announce-once precedent is the server's `AnnouncedRecord` (span id → when announced), written after Slack accepts, so a failed post is retried next pass. A re-announcement rule on the recorder's side needs the same shape: *when was this incident last announced*, so "once a day" survives restarts and never becomes "every pass".

### A reopened plan's worktree

`ownerDir` (`lib/promises/reopen.ts`) and `archivedInMotion` (`lib/promises/after-close.ts`) already resolve an archived owner — active wins over archived, as everywhere else — and `list_plans` lists a reopened archived plan as active with its open Maintenance phases. `requirePlan` in `plan-worktree-commands.ts` is the one reader that does not: it checks `.indusk/planning/<plan>` on the trunk or in the worktree being assigned. The fix is one resolver for "where is this plan's folder", shared with the reopen, rather than a second archive check.

### Marking the recorder

A behaviour promise asks for marks in the running system. The recorder is a loop in the admin daemon, and the precedent is the evaluator: every run marks its root span `indusk.promise = every-commit-evaluated`, upheld or violated with the reason (`lib/eval/otel.ts`, `markPromise` in `lib/promises/mark.ts`), so a failed run is read by `promises status` like any application's broken promise. A recording pass that could not read the server, could not write the incident or could not commit it should mark itself the same way, into the local daemon, so the recorder's own silence is a violation and not a quiet week.

### Blast radius

- `watchPromises`: called by the CLI (`bin/commands/promises.ts`) and tests only; the recorder is a second caller.
- `commitTrunkBookkeeping` / `isBookkeeping`: `approve.ts`, `land.ts`, `plans-land.test.ts` A32. Widening the list changes what landing commits unasked, which the test pins.
- `promiseHealth`: the MCP tool and the admin's reader. Adding open incidents with ages to its rows is additive.
- `requirePlan`: `assignPlan` and `createPlanWorktree`; `plan-worktree-fixture` tests both.
- The catchup skill: `skills/catchup.md` step 8a, resynced to `.claude/skills/`.

## Decisions

- **The admin records; the server's PR waits** (Sandy, 2026-10-08). The demo's step 6 is met by the developer's running admin; the always-on instance keeps announcing only. The GitHub connection stays with workbench-watch-provisioning.
- **Recording commits what it writes, on the trunk** (Sandy, 2026-10-08), the way approve and land commit bookkeeping; the Maintenance phase is worked on the plan's own branch afterwards.
- **An incident open longer than a day is announced again, once a day** (Sandy, 2026-10-08); every reader shows its age always.
- **The recorder is a behaviour promise** (2026-10-08): its pass marks itself in the local telemetry, so a recorder that cannot read or cannot write is its own broken promise.
- **Catchup records when the admin did not** (from the 2026-10-02 brief): a laptop that was closed has an admin that was not running; catchup running `watch` itself closes that gap and reports what it opened.

## Open Questions

- Where the daily re-announcement is heard when the project names no Slack webhook locally: catchup and the admin for certain; Slack only if a `promises.slack_webhook` (or the server) is given one. Settled in the ADR.
- The recorder's cadence (the demo wants under a minute) and how a pass that overlaps a person's own `watch` in the same checkout is kept to one writer. The ADR's.
- Whether a `local`-only project should ever record unprompted. Research says no (demo step 5); the ADR records it.

## Sources

- [day-always-on-deploy](../archive/day-always-on-deploy/brief.md), where the items were first written.
- [day-monitor](../archive/day-monitor/adr.md) D5–D9: `watch`, incidents, reopening, health.
- [watch-reopen-collision](../archive/watch-reopen-collision/brief.md): a scheduled `watch` must not silently fail to reopen.
- [watcher-heartbeat](../archive/watcher-heartbeat/adr.md): the server's heartbeat and announce-once.
- [promise-sources](../archive/promise-sources/adr.md): `local` and `production`, each failure its own.
- [bookkeeping-lives-where-it-is-read](../archive/bookkeeping-lives-where-it-is-read/adr.md): `indusk-leaves-main-clean`.
- [the demo script](../indusk-demo/master.md), steps 5 and 6.
