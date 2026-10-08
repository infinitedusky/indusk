---
title: "Recording never waits for a person to think of it — Test Plan"
date: 2026-10-08
status: draft
---

# Recording never waits for a person to think of it — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names its level — unit / contract / live check / smoke / promise, the smallest that can prove it — and so when its test runs. They are grouped by the promise in the brief that they prove. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. The ADR that follows this document is constrained by "what makes all these assertions true?" rather than invented from intuition.

## Behavioral Assertions

**Every assertion must be observable from outside the system.** Describe what the user sees, what the API returns to a caller, what an external observer measures — never internal function calls, return types, or method signatures.

### `a-production-break-is-recorded-unasked` — while the admin is running, a production break becomes a committed incident and reopens its owner, within a minute, with nobody running a command

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A recording pass over a project's production source that holds a new violation leaves an incident file naming that trace and a Maintenance phase for it in the owner's impl; a second pass over the same source leaves both exactly as they were | unit |
| A2 | What a pass records is committed on the trunk in a commit of its own, named as InDusk's, and the working tree is clean afterwards; when the owner is being worked in a plan worktree, its Maintenance phase is written in that worktree's copy and left for the plan's own session to commit | unit |
| A3 | A pass that cannot read the server (unreachable, or a watcher that is blind) or cannot write the incident records nothing and marks itself broken in the local telemetry with the reason; a pass that recorded, or found nothing to record, marks itself held | unit |
| A4 | A person's own `watch` run at the same moment as a recording pass, in the same checkout, produces one incident, not two | unit |
| A5 | With the admin running and no page open, a violation marked in a project's production source is recorded within a minute, with nothing typed | contract |
| A6 | In the demo project, with the admin running, flipping the deployed fault switch puts the committed incident and the reopened plan on screen with nothing typed; recorded once with the time it took | live check |
| A7 | In production use, every recording pass that follows a violation ends within a minute of it, or marks itself broken; `promises status` reads the recorder's marks like any other promise's | promise |

### `catchup-records-what-it-finds` — catchup records what the admin did not, and says what it opened

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | Asked to record, catchup's tool opens the incidents for every unrecorded production violation, commits them, and answers with what it opened: each incident's id, promise and owner; asked again it answers that nothing was unrecorded | unit |
| A9 | The catchup skill directs the agent to record unrecorded production violations and report what it opened, and nowhere tells the person to run `watch` themselves | unit |

### `an-open-incident-stays-loud` — every reader shows an open incident's age and its owner's Maintenance phase, ahead of the roadmap; open past a day, it is announced again daily

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A10 | `promise_health` lists each open incident with its id, how long it has been open, its owner, and whether the owner carries its Maintenance phase; an incident whose owner carries none is said so, never hidden | unit |
| A11 | `indusk promises status` prints the open incidents, with age and owner, before any source's counts | unit |
| A12 | The admin's promise page shows each open incident's age and links to its owner's Maintenance phase; a fixed incident shows when it was fixed | unit |
| A13 | The catchup skill puts open incidents, with their ages, ahead of the roadmap alongside unrecorded violations | unit |
| A14 | An incident open longer than a day is announced again — in the agent's inbox, and in Slack when the project names a webhook — once a day and not again the same day, across restarts of the admin; fixing it ends the announcements | unit |

### `a-reopened-plan-can-be-worked` — a plan reopened from the archive gets a worktree like any other

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A15 | `indusk worktree create <plan>` for an archived plan with an open Maintenance phase creates its worktree and records the assignment; `assign` accepts a worktree made another way; `list_plans` and the admin then read the plan from that worktree | unit |
| A16 | `indusk worktree create <plan>` for an archived plan with no open Maintenance phase is refused, saying the plan is archived and how it reopens | unit |

### `a-break-reaches-the-working-agent` — a running session hears about a break on its next turn, by name

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A17 | When a pass opens or extends an incident, the project's inbox gains an entry naming the promise, the incident and the reopened plan | unit |
| A18 | On the next turn of a session in that project, the hook puts every undelivered inbox entry in front of the agent and marks it delivered, so a later turn does not repeat it; a session in another project sees nothing; an inbox that cannot be read is said so rather than skipped | unit |
| A19 | Claude Code delivers the hook's text to the model on the prompt after the entry was written: a session that asks "what is next" names the broken promise first, without a catchup | contract |

### `the-admin-keeps-what-it-heard` — the admin keeps its own record of every production violation it heard

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A20 | Each pass appends what it heard to the project's record — per violation: when it happened, the promise, the trace, the incident it belongs to — and a pass that heard nothing appends nothing; the record never holds a trace twice | unit |
| A21 | The promise page counts a promise's violations over time from the record, including those heard while no page was open and those older than what the production source still holds | unit |
| A22 | While the production source cannot be read, the page still shows the record, marked as of when the admin last heard, never as zero | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A23 | A break seen only by the local daemon, with production quiet, is never recorded unprompted and reopens nothing, however many passes run | unit | `the-demo-break-is-caught-locally` must not break: a local break is work in progress (demo step 5) |
| A24 | `indusk promises watch` run by hand commits what it wrote, the same way the recorder does, and says what it committed; a landing with a recorded incident on the trunk is not stopped by it | unit | `indusk-leaves-main-clean` must not break: the recorder, catchup and `watch` share one writer, and that writer commits |
| A25 | An incident the recorder opens names the tests that were proving the promise, as a hand-run `watch` does | unit | `an-incident-names-its-tests` must not break |
| A26 | In a workbench, the recorder reads the repo's promises through the same resolver as every other reader and writes the incident where that resolver says, never to a copy of its own | unit | `a-project-has-one-contract` must not break |

## Untestable Assertions

None: the one claim no test proves on this machine — a minute, in production, over a real network — is held by A7 as a promise the watcher reads, and A6 records it once.

## Notes

- A5 is `contract` because its subject is the admin daemon's lifecycle (a `next start` process running the recorder with no page open): it belongs in the system tier, at landing and release. Everything A5 proves about *recording* is proven by A1–A4 as units.
- A19 is `contract` because the thing not owned is Claude Code's hook delivery; it runs with the other e2e probes (`pnpm e2e`), the way the nested-context probe does.
- A14's "once a day, across restarts" means the recorder keeps when it last announced each incident, the way the server's announce-once record does; the ADR decides where.
- A24 changes what `watch` has documented since day-monitor ("writes plan documents, commits nothing"); the docs reference for `promises watch` changes with it.
- The hook A18 names runs on an event the existing hook table does not register (every prompt rather than a tool call); the registration table from small-fixes gains the event, and its parity pin with it.
