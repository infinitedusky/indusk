---
title: "Recording never waits for a person to think of it"
date: 2026-10-08
status: accepted
---

# Recording never waits for a person to think of it

## Goal

**A promise broken in production becomes a committed incident, reopens its plan, and is in front of the developer's agent and admin, with nobody running a command.**

Today `indusk promises watch` is one pass, typed by a person. Between runs a production violation sits in Jaeger as *unrecorded*: Slack heard it once, the admin shows it red while someone looks, and nothing writes it down or reopens the plan that owns it. The demo's step 6 is that moment with nothing typed. The same gap lets an incident stay open unnoticed: `i-2026-10-05-every-commit-evaluated` was open five days when this plan started, and no reader asked how long.

## Y-Statement

**In the context of:**
a solo developer running a local admin next to the code, connected to an always-on server that holds the production Jaeger; a server that announces to Slack but has no registry and no plan repository; readers (catchup, `promise_health`, `promises status`, the admin) that all ask Jaeger and never write; and a demo whose step 6 must show the loop closing on its own

**Facing:**
recording needs the plan repository, which only the developer's machine has; a laptop has no address a server can call; Jaeger answers questions and announces nothing; anything InDusk writes must be committed (`indusk-leaves-main-clean`); two writers of one incident collide; and a running session hears nothing until its next catchup

**We decided for:**
one recording writer in the package — the `watch` pass plus the commit, the agent's inbox, the admin's record and the pass's own mark — run on a timer inside the admin daemon for every registered project that names a production source, asking the production Jaeger on the admin's refresh interval; the same writer behind a catchup tool and the hand command; a prompt-time hook that puts the inbox in front of the agent; open incidents with their age in every reader and announced again daily; and a worktree resolver that knows a reopened archived plan

**And against:**
the server recording by pull request (no GitHub connection yet; workbench-watch-provisioning's); a subscription from the server to the laptop (no sooner than the server's own pass, and still needs the asking after a disconnect); a separate recorder daemon (one more process to keep alive and stop); a database (Jaeger, markdown and JSON lines in the home already hold the three kinds of fact); a hook on every tool result (noisy and per-call) or only at session start (a running session would not hear)

**To achieve:**
the demo's step 6 with nothing typed; incidents that are written down and reopen their plan within a minute while the admin runs, and at the next catchup when it did not; an agent that hears about a break on its next turn; and open incidents that stay loud until they are fixed

**Accepting:**
that recording happens only while a developer's admin is running (the server still only announces); that the admin daemon now does work with no page open; that `watch` by hand commits, where it did not; that one more hook runs on every prompt; and a polling cadence of five seconds against the production Jaeger, about 17,000 small requests a day per project

**Because:**
the admin is already the one local process that is always on, holds the credential and reads every source; a writer shared by three callers is the only way one break makes one incident; and asking every five seconds puts a break on the laptop within ten seconds, which is what the demo needs and what a subscription would not improve on

## Context

The research ([research.md](research.md)) lays out the four pieces that run today and what each knows: the server's pass (its Jaeger, no registry, Slack), `watch` (everything, once, commits nothing), `promise_health` and the admin (read-only, on request). Sandy's decisions on 2026-10-08: the admin records; it commits; open past a day is announced daily; the admin asks and nothing pushes; no database; the break reaches the working agent and the admin keeps what it heard; the chart stays with plan-cockpit. The brief ([brief.md](brief.md)) holds the six promises; the test plan ([test-plan.md](test-plan.md)) the 26 assertions this decision has to make true.

## Decision

**D1. One writer, in the package.** `lib/promises/record.ts` exports `recordBreaks(planRoot, { source, now, clock, reads, git, home })`: it runs `watchPromises` over the `production` source, commits what was written (D3), appends to the inbox (D5) and the heard record (D6), writes any due reminders (D7), and marks the pass (D4). It takes its clock and its reads as inputs, so A1–A4, A8, A14, A17, A20 and A23 are units. Three callers: the admin's loop (D2), the `record_breaks` MCP tool catchup calls (D8), and `indusk promises watch`, which becomes a thin call to it (A24). One file lock per project in the home (`recorder.lock`, through `lib/agents/lock.ts`, the one lock implementation) keeps the three to one pass at a time (A4); a caller that finds the lock held waits for it and then runs, so nothing is skipped.

**D2. The admin daemon runs it.** Next 16's `instrumentation.ts` `register()` runs once when the daemon starts, in the Node runtime; it starts one loop per registered project that names `promises.jaeger`, on that project's `admin.refresh_ms` (5 s default, floor 1 s), the interval its pages already refresh on. A project naming no production source gets no loop: a local break is work in progress (A23). The loop is the server's `startPass` shape: an in-process guard so a slow pass is never overlapped, a thrown pass logged and the interval kept. The watcher probe (watcher-heartbeat) runs on its own cadence, once a minute, with the reads between trusting the last probe; a blind or unreachable source makes the pass mark itself broken (D4) and record nothing. `ui stop` ends the loops with the daemon.

**D3. The writer commits.** `recordBreaks` commits the paths it wrote on the trunk: the incident file, and the owner's `impl.md` when the owner's folder is on the trunk (an archived owner, or an active owner with no worktree), in one commit `chore(indusk): incident <id> — <promise>, recorded by <admin|catchup|watch>`, by path, the way `commitTrunkBookkeeping` commits. When the owner is being worked in a plan worktree, the Maintenance phase goes into that worktree's copy (as `watch` writes it today, day-monitor A29) and is left for the plan's session to commit (A2). `isBookkeeping` gains `.indusk/promises/incidents/`, so an incident recorded by hand and left uncommitted no longer stops a landing (A24).

**D4. The pass marks itself.** Each pass marks a root span `indusk.promise = a-production-break-is-recorded-unasked` through `markPromise`, exported to the local daemon the way the evaluator's marks are (`initEvalOtel`): `upheld` when it recorded or had nothing to record, `violated` with the reason when the source could not be read, was blind, the incident could not be written or the commit failed (A3). The promise declares no `expect_every`: an admin that is not running is not a broken recorder, and catchup records in its place (D8). `promises status` reads the recorder like any promise (A7).

**D5. The agent's inbox and its hook.** The writer appends one line per opened or extended incident, and per reminder (D7), to `~/.indusk/projects/<id>/inbox.jsonl`: `{ id, at, kind: "break" | "reminder", promise, incident, owner, phase }`. A new hook, `hooks/break-inbox.js`, registered on `UserPromptSubmit` (once per turn, before the model reads the prompt), reads the undelivered entries for the project the session is in (the state root from `_hook-paths.js`, the home from the project id), prints them as `hookSpecificOutput.additionalContext` — "a promise broke in production: `<promise>`, incident `<id>`, `<owner>` reopened with `<phase>`; it outranks the roadmap" — and marks them delivered by appending to `inbox-delivered.jsonl`, so a later turn repeats nothing (A18). It exits 0 in under 100 ms with nothing to say, and says on its own line when the inbox cannot be read. `HOOK_REGISTRATIONS` gains the row with an empty matcher; the registration pin from small-fixes learns the event. The VS Code extension reads the same file.

**D6. The admin's record.** The writer appends one line per violation it heard to `~/.indusk/projects/<id>/heard.jsonl`: `{ at, promise, trace, incident, source }`, never a trace twice (A20). `lib/promises/heard.ts` reads it and counts per promise per bucket; the admin's promise page draws its counts from the record, and keeps showing it when the production source is down, marked "as of <last heard>" (A21, A22). The bar chart of checks is plan-cockpit's; this record is what it will count.

**D7. Reminders.** Each pass compares every open incident's `opened` with now; one open longer than a day whose last reminder (`~/.indusk/projects/<id>/announced.json`, `{ [incident]: iso }`) is older than a day gets an inbox `reminder` line and, when the project names `promises.slack_webhook_env`, a Slack message through the same post the server uses; the time is written after the post is accepted, as the server's announce-once record is. A fixed incident gets none (A14).

**D8. Every reader shows age.** `promiseHealth` gains `openIncidents: [{ id, promise, owner, openedAt, ageMs, ownerHasPhase }]` (A10); `promises status` prints them first (A11); the admin's incidents table gains an age column and a link to the owner's Maintenance phase (A12). A new MCP tool, `record_breaks`, runs the writer for the project and answers with what it opened; the catchup skill's step 8a calls it when `promise_health` reports unrecorded production violations and puts open incidents, with ages, ahead of the roadmap (A8, A9, A13).

**D9. A reopened plan's worktree.** `requirePlan` in `plan-worktree-commands.ts` resolves the plan the way `reopen.ts` does: an active folder, else an archived one — and an archived plan is accepted only when `openMaintenancePhasesIn` finds an open phase; otherwise the refusal says it is archived and reopens through an incident (A15, A16). `list_plans` and the admin already read a reopened plan's assigned worktree.

**D10. Polling, not a subscription.** The admin asks; the server does not push. Pub/sub (a fan-out in the server's collector pipeline and a subscription endpoint the admin connects to) is the upgrade, triggered by wanting seconds instead of five, or by several subscribers — the multi-developer work deferred 2026-10-04. Nothing on the laptop side changes when it comes.

## Alternatives Considered

### The server records, by pull request
Needs the GitHub connection and a clone of the plan repository on the instance; workbench-watch-provisioning's. Deferred, not rejected: it reuses D1's writer.

### A subscription from the server to the laptop
The server's own pass polls its Jaeger, so a pushed violation arrives no sooner; a subscriber that was away must ask "since my cursor" anyway. Rejected for now, with its trigger (D10).

### A separate recorder daemon
`indusk recorder start`: one more process to start, identify and stop, on a machine where the admin is already always on. Rejected.

### A database for what was heard
Jaeger holds what happened, markdown what was decided, JSON lines in the home what this machine heard. A shared store earns its place with several machines, and belongs on the server then. Rejected.

### A hook on every tool result, or at session start only
`PostToolUse` fires per tool call and would repeat or cost on every call; `SessionStart` would leave a running session deaf. `UserPromptSubmit` fires once per turn. Chosen.

## Consequences

### Positive
- Demo step 6 with nothing typed; a break is on the laptop within about ten seconds.
- One writer: the hand command, catchup and the admin cannot disagree or double-record.
- Open incidents are visible with their age everywhere, and nagged daily.
- A reopened plan is worked like any other.

### Negative
- Recording depends on a running admin; a developer who never opens it records only at catchup.
- `watch` by hand now commits, which a person running it to look first may not expect; it says what it committed.
- One more hook on every prompt, and a loop in the admin daemon with no page open.

### Risks
- The prompt hook slows every turn: it reads one small file and exits; A18 holds it under 100 ms, and an unreadable inbox is said, not skipped.
- The admin daemon writes to a trunk a person is editing: the commit is by path, only the files the writer wrote, with the project's lock held; `uncommittedWork` already refuses anything else.
- Reminder noise: once a day per incident, and only past a day open.

## Documentation Plan

### Pages
- New: `decisions/incident-recording.md` — this ADR's summary.
- Update: `reference/cli/promises.md` — `watch` commits; `status` lists open incidents with age; the recorder.
- Update: `reference/tools/indusk-mcp.md` — `promise_health`'s `openIncidents`; `record_breaks`.
- Update: `reference/admin-ui/promises.md` — the recorder, the record, the incidents table.
- Update: `reference/skills/catchup.md` — step 8a records and ranks open incidents.
- Update: `guide/index.md` hooks table (nine hooks) and the Dawn master's keep/shed record (`hooks-record-parity` pins both).
- Update: `reference/cli/worktree.md` — a reopened archived plan.

### Diagrams
- One Mermaid sequence in `decisions/incident-recording.md`: the server's Jaeger, the admin's loop, the writer, the trunk commit, the inbox, the hook, the agent.

### Changelog
- Added: the admin records production breaks unasked; `record_breaks`; the break inbox and its hook; open incidents with age everywhere, reminded daily; worktrees for reopened plans.
- Changed: `promises watch` commits what it writes.

### ADR in Docs
- Yes: `decisions/incident-recording.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [day-monitor](../archive/day-monitor/adr.md) D5–D9; [watch-reopen-collision](../archive/watch-reopen-collision/adr.md); [watcher-heartbeat](../archive/watcher-heartbeat/adr.md); [promise-sources](../archive/promise-sources/adr.md); [bookkeeping-lives-where-it-is-read](../archive/bookkeeping-lives-where-it-is-read/adr.md); [small-fixes](../archive/small-fixes/impl.md) (`HOOK_REGISTRATIONS`)
- [workbench-watch-provisioning](../workbench-watch-provisioning/brief.md); [the demo](../indusk-demo/master.md)
