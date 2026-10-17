---
title: "The daemon is found, not guessed"
date: 2026-10-16
status: in-progress
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
approved_brief: "a8cefb750dcfbcb8df0874e6fc816c4c7a9aa0f2ccfe7489322fe9fa724856f9"
approved_by: "Sandy Corsillo"
approved_at: "2026-10-17T01:44:01.839Z"
---

# The daemon is found, not guessed

## Goal

Make true the promise this plan's [brief](brief.md) makes, `the-daemon-readers-follow-is-the-one-running` (every reader of promises, every InDusk command and every application on a machine reaches the same one local telemetry daemon), and its six clauses, the way the [ADR](adr.md) decided: one address per machine, chosen once at first setup and stored in the real InDusk home (InDusk's own block, 24318 traces, 24319 logs, 24316 interface, 24317 MCP, or a free port picked once for any block port held then), kept, read by every reader and command and printed for `init`, one definition of an InDusk daemon process by its binary and config path, a record that no read deletes and that whoever finds a running daemon writes again, a `start` and a `register` that take over a found daemon and, once the address is stored, refuse by name when a stranger holds one of its ports, a `reap` that stops this home's strays, Jaeger's own tracing switched off, and each clause's signal sent as a span by the InDusk command that knows the answer, at the moment it knows it. The rows below come one for one from the clause plan in [test-plan.md](test-plan.md); the findings behind them, with file and line on trunk, are in [research.md](research.md).

## Scope

### In Scope
- One definition of an InDusk daemon process (binary path plus config path under a home), shared by status, the finding, takeover, `stop`, `reap` and the test-daemon guard script, with a parity test holding the script's copy equal.
- One set of reads (the record, the process list, the listening sockets, a port's holder, a file's stat, the log, the clock) handed to pure functions that decide the daemon's state, what `start` does, what `reap` stops, what `.mcp.json` entry changes and what each report says.
- `daemonStatus` no longer deletes the record; one resolver behind every reader (promise readers, the span reader, look standing, the evaluator, `update`, `demo`, `telemetry reset`).
- Finding a lost daemon from the process list and its sockets, and writing its record again under the home's lock with an exclusive create.
- The stored address: chosen once at first setup in `<home>/telemetry-address.json` (the block, or a free port picked once for any block port a stranger holds), never moved, read by every reader and command (`status`, promise readers, the evaluator, `demo`, the `jaeger` MCP entry), and printed by `indusk telemetry address` (`--json`) and an exported `daemonAddress` for `init` to hand to an application.
- Every start in the real home on the stored address, a later stranger on a stored port refused by name, port options only in a temporary home, the port bump and `--allow-port-bump` removed, `restart` keeping the stored address, `register` taking over or starting the one daemon and writing only its own project's MCP entry, `.mcp.json` written only on a change.
- `reap` stopping this home's strays as well as orphans, scoped to this home.
- `jaeger_query.enable_tracing: false` in the local daemon's config, the shipped config files and the always-on server's config.
- The reporter that sends each clause's signal, the `indusk.clause` attribute, and the reports wired into `status`, `start`, `restart`, `register`, `reap`, the finders and the promise readers.
- Restarting this machine's daemon onto its stored address and running the live check.

### Out of Scope
- Keeping traces across a restart: the store stays in memory (Sandy, 2026-10-16).
- Several daemons per machine, each on its own ports: `instance-ports`' per-instance-ports promise is superseded.
- Writing the stored address into each application `init` scaffolds (this plan only stores and prints it), and the evaluator's log export posting to the traces port (`eval/otel.ts:307-309`): both belong to [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/) unless Sandy takes the one-line log fix here (see Notes).
- A port in the stored address for Jaeger's OTLP gRPC receiver.
- Pruning the dead entries in the project registry, and rotating the daemon's log.
- Reading the `indusk.clause` attribute in promise readers: that is `mark-first`'s, the later child of the telemetry-from-day-one master that teaches readers to key a break by its clause.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | the contract tests that start a real Jaeger in a temporary home (lifecycle on given ports, slow-not-gone, reap of a stray, no self-tracing lines), the `.mcp.json` entry tests, the refusal naming its holder in `port-guard.test.ts`, the stale-record case of `telemetry-daemon-state.test.ts` and the live check, all red; the register of every deferred body | `daemon.ts`, `status.ts`, `orphans.ts`, `mcp-config.ts` and the CLI as they stand |
| Build Phase 1 | `lib/telemetry/daemon-process.ts` (`daemonProcessOf`, `homeKind`, own/temporary/orphan), `lib/telemetry/daemon-reads.ts` (`DaemonReads`, `realDaemonReads`), the whole-list `ps` read in `lib/process-identity.ts`, `lib/telemetry/daemon-state.ts` (`daemonState`, `renderStatus`); `daemonStatus` with no `cleanupFiles`; the record-writing stand-in for tests | the red tests of Test Phase 1 |
| Build Phase 2 | `findDaemon` (ports from sockets, pairing, several daemons, record written under `<home>/telemetry.lock` with `flag: "wx"`), `resolveLocalDaemon` used by every reader, `liveOtlpEndpointSync` over it | `DaemonReads`, `daemonState` |
| Build Phase 3 | `lib/telemetry/daemon-address.ts` (`PORT_BLOCK`, `chooseAddress`, `daemonAddress`, `<home>/telemetry-address.json`), `indusk telemetry address`, `lib/telemetry/start-plan.ts` (`startPlan`, `ensureDaemon`), the preflight naming holders, `daemonStart` on the stored address, `findDaemon` labelling by it, `restart` keeping it, `register` and `.mcp.json` changes (`jaegerEntryChange`, write on difference, own entry only, `ensureMcpJson` with `jaeger`), `--allow-port-bump` removed | `findDaemon`, `daemonState`, the resolver |
| Build Phase 4 | `lib/telemetry/reap-plan.ts` (`reapPlan`), `reap` over it scoped to this home, `enable_tracing: false` in every Jaeger config InDusk renders or ships, `selfTracingLines`, `logOffset` on the record | `daemonState`, `startPlan` |
| Build Phase 5 | `PROMISE_MARK.clause`, `watcherSpanBody` with events and a service name, `lib/telemetry/daemon-reports.ts` (`daemonReports`, `sendDaemonReports`, the throttle), reports wired into every command and reader; this machine's daemon on its stored address; the live check recorded | everything above |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | With no address stored and the block free, the first start, by hand or automatic, gives the daemon 24318 (traces), 24319 (logs), 24316 (interface) and 24317 (MCP), stores that address in the InDusk home, and `start` and `status` both print all four | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts |
| A2 | A daemon started in a temporary home binds every port the test gives it: a trace sent to its traces port appears in its interface, and a log record sent to its logs port is accepted and written to its logs file | Test Phase 1 | Build Phase 3 | planned | contract | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts |
| A3 | At first setup, a block port held by a process that is not InDusk's is replaced by a free port picked once and stored, and the start prints the held port, its holder and the port picked, and exits zero; once an address is stored, a start that finds one of its ports held by such a process starts nothing, picks nothing, leaves the address as it was, exits non-zero, and names the port and the holder's process id and command | Test Phase 1 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts |
| A4 | Once an address is stored, every start in the real home uses it: `start`, `restart` and the automatic start run by `init`, `update` and enabling the extension never pick again or move the daemon; the address is the same after stop and start, after a restart, and after the record is lost and rebuilt from the process list; explicit port options are refused in the real home | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts |
| A5 | For an InDusk daemon on ports other than its stored address, such as one started before this change on 4318 and 16686, `status` says which ports differ and `restart` brings it onto the stored address | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts |
| A6 | `status` sends an upheld report for one-daemon-on-its-own-ports when one InDusk Jaeger and one collector hold the four ports of the stored address, and otherwise a broken one naming each extra process or each stored port not held | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts |
| A29 | Every InDusk reader and command (`status`, the promise readers, the evaluator, `demo`, and the `jaeger` MCP entry register and `update` write) takes the daemon's ports from the stored address or the record, never from a port number in its code; `indusk telemetry address` prints the stored address, `--json` for `init` to hand to an application, and one exported function returns the same; with none stored it says so, exits non-zero and chooses nothing | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-address.test.ts |
| A30 | `indusk telemetry address --reset` chooses the address again by the same rule, keeping any port this home's running daemon holds, prints the old and the new address and that every application given the old one needs the new one, and is the only way the stored address ever changes | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports | apps/indusk-mcp/src/__tests__/telemetry-address.test.ts |
| A31 | The evaluator sends its log records to the stored address's logs port, never to the traces port, and none is answered 404 | Build Phase 3 | Build Phase 3 | planned | unit | a regression guard over every-commit-evaluated: the evaluator's logs reach the daemon's log channel, which today they never do | apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts |
| A7 | No status read, extension health check, promise reader, admin page or evaluator lookup removes the record; a slow port reads as running and slow, naming the port and the wait; a stale record with nothing running reads not running, is named, and stays | Test Phase 1 | Build Phase 1 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon | apps/indusk-mcp/src/__tests__/telemetry-daemon-state.test.ts |
| A8 | With a real daemon in a temporary home and the reading process kept busy longer than the port check waits, a status read reports the daemon slow, not gone, and its record is still there afterwards | Test Phase 1 | Build Phase 1 | planned | contract | clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon | apps/indusk-mcp/src/__tests__/telemetry-slow-not-gone.test.ts |
| A9 | A promise reader that reaches the daemon through its record sends an upheld report for a-read-never-loses-the-daemon at its probe, throttled; a reader that first had to find the daemon sends the finding's broken report instead | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon | apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts |
| A10 | With the record missing while an InDusk daemon runs, `status` reports it running with its process ids and its ports read from its listening sockets, and the record is written again | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-daemon-found.test.ts |
| A11 | With the record missing and an InDusk daemon on its stored address, `start` takes it over: writes the record, starts nothing, prints the takeover with process ids and ports, exits zero | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts |
| A12 | With the record missing and several InDusk daemons running, `start` takes over the one holding the stored traces port, the port applications are handed, and lists every other as a stray for `reap`; when none holds it, it takes over none, starts nothing and lists them all | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts |
| A13 | With the record missing and the daemon running, `promises status`, the admin's promise page and the editor's health line read the running daemon's traces | Build Phase 2 | Build Phase 2 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts |
| A14 | A finding sends the found daemon an upheld report for a-lost-daemon-is-found and a broken one for a-read-never-loses-the-daemon naming when the daemon started; a start that started a daemon sends upheld when nothing runs beside it, broken naming the one it missed otherwise | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts |
| A15 | On this machine, with the record moved aside, `start` takes the daemon over and then `status` finds it; one InDusk Jaeger and one collector remain on the stored address (24318, 24319, 24316, 24317 here, where the block is free); `promises status` shows the promise broken naming a-read-never-loses-the-daemon; the interface shows both upheld finding reports | Test Phase 1 | Build Phase 5 | planned | live check | clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found | apps/indusk-mcp/src/__tests__/telemetry-daemon-found-live.test.ts |
| A16 | With an InDusk daemon running, `init`, `update` and enabling the extension start none and register against it; with none running, they start exactly one, on the stored address, choosing it first when none is stored | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second | apps/indusk-mcp/src/__tests__/telemetry-register.test.ts |
| A17 | Registering a project points its own MCP entry at the stored MCP port and leaves every other registered project's entry as it was, whatever port it names | Build Phase 3 | Build Phase 3 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second | apps/indusk-mcp/src/__tests__/telemetry-mcp-entries.test.ts |
| A18 | Registering sends an upheld report for nothing-starts-a-second when it found or started the one daemon and changed no other entry, and a broken one naming both process ids of a second daemon or each other entry it changed | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second | apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts |
| A19 | `status` lists every InDusk Jaeger and collector the record does not name, each with process id, start time, ports and install, and says `reap` stops them | Build Phase 1 | Build Phase 1 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared | apps/indusk-mcp/src/__tests__/telemetry-daemon-state.test.ts |
| A20 | `reap` stops every stray of this home, including one whose config file still exists, and leaves the recorded daemon and every process that is not InDusk's untouched | Build Phase 4 | Build Phase 4 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared | apps/indusk-mcp/src/__tests__/telemetry-reap-plan.test.ts |
| A21 | `reap` prints each stray it stopped, exits non-zero naming each that would not stop, and sends upheld for strays-are-cleared when none remains and broken naming each that does | Build Phase 4 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared | apps/indusk-mcp/src/__tests__/telemetry-reap-plan.test.ts |
| A22 | With two daemons in a temporary home and the record naming one, `reap` stops the other and the recorded one still receives traces | Test Phase 1 | Build Phase 4 | planned | contract | clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared | apps/indusk-mcp/src/__tests__/telemetry-reap-strays.test.ts |
| A23 | The shipped Jaeger with the config InDusk renders writes no line of failing to send its own traces over half a minute while traces and logs sent to it still arrive | Test Phase 1 | Build Phase 4 | planned | contract | clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable | apps/indusk-mcp/src/__tests__/telemetry-self-tracing.test.ts |
| A24 | `status` sends upheld for the-log-is-readable when the log since the daemon started holds no self-tracing line, and broken giving their count and the first of them | Build Phase 5 | Build Phase 5 | planned | unit | clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable | apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts |
| A25 | Taking over and reaping judge a process by its command line: a stranger on a stored port and a temporary-home daemon are never signalled or taken over from the real home; after a takeover, `stop` stops that daemon and says, non-zero, if a process would not stop | Build Phase 4 | Build Phase 4 | planned | unit | a regression guard over indusk-stops-only-its-own-daemons: stop and ui stop judge a process by its command line and signal only their own | apps/indusk-mcp/src/__tests__/telemetry-own-only.test.ts |
| A26 | A test's daemon runs in a temporary home on the ports it is given, never the block or the real home's stored address, which it never reads or writes, only in the system tier; the guard script and the package recognise a daemon process the same way | Build Phase 1 | Build Phase 3 | planned | unit | a regression guard over everyday-tests-never-wait: the everyday suite starts no server, and the stored address belongs to the real home only | apps/indusk-mcp/src/__tests__/telemetry-test-homes.test.ts |
| A27 | Starting, restarting or taking over leaves a `.mcp.json` that already names the stored MCP port unchanged; `update` in a checkout with none writes one naming `indusk` and `jaeger` at the stored MCP port | Test Phase 1 | Build Phase 3 | planned | unit | a regression guard over the-mcp-config-is-not-tracked and a-clone-without-an-mcp-config-gets-the-keep-list: the file stays untracked and a checkout without one gets the keep-list | apps/indusk-mcp/src/__tests__/telemetry-mcp-entries.test.ts |
| A28 | The evaluator exports to the daemon the record names, or to the one found when the record is missing, and writes no "endpoint unset; falling back to no-op logger" line while a daemon runs | Build Phase 2 | Build Phase 2 | planned | unit | a regression guard over every-commit-evaluated: each evaluation's report reaches the local Jaeger | apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts |

### Deferred Verification

- **This machine runs one InDusk daemon for a month** (the clause plan's untestable row U1: `status` lists one Jaeger and one collector, and the log holds no start without a shutdown before it)
  - reason: needs 30 days of this machine's real use, through inits, updates, restarts and sleeps
  - would require: time after landing
  - mitigation: the brief's first expectation, looked at 30 days after landing; until then, the report each `telemetry status` sends for `one-daemon-on-its-own-ports`
- **Readers stop losing the daemon** (U2: no evaluator "endpoint unset; falling back to no-op logger" lines while the daemon runs, 2,303 before this plan)
  - reason: needs weeks of commits evaluated across every project on the machine
  - would require: time after landing
  - mitigation: the brief's second expectation, looked at 30 days after landing; until then, the broken report a finding sends for `a-read-never-loses-the-daemon`, and row A28, the guard that the evaluator exports to the recorded or found daemon
- **The daemon's log is worth reading** (U3: none of the lines written after landing are Jaeger failing to trace itself, 67 % on 2026-10-16)
  - reason: needs a week of the daemon under real load
  - would require: time after landing
  - mitigation: the brief's third expectation, looked at one week after landing; the report each `telemetry status` sends for `the-log-is-readable`

## Checklist

### Test Phase 1: Write the tests that need no new code, failing today

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

Before any code changes, this phase writes every test that today's code can already be driven by, and records the rest with the body each will have. The tests that start a real Jaeger in a temporary home are written now: a daemon given its ports binds all of them, including a logs port and an MCP port today's command does not accept; a status read made while the reader is busy keeps the record; a stray beside the recorded daemon is stopped by reap; the daemon's log stays free of Jaeger failing to trace itself. So are the tests that a project's MCP file is rewritten only when its address changes, and that a new checkout's MCP file names the daemon; that a start refused because a port is taken names the process holding it; that a status read leaves a stale record in place; and the check against this machine's own daemon on this machine that a daemon whose record was moved aside is taken over and found, which today stops at its first step and puts the record back. Each fails today on what it asserts. Every other test's subject is a function a build phase introduces, so its body is written into this phase's register below and authored in that build phase. The next phase starts the code.

- [x] This plan's own worktree is confirmed as the place the work happens.
  <details><summary>Technical</summary>

  `plans start` made `/Users/the_dusky/code/sandbox/dusk-worktrees/daemon-found-not-guessed` on `plan/daemon-found-not-guessed`; confirm with `indusk worktree list` — worktree-per-plan default.

  </details>
- [ ] The lifecycle test asks a daemon in a temporary home for four given ports and checks that traces and log records both arrive, failing today.
  <details><summary>Technical</summary>

  Rewrite `apps/indusk-mcp/src/__tests__/telemetry-cli-lifecycle.test.ts` (system tier, already in `vitest.tiers.ts` SYSTEM) for A2: its docblock's "auto-bumped if taken" goes; T1 and T3 start with `--otlp-port <p1> --ui-port <p2> --logs-port <p3> --mcp-port <p4>` (four free ports picked by the test) and assert all four printed by `start` and `status`; POST one OTLP trace to `<p1>/v1/traces` and read it from `<p2>/api/services`; POST one OTLP log record to `<p3>/v1/logs` and assert a 2xx and the line in the home's logs file; T5 asserts new process ids on the same four ports after `restart`. Add the comment `// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports`. Red today: `--logs-port` and `--mcp-port` are unknown options.

  </details>
- [ ] A new system test keeps a reader busy past the port check and expects the daemon read as slow with its record kept, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/telemetry-slow-not-gone.test.ts` for A8, added to SYSTEM in `apps/indusk-mcp/vitest.tiers.ts`, opening with `// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon`. Start a daemon with the built CLI in a temporary `INDUSK_HOME`; in-process, with `INDUSK_HOME` pinned, start `daemonStatus()` and block the event loop with a synchronous busy wait longer than `isPortListening`'s 500 ms per attempt; then assert the result is not "not running" and that `telemetry.json` and `telemetry.pid` still exist. Red today: `status.ts:143-146` calls `cleanupFiles()`. Stop the daemon in `afterAll`.

  </details>
- [ ] A new system test runs two daemons in one temporary home with the record naming one, and expects reap to stop the other while the recorded one keeps receiving traces, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/telemetry-reap-strays.test.ts` for A22, in SYSTEM, opening with `// clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared`. Start a daemon with the CLI, copy its record aside, remove the record, start a second (the CLI refuses on the same ports today, so the second uses other given ports), restore the first record, run `telemetry reap`, then assert the second Jaeger's process is gone and a trace posted to the first's traces port appears in its interface. Red today: `reapOrphans` skips a process whose config exists (`orphans.ts:73`). The `afterAll` kills both by process id.

  </details>
- [ ] A new system test runs the shipped Jaeger with the config InDusk renders for half a minute and expects no self-tracing lines while traces and logs still arrive, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/telemetry-self-tracing.test.ts` for A23, in SYSTEM, opening with `// clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable`. Start with the CLI in a temporary home, post one trace and one log record every 5 s for 30 s, then count lines of the home's `telemetry.log` containing `4317` and either `traces export` or `addrConn.createTransport failed`; expect 0, and expect the trace in `/api/services` and the log record accepted. Red today: about 17 such lines in 50 s (ADR decision D8, the measurement of six Jaeger variants).

  </details>
- [ ] A new unit test expects a project's MCP file to be left alone when it already names the daemon, and a new checkout with the telemetry extension enabled to get the daemon's entry, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/telemetry-mcp-entries.test.ts` for A27 (A17's cases join it in Build Phase 3), opening with `// clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second`. Case 1: a temp project whose `.mcp.json` names `jaeger` at `http://localhost:24317/mcp`; set its mtime to a fixed past time with `utimesSync`, call `upsertJaegerEntry(project, 24317)`, assert the mtime is unchanged. Case 2: a temporary `INDUSK_HOME` holding a `telemetry-address.json` whose MCP port is 24317, and a temp project with `local-telemetry` enabled in its `.indusk` config and no `.mcp.json`; call `ensureMcpJson(project)`; assert `indusk` and `jaeger: { type: "http", url: "http://localhost:24317/mcp" }`, the stored MCP port. Case 3: `git check-ignore .mcp.json` in a temp repo carrying the repository's ignore rule still answers ignored. Red today: `upsertJaegerEntry` always writes (`mcp-config.ts:86-95`) and `ensureMcpJson` writes only `indusk` (`mcp-config.ts:54-70`).

  </details>
- [ ] A start refused because one of its ports is taken is expected to name the process holding that port, by process id and command, failing today.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts`, add a case for A3 with the comment `// clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports`: `occupy()` a port in this test process, `daemonStart({ otlpPort: taken, uiPort: 0 })` in the temporary home, and expect the rejection to match `new RegExp(\`${taken} is held by ${process.pid} \\(.*node\`)`. The guard rejects before any spawn, so no daemon is started. Red today: `assertRequestedPortsFree` (`daemon.ts:352-376`) says "already in use by a process this daemon does not own" without naming it. Build Phase 3 rewrites the rest of the file around `startPlan` and adds A3's two real-home halves over injected reads (a block port held at first setup: a port picked once and stored; a stored port held later: refused, address unchanged); this case stays, since port options remain allowed in a temporary home and a temporary home never picks.

  </details>
- [ ] A new unit test expects a status read to leave a record naming processes that are gone where it is, failing today.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/__tests__/telemetry-daemon-state.test.ts` for A7's stale-record half, opening with `// clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon`: in a temporary `INDUSK_HOME`, write `telemetry.json` and `telemetry.pid` naming two process ids that are not alive (a spawned `node -e ""` child, awaited to exit), call `daemonStatus()`, expect `running: false` and both files still present. No socket is opened: a dead process id fails `isAlive` before any port check. Red today: `status.ts:143-146` calls `cleanupFiles()`. Build Phase 1 adds the slow-port and stale-naming cases over `daemonState` and A19 to the same file.

  </details>
- [ ] The check against this machine's own daemon is written and run once, failing at its first step and leaving the record in place.
  <details><summary>Technical</summary>

  Author A15 from the body below as `apps/indusk-mcp/src/__tests__/telemetry-daemon-found-live.test.ts`, added to SYSTEM in `apps/indusk-mcp/vitest.tiers.ts`, running only with `INDUSK_LIVE_CHECK=daemon-found-not-guessed` (so the release's system tier never moves the real record) and restoring the record in `finally`. Red today at its first expectation: with the record moved aside, today's `telemetry start` refuses on the held 4318 and 16686 (`assertRequestedPortsFree`) instead of taking over, so it starts nothing; the record is aside for about a second. No report exists yet, so nothing is sent to the promise. Body:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  // live check: runs only with INDUSK_LIVE_CHECK=daemon-found-not-guessed, against ~/.indusk, once
  const live = process.env.INDUSK_LIVE_CHECK === "daemon-found-not-guessed";
  describe.runIf(live)("the daemon is found on this machine", () => {
    it("start takes over, status finds, one daemon stays on the stored address, the reports arrive", async () => {
      const aside = moveRecordAside(); // restored in finally if anything throws
      try {
        expect(cli(["telemetry", "start"]).stdout).toMatch(/took over the running daemon/);
        moveRecordAside();
        expect(cli(["telemetry", "status"]).stdout).toMatch(/running/);
        expect(existsSync(join(REAL_HOME, "telemetry.json"))).toBe(true);
        const address = JSON.parse(readFileSync(join(REAL_HOME, "telemetry-address.json"), "utf8"));
        expect(ownDaemonProcesses()).toEqual({ jaeger: 1, otelcol: 1, ports: [address.traces, address.logs, address.ui, address.mcp] });
        expect(cli(["promises", "status"], REPO).stdout).toMatch(/the-daemon-readers-follow-is-the-one-running .*broken.*a-read-never-loses-the-daemon/s);
        expect(await upheldReports("a-lost-daemon-is-found", sinceStart)).toBeGreaterThanOrEqual(2);
      } finally { aside.restoreIfMissing(); }
    });
  });
  ```

  </details>
- [ ] No test written in this phase fails only because a file it loads is missing.
  <details><summary>Technical</summary>

  The four contract files and the live check drive the built CLI and `daemonStatus`; `telemetry-daemon-state.test.ts` imports `daemonStatus`; `port-guard.test.ts` imports `daemonStart`; `telemetry-mcp-entries.test.ts` imports `upsertJaegerEntry` and `ensureMcpJson`. All exist today; every red is an assertion.

  </details>

#### Deferred to Build Phase 1

- **A19** — its subject is `daemonState`'s `strays` and `renderStatus`, introduced in Build Phase 1; it joins `telemetry-daemon-state.test.ts`, which Test Phase 1 starts with A7's stale-record case, together with these two A7 cases over `daemonState`, whose injected reads do not exist today. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
  import { daemonState, renderStatus } from "../lib/telemetry/daemon-state.js";
  import { fakeReads, jaegerCmd, collectorCmd } from "./helpers/daemon-reads.js";

  it("a slow port reads as running and slow, and the record is never written or removed", () => {
    const reads = fakeReads({ record: rec(101, 102), processes: [jaegerCmd(101, HOME), collectorCmd(102, HOME)] });
    const state = daemonState(reads, HOME);
    expect(state.kind).toBe("running");
    const lines = renderStatus(state, { 24318: { answer: "timeout", waitedMs: 500 } });
    expect(lines.join("\n")).toMatch(/:24318 did not answer in 500 ms \(slow, not gone\)/);
    expect(reads.removed).toEqual([]);
  });
  it("a stale record with nothing running reads not running, is named, and stays", () => {
    const reads = fakeReads({ record: rec(101, 102), processes: [] });
    const state = daemonState(reads, HOME);
    expect(state.kind).toBe("stale");
    expect(renderStatus(state, {}).join("\n")).toMatch(/record names jaeger 101 and otelcol 102/);
    expect(reads.removed).toEqual([]);
  });
  ```

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
  it("lists every own daemon process the record does not name", () => {
    const reads = fakeReads({
      record: rec(101, 102),
      processes: [jaegerCmd(101, HOME), collectorCmd(102, HOME), jaegerCmd(201, HOME, { install: GLOBAL })],
      listening: { 201: [54677, 54678] },
    });
    const state = daemonState(reads, HOME);
    expect(state.strays.map((p) => p.pid)).toEqual([201]);
    const out = renderStatus(state, {}).join("\n");
    expect(out).toMatch(/jaeger 201 .* started .* ports 54677, 54678 .* from .*telemetry-binaries/);
    expect(out).toMatch(/indusk telemetry reap/);
  });
  ```

- **A26** — its subject is `daemonProcessOf` and `homeKind` in `lib/telemetry/daemon-process.ts`, introduced in Build Phase 1; the stored-address half joins in Build Phase 3 with `startPlan`. Body reviewed:

  ```typescript
  import { daemonProcessOf, homeKind } from "../lib/telemetry/daemon-process.js";
  // the guard script's own copy, loaded without a build
  import { daemonProcessOf as scriptParse } from "../../scripts/check-test-daemons.js";

  it.each(COMMAND_LINES)("the package and the guard script agree on %s", (cmd) => {
    expect(scriptParse(cmd)).toEqual(daemonProcessOf(cmd));
  });
  it("a home under a temp root is temporary, ~/.indusk is real", () => {
    expect(homeKind("/private/var/folders/x/T/h-1", TEMP_ROOTS)).toBe("temporary");
    expect(homeKind(join(homedir(), ".indusk"), TEMP_ROOTS)).toBe("real");
  });
  // Build Phase 3: startPlan for a temporary home never returns a block port and never reads or writes the real home's address
  ```

#### Deferred to Build Phase 2

- **A10** — its subject is `findDaemon` (ports read from sockets, the record written with an exclusive create), introduced in Build Phase 2. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  import { findDaemon } from "../lib/telemetry/daemon-state.js";
  it("finds a running daemon from ps and its sockets and writes the record again", async () => {
    // this machine's daemon on 2026-10-16, started before this change: 4318 and 16686 are labelled as Jaeger's own defaults
    const reads = fakeReads({
      record: null,
      processes: [jaegerCmd(43599, HOME), collectorCmd(43600, HOME)],
      listening: { 43599: [4318, 16686, 62843], 43600: [62841] },
      yaml: { mtimeAfterStart: true },
    });
    const found = await findDaemon(reads, HOME, "status");
    expect(found?.meta).toMatchObject({ jaegerPid: 43599, otelcolPid: 43600, otlpPort: 4318, uiPort: 16686 });
    expect(found?.unknownRoles).toEqual(["mcp", "logs"]); // a stale yaml is not trusted; ports are never guessed
    expect(reads.written).toEqual([{ meta: found?.meta, exclusive: true }]);
  });
  it("reads listening sockets from /proc when lsof is missing", () => {
    expect(listeningFromProc(PROC_NET_TCP_FIXTURE, FD_FIXTURE)).toEqual({ 43599: [4318, 16686] });
  });
  ```

- **A13** — its subject is `resolveLocalDaemon`, the one resolver every reader calls, introduced in Build Phase 2; `resolveLocal` takes no reads today. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  import { resolveLocal } from "../lib/promises/sources.js";
  it("a reader follows the running daemon when the record is missing", async () => {
    // ports labelled from a trusted yaml: the stored address arrives in Build Phase 3
    const reads = fakeReads({ record: null, processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)], listening: ON_BLOCK, yaml: { ports: BLOCK, mtimeAfterStart: false } });
    const local = await resolveLocal({ reads, home: HOME });
    expect(local).toMatchObject({ queryUrl: "http://localhost:24316", otlpUrl: "http://localhost:24318" });
  });
  ```

- **A28** — its subject is `liveOtlpEndpointSync` over the resolver with injected reads, introduced in Build Phase 2. Body reviewed:

  ```typescript
  // a regression guard over every-commit-evaluated
  import { liveOtlpEndpointSync } from "../lib/telemetry/status.js";
  it("the evaluator exports to the found daemon when the record is missing", () => {
    const reads = fakeReads({ record: null, processes: [jaegerCmd(1, HOME), collectorCmd(2, HOME)], listening: ON_BLOCK, yaml: { ports: BLOCK, mtimeAfterStart: false } });
    expect(liveOtlpEndpointSync({ reads, home: HOME })).toBe("http://localhost:24318");
  });
  it("writes no no-op-logger line while a daemon runs", () => { /* initEvalOtel with the injected endpoint; system.log has no "falling back to no-op logger" */ });
  ```

#### Deferred to Build Phase 3

- **A1** — its subjects are `PORT_BLOCK` and `chooseAddress` in `lib/telemetry/daemon-address.ts` and `startPlan` in `lib/telemetry/start-plan.ts`, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  import { PORT_BLOCK } from "../lib/telemetry/daemon-address.js";
  import { startPlan } from "../lib/telemetry/start-plan.js";
  it("no address stored, the block free: start on the block and store it", () => {
    expect(PORT_BLOCK).toEqual({ traces: 24318, logs: 24319, ui: 24316, mcp: 24317 });
    expect(startPlan(none(), noHolders(), REAL, { address: null })).toEqual({ kind: "start", ports: PORT_BLOCK, store: { ...PORT_BLOCK, picked: [] } });
  });
  it("status prints all four ports", () => {
    expect(renderStatus(running(PORT_BLOCK), {}).join("\n")).toMatch(/24318.*24319.*24316.*24317/s);
  });
  ```

- **A4** — its subject is `ensureDaemon("register")` over `startPlan` with a stored address, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  const STORED = { ...PORT_BLOCK, logs: 51234, picked: [{ role: "logs", blockPort: 24319 }] };
  it.each(["start", "restart", "register"])("%s with an address stored uses it and never picks again", async (by) => {
    const reads = fakeReads({ record: null, address: STORED });
    await ensureDaemon(by, reads, REAL, spawnSpy);
    expect(spawnSpy.mock.calls[0][0].ports).toEqual({ traces: 24318, logs: 51234, ui: 24316, mcp: 24317 });
    expect(reads.addressWrites).toEqual([]);
  });
  it("the record lost and rebuilt from the process list leaves the address as it was", async () => {
    const reads = fakeReads({ record: null, address: STORED, processes: OWN, listening: { 1: [24318, 24316, 24317], 2: [51234] } });
    await findDaemon(reads, REAL, "status");
    expect(reads.address()).toEqual(STORED);
    expect(reads.addressWrites).toEqual([]);
  });
  it("the real home refuses explicit port options by name", () => {
    expect(() => startOptions({ otlpPort: 5000 }, REAL)).toThrow(/--otlp-port .* only in a temporary home/);
  });
  ```

- **A5** — its subject is `daemonState`'s port differences against the stored address and `restartPorts`, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  it("a daemon started before this change: status names each port that differs, restart moves it onto the stored address", () => {
    const state = daemonState(fakeReads({ record: rec(1, 2, { traces: 4318, ui: 16686, mcp: 62843, logs: 62841 }), address: { ...PORT_BLOCK, picked: [] }, processes: OWN, listening: OLD }), REAL);
    expect(renderStatus(state, {}).join("\n")).toMatch(/traces on 4318 \(expected 24318\).*MCP on 62843 \(expected 24317\).*logs on 62841 \(expected 24319\)/s);
    expect(restartPorts(state, REAL)).toEqual(PORT_BLOCK);
  });
  ```

- **A11** — its subject is `startPlan`'s takeover, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  it("record missing, own daemon on its stored address: take it over, start nothing, exit zero", async () => {
    const out = await runStart(fakeReads({ record: null, address: { ...PORT_BLOCK, picked: [] }, processes: OWN, listening: ON_BLOCK }), REAL, spawnSpy);
    expect(out.code).toBe(0);
    expect(out.text).toMatch(/took over the running daemon: jaeger 1, otelcol 2 on 24318, 24319, 24316, 24317/);
    expect(spawnSpy).not.toHaveBeenCalled();
  });
  ```

- **A12** — its subject is `startPlan` with several found daemons, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  it("several daemons: take the one on the stored traces port, list the rest as strays", () => {
    const plan = startPlan(found([onBlock(1, 2), onOther(3, 4)]), noHolders(), REAL, { address: { ...PORT_BLOCK, picked: [] } });
    expect(plan).toMatchObject({ kind: "takeover", jaegerPid: 1, strays: [3, 4] });
  });
  it("none on the stored traces port: take none, start nothing, list them all", () => {
    expect(startPlan(found([onOther(1, 2), onOther(3, 4)]), noHolders(), REAL, { address: { ...PORT_BLOCK, picked: [] } })).toMatchObject({ kind: "refuse-several", listed: [1, 2, 3, 4] });
  });
  ```

- **A30** — its subjects are `chooseAddress` and the `telemetry address` command, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  import { resetAddress } from "../lib/telemetry/daemon-address.js";
  it("--reset re-chooses by the same rule, keeps the running daemon's ports, and says so", () => {
    const r = resetAddress(readsWith({ address: { ...PORT_BLOCK, traces: 51000, picked: [{ role: "traces", holder: "otelcol-contrib" }] }, ownDaemonPorts: { mcp: 24317 }, holders: [] }));
    expect(r.old.traces).toBe(51000);
    expect(r.new).toMatchObject({ traces: 24318, mcp: 24317 });
    expect(r.message).toMatch(/every application given the old address/);
  });
  it("nothing else changes the stored address", () => {
    expect(writersOf("telemetry-address.json")).toEqual(["chooseAddress (first setup)", "resetAddress"]);
  });
  ```

- **A31** — its subject is the evaluator's log exporter reading the stored logs port, introduced in Build Phase 3 with the stored address. Body reviewed:

  ```typescript
  // a regression guard over every-commit-evaluated
  import { evalLogsEndpoint } from "../lib/eval/otel.js";
  it("the evaluator's logs go to the logs port, never the traces port", () => {
    expect(evalLogsEndpoint({ traces: "http://localhost:24318", logs: "http://localhost:24319" })).toBe("http://localhost:24319/v1/logs");
  });
  ```

- **A29** — its subjects are `daemonAddress`, the `telemetry address` command and the readers' use of the stored address, introduced in Build Phase 3. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  import { daemonAddress } from "../lib/telemetry/daemon-address.js";
  it("telemetry address prints the stored address, --json for init", async () => {
    const reads = fakeReads({ address: { ...PORT_BLOCK, logs: 51234, picked: [{ role: "logs", blockPort: 24319 }] } });
    expect(daemonAddress(reads)).toEqual({ traces: "http://localhost:24318", logs: "http://localhost:51234", ui: "http://localhost:24316", mcp: "http://localhost:24317/mcp" });
    expect(JSON.parse((await runAddress(reads, ["--json"])).text)).toEqual(daemonAddress(reads));
  });
  it("with no address stored it says so, exits non-zero and chooses nothing", async () => {
    const reads = fakeReads({ address: null });
    const out = await runAddress(reads, []);
    expect(out.code).not.toBe(0);
    expect(out.text).toMatch(/no address stored/);
    expect(reads.addressWrites).toEqual([]);
  });
  it.each(READER_MODULES)("%s names no daemon port number in its code", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/\b(4318|4319|16686|16687|24316|24317|24318|24319)\b/);
  });
  it("register and update write the jaeger entry at the stored MCP port", () => {
    expect(jaegerEntryChange(null, { ...PORT_BLOCK, mcp: 52000 })?.url).toBe("http://localhost:52000/mcp");
  });
  ```

- **A16** — its subject is `telemetryRegister` over `ensureDaemon` with injected reads and spawn, introduced in Build Phase 3; today `register` can only be driven by starting a real daemon, which the everyday suite forbids. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
  it.each(["init", "update", "extension enable"])("%s with a daemon running registers against it and starts none", async (via) => {
    const r = await registerVia(via, fakeReads({ record: null, address: { ...PORT_BLOCK, picked: [] }, processes: OWN, listening: ON_BLOCK }), spawnSpy);
    expect(r.daemon).toBe("found");
    expect(spawnSpy).not.toHaveBeenCalled();
  });
  it("no daemon and no address stored: exactly one start, on the address it chose", async () => {
    await registerVia("init", fakeReads({ record: null, address: null }), spawnSpy);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    expect(spawnSpy.mock.calls[0][0].ports).toEqual(PORT_BLOCK);
  });
  ```

- **A17** — its subject is `register`'s own-entry write through `jaegerEntryChange`, introduced in Build Phase 3; the second test of `telemetry-mcp-port-sync.test.ts` (start refreshing another project's URL) is reversed by it. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
  it("register writes its own entry at the stored MCP port and leaves every other project's as it was", async () => {
    writeMcp(other, "http://localhost:62843/mcp");
    const before = readFileSync(join(other, ".mcp.json"), "utf8");
    await registerVia("extension enable", fakeReads({ record: rec(1, 2), address: { ...PORT_BLOCK, picked: [] }, processes: OWN, listening: ON_BLOCK }), spawnSpy, { project: mine, registry: [mine, other] });
    expect(readMcp(mine).mcpServers.jaeger.url).toBe("http://localhost:24317/mcp");
    expect(readFileSync(join(other, ".mcp.json"), "utf8")).toBe(before);
  });
  ```

#### Deferred to Build Phase 4

- **A20** — its subject is `reapPlan` in `lib/telemetry/reap-plan.ts`, introduced in Build Phase 4. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
  import { reapPlan } from "../lib/telemetry/reap-plan.js";
  it("stops every stray of this home, config present or not, and nothing else", () => {
    const state = daemonState(fakeReads({
      record: rec(1, 2),
      processes: [...OWN, jaegerCmd(3, HOME), collectorCmd(4, HOME, { configGone: true }), jaegerCmd(5, TEMP_HOME), STRANGER_CMD(6)],
    }), HOME);
    expect(reapPlan(state).map((p) => p.pid)).toEqual([3, 4]);
  });
  ```

- **A21** — its subject is the reap command's result over `reapPlan`, introduced in Build Phase 4; its report half uses `daemonReports`, added to the same file in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/strays-are-cleared
  it("prints each stray stopped and exits non-zero naming one that would not stop", async () => {
    const out = await runReap(fakeReads({ record: rec(1, 2), processes: [...OWN, jaegerCmd(3, HOME), jaegerCmd(4, HOME)] }), { stubborn: [4] });
    expect(out.text).toMatch(/stopped jaeger 3/);
    expect(out.text).toMatch(/jaeger 4 would not stop/);
    expect(out.code).not.toBe(0);
  });
  // Build Phase 5: daemonReports("reap", after) → one report, clause strays-are-cleared, broken naming 4
  ```

- **A25** — its subjects are `startPlan`'s takeover (Build Phase 3) and `reapPlan` (Build Phase 4); the row is written once both exist. Body reviewed:

  ```typescript
  // a regression guard over indusk-stops-only-its-own-daemons
  it("a stranger on a stored port and a temporary-home daemon are never taken over or reaped from the real home", () => {
    const state = daemonState(fakeReads({ record: null, address: { ...PORT_BLOCK, picked: [] }, processes: [jaegerCmd(5, TEMP_HOME), STRANGER_CMD(6)], holders: { 24318: STRANGER(6) } }), REAL);
    expect(startPlan(state, holdersOf(state), REAL).kind).toBe("refuse");
    expect(reapPlan(state)).toEqual([]);
  });
  it("after a takeover, stop stops that daemon and says non-zero if one would not stop", async () => {
    const meta = takeoverMeta(OWN);
    const r = await stopDaemon(meta, REAL, stopDeps({ stubborn: [2] }));
    expect(r).toMatchObject({ stopped: [1], survived: [2] });
  });
  ```

#### Deferred to Build Phase 5

- **A6** — its subject is `daemonReports` in `lib/telemetry/daemon-reports.ts`, introduced in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/one-daemon-on-its-own-ports
  import { daemonReports } from "../lib/telemetry/daemon-reports.js";
  it("status: upheld on the stored address, broken naming the extra process and the ports not held", () => {
    expect(daemonReports("status", running(PORT_BLOCK))).toContainEqual(
      expect.objectContaining({ clause: "one-daemon-on-its-own-ports", outcome: "upheld" }));
    const broken = daemonReports("status", withStray(running({ ...PORT_BLOCK, mcp: 62843 }), 201));
    const r = broken.find((x) => x.clause === "one-daemon-on-its-own-ports");
    expect(r?.outcome).toBe("broken");
    expect(r?.symptom).toMatch(/^one-daemon-on-its-own-ports: .*jaeger 201.*MCP on 62843, expected 24317/);
  });
  it("status: ports picked at first setup are upheld, with the held block port as an attribute", () => {
    const picked = { ...PORT_BLOCK, logs: 51234, picked: [{ role: "logs", blockPort: 24319, holder: "otelcol-contrib 812" }] };
    const r = daemonReports("status", running(picked)).find((x) => x.clause === "one-daemon-on-its-own-ports");
    expect(r).toMatchObject({ outcome: "upheld", attributes: expect.objectContaining({ "indusk.daemon.picked": "logs:24319" }) });
  });
  ```

- **A9** — its subject is the reader's report beside its probe, with the throttle stamp and an injected clock, introduced in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-read-never-loses-the-daemon
  it("a read through the record sends one upheld report per project per 15 minutes", () => {
    const t0 = Date.parse("2026-10-16T20:00:00Z");
    expect(readerReports({ via: "record", project: "dusk", now: t0, lastStamp: null })).toHaveLength(1);
    expect(readerReports({ via: "record", project: "dusk", now: t0 + 60_000, lastStamp: t0 })).toHaveLength(0);
    expect(readerReports({ via: "record", project: "dusk", now: t0 + 15 * 60_000, lastStamp: t0 })).toHaveLength(1);
  });
  it("a read that had to find the daemon sends the finding's broken report, not upheld", () => {
    const r = readerReports({ via: "found", project: "dusk", now: 0, lastStamp: null, found: FOUND });
    expect(r.map((x) => [x.clause, x.outcome])).toContainEqual(["a-read-never-loses-the-daemon", "broken"]);
    expect(r.some((x) => x.clause === "a-read-never-loses-the-daemon" && x.outcome === "upheld")).toBe(false);
  });
  ```

- **A14** — its subject is `daemonReports` for the finding and the start moments, introduced in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/a-lost-daemon-is-found
  it("a finding: upheld for a-lost-daemon-is-found, broken for a-read-never-loses-the-daemon", () => {
    const r = daemonReports("found", FOUND_BY_STATUS);
    expect(r).toContainEqual(expect.objectContaining({ clause: "a-lost-daemon-is-found", outcome: "upheld" }));
    expect(r.find((x) => x.clause === "a-read-never-loses-the-daemon")?.symptom)
      .toMatch(/^a-read-never-loses-the-daemon: the record was missing while jaeger 43599 \(started .*\) ran; found by status/);
  });
  it("a start with another daemon beside it: broken naming the one it missed", () => {
    const r = daemonReports("started", withStray(running(PORT_BLOCK), 201));
    expect(r.find((x) => x.clause === "a-lost-daemon-is-found")).toMatchObject({ outcome: "broken" });
  });
  ```

- **A18** — its subject is `daemonReports` for the register moment, introduced in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/nothing-starts-a-second
  it("register: upheld when it found the one daemon and changed no other entry", () => {
    expect(daemonReports("register", { ...running(PORT_BLOCK), registered: { project: "/p", daemon: "found", otherEntriesChanged: [] } }))
      .toContainEqual(expect.objectContaining({ clause: "nothing-starts-a-second", outcome: "upheld" }));
  });
  it("register: broken naming a second daemon by both process ids, or each other entry changed", () => {
    const r = daemonReports("register", { ...withStray(running(PORT_BLOCK), 201, 202), registered: { project: "/p", daemon: "started", otherEntriesChanged: [{ path: "/q", from: ":62843", to: ":24317" }] } });
    expect(r.find((x) => x.clause === "nothing-starts-a-second")?.symptom).toMatch(/201.*202.*\/q.*62843.*24317/s);
  });
  ```

- **A24** — its subject is `daemonReports` for the log count, over `selfTracingLines` from Build Phase 4, introduced in Build Phase 5. Body reviewed:

  ```typescript
  // clause: the-daemon-readers-follow-is-the-one-running/the-log-is-readable
  it("status: upheld with no self-tracing line since start, broken with the count and the first", () => {
    expect(daemonReports("status", { ...running(PORT_BLOCK), selfTracing: { count: 0 } }))
      .toContainEqual(expect.objectContaining({ clause: "the-log-is-readable", outcome: "upheld" }));
    const r = daemonReports("status", { ...running(PORT_BLOCK), selfTracing: { count: 17, first: LINE } });
    expect(r.find((x) => x.clause === "the-log-is-readable")?.symptom).toMatch(/^the-log-is-readable: 17 lines .*4317/);
  });
  ```

#### Test Phase 1 Verification

- [ ] The tests this phase writes exist and each fails on what it asserts.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-cli-lifecycle.test.ts src/__tests__/telemetry-slow-not-gone.test.ts src/__tests__/telemetry-reap-strays.test.ts src/__tests__/telemetry-self-tracing.test.ts` — A2 red on the unknown `--logs-port`, A8 red on the record being gone, A22 red on the stray still running, A23 red on a non-zero count of self-tracing lines; `pnpm exec vitest run src/__tests__/telemetry-mcp-entries.test.ts src/__tests__/telemetry-daemon-state.test.ts src/lib/telemetry/port-guard.test.ts` — A27 red on the changed mtime and the missing `jaeger` entry, A7 red on the record being removed, A3 red on the refusal not naming its holder; `INDUSK_LIVE_CHECK=daemon-found-not-guessed pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-daemon-found-live.test.ts` — A15 red at "took over the running daemon", then `ls ~/.indusk/telemetry.json ~/.indusk/telemetry.pid` shows the record back and `pgrep -f telemetry-binaries` shows the same one Jaeger and one collector. Each row's State goes to `written` in the same edit.

  </details>
- [ ] Every deferred test body above has been read and judged.
  <details><summary>Technical</summary>

  Each body in the register is checked against two questions: will it load at the build phase it names (the symbols it imports are produced by that phase in the Boundary Map), and does it assert what its row in the Test Trajectory claims.

  </details>

### Build Phase 1: The daemon is recognised by its command line, and no read deletes its record

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase gives InDusk one way to tell its own daemon processes apart from everything else on the machine, and stops reads from deleting the record. A process is InDusk's daemon of a home when it runs InDusk's shipped Jaeger or collector binary with its config file in that home; a port answering, a start time or the binary file still existing never decide it. Everything the daemon commands need from the machine (the record, the process list, the listening sockets, files, the log, the clock) is read through one bundle that tests can hand in, and plain functions decide from it whether the daemon is running, partly running, stale or absent, and which processes are strays. The status read stops deleting the record; a slow port now reads as slow, and a stale record is named and left for start or stop. The test helpers that pretend to be a daemon are changed to look like one by their command line. The next phase uses the same reads to find a daemon when the record is gone.

- [ ] One parser recognises an InDusk daemon process and its home from a command line, and the test-daemon guard script carries an identical copy.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/daemon-process.ts`: `daemonProcessOf(command: string): { role: "jaeger" | "otelcol"; binary: string; configPath: string; home: string } | null` (binary matches the `TELEMETRY_BINARY` regex from `orphans.ts:32`; Jaeger's `--config=file:<H>/telemetry-jaeger.yaml`, otelcol's `--config=<H>/telemetry-collector.yaml`); `homeKind(home, tempRoots): "real" | "temporary"` comparing both the path given and its real path (`/var/folders` against `/private/var`); predicates `isOwn(p, home)`, `isTemporary(p)`, `isOrphan(p, exists)`. `orphans.ts` and `stop.ts:51-53` call it instead of their own matching. `apps/indusk-mcp/scripts/check-test-daemons.js` exports its own `daemonProcessOf` copy (it runs without a build). Author A26's parity and home cases in `apps/indusk-mcp/src/__tests__/telemetry-test-homes.test.ts` from the register body.

  </details>
- [ ] The daemon's reads come through one bundle that tests can replace, and the whole process list is read in the one module that already owns process reads.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts`: `interface DaemonReads { record(): DaemonMeta | null; writeRecord(meta: DaemonMeta, opts: { exclusive: boolean }): boolean; processes(): ProcessRow[]; listening(pids: number[]): Record<number, number[]>; holders(ports: number[]): Record<number, { pid: number; command: string } | null>; stat(path: string): { mtimeMs: number; size: number } | null; logSince(from: { offset: number } | { time: number }): string[]; now(): number }` and `realDaemonReads(home)`. `processes()` calls a new `psAll()` in `apps/indusk-mcp/src/lib/process-identity.ts` (`LC_ALL=C ps -axo pid=,lstart=,command=`), keeping `process-identity-single-definition.test.ts` green. `listening` runs `lsof -nP -a -p <pids> -iTCP -sTCP:LISTEN -Fpn`, parsing stdout and ignoring exit code 1; `holders` runs `lsof -nP -iTCP:<p> -sTCP:LISTEN -Fpc` then `ps -o command= -p <pid>`. Test helper `apps/indusk-mcp/src/__tests__/helpers/daemon-reads.ts` (`fakeReads`, `jaegerCmd`, `collectorCmd`, `rec`) records every write and removal.

  </details>
- [ ] Plain functions decide the daemon's state and the lines status prints, and the status read no longer deletes the record.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/daemon-state.ts`: `daemonState(reads, home): DaemonState` with `kind: "running" | "partial" | "found" | "stale" | "none"` (identity of each recorded process id from one `ps -o pid=,command= -p a,b`, judged by `daemonProcessOf`), `strays`, `orphans`, `portDifferences`; `renderStatus(state, answers): string[]` with the three-way port answer reusing `connectOnce` (`status.ts:83-94`): timeout prints `running — :<port> did not answer in <ms> ms (slow, not gone)`, refused prints `running — :<port> refused (starting, or that receiver failed)`; a stale record prints its process ids and stays. Remove `cleanupFiles()` from `daemonStatus` (`status.ts:143-146`); `daemonStatus` becomes a thin shell over `daemonState(realDaemonReads(home), home)`. `start` now judges a stale record by command line and writes over it; `stop` stays the one remover (`daemon.ts:526`). Add A7's two `daemonState` cases and A19 to `apps/indusk-mcp/src/__tests__/telemetry-daemon-state.test.ts` from the register bodies, beside the stale-record case Test Phase 1 wrote.

  </details>
- [ ] The test stand-ins that write a daemon record become separate processes that look like a daemon by their command line, so existing reader tests keep working under the new identity rule.
  <details><summary>Technical</summary>

  `startFakeQueryPort` in `apps/indusk-mcp/src/__tests__/helpers/local-jaeger.ts` spawns a script at `<tmp>/telemetry-binaries-test-arch/bin/jaeger` run with `--config=file:<home>/telemetry-jaeger.yaml` that serves the fake answers (the pattern `orphans.test.ts` uses), and writes a record naming that child's process id. Its users: `monitor-status.test.ts`, `watcher-probe.test.ts`, `watcher-falsification.test.ts`, and in the admin `apps/indusk-admin/src/__tests__/http-promise-health.test.ts` and `http-watcher-blind.test.ts`. `liveDaemon` in `apps/indusk-mcp/src/lib/eval/otel.test.ts:203-245` takes injected reads. Update the docblock of `apps/indusk-mcp/src/lib/telemetry/port-listening.test.ts` ("daemonStatus deletes the daemon's record on that answer" is no longer true).

  </details>

#### Build Phase 1 Verification

- [ ] The state and stray tests pass, the busy-reader system test passes, and the files that depend on the changed modules still pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/telemetry-daemon-state.test.ts src/__tests__/telemetry-test-homes.test.ts && pnpm exec vitest related --run src/lib/telemetry/daemon-process.ts src/lib/telemetry/daemon-reads.ts src/lib/telemetry/daemon-state.ts src/lib/telemetry/status.ts src/lib/telemetry/orphans.ts src/lib/telemetry/stop.ts src/lib/process-identity.ts src/__tests__/helpers/local-jaeger.ts src/lib/eval/otel.test.ts` — A7, A19 green; A26 written (its stored-address half waits for Build Phase 3). `pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-slow-not-gone.test.ts src/__tests__/monitor-status.test.ts src/__tests__/watcher-probe.test.ts src/__tests__/watcher-falsification.test.ts` — A8 green, the three stand-in users green. `cd ../indusk-admin && pnpm exec vitest run src/__tests__/http-promise-health.test.ts src/__tests__/http-watcher-blind.test.ts` — green. Rows' State updated in the same edit.

  </details>

#### Build Phase 1 Context

- [ ] The root context file records the decision in one line.
  <details><summary>Technical</summary>

  root (Key Decisions): `- The daemon is found, not guessed: one daemon on one address chosen once and stored in ~/.indusk (InDusk's block 24316-24319, or ports picked once when held at first setup; a recording server keeps 4318), read by every reader and handed out by \`indusk telemetry address\`, recognised by binary + config path, its record never deleted by a read and rebuilt from the process list; nothing starts a second — see /decisions/daemon-found-not-guessed` — always-on because every session that runs `init`, `update`, a telemetry command or a promise reader depends on which daemon it reaches, across every area of the repository, and a session that guesses a port or reads a record as truth reintroduces the defect.

  </details>
- [ ] The package's context file says how a daemon process is recognised and that no read removes its record.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry": "An InDusk daemon process is recognised by `daemonProcessOf` (binary + `--config` under the home), never by a port, start time or the binary existing; `check-test-daemons.js` keeps a parity copy. No read removes the daemon's record: only `stop` does. Code that decides about the daemon takes `DaemonReads`. — guarded by `telemetry-daemon-state.test.ts` and `telemetry-test-homes.test.ts`."

  </details>

#### Build Phase 1 Document

- [ ] The telemetry reference explains what an InDusk daemon process is, what the record is, and the states status now reports.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/telemetry/overview.md`: a new section "What counts as InDusk's daemon" (binary plus config path, the home as owner, a temporary home) and what the record (`telemetry.json`, `telemetry.pid`) is. `apps/docs/src/reference/telemetry/cli.md`: `status`'s five states and the three-way port answers. `apps/docs/src/changelog.md` (Unreleased, Changed): "No read deletes the telemetry daemon's record; a slow port reads as slow, not gone."

  </details>

### Build Phase 2: A lost daemon is found, and every reader follows it

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase makes InDusk find its daemon when the record is gone. A command that sees no usable record reads the process list for this home's Jaeger and collector, reads the ports they really listen on from the operating system, pairs them, and writes the record again, under the home's lock and only if no other command wrote it first. When several are running, it takes the one applications reach, on the traces port, and leaves the rest for status to list. Every reader that looks for the local daemon (promise status and watch, the promise health tool, the admin, the evaluator, update, the demo, telemetry reset) now asks one resolver, so none of them can disagree. The next phase builds starting, taking over and registering on this finding.

- [ ] A command that finds no usable record finds the running daemon from the process list and its listening sockets, and writes the record again exactly once.
  <details><summary>Technical</summary>

  In `apps/indusk-mcp/src/lib/telemetry/daemon-state.ts`: `findDaemon(reads, home, by: string): Promise<Found | null>`. Ports from `reads.listening`; roles labelled by Jaeger's own defaults (4318 traces, 16686 interface, which a daemon started before this change uses), else from the rendered yaml only when its mtime is not after the process start (about 5 s allowed) and every port it names is among the sockets, else `null` and listed in `unknownRoles`; Build Phase 3 puts labelling by the stored address first. Pair a Jaeger with the collector holding the logs port (the stored one from Build Phase 3), else the same-home collector started closest after it within 20 s. Several own daemons: take the one holding the traces port (the stored one from Build Phase 3), the rest become strays; none on it: take none. The finder never writes the stored address. Write with `reads.writeRecord(meta, { exclusive: true })` (`flag: "wx"`) under `<home>/telemetry.lock` via `acquireLockAsync` (`apps/indusk-mcp/src/lib/agents/lock.ts:120`); only the finder whose create succeeds is reported as the finder. `realDaemonReads.listening` falls back to `/proc/<pid>/fd` socket inodes joined to the LISTEN rows of `/proc/net/tcp` and `/proc/net/tcp6` when `lsof` is not on the PATH (`listeningFromProc`, a pure parser). Author A10 in `apps/indusk-mcp/src/__tests__/telemetry-daemon-found.test.ts`, including the `/proc` fixture case.

  </details>
- [ ] Every reader of the local daemon goes through one resolver that follows the record and finds the daemon when the record is gone.
  <details><summary>Technical</summary>

  `resolveLocalDaemon({ reads, home })` in `daemon-state.ts`, used by: `resolveLocal` (`apps/indusk-mcp/src/lib/promises/sources.ts:99-112`, behind `promises status`, `watch`, `promise_health`, the admin and catchup), the span reader with no endpoint (`apps/indusk-mcp/src/lib/promises/telemetry.ts:339-345`), look standing (`apps/indusk-mcp/src/lib/promises/look-standing.ts:263`), `liveOtlpEndpointSync` (`apps/indusk-mcp/src/lib/telemetry/status.ts:118-126`, synchronous: `spawnSync` of `ps` and `lsof`), `update`'s own-project jaeger sync (`apps/indusk-mcp/src/bin/commands/update.ts:507-526`), `demo` (`apps/indusk-mcp/src/bin/commands/demo.ts:64-84`) and `telemetryReset`. Failures stay `JaegerUnreachable` or `WatcherBlind`, naming the URL. Author A13 and A28 in `apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts`.

  </details>

#### Build Phase 2 Verification

- [ ] The finding and reader tests pass, and the files that depend on the resolver still pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/telemetry-daemon-found.test.ts src/__tests__/telemetry-readers-follow.test.ts && pnpm exec vitest related --run src/lib/telemetry/daemon-state.ts src/lib/telemetry/daemon-reads.ts src/lib/telemetry/status.ts src/lib/promises/sources.ts src/lib/promises/telemetry.ts src/lib/promises/look-standing.ts src/bin/commands/update.ts src/bin/commands/demo.ts src/bin/commands/telemetry.ts` — A10, A13, A28 green; rows' State updated in the same edit.

  </details>
- [ ] On this machine, with the record copied aside and removed, the worktree's status command finds the running daemon and writes the record back.
  <details><summary>Technical</summary>

  `cp ~/.indusk/telemetry.json ~/.indusk/telemetry.pid /tmp/ && rm ~/.indusk/telemetry.json ~/.indusk/telemetry.pid && node apps/indusk-mcp/dist/bin/cli.js telemetry status; ls ~/.indusk/telemetry.json` — expected: status prints jaeger 43599 running with 4318 and 16686, names MCP and logs as roles it could not read or as 62843 and 62841, and the record exists again. No reports are sent at this phase, so nothing breaks the promise. If the record is not back, restore it from `/tmp` before anything else runs.

  </details>

#### Build Phase 2 Context

- [ ] The package's context file says every reader resolves the daemon through one resolver and how a finder writes the record.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry", appended to the Build Phase 1 rule: "Every reader resolves the local daemon through `resolveLocalDaemon`; a finder writes the record with an exclusive create under `<home>/telemetry.lock`, reading ports from listening sockets, never guessing one. — guarded by `telemetry-daemon-found.test.ts` and `telemetry-readers-follow.test.ts`."

  </details>

#### Build Phase 2 Document

- [ ] The getting-started troubleshooting entry says a lost daemon is now found by the next command that looks.
  <details><summary>Technical</summary>

  `apps/docs/src/guide/getting-started.md:123-133` ("Telemetry: the daemon looks up but no traces arrive"): the first recovery step becomes `indusk telemetry status`, which finds a daemon whose record is gone. `apps/docs/src/reference/telemetry/overview.md`: a paragraph on the finding (process list, listening sockets, lsof or `/proc`). Changelog (Unreleased, Changed): "A telemetry daemon whose record is lost is found from the process list, and every reader follows it."

  </details>

### Build Phase 3: InDusk's own ports, chosen once; take over the running daemon, never start a second

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase gives the daemon one address of its own and makes starting it safe. The first time InDusk sets up its daemon on a machine it chooses that address: its own block of ports, 24318 for traces, 24319 for logs, 24316 for the interface and 24317 for the MCP server, with a free port picked once in place of any of those another program already holds. The address is stored in the InDusk home and never changes after that; every start, restart and automatic start uses it, every reader and command reads it, and a command prints it so that setting up a new project can hand it to the application. A temporary home, as tests use, takes the ports it is given and never touches the stored address. Before starting, the command checks the stored ports: a daemon of its own is taken over where it stands, and a port later held by anything else stops the start with the port, the process and its command named, leaving the address as it was. The port bump and its option are removed. Registering a project, which enabling the extension, init and update all run, takes over or starts the one daemon and writes only its own project's MCP entry, and an MCP file is rewritten only when its address changes. The tests that pinned the old behaviour are rewritten. The next phase clears strays and quiets the log.

- [ ] The daemon's address is chosen once, stored in the InDusk home, and printed so that setting up a project can hand it to an application.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/daemon-address.ts`: `PORT_BLOCK = { traces: 24318, logs: 24319, ui: 24316, mcp: 24317 }` (the only place those numbers appear); `chooseAddress(holders, ownDaemonPorts, home, findFree) → { kind: "chosen"; address } | { kind: "refuse"; holders }` (a block port free or held by this home's daemon is kept; one held by a process that is not InDusk's is replaced by a port this home's running daemon already holds for that role, else by `findFreePort(0)`, recorded in `picked` with the holder; one held by another home's InDusk daemon refuses); `readAddress(reads)`, and `daemonAddress(reads | home)` returning the traces, logs, interface and MCP URLs, exported from the package for `init`. `DaemonReads` gains `address()` and `writeAddress(a)`, writing `<home>/telemetry-address.json` with `flag: "wx"` under `<home>/telemetry.lock`; nothing else writes or removes it, `stop` included. New command `indusk telemetry address [--json]` in `apps/indusk-mcp/src/bin/cli.ts` and `apps/indusk-mcp/src/bin/commands/telemetry.ts`: prints the address, or says none is stored and exits 1, never choosing. `findDaemon` labels roles by the stored address before Jaeger's defaults. The readers that resolve the daemon (`status`, `resolveLocalDaemon`, `liveOtlpEndpointSync`, `demo`, `update`'s jaeger sync) take ports from the record or the address, never a literal. Author A29 in `apps/indusk-mcp/src/__tests__/telemetry-address.test.ts`, and A3's first-setup cases (a held block port picked once and stored, another home's daemon refused) in `apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts`.

  </details>

- [ ] A person can choose the address again on purpose, and that is the only way it ever changes.
  <details><summary>Technical</summary>

  `resetAddress(reads)` in `apps/indusk-mcp/src/lib/telemetry/daemon-address.ts` re-runs `chooseAddress`, keeping any port this home's running daemon holds, writes the address under `<home>/telemetry.lock`, and returns the old and new address with a message naming that every application given the old address needs the new one. `indusk telemetry address --reset` prints it; a refusal (another home's daemon on a block port) exits 1. A refused later start names `telemetry address --reset` as the way out. Author A30 in `apps/indusk-mcp/src/__tests__/telemetry-address.test.ts`.

  </details>
- [ ] The evaluator sends its logs to the daemon's log channel, not to the traces port.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/eval/otel.ts:307-309` builds the log URL from the traces endpoint, which Jaeger answers 404. Extract `evalLogsEndpoint(address)` returning the stored logs URL (`/v1/logs` on the logs port), falling back to today's behaviour only for an explicit `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT`. Author A31 in `apps/indusk-mcp/src/__tests__/telemetry-readers-follow.test.ts`.

  </details>
- [ ] A start in the real home decides from what is running, the stored address and what holds its ports whether to report, take over, start or refuse, and never moves a port.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/start-plan.ts`: `startPlan(state, holders, home, { address }) → { kind: "running" } | { kind: "takeover"; meta; strays } | { kind: "start"; ports; store? } | { kind: "refuse"; holders } | { kind: "refuse-several"; listed }`, calling `chooseAddress` when no address is stored and never otherwise; `refusalText` naming port, process id and command, suggesting `reap` only for an InDusk holder of another home or an orphan; `ensureDaemon(by, reads, home, spawn)`. `daemonStart` (`apps/indusk-mcp/src/lib/telemetry/daemon.ts`) renders the yaml right before it spawns and, in the real home, binds all four roles to the stored address, the MCP port instead of `findFreePort(0)` (`daemon.ts:405, 228-230`); remove `allowPortBump` (`daemon.ts:64-72, 352-353`) and `--allow-port-bump` (`apps/indusk-mcp/src/bin/cli.ts:634-647`); add `--logs-port` and `--mcp-port`; all four port options accepted only when `homeKind` is temporary and refused by name otherwise. `daemonRestart` restarts on the stored address (`daemon.ts:541-553`). Start, takeover and every record or address write hold `<home>/telemetry.lock`. `start` and `status` print all four ports and whether any was picked. Author A1, A5, A11, A12 in `apps/indusk-mcp/src/__tests__/telemetry-start-plan.test.ts`; rewrite `apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts` for A4 and add `startPlan`'s later-collision refusal (address unchanged, nothing picked) to A3's (lines 95-102 deleted; 54-85 become "names the holder", with `reap` suggested only for an InDusk holder of another home or an orphan; line 87 holds in temporary homes only; Test Phase 1's holder-naming case stays); add A26's case (a temporary home never reads or writes the real home's address and never gets the block) to `telemetry-test-homes.test.ts`.

  </details>
- [ ] Registering a project takes over or starts the one daemon and writes only that project's MCP entry, and only when its address changes.
  <details><summary>Technical</summary>

  `telemetryRegister` (`apps/indusk-mcp/src/bin/commands/telemetry.ts:257-266`) calls `ensureDaemon("register")` instead of `daemonStart({ allowPortBump: true })`; on a refusal it still records the project, prints the refusal and exits 1 (the hook runner at `apps/indusk-mcp/src/bin/commands/extensions.ts:800-808` prints it for `init`, `update` and enabling). `syncAllRegisteredProjectsMcp` (`telemetry.ts:36-55`): register's call (`:280`) becomes an upsert of its own project only; `start` (`:103`) and `reset` (`:476`) drop it; `restart` (`:203`) re-points only entries naming exactly the old MCP port, and writes nothing when ports did not change. `jaegerEntryChange(current, port)` in `apps/indusk-mcp/src/lib/mcp-config.ts`; `upsertJaegerEntry` writes only on a change; `ensureMcpJson` adds `jaeger: { type: "http", url: "http://localhost:<stored mcp>/mcp" }` when `local-telemetry` is enabled and an address is stored, and no `jaeger` entry when none is. `INDUSK_SKIP_TELEMETRY_AUTOSTART=1` still skips the start. Author A16 in `apps/indusk-mcp/src/__tests__/telemetry-register.test.ts` and A17 in `telemetry-mcp-entries.test.ts`.

  </details>
- [ ] The system tests that pinned per-start ports and every-project syncing are rewritten to the new rules.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/__tests__/telemetry-mcp-port-sync.test.ts`: lines 77-96 become "restart keeps the stored address and leaves every entry byte-for-byte unchanged"; its second test is reversed (another project's stale URL is left alone); its third (`update` repairs its own project's entry) stays. `apps/indusk-mcp/src/__tests__/telemetry-restart-port-pin.test.ts` covers all four ports.

  </details>

#### Build Phase 3 Verification

- [ ] The start, register, port-guard and MCP-entry tests pass, and the files that depend on the changed modules still pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/telemetry-start-plan.test.ts src/lib/telemetry/port-guard.test.ts src/__tests__/telemetry-address.test.ts src/__tests__/telemetry-register.test.ts src/__tests__/telemetry-mcp-entries.test.ts src/__tests__/telemetry-test-homes.test.ts && pnpm exec vitest related --run src/lib/telemetry/daemon-address.ts src/lib/telemetry/start-plan.ts src/lib/telemetry/daemon.ts src/lib/telemetry/daemon-state.ts src/bin/commands/telemetry.ts src/bin/cli.ts src/lib/mcp-config.ts src/lib/eval/otel.ts && pnpm exec vitest run src/__tests__/telemetry-readers-follow.test.ts` — A1, A3, A4, A5, A11, A12, A16, A17, A26, A27, A29, A30, A31 green; rows' State updated in the same edit.

  </details>
- [ ] The rewritten system tests pass: a temporary-home daemon on four given ports, restart keeping them, and project entries left alone.
  <details><summary>Technical</summary>

  `pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-cli-lifecycle.test.ts src/__tests__/telemetry-mcp-port-sync.test.ts src/__tests__/telemetry-restart-port-pin.test.ts` — A2 green.

  </details>
- [ ] The check against this machine's own daemon runs again and now gets past the takeover and the finding, failing only on the ports and the reports later steps provide.
  <details><summary>Technical</summary>

  `INDUSK_LIVE_CHECK=daemon-found-not-guessed pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-daemon-found-live.test.ts` — A15 still red, now on the stored address (the daemon still on 4318, 16686, 62843 and 62841 until the restart in Build Phase 5) and on the reports; `start` took over and `status` found the daemon; `ls ~/.indusk/telemetry.json ~/.indusk/telemetry-address.json` shows the record present afterwards and the address chosen; `node apps/indusk-mcp/dist/bin/cli.js telemetry address` prints it (24318, 24319, 24316, 24317 if the block was free).

  </details>

#### Build Phase 3 Context

- [ ] The package's context file states how the daemon's address is chosen and kept, the temporary-home rule and that a project's MCP entry is written only on a change.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry": replace "the daemon's sync edits only the local copy's `jaeger` port" with "`register` writes only its own project's `jaeger` entry, at the stored MCP port, and only when it differs; nothing re-points another project's entry". New rule: "The real home's daemon runs on the address in `<home>/telemetry-address.json`, chosen once (`PORT_BLOCK` 24316-24319, or a port picked once for a block port held at first setup) and never moved; no code names a daemon port but `daemon-address.ts`; a stored port later held by a stranger is refused by name; port options are accepted only in a temporary home; `indusk telemetry address` is how anything else learns it. — guarded by `port-guard.test.ts`, `telemetry-start-plan.test.ts` and `telemetry-address.test.ts`." "Tests" section: Jaeger tests start the daemon in a temporary home on ports the test gives it.

  </details>

#### Build Phase 3 Document

- [ ] The telemetry reference, the getting-started guide, the always-on guide and the extension's own files describe the daemon's own ports and how the address is chosen and handed out, taking over and the refusal, and no longer mention a port bump.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/telemetry/cli.md`: `start` taking over, the stored address and how it is chosen, `telemetry address` (`--json`), port options limited to temporary homes, `restart` keeping the address; remove `--allow-port-bump` and the text at lines 32-33; add a Mermaid flow (record, then process list and sockets, ending at running, takeover, start on the stored address after choosing it if none is stored, or refuse naming the holder). `apps/docs/src/reference/telemetry/overview.md`: a ports table (the block 24318 traces, 24319 logs, 24316 interface, 24317 MCP; a port picked once for any held at first setup; stored in `~/.indusk/telemetry-address.json`, never moved; why 4318 is left to a person's other tools) and the enable-time steps at lines 95-98 rewritten. `apps/docs/src/guide/getting-started.md:133`: the 1.36.2 sentence replaced. `apps/docs/src/guide/always-on.md` (lines 114-118, 251, 269): one sentence that a recording server keeps the standard 4318 and 16687 as its query port on Fly, being a dedicated machine, while the laptop daemon runs on InDusk's block. `apps/indusk-mcp/extensions/local-telemetry/skill.md:83` and `apps/indusk-mcp/extensions/local-telemetry/.env.example` (auto-bump paragraph; MCP line becomes the stored MCP URL, `http://localhost:24317/mcp` when the block was free, read with `indusk telemetry address`). Changelog (Unreleased): "Changed: the local daemon runs on InDusk's own ports (24318 traces, 24319 logs, 24316 interface, 24317 MCP), or on ports picked once in place of any held at first setup, and the address never moves; a recording server keeps 4318. Changed: an application no longer reaches the local daemon on the SDK's default 4318. Added: `indusk telemetry address`. Changed: `start` and `init` take over a running InDusk daemon, and a stored port later held by another process is refused, naming it. Removed: `--allow-port-bump`."

  </details>

### Build Phase 4: Reap clears strays, and Jaeger stops tracing itself

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase finishes the clean-up commands and the log. Reap now stops every daemon process of this home that the record does not name, as well as orphans whose config file is gone, and only within this home; it never touches a test's daemon from the real home or a process that is not InDusk's, and it says which processes it stopped and which would not stop. Jaeger's own tracer, which wrote two-thirds of the daemon's log failing to reach a port nobody listens on, is switched off in every Jaeger configuration InDusk renders or ships. Status learns to count any such lines written since the running daemon started, so the next phase can report them. The next phase sends every clause's report.

- [ ] Reap stops this home's strays and orphans, leaves everything else alone, and says what it stopped and what would not stop.
  <details><summary>Technical</summary>

  New `apps/indusk-mcp/src/lib/telemetry/reap-plan.ts`: `reapPlan(state)` returns strays plus orphans of this home only (today's `reapOrphans()` reaps every orphan on the machine, `apps/indusk-mcp/src/lib/telemetry/orphans.ts:109`). With no record, reap stops nothing and tells the person to run `telemetry start` first. The reap command prints each stopped process and exits non-zero naming each survivor. Rewrite `apps/indusk-mcp/src/lib/telemetry/orphans.test.ts`: lines 72-78 stay true for orphans; "reap leaves the live one alone" becomes "leaves the recorded one alone"; fixtures name `<home>/telemetry-collector.yaml` with `INDUSK_HOME` set to the fixture root. Author A20 and A21's reap half in `apps/indusk-mcp/src/__tests__/telemetry-reap-plan.test.ts`, and A25 in `apps/indusk-mcp/src/__tests__/telemetry-own-only.test.ts`.

  </details>
- [ ] Every Jaeger configuration InDusk renders or ships switches off Jaeger's own tracing.
  <details><summary>Technical</summary>

  Add `enable_tracing: false` under `jaeger_query` in `renderJaegerConfig` (`apps/indusk-mcp/src/lib/telemetry/daemon.ts:221-227`), in `packages/telemetry-binaries-shared/jaeger-config.yaml` and its four platform copies (`packages/telemetry-binaries-{darwin-arm64,darwin-x64,linux-arm64,linux-x64}/jaeger-config.yaml`), and in `renderServerConfig` (`apps/indusk-mcp/src/lib/telemetry/server.ts:285`). Remove the "Noise, not an error" comment at `apps/indusk-mcp/templates/server/Dockerfile:34-35`. `jaeger validate` rejects unknown keys, so a misspelling fails at start.

  </details>
- [ ] Status counts the lines of Jaeger failing to trace itself written since the running daemon started.
  <details><summary>Technical</summary>

  `selfTracingLines(lines): { count: number; first?: string }` in `apps/indusk-mcp/src/lib/telemetry/daemon-state.ts` (a line containing `4317` and either `traces export` or `addrConn.createTransport failed`). `daemonStart` records `logOffset` (the size of `telemetry.log` just before spawn) on the record; for a found daemon, `reads.logSince({ time })` scans back from the end to the first line timestamped before Jaeger's start, reading both `2026/10/16 19:13:04` and `2026-10-16T19:13:17.583-0400`.

  </details>

#### Build Phase 4 Verification

- [ ] The reap, own-only and self-tracing tests pass, and the files that depend on the changed modules still pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/telemetry-reap-plan.test.ts src/__tests__/telemetry-own-only.test.ts && pnpm exec vitest related --run src/lib/telemetry/reap-plan.ts src/lib/telemetry/orphans.ts src/lib/telemetry/daemon.ts src/lib/telemetry/daemon-state.ts src/lib/telemetry/server.ts src/bin/commands/telemetry.ts` — A20, A25 green; A21 written, its report half waiting for Build Phase 5. `pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-reap-strays.test.ts src/__tests__/telemetry-self-tracing.test.ts src/lib/telemetry/orphans.test.ts` — A22, A23 green. Rows' State updated in the same edit.

  </details>

#### Build Phase 4 Context

- [ ] The package's context file records that reap stops this home's strays and that Jaeger's own tracing is off.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry": extend "self-metrics off via `service.telemetry.metrics.level: none`" with "and its own tracing off via `jaeger_query.enable_tracing: false` (the only setting that silences it; `service.telemetry.traces` and `OTEL_*` do not)"; add "`reap` stops this home's strays (own processes the record does not name) and orphans, never another home's or a stranger's. — guarded by `telemetry-reap-plan.test.ts`, `telemetry-own-only.test.ts`."

  </details>

#### Build Phase 4 Document

- [ ] The telemetry reference and the troubleshooting guide say reap stops strays, and the changelog says the log is quiet.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/telemetry/cli.md`: `reap` stops strays as well as orphans, scoped to this home. `apps/docs/src/guide/getting-started.md:123-133`: `reap` in the recovery path. Changelog (Unreleased, Changed): "`telemetry reap` stops strays"; "Jaeger no longer logs failing to trace itself."

  </details>

### Build Phase 5: Each clause sends its signal, and this machine's daemon proves it

**Tier**: med — the work step's default (`workflow.steps.work.tier`)

This phase makes the promise heard in the running system. Each part of the promise is reported as a span sent to the local daemon by the InDusk command that knows the answer, at the moment it knows it: status reports the ports, strays and log; start and restart report once their daemon is ready or taken over; register reports at its end; reap reports what remains; a command that finds a lost daemon reports the finding, and also reports that the record had been lost, since nothing could report it at the moment it was lost; and a promise reader that reaches the daemon through an intact record reports that, at most once a quarter hour per project. The reports carry the promise, upheld or broken, and the part of the promise they concern, under their own service so the reader's frequent heartbeat cannot crowd them out. Then this machine's daemon is restarted onto its stored address and the live check runs once against it, with its result recorded here. This is the last build phase; the close-out rituals follow.

- [ ] Each report names the part of the promise it concerns, and is sent without the evaluator's tracing setup.
  <details><summary>Technical</summary>

  Add `clause: "indusk.clause"` to `PROMISE_MARK` in `apps/indusk-mcp/src/lib/promises/vocabulary.ts` (the key D1 of `mark-first`'s proposed ADR, on branch `plan/mark-first`, names: a signal's spans carry the promise and the clause). `watcherSpanBody` in `apps/indusk-mcp/src/lib/promises/probe.ts` gains span events and a service-name argument. New `apps/indusk-mcp/src/lib/telemetry/daemon-reports.ts`: `daemonReports(moment: "status" | "started" | "restarted" | "takeover" | "found" | "register" | "reap" | "read", state) → Report[]` (each with `clause`, `outcome`, `symptom` opening with the clause name, attributes); `sendDaemonReports(otlpPort, reports, post?)` posting to the recorded or found daemon's traces port only after `daemonProcessOf` confirmed it, a 2 s timeout, never throwing, under service `indusk-telemetry`; promise fields set by `markPromise` (`apps/indusk-mcp/src/lib/promises/mark.ts`) so broken uses the wire word every writer uses today; no `indusk.project` on telemetry-command reports. Add the reporter to `apps/indusk-mcp/src/lib/promises/signal-writers.test.ts`. Author A6, A14, A18, A24 in `apps/indusk-mcp/src/__tests__/telemetry-daemon-reports.test.ts` and A21's report half in `telemetry-reap-plan.test.ts`.

  </details>
- [ ] Status, start, restart, register, reap and every finder send their reports at the moment they know the answer.
  <details><summary>Technical</summary>

  Wire per the ADR's D9 table: `status` (one-daemon-on-its-own-ports, the-log-is-readable on every run that finds a daemon); `start` and `restart` once ready or after a takeover (one-daemon-on-its-own-ports; a start that spawned also a-lost-daemon-is-found after reading the process list); `register` at its end (nothing-starts-a-second, with the project and found, took over or started; nothing on a refusal); `reap` at its end to the recorded daemon (strays-are-cleared; nothing when no daemon is recorded); every finder whose exclusive create succeeded (a-lost-daemon-is-found upheld and a-read-never-loses-the-daemon broken, symptom `a-read-never-loses-the-daemon: the record was missing while jaeger <pid> (started <t>) ran; found by <command>`). The evaluator's post is fire-and-forget. A refused start sends nothing: no InDusk daemon is there to receive it.

  </details>
- [ ] A promise reader that reaches the daemon through its record reports it, at most once a quarter hour per project.
  <details><summary>Technical</summary>

  In `resolveLocal`'s probe path (`apps/indusk-mcp/src/lib/promises/sources.ts:306-311`): when resolved via the record, send a separate `indusk-telemetry` span (a-read-never-loses-the-daemon upheld, the reader's `indusk.project`) beside the `indusk-watcher` probe, throttled by the mtime of a stamp file in the home (`<home>/telemetry-read-report.<project>.stamp`) against an injected clock, 15 minutes. Author A9 in `telemetry-daemon-reports.test.ts`.

  </details>
- [ ] This machine's daemon is restarted onto its stored address, and every registered project that named its old MCP port is pointed at the new one.
  <details><summary>Technical</summary>

  `pnpm build` then `node apps/indusk-mcp/dist/bin/cli.js telemetry address` (the address chosen in Build Phase 3; 24318, 24319, 24316, 24317 if the block was free) and `node apps/indusk-mcp/dist/bin/cli.js telemetry restart`; expected: jaeger and otelcol with new process ids on the stored address, nothing left listening on 4318 or 16686, and `.mcp.json` entries that named `http://localhost:62843/mcp` now name the stored MCP URL (the restart re-points only those). The in-memory store is emptied by this restart, so every promise reads no signal until its next report. Check with `lsof -nP -iTCP:24316-24319 -sTCP:LISTEN` (or the stored ports, if any were picked). Anything on this machine that sent traces to 4318 now reaches nothing until it is given the stored address.

  </details>
- [ ] Sandy has agreed that the live check sends one real broken report, and no promise watch runs while it does.
  <details><summary>Technical</summary>

  The ADR's first risk: moving the record aside sends a real broken report for `a-read-never-loses-the-daemon`; with no production source in this repository, a `promises watch` run inside the health window would open an incident and reopen this plan with a Maintenance phase. Confirm with Sandy, and check `ps -axo command= | grep "promises watch"` is empty before the run.

  </details>

#### Build Phase 5 Verification

- [ ] The report tests pass, the reap report test passes, and the files that depend on the changed modules still pass.
  <details><summary>Technical</summary>

  `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/telemetry-daemon-reports.test.ts src/__tests__/telemetry-reap-plan.test.ts src/lib/promises/signal-writers.test.ts && pnpm exec vitest related --run src/lib/telemetry/daemon-reports.ts src/lib/promises/vocabulary.ts src/lib/promises/probe.ts src/lib/promises/sources.ts src/bin/commands/telemetry.ts` — A6, A9, A14, A18, A21, A24 green; rows' State updated in the same edit.

  </details>
- [ ] The live check passes on this machine and its result is recorded in this plan.
  <details><summary>Technical</summary>

  `INDUSK_LIVE_CHECK=daemon-found-not-guessed pnpm exec vitest run --config vitest.system.config.ts src/__tests__/telemetry-daemon-found-live.test.ts` — A15 green: `start` took over, `status` found the daemon, one Jaeger and one collector on the stored address, `indusk promises status` in this repository shows the promise broken naming `a-read-never-loses-the-daemon`, and the interface (the stored interface port, `http://localhost:24316` if the block was free, service `indusk-telemetry`) shows two upheld `a-lost-daemon-is-found` reports. Record the date, the process ids and the result in Notes.

  </details>
- [ ] Jaeger's memory store is checked to return a fresh broken report once more traces than the query limit are stored.
  <details><summary>Technical</summary>

  In a temporary home, start a daemon on given ports, post 1,600 upheld `indusk-telemetry` spans for the promise, then one broken; query `/api/traces?service=indusk-telemetry&tags={"indusk.promise":"the-daemon-readers-follow-is-the-one-running"}&limit=1500` and check the broken one is among the results. Expected: present. If absent, record it in Notes and lower the throttle's volume or query by outcome; this is the ADR's "query order is assumed" risk.

  </details>

#### Build Phase 5 Context

- [ ] The package's context file says where this promise's reports come from and why they do not use the evaluator's tracing setup.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/CLAUDE.md`, "Promises and telemetry": "The daemon promise's reports are sent by `daemon-reports.ts` through the SDK-free span path (`watcherSpanBody`), under `indusk-telemetry`, with `indusk.clause`; never through `initEvalOtel`, which is off when the record is missing and follows `OTEL_EXPORTER_OTLP_ENDPOINT`. A loss is reported by whoever finds it. — guarded by `telemetry-daemon-reports.test.ts`, `signal-writers.test.ts`." And `current.md` (Project, shared): this machine's daemon is on its stored address (`indusk telemetry address`); applications that sent to 4318 need that address; projects whose `.mcp.json` named another old port move on their own `indusk update`.

  </details>

#### Build Phase 5 Document

- [ ] The decision is published in the docs, and the telemetry reference says which command sends which report.
  <details><summary>Technical</summary>

  New `apps/docs/src/decisions/daemon-found-not-guessed.md` from the ADR. `apps/docs/src/reference/telemetry/overview.md`: a section on the promise's signal (the D9 table in plain words: which command reports which part, when, under `indusk-telemetry`). Changelog (Unreleased, Changed): "The local daemon reports whether it is the one every reader follows, as the promise `the-daemon-readers-follow-is-the-one-running`."

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/telemetry/daemon-process.ts` | new: one parser and three predicates for an InDusk daemon process |
| `apps/indusk-mcp/src/lib/telemetry/daemon-reads.ts` | new: `DaemonReads`, `realDaemonReads` (ps, lsof, `/proc`) |
| `apps/indusk-mcp/src/lib/telemetry/daemon-state.ts` | new: `daemonState`, `renderStatus`, `findDaemon`, `resolveLocalDaemon`, `selfTracingLines` |
| `apps/indusk-mcp/src/lib/telemetry/daemon-address.ts` | new: `PORT_BLOCK`, `chooseAddress`, `readAddress`, `daemonAddress` (exported for `init`); `<home>/telemetry-address.json` |
| `apps/indusk-mcp/src/lib/telemetry/start-plan.ts` | new: `startPlan`, `ensureDaemon` |
| `apps/indusk-mcp/src/lib/telemetry/reap-plan.ts` | new: `reapPlan` |
| `apps/indusk-mcp/src/lib/telemetry/daemon-reports.ts` | new: `daemonReports`, `sendDaemonReports`, the throttle |
| `apps/indusk-mcp/src/lib/telemetry/status.ts` | `daemonStatus` stops deleting the record; `liveOtlpEndpointSync` over the resolver |
| `apps/indusk-mcp/src/lib/telemetry/daemon.ts` | the stored address, no bump, `enable_tracing: false`, restart keeps the address, `logOffset` |
| `apps/indusk-mcp/src/lib/telemetry/orphans.ts`, `stop.ts` | use `daemonProcessOf`; reap scoped to this home |
| `apps/indusk-mcp/src/lib/telemetry/server.ts` | `enable_tracing: false` in the server's Jaeger config |
| `apps/indusk-mcp/src/lib/process-identity.ts` | `psAll()` whole-list read |
| `apps/indusk-mcp/src/lib/mcp-config.ts` | `jaegerEntryChange`; write on change; `ensureMcpJson` adds `jaeger` |
| `apps/indusk-mcp/src/lib/promises/vocabulary.ts`, `probe.ts`, `sources.ts`, `telemetry.ts`, `look-standing.ts` | `indusk.clause`; span body events and service; readers through the resolver; reader report |
| `apps/indusk-mcp/src/bin/commands/telemetry.ts`, `update.ts`, `demo.ts`, `apps/indusk-mcp/src/bin/cli.ts` | register via `ensureDaemon`, own entry only; options; `telemetry address`; resolver |
| `apps/indusk-mcp/scripts/check-test-daemons.js` | parity copy of `daemonProcessOf` |
| `apps/indusk-mcp/templates/server/Dockerfile` | remove the "Noise, not an error" comment |
| `packages/telemetry-binaries-*/jaeger-config.yaml` | `enable_tracing: false` |
| `apps/indusk-mcp/vitest.tiers.ts` | new system-tier files |
| `apps/indusk-mcp/src/__tests__/telemetry-*.test.ts`, `apps/indusk-mcp/src/lib/telemetry/port-guard.test.ts`, `orphans.test.ts`, `port-listening.test.ts`, `apps/indusk-mcp/src/lib/eval/otel.test.ts`, `apps/indusk-mcp/src/__tests__/helpers/local-jaeger.ts`, `apps/indusk-mcp/src/__tests__/helpers/daemon-reads.ts` | new and rewritten tests and helpers |
| `apps/indusk-admin/src/__tests__/http-promise-health.test.ts`, `http-watcher-blind.test.ts` | follow the stand-in's new shape |
| `apps/indusk-mcp/extensions/local-telemetry/skill.md`, `.env.example` | the stored address, no bump |
| `apps/docs/src/reference/telemetry/cli.md`, `overview.md`, `apps/docs/src/guide/getting-started.md`, `always-on.md`, `apps/docs/src/changelog.md`, `apps/docs/src/decisions/daemon-found-not-guessed.md` | docs |
| `CLAUDE.md`, `apps/indusk-mcp/CLAUDE.md` | Key Decisions line; telemetry rules |

## Dependencies

- None: the brief depends on no other plan. `mark-first` (a later child of the telemetry-from-day-one master, which teaches readers to key a break by its clause) depends on this one; it reads the `indusk.clause` key this plan adds.
- `lsof` on macOS (present by default); on Linux, `lsof` or a readable `/proc`.

## Notes

- **Signal, not tests.** Each clause's signal is a span the running daemon receives, sent by the InDusk command that knows the answer. Unit rows assert only what `daemonReports` decides from the reads it is handed; the live check is the one place a report is shown reaching a reader. A lost daemon cannot receive a span at the moment it is lost, so that break is reported by whoever finds it.
- **Decided by Sandy, 2026-10-16** ("agreed", on the nine recommendations put after the port change): the live check may send one real broken report, run only with `INDUSK_LIVE_CHECK` set; a later collision on a stored port refuses, names the holder and exits non-zero from `start` and `register`, while `init`, `update` and enabling finish with the refusal printed; the evaluator's log port is fixed here (the task above, row A31); clauses that report only when a telemetry command runs are accepted; the 15-minute throttle and the `indusk-telemetry` service split stay; `indusk telemetry address --reset` is added (row A30) as the one way the address changes; a lost address file with no daemon running may come back on different picked ports, accepted and named by `--reset`'s message; the MCP server stays on 24317; another home's daemon on a block port refuses rather than taking free ports. Still open, not blocking: making `lsof` a stated requirement instead of the `/proc` fallback. An SDK exporting to its default (4318 over HTTP, 4317 over gRPC) reaches nothing on the laptop until the application is given the stored address, which is `a-new-project-starts-instrumented`'s.
- **Projects still naming an old MCP port.** The restart in Build Phase 5 re-points only entries naming exactly the daemon's old MCP port (62843 on 2026-10-16). Any project naming another old port, such as 54677, moves at its own next `indusk update`.
- **Live check result:** recorded here at Build Phase 5.
