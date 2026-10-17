---
title: "The daemon is found, not guessed"
date: 2026-10-16
status: complete
workflow: feature
---

# The daemon is found, not guessed — Research

Child 1 of seven in [telemetry-from-day-one](../telemetry-from-day-one/master.md), the parent made on
2026-10-16 after the cold audit of [`mark-first`](../mark-first/research.md) ("Audit against the goal
(2026-10-16)"; that research is committed on branch `plan/mark-first`, not yet on trunk). Blocked by nothing;
shares no code with `run-the-master`, the plan that has a master plan run its own phases as a graph. Every
file:line is on trunk (`/Users/the_dusky/code/sandbox/dusk`) unless a path says otherwise; every machine fact
was read on 2026-10-16 with `ls`, `ps` and `lsof`, and nothing was started, stopped or written. "The judge"
below is the reader in that audit that weighed three independent plan-structure proposals into one synthesis.

## Question

How does the local telemetry daemon — Jaeger and a collector, run by the `local-telemetry` extension — become
the one daemon every reader of promises (`promises status`, the admin, the editor, the evaluator, plan
closing), every InDusk command and an application on this machine agree on: found when its record is gone,
never started beside a running one, never re-pointing other projects, recoverable by its own commands, with a
readable log and a logs port something binds?

## Background

**Why this plan, why now.** Sandy's goal of 2026-10-16: telemetry integral to a project built with InDusk from
day one, promises breaking in production as part of how the system works, decisions eventually taken from
expectations and measurements — proved on Homework Gate, not on InDusk. The audit found `mark-first` sound for
how InDusk *reads* a signal and silent on what a new project is handed; of its 41 gaps, five block Homework
Gate's day one and three of those are the daemon — in the audit's numbering, G11: the daemon the readers follow
is not one of the three running here; G31: the auto-start on `init` spawns a new one with bumped ports whenever
the record reads "not running" and re-points every registered project; G32: no InDusk command can recover the
state InDusk itself made, and a read can delete the record. D2 in `mark-first`'s
proposed ADR, the decision that closing asks the local daemon whether each clause's signal reported, would
refuse every close on this machine until that is fixed by hand; row A11 in its test plan, the live check that
a signal through the local daemon reads upheld end to end, cannot run here. Homework Gate's own creation on
2026-10-12 spawned the third Jaeger. So this plan is first: the signal `mark-first` reads has first to be
written to a daemon that can be found.

**What exists.** The extension is required by default
(`apps/indusk-mcp/extensions/local-telemetry/manifest.json:4`); its `on_enable` hook runs `indusk telemetry
register $(pwd)` (`manifest.json:19`). The daemon is two detached native binaries — Jaeger 2.17.0 (an OTel
Collector 0.148.0 distribution, per the `service@v0.148.0` prefix on its log lines) for traces, otelcol
0.150.1 for a logs-only pipeline to a JSONL file (`packages/telemetry-binaries-shared/UPSTREAM.json`;
`apps/indusk-mcp/src/lib/telemetry/daemon.ts:7-32`). Its identity is three files under `~/.indusk/`:
`telemetry.pid`, `telemetry.json` (both PIDs, every port, binaries, start time) and `telemetry.log`
(`daemon.ts:12-21`; `status.ts:23-34`). The archived ADR chose this on 2026-04-20
(`.indusk/planning/archive/local-telemetry/adr.md`, decisions 2, 4, 9): machine-global, auto-started on the
first enable, stopped on the last disable. What is wrong with it is the Findings, one per topic.

## Findings

### The record is the daemon's only identity, and a read deletes it

`daemonStatus()` returns not running when `telemetry.pid` or `telemetry.json` is absent (`status.ts:128-131`)
and never reads the process list. With both present it runs an identity gate — each PID alive *and* its port
answering (`status.ts:99-102, 140-142`) — and on any failure calls `cleanupFiles()`, which removes both files
(`status.ts:104-108, 143-146`). The probe is a 500 ms connect on the caller's own event loop, tried twice
since 2026-10-05 (commit `b7f82bf98`; `status.ts:66-81`): a loop held by other work reads a listening port as
closed, and the docblock says so; the deletion dates from 2026-09-19 (commit `383ca2ea4`). Nothing writes the
record but `daemonStart` (`daemon.ts:500-501`), so a deleted record stays gone until a start — which, as the
finding on `register` below shows, starts a new daemon rather than finding the old one.
`.indusk/planning/known-issues.md:140-154` records the sweep, names the fix (`isOwnProcess` by command line,
as `stop` does since 2026-10-07, `stop.ts:5-17`) and says "fix the port check first" (Sandy, 2026-10-09).

### Every reader follows the record, and this machine's readers get four answers

Every promise reader resolves the local source through `daemonStatus()` and throws `JaegerUnreachable("no
telemetry daemon is running")` on not running: `promises status`, `promises watch`, `promise_health`, the
admin and catchup through `resolveLocal` (`src/lib/promises/sources.ts:99-112`), the span reader
(`src/lib/promises/telemetry.ts:339-345`), look standing (`src/lib/promises/look-standing.ts:263-266`).
`promises status` exits 2 when the local source is the alarm source (`src/bin/commands/promises.ts:113-121`) —
Homework Gate's case. The advice, "Start the daemon with `indusk telemetry start`" (`sources.ts:388-390`),
refuses here. The editor runs `indusk promises health --json --every 5`
(`apps/vscode-extension/src/extension.ts:26`) and the admin imports `promises/sources`
(`apps/indusk-admin/src/instrumentation.ts:29`), so both read the same path. The evaluator reads the record
synchronously (`src/lib/eval/otel.ts:78-82`; `status.ts:118-126`); `update` syncs the `jaeger` MCP URL only
when the record reads running (`src/bin/commands/update.ts:507-526`); both extension health checks exit 1
without `telemetry.json` and name no process (`manifest.json:7-16`).

On 2026-10-16 those readers disagree four ways. An application exporting to the documented
`http://localhost:4318` reaches jaeger PID 60080, which holds `*:4318` and `*:16686`. The `jaeger` MCP server
in this repository's and Homework Gate's `.mcp.json` is `http://localhost:54677/mcp` (`.mcp.json:13-16`;
`/Users/the_dusky/code/sandbox/homework-gate-workbench/.mcp.json`), held by jaeger PID 69702 — another Jaeger
with another in-memory store. Every promise reader says no daemon is running, because the record does not
exist. The evaluator falls back to a no-op logger: `~/.indusk/projects/*/eval/system.log` holds 2,303 lines
"endpoint unset", beside 422 runs that exported to `:60735` (jaeger 68711's OTLP port), 232 to `:4318` and 22
to `:54678` (jaeger 69702's) — the record named each daemon for a while, then none.

### How this machine got three Jaegers and four collectors

| PID | binary | started | listening | started from |
|---|---|---|---|---|
| 68711 | jaeger | 2026-10-08 22:06:12 | 60729–60736 | dusk's `node_modules` (binaries 1.28.0) |
| 60080 | jaeger | 2026-10-11 21:06:42 | **4318**, **16686**, 60910–60915 | same |
| 69702 | jaeger | 2026-10-12 21:19:53 | 54672–54679 (MCP 54677, OTLP 54678, UI 54679) | same |
| 50723 | otelcol | 2026-10-02 13:25:38 | 49541–49542 | the mise global install of `indusk-mcp` |
| 68712 / 60081 / 69741 | otelcol | with their Jaegers | 60732–60733 / 60913–60914 / 54675–54676 | dusk's `node_modules` |

All seven carry `--config` paths at `~/.indusk/telemetry-{jaeger,collector}.yaml`, both of which exist (mtime
2026-10-12 21:19, the last start's rendering). Nothing listens on 4319. The daemon log tells the sequence by
Jaeger's `service.instance.id`: four starts on 2026-10-01/02, each after a clean "Starting shutdown"; on
2026-10-08 22:06:12 a start with no shutdown before it — a second Jaeger beside the 2026-10-02 one, which the
log shows alive until its clean shutdown on 2026-10-11 21:06:38, four seconds before PID 60080 started on
4318/16686 (the shape of `telemetry restart`, `daemon.ts:535-566`); on 2026-10-12 21:19:53 a third start, the
same second Homework Gate's workbench was registered (`~/.indusk/telemetry/projects.json`:
`2026-10-13T01:19:53.321Z`, UTC−4). A start beside a live Jaeger happens only through the auto-start's bump or
`--allow-port-bump`, so twice `daemonStatus` read "not running" with a Jaeger alive. Which read deleted the
record is not logged, and why the 2026-10-11 stop left the 2026-10-02 collector is not determinable (moderate
confidence on the sequence; the instance ids are the only thread). This corrects `known-issues.md:147-154`,
which reads 2026-10-08 as a Jaeger "killed with no shutdown line, restarted 35 s later": the 2026-10-02
instance lived on.

### `register` on `init` starts a daemon beside a running one and re-points every project

`init` and `update` call `autoEnableExtensions` (`src/bin/commands/init.ts:1209-1210`; `update.ts:719-720`),
which skips an enabled extension (`extensions.ts:637`) and otherwise fires `on_enable` (`extensions.ts:169,
184`) — so a *new* project, and the admin's new-project flow through `init --workbench`
(`src/lib/new-project/create.ts:390-404`), reaches `telemetryRegister`. When the record reads not running it
calls `daemonStart({ allowPortBump: true })` "on purpose" (`src/bin/commands/telemetry.ts:257-266`), which
skips the guard (`daemon.ts:352-353`) and lets `findFreePort(4318)` fall to a random port (`daemon.ts:116-120,
398`), then rewrites the `jaeger` entry of every registered project whose path exists (`telemetry.ts:36-55,
276-287`; `src/lib/mcp-config.ts:86-95`). The registry holds 2,681 projects of which 18 paths exist (2,669 are
temp directories, `known-issues.md:164-169`), so 18 files were rewritten on 2026-10-12, not 2,681 as the
audit's prose says. `.mcp.json` is untracked on trunk (`.gitignore:25`; `git ls-files .mcp.json` is empty), so
nothing tracked is dirtied; what is wrong is that a checkout is re-pointed at a Jaeger it never emitted to.
The bump was a deliberate repair of 1.36.2's regression, when the guard on the auto-start made `init` fail on
every machine already running a daemon (`apps/docs/src/changelog.md:620`, commit `31dcfd4ea`, 2026-08-19); it
is pinned by `port-guard.test.ts:95` and `telemetry-mcp-port-sync.test.ts:77`. Only `indusk demo` hands an
application the real OTLP port, from the record (`src/bin/commands/demo.ts:64-84`); everything else says 4318
— the skill (`skill.md:81, 95, 116, 127`), the reference card headed "NOT CONSUMED BY ANYTHING"
(`.env.example:1, 21`), the demo README (`examples/seat-holds/README.md:35`), and the overview, which says
enabling writes an `.env` component routing to 4318 (`apps/docs/src/reference/telemetry/overview.md:97`) while
the skill says the extension "does NOT configure your services to emit" (`skill.md:81`) — the contradiction the
audit lists fifth, the overview saying enabling wires the app and the skill saying it does not; its daemon side
is this plan's.

### The recovery commands cannot recover this state

`telemetry start` asks `daemonStatus()` then `assertRequestedPortsFree`, which throws when 4318 or 16686 is
listening and offers `reap`, `--allow-port-bump` or explicit ports (`daemon.ts:378-389, 352-376`); its
docblock says it "deliberately does NOT adopt the listener: without its PIDs the daemon cannot be managed"
(`daemon.ts:348-350`) — a decision of 2026-08-16 (`changelog.md:626`); the PIDs are in fact readable from
`ps`. `reap` signals only a process whose `--config` path no longer exists (`orphans.ts:73, 109-113`), pinned
by `orphans.test.ts:72-78`; all seven survivors name files that exist. `stop` returns `{ stopped: false }`
without the meta file (`daemon.ts:506-508`). `status` prints "not running" and never reads `ps`
(`telemetry.ts:214-222`); `listTelemetryProcesses` has no non-test caller but `reapOrphans`. The docs send the
person to these commands (`apps/docs/src/guide/getting-started.md:123-133`), and the CLI reference still
documents `start` as auto-bumping (`apps/docs/src/reference/telemetry/cli.md:32-33`), which it stopped doing
on 2026-08-16. The two escapes — `--allow-port-bump` or explicit ports — write a fresh record on another
random port and leave 4318 to PID 60080, the split the docblock at `daemon.ts:333-346` itself calls the one behaviour that
cannot be right. Only a manual kill clears this machine.

### The daemon log is two-thirds Jaeger failing to trace itself

`~/.indusk/telemetry.log` is 45,346,654 bytes, 120,130 lines, on 2026-10-16 at 18:37; 80,367 (67 %) contain
`4317`: Jaeger's own gRPC client failing to reach `localhost:4317` every few seconds, first at 2026-05-11
23:55:34 and still being written (the audit's 80,230 was the same count an hour earlier). The rendered config
turns off self-metrics only (`daemon.ts:205-209`; the shipped
`packages/telemetry-binaries-shared/jaeger-config.yaml:31-38` says why), nothing under `traces`; the spawn
passes no env (`daemon.ts:434-437`); the file is append-only, never rotated (`daemon.ts:431`); `telemetry
reset` truncates `logs.jsonl`, never this (`telemetry.ts:462-467`). The server image carries the same noise
with a comment "Noise, not an error" (`apps/indusk-mcp/templates/server/Dockerfile:34-35`;
`src/lib/telemetry/server.ts:264-268`). The person is pointed at this file by `start` (`telemetry.ts:102`),
both start-failure errors (`daemon.ts:452, 480`) and the reference ("First place to look", `cli.md:198`).
Known since 2026-10-09 (`known-issues.md:156-162`). **Not determined:** whether Jaeger 2.17.0 honours
`service.telemetry.traces.level: none`, needs `traces.processors: []`, or `OTEL_TRACES_EXPORTER=none` in the
spawn env — nothing on trunk exercises any of them and nothing was run.

### The logs receiver is bound on a port nothing reads, and 4319 is bound by nothing

The archived ADR's decision 6 (one locked Collector pipeline, OTLP receivers fanning out to a Jaeger exporter and
a file sink) with its decision 8 (the development endpoint `http://localhost:4318`) had services send everything
to a Collector on 4318. What shipped is the ADR's rejected alternative 5, direct-to-Jaeger OTLP without a
Collector, in all but name: traces go straight to Jaeger's OTLP receiver and the collector is logs-only on its
own port
(`packages/telemetry-binaries-shared/collector-config.yaml:3-6, 16`). That shipped config says 4319 (`:32`),
as do the skill (`skill.md:81, 98, 118`), the reference card (`.env.example:29`) and the overview
(`overview.md:40, 193`) — but the daemon renders the collector on `findFreePort(0)` (`daemon.ts:403, 428`),
writes the result as `logsOtlpPort` (`daemon.ts:492`; `status.ts:44`), and no command, check, skill or
template reads it back: `start` and `status` print the OTLP, UI, PIDs and sink path, never the logs port
(`telemetry.ts:98-102, 229-233`). This machine's collector listens on 54675. The scaffolded logger keys only
on `OTEL_EXPORTER_OTLP_ENDPOINT` with no logs URL (`apps/indusk-mcp/templates/logger.ts:31-46`; the same file
sits at Homework Gate's workbench root), so a log record goes to Jaeger's port, whose rendered config has a
traces pipeline only (`daemon.ts:198-204`) and so no `/v1/logs` route — the audit's probe of 2026-10-16 read
404 there and 200 on the collector; I did not repeat it. `logs.jsonl` has never been created on this machine.
The master gives the daemon half — which port the collector binds and whether anything shows it — to this
plan, and the app half — what the logger template is handed — to
[a-new-project-starts-instrumented](../a-new-project-starts-instrumented/) (child 3, on its own branch); the
audit's gap G27, the structured-log channel that has never carried a record, is split the same way.

### What the `instance-ports` draft already decided, and what has changed since

The draft brief on branch `plan/instance-ports` (2026-10-11, "Backlog, not critical",
`.indusk/planning/master.md:681-690`) promises `an-instance-never-takes-a-held-port` (a second instance gets
another port), `starting-an-instance-leaves-tracked-files-unchanged` and
`a-checkout-reaches-its-own-instance`. Its research measured on Claude Code 2.1.296 that `${VAR:-default}` in
an MCP `url` expands only from the process environment and that a local-scope server shadows the project
entry; Sandy chose local-scope registration over a launcher ("Decision so far", 2026-10-11). Two things have
moved: `.mcp.json` is untracked now, so the churn its first expectation measures is already met and only the
re-pointing of other checkouts remains; and its first promise pulls the opposite way from a fixed 4318 —
per-instance ports assume several daemons on one machine, one fixed port assumes one. The judge's synthesis
folds in the draft's first two promises; whether a fixed port supersedes the first instead is an Open Question
below.

### What the audit got wrong or overstated

- "Re-pointing every registered project's `.mcp.json` (2,681 of them)": the sync skips paths that do not
  exist; 18 were rewritten.
- "The next `init`/`update` adds a fourth" (and the master's "run on every `init` and `update`"): `update` on
  a project with the extension enabled does not; a new project's `init`, `extensions enable` or a direct
  `register` does.
- `known-issues.md:147-154`'s kill-and-restart reading of 2026-10-08.
- Counts that moved: 80,367 noise lines, not 80,230; 18 live registry paths, not 14.

### What exists to build on

- `listTelemetryProcesses` enumerates every jaeger/otelcol by shipped binary path and `--config` argument
  (`orphans.ts:32-33, 42-78`) — the raw material for rebuilding a record from the process list. A survivor's
  ports cannot be read from its config file, regenerated on every start (PID 60080 serves 4318 while the yaml
  says 54678); they must come from its listening sockets.
- `isOwnProcess` judges by binary, config and start time over `ps` in the C locale
  (`process-identity.ts:38-55, 67-74`); `stop` uses it (`stop.ts:51-53`) and `status` could. The promises
  `telemetry-stop-stops-what-it-started` and `indusk-stops-only-its-own-daemons` (`stop.ts:6, 16`) are in
  force.
- `scripts/check-test-daemons.js:13-15, 45-52` tells a test's daemon from the real one by whether its config
  directory is a temp root or `~/.indusk` — one candidate definition of "InDusk-owned".
- The watcher probe: every reader sends a `watcher.probe` span through the intake and reads it back before
  reading a promise (`/decisions/watcher-heartbeat`; `sources.ts:333-341`) — the signal the judge proposes
  this promise be read by.
- `waitForPortFree`, the retrying `isPortListening`, `daemonRestart`'s port inheritance (`daemon.ts:157-179,
  535-566`); `INDUSK_SKIP_TELEMETRY_AUTOSTART` keeps `pnpm test` from starting a daemon
  (`apps/indusk-mcp/vitest.config.ts:14`).
- The always-on server renders a badger (file-backed) store on a volume (`server.ts:256, 275-278`) where the
  daemon renders memory (`daemon.ts:216-220`).
- Tests that pin today's behaviour, which a change would rewrite rather than add beside:
  `port-guard.test.ts:54-100` (start refuses a served port; `--allow-port-bump` restores the bump),
  `orphans.test.ts:72-78` (a process whose config exists is not an orphan), `telemetry-mcp-port-sync.test.ts:77`
  (restart re-points every registered project), and the lifecycle suite `telemetry-cli-lifecycle.test.ts`, whose
  rows T1, T3, T4 and T5 walk start, status, stop and restart with auto-bumped ports. Documents that state today's
  behaviour or the unbuilt design: `cli.md:32-33`, `overview.md:97, 193`, `getting-started.md:123-133`, the
  skill, `.env.example`.

## Proposed shape (not decided)

The judge's synthesis (`mark-first`'s research, "The proposed structure", the first of the seven plans it lays
out) proposes one promise, `the-daemon-readers-follow-is-the-one-running`, with six clauses, each a split (a part
of the promise) or a limit (a bound on it): **a-read-never-deletes-the-record** (limit —
no status or reader path removes `telemetry.json`); **a-running-daemon-is-found-without-its-record** (split —
the record is rebuilt from the process list for jaeger/otelcol launched from `~/.indusk`, and `telemetry
start` adopts an InDusk-owned listener on 4318/16686 instead of refusing);
**register-never-spawns-beside-a-running-one** (limit — `register` and `update` never bump ports or rewrite
other projects' `.mcp.json` while an owned daemon serves; folds in the first two `instance-ports` promises);
**reap-clears-indusks-own-strays** (split — an owned process the record does not name is a stray, not only one
whose config is gone); **the-log-is-readable** (split — self-tracing off in the rendered config, locally and
in the image); **the-logs-port-is-recorded-and-shown** (split — the logs receiver bound on the port the record
names, printed by `start` and `status`). Signal: the watcher probe every reader already sends, through the
recorded daemon. It would close three of the audit's gaps whole — G11, the daemon the readers follow is not one
running; G32, the recovery commands and the deleting read; G40, the self-tracing noise in the log — and the
daemon halves of two — G31, the auto-start's bump and re-pointing; G27, the logs channel that never carried a
record. The other two proposals
add variants: `status` naming every live InDusk jaeger/otelcol with its ports; `telemetry.log` rotating; a
file-backed store so standing survives a restart (an Open Question).

What it would cost. It reverses two decisions of August 2026 — `start` refuses rather than adopts (1.36.2) and
the auto-start bumps (1.37.0, repairing 1.36.2's regression) — so a brief that adopted it would say so, and three
pinned tests would be rewritten. "Owned" needs a definition that
survives a global install beside a repo-local one (this machine has both). Adoption must choose among several
survivors or refuse and list them. `register` changes meaning for every `init`. A fixed 4318, if chosen, drops
the draft's per-instance promise. The Jaeger knob is not yet verified against 2.17.0. None of it touches
`run-the-master`'s code.

## Decisions

- **The goal and the proving ground** (Sandy, 2026-10-16): telemetry integral from day one, breaks in production as part of how the system works, decisions from measurements; Homework Gate proves it; "If we need to do more than one plan, we can do that." In `mark-first`'s research, "Audit against the goal".
- **This plan is first of seven and blocked by nothing** — the parent master, 2026-10-16 ("Children, in order").
- **A read never counts silence as health** — the watcher-heartbeat decision of 2026-10-01: every reader probes before it reads; a probe that does not return is "watcher blind". In force; this plan builds under it.
- **`stop` judges ownership by command line, never by port** (2026-10-07, commit `f41230daa`; promise `indusk-stops-only-its-own-daemons`). In force.
- **Local-scope MCP registration over an env-var launcher** (Sandy, 2026-10-11, `instance-ports` research "Decision so far"); `instance-ports` "Backlog, not critical" the same day.
- **`every-broken-trace-is-kept` is in the later cut** (Sandy, 2026-10-15, `mark-first`'s brief and research) — the boundary the store question respects.
- **Prior decisions this plan would reverse, named so the brief can say so:** `start` does not adopt a listener (2026-08-16, `daemon.ts:348-350`); the auto-start bumps (2026-08-19, `changelog.md:620`); an orphan is a process whose config is gone (2026-08-16, `orphans.ts:13-18`).

## Open Questions

- **How an application reaches the daemon**: a fixed 4318 the daemon always holds (no env file, any SDK default works, a taken port must refuse loudly and name the holder) or an environment file written from the recorded port (survives a collision; every app needs the file and a port change rewrites it). Sandy's, per the master; the scaffold plan writes whichever is chosen.
- **A file-backed trace store** so standing survives a restart: a store flag this plan may set (the server already renders badger) or pulling `every-broken-trace-is-kept` out of the later cut.
- **This machine's three Jaegers and four collectors**: killed by hand on 2026-10-16 (unblocks row A11 in `mark-first`'s test plan, the live check that a signal through the local daemon reads upheld end to end, and Homework Gate at once) or adopted by this plan's first landing (about a week; the machine stays the proof case meanwhile).
- **What "owned" means** for adoption and reap: a binary under any InDusk install plus a config under `~/.indusk` (the test guard's rule) or the start-time rule `isOwnProcess` uses; whether a mise global install and a repo-local one are one owner.
- **Which survivor to adopt** when several run: the one on 4318/16686, the newest, or refuse and list them for a person.
- **Fold in `instance-ports`' first promise** (per-instance ports, several daemons) or supersede it with one fixed port — they pull opposite ways; the churn half is moot since `.mcp.json` is untracked.
- **The logs receiver's port**: fixed 4319 as every document says, or the recorded random port printed everywhere; and whether the logger template's logs URL is this plan's or the scaffold plan's.
- **The self-tracing knob**: `service.telemetry.traces.level: none`, `traces.processors: []`, or `OTEL_TRACES_EXPORTER=none` — one must be verified against Jaeger 2.17.0 before a row names it.
- **Discovery by process list in `status` and the health checks**, or the record alone once a read can no longer delete it.
- **The registry's 2,663 dead entries**: pruned here, since the sync walks them on every start, or left to `known-issues`.

## Sources

- `../telemetry-from-day-one/master.md` (trunk); `../mark-first/research.md` (branch `plan/mark-first`: "Audit against the goal (2026-10-16)", whose gap table holds the rows G11 the daemon the readers follow, G31 the auto-start's bump, G32 the recovery commands, G40 the log noise, G27 the logs channel; and "The proposed structure", the judge's synthesis); the audit's per-gap records and the synthesis as written, in the session scratchpad
- `.indusk/planning/archive/local-telemetry/adr.md`; `/decisions/watcher-heartbeat`; `.indusk/planning/known-issues.md:140-169`; `.indusk/planning/master.md:681-690`; `git show plan/instance-ports:.indusk/planning/instance-ports/{brief,research}.md`
- `apps/indusk-mcp/src/lib/telemetry/{daemon,status,orphans,stop,server}.ts`, `src/lib/process-identity.ts`, `src/bin/commands/{telemetry,extensions,init,update,demo,promises}.ts`, `src/lib/promises/{sources,telemetry,look-standing}.ts`, `src/lib/eval/otel.ts`, `src/lib/mcp-config.ts`, `scripts/check-test-daemons.js`, the tests named above
- `apps/indusk-mcp/extensions/local-telemetry/{manifest.json,skill.md,.env.example,README.md}`; `packages/telemetry-binaries-shared/{jaeger-config,collector-config}.yaml`, `UPSTREAM.json`; `apps/docs/src/reference/telemetry/{cli,overview}.md`, `guide/getting-started.md`, `changelog.md`
- Machine, read-only on 2026-10-16: `~/.indusk/` (`telemetry.log`, the rendered yaml files, `telemetry/projects.json`, `projects/*/eval/system.log`), `ps`, `lsof`; `/Users/the_dusky/code/sandbox/homework-gate-workbench/{.mcp.json,.indusk/extensions,logger.ts}`

