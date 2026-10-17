---
title: "The daemon is found, not guessed"
date: 2026-10-16
status: accepted
---

# The daemon is found, not guessed

## Goal

**One InDusk telemetry daemon per machine, on InDusk's own ports, chosen once and stored, that every reader, every InDusk command and every application reaches; a read never loses it, a lost one is found from the process list, nothing starts a second, and its own commands clear what InDusk left behind.**

On 2026-10-16 this machine ran three Jaegers and four collectors, with no record naming any of them. Applications reached the Jaeger on 4318. Claude Code's `jaeger` MCP entry reached a second one, on 54677. Every promise reader said no daemon was running, and the evaluator had written 2,303 "endpoint unset; falling back to no-op logger" lines. `telemetry start` refused, `reap` skipped all seven processes, and only killing them by hand cleared the machine. This ADR decides what makes each of those fail loudly or not happen at all.

## Y-Statement

**In the context of:**
the local telemetry daemon (a Jaeger for traces and an otelcol for logs, started by the `local-telemetry` extension), whose only identity today is a record of two files under `~/.indusk` (`telemetry.json` and `telemetry.pid`). Every promise reader, the evaluator, `update` and the automatic start that `init` triggers follow that record, and every promise that `mark-first` (a later child of the telemetry-from-day-one master, the plan for how InDusk reads a signal: closing a plan, a promise's standing, a break keyed by its clause) will close on is read through this daemon.

**Facing:**
a status read that deletes the record when a port is slow to answer. An automatic start that, finding no record, starts a second daemon on random ports and re-points every registered project's MCP entry at it. A `start` that refuses to take over a daemon it could identify from `ps`. A `reap` that only stops processes whose config file is gone. A log that is two-thirds Jaeger failing to send its own traces to `localhost:4317`. And a traces port, 4318, that is every OpenTelemetry tool's default, so the tools a person already runs are the likeliest to hold it.

**We decided for:**
one address per machine, chosen once at first setup and stored in the installed InDusk's home: InDusk's own port block (24318 traces, 24319 logs, 24316 interface, 24317 MCP), or a free port picked once in place of any block port a process that is not InDusk's holds at that moment; kept across stop, restart and the record's loss, read by every reader and command, printed by `indusk telemetry address` for `init` to hand to an application, and any ports in a temporary home. One definition of an InDusk daemon process, by binary and config path. A record that only `start` writes over and only `stop` removes, rebuilt by whoever finds a running daemon in the process list. A `start` and a `register` that take over a found daemon and, once the address is stored, refuse, naming the holder, when a stranger holds one of its ports. A `reap` that stops every stray of this home. Jaeger's own tracing switched off. Each clause's signal sent as a span by the InDusk command that knows the answer, at the moment it knows it.

**And against:**
the standard 4318 on the laptop, which collides with the ecosystem's default and lets applications guess the address. A port bump of any kind, on every start, automatic or by flag, which moves the address. Refusing at first setup when a block port is held, which blocks setup over telemetry. Storing the address per project. Restarting a daemon found on old ports without being asked, which would erase its in-memory store. Judging identity by a port answering, by start time, or by the binary file still existing. Re-pointing other projects' MCP entries on every start. Sending the reports through the evaluator's OpenTelemetry SDK provider. Several daemons per machine, each on its own ports, the superseded `instance-ports` promise.

**To achieve:**
the promise `the-daemon-readers-follow-is-the-one-running` (every reader of promises, every InDusk command and every application on a machine reaches the same one local telemetry daemon) and its six clauses, each with a signal that the running daemon receives.

**Accepting:**
that an application no longer reaches the laptop daemon by its SDK's default port and needs the address `init` hands it, which is the sibling plan `a-new-project-starts-instrumented`'s to write. That a process not InDusk's taking a port of the stored address after first setup stops the daemon from starting until a person frees the port, because the address is never moved. That a daemon found on old ports keeps running there, reported broken, until someone runs `telemetry restart`. That readers such as the admin and the evaluator now write the record when they find a lost daemon. That some clauses report only when a telemetry command runs. That a lost daemon's break is reported when the loss is found, not when it happens.

**Because:**
the process list and the listening sockets are facts the machine already holds, and a record rebuilt from them cannot disagree with what is running. InDusk is installed on someone else's machine, beside their own tools: a block of its own leaves the ecosystem's 4318 to them, and an address chosen once and handed out means a taken port can never split the writers, who were handed the address, from the readers, who read it. A refusal that names the holder can be acted on, while a bump moves the problem somewhere no one is looking.

## Context

[research.md](research.md) has the findings with file and line on trunk, and how this machine came to run seven processes. [brief.md](brief.md) makes one promise in six clauses, accepted on 2026-10-16. [test-plan.md](test-plan.md) is the clause plan: rows A1–A29 and U1–U3 at acceptance, A30–A37 added during the build, each clause's signal line, and the decisions it left to this ADR. This ADR answers "what makes every one of those rows true". Decisions taken after acceptance are recorded under [Amendments](#amendments-2026-10-17); each decision they change carries a pointer to them.

Sandy settled the following on 2026-10-16:
- The laptop daemon takes InDusk's own port block (24318 traces, 24319 logs, 24316 interface, 24317 MCP), not the standard 4318. The address is chosen once, stored, and handed to every application; a block port held at first setup is replaced by a free port picked once and kept. This replaces the design this ADR first proposed, four fixed ports on 4318, 4319, 16686 and 16687, with any held port refused.
- A deployed recording server keeps the standard 4318: it is a dedicated machine.
- Writing the stored address into each application is [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/)'s; this plan stores the address, makes every InDusk reader and command read it, and prints it for `init`.
- Test daemons keep their own ports in temporary homes.
- The store stays in memory.
- `instance-ports`' per-instance-ports promise is superseded.

The seven stray processes were killed by hand the same day. One daemon now runs: Jaeger PID 43599 on 4318 and 16686, with its MCP server on random port 62843 and its collector's logs receiver on 62841.

A design investigation on 2026-10-16 ran the bundled binaries in a temporary directory and read the code; its answers ground decisions D1–D10. It corrects two facts in research.md:
- The record deletion dates from the daemon's first commit, `138ec1b9f` (2026-04-20). Commit `383ca2ea4` (2026-09-19) only moved it.
- All 18 live registered `.mcp.json` files now name 62843, not 54677.

Three prior decisions are reversed:

- **`start` never takes over a running daemon** (2026-08-16, the docblock at `daemon.ts:348-350`: "without its PIDs the daemon cannot be managed"). The PIDs are readable from `ps`, and refusing left a person with only a bump or a kill. Reversed by D5.
- **The automatic start bumps ports** (2026-08-19, commit `31dcfd4ea`, `changelog.md:620`). It repaired 1.36.2, where the port guard made `init` fail on every machine already running a daemon. The repair started a second daemon, the defect this plan removes. Once the holder of the daemon's port is identified as InDusk's own daemon it is taken over, so the 1.36.2 case succeeds with no second daemon. Reversed by D6.
- **An orphan is a process whose config file is gone** (2026-08-16, `orphans.ts:13-18`). All seven survivors named config files that existed. The orphan rule stays, and a stray rule joins it. Reversed in part by D7.

## Decision

Each decision names the clause-plan rows it makes true. Every row cited is from [test-plan.md](test-plan.md). The decisions read as accepted on 2026-10-16; where the build changed one, a line at its end names the amendment.

**D1. InDusk's own port block, chosen once and stored machine-wide; a temporary home takes the ports it is given.** In the real InDusk home the daemon runs on one stored address: four ports for Jaeger's OTLP/HTTP receiver (traces), the collector's logs receiver, Jaeger's interface and Jaeger's MCP server. The default is InDusk's block, `PORT_BLOCK = { traces: 24318, logs: 24319, ui: 24316, mcp: 24317 }`, the only place those numbers appear in code.
- **Why a block of its own:** 4318 is every OpenTelemetry tool's default, so the tools a person already runs are the likeliest to hold it, and an application that reaches the daemon by its SDK's default has guessed the address. InDusk is installed on someone else's machine; it takes ports the ecosystem does not use and hands the address out.
- **Where it is stored:** `<home>/telemetry-address.json`, in the installed InDusk's home (`~/.indusk`), beside the record but separate from it: `{ traces, logs, ui, mcp, chosenAt, picked: [{ role, blockPort, holder }] }`. It is written once, with an exclusive create (`flag: "wx"`) under `<home>/telemetry.lock`. `stop` never removes it, a finder never rewrites it, and nothing moves it.
- **Why machine-wide, not per project:** one daemon serves every project on the machine, so every project, every reader and every application must agree on one address. An address stored per project would let two projects choose two addresses, the split between writers and readers again. The record cannot hold it either: `stop` removes the record and a finder rebuilds it from what is running, while the address must outlive both.
- **Choosing, once:** the first start, restart, register or takeover that finds no address stored chooses it. Each block port that is free, or held by this home's own daemon, is kept. Each held by a process that is not InDusk's is replaced by a free port picked once (`findFreePort(0)`), and the start prints the held port, the holder's PID and command, and the port picked instead, then starts and exits zero. A block port held by another home's InDusk daemon is refused, naming it and suggesting `reap` or `stop`, since one daemon per machine is the rule (D2). Readers never choose; `telemetry address` never chooses.
- **A lost address file:** the next start chooses again by the same rule, and for each held block port it reuses the port this home's running daemon already holds for that role before picking a new one. A daemon on the block or on picked ports therefore keeps its address. With no daemon running, a lost file can yield new picked ports; an application handed the old address then reaches nothing until `init` hands it the new one (named under Risks).
- **A later collision:** once an address is stored, a start that finds one of its ports held by a process that is not InDusk's own daemon starts nothing, picks nothing and leaves the address as it was. It exits non-zero and names the port, that process's PID and its command (read with `lsof -nP -iTCP:<p> -sTCP:LISTEN -Fpc`, then `ps -o command= -p <pid>`). It never moves the address, because every application `init` configured was handed that address, and moving it is the split this plan removes. `reap` is suggested only when the holder is an InDusk daemon of another home, or an orphan.
- **Removed:** `allowPortBump` (`daemon.ts:64-72, 352-353`) and `--allow-port-bump` (`cli.ts:634-647`) are deleted.
- **Port options:** `--otlp-port` and `--ui-port`, plus new `--logs-port` and `--mcp-port`, are accepted only in a temporary home and refused by name in the real one. A temporary home is one under a temp root, per D2. It starts on the ports it is given or on any free ones, never reads or writes the real home's stored address, and so a test daemon never takes the block.
- **Handed out:** `indusk telemetry address` prints the stored address (`http://localhost:<traces>` for traces, `http://localhost:<logs>` for logs, the interface, and `http://localhost:<mcp>/mcp`); `--json` prints it for `init` to write into an application. `daemonAddress(home)` returns the same and is exported from the package. With nothing stored, both say so and the command exits non-zero. [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/) consumes it.
- **Every reader reads it:** every port InDusk uses for the laptop daemon comes from the stored address or from the record: `status`, the promise readers, the evaluator, `demo`, `update`'s jaeger sync and the `jaeger` entry in `.mcp.json`. A unit test scans those modules for a port literal.
- **Printing:** `start` and `status` print all four ports and whether the address is the block or has picked ports.
- **Restart:** `daemonRestart` restarts on the stored address. Today it keeps only traces and the interface (`daemon.ts:541-553`).
- **Known limit:** an SDK exporting to its default (4318 over HTTP, 4317 over gRPC) reaches nothing on the laptop until the application is given the address. Jaeger's OTLP gRPC receiver stays on a random port.
- **The recording server:** a deployed server keeps the standard 4318, because it is a dedicated machine, and 16687 stays its public query port on Fly (`fly-config.ts:18`). Only the laptop daemon gets the block, so the two no longer share a number for different things.
- **Amended 2026-10-17:** the address can be chosen again on purpose with `indusk telemetry address --reset` (amendment 1, which also narrows "a lost address file" above to what the code does); an address file that exists but cannot be read refuses a start, and the file is written whole (amendment 2); the refusal's suggestions (amendment 9).
- **Makes true:** A1 (with the block free, the first start puts the daemon on the block, stores it, and `start` and `status` print all four), A2 (a temporary-home daemon binds the ports it is given, and a log record sent to its logs port is written), A3 (a stranger on a block port at first setup: a free port is picked once and stored; a stranger on a stored port later: the start refuses, naming port, PID and command, and the address is unchanged), A4 (every start in the real home, automatic or by hand, uses the stored address, which survives stop, restart and the record's rebuilding), A29 (every reader and command reads the stored address, and `telemetry address` prints it) and A26 (a test's daemon never takes the block or the real home's address and runs only in the system tier).

**D2. One definition of an InDusk daemon process.** A process is an InDusk daemon process of home H when both hold:
- **(a)** its executable path matches `telemetry-binaries-<platform>/bin/(jaeger|otelcol)` (the regex at `orphans.ts:32`), from any install: the repo's `node_modules`, a global npm or mise install, or `packages/`. The binary file need not still exist, because the global install on this machine was relinked to the repo on 2026-10-09 and its 2026-10-02 collector ran from a path that no longer existed.
- **(b)** its `--config` is exactly `<H>/telemetry-jaeger.yaml` (Jaeger, given as `--config=file:<p>`) or `<H>/telemetry-collector.yaml` (otelcol). H is compared both as given and after resolving its real path, because a macOS temporary home `/var/folders/…` resolves to `/private/var/…`.

The role (Jaeger or collector) comes from the binary and config pair. Neither port nor start time is part of identity: `startedAt` is written only after both readiness waits, which can take 30 s, so the 5 s tolerance in `isOwnProcess` would fail a slow start.

**One parser, three predicates.** `daemonProcessOf(command) → {role, binary, configPath, home} | null` feeds:
- **own(H):** its home is H. Status, finding, taking over and `stop` use it; `stop.ts:51-53` already applies the equivalent.
- **temporary:** its home is under a temp root, the rule `scripts/check-test-daemons.js:22-24, 52` uses.
- **orphan:** its config file is gone (`orphans.ts:73`).

**Where the reads live.** The whole-process-list read (`LC_ALL=C ps -axo pid=,lstart=,command=`) joins `lib/process-identity.ts`, which `process-identity-single-definition.test.ts` pins as the one place `ps` is read. `check-test-daemons.js` must run without a build, so it keeps its own copy of the parser, held equal by a parity unit test that feeds both the same command lines.

A global install and a repo-local one are one owner: the home is the owner. A custom `INDUSK_HOME` outside a temp root is a real home with its own stored address. At its first setup the block is held by `~/.indusk`'s daemon, an InDusk daemon of another home, so it refuses rather than picking ports (D1): a daemon there and one in `~/.indusk` refuse each other, by design, keeping one daemon per machine.

Amended 2026-10-17: own(H) compares the config's directory with H as given; the real path is resolved only to judge a home temporary (amendment 9). `OwnProcess` and `ownProcess` live in `daemon-process.ts` (amendment 5).

Makes true: A10 (with the record missing, `status` finds the running daemon), A19 (`status` lists every stray with its PID, start time, ports and install), A20 (`reap` stops strays, including one whose config exists, and leaves strangers alone), A25 (taking over and reaping judge by command line, and never touch a stranger or a temporary-home daemon from the real home) and A26. Confidence moderate: the definition is new, and the parity test and A25 are its guards.

**D3. No read deletes the record; one resolver answers every reader.** `cleanupFiles()` is removed from `daemonStatus` (`status.ts:143-146`). The sweep existed so that `start` would not refuse "already running" over a recycled PID. That job moves into `start`, which judges the recorded PIDs by D2 and writes over a stale record. `stop` stays the one command that removes the record, and only when nothing of its own still runs.

Identity is read from one `ps -o pid=,command= -p <jaeger>,<otelcol>` call, never from a port. The resolver returns one of five states:
- **running:** both recorded processes are ours.
- **partial:** one is ours, and the state says which.
- **found:** the record is missing or stale, and the process list holds an own daemon. The record is rewritten (D4).
- **stale with nothing found:** reads not running, names the record and its PIDs, and keeps the file.
- **none.**

Port answers are for display only, three-way, reusing `connectOnce` (`status.ts:83-94`):
- **timeout:** "running — :<port> did not answer in <ms> ms (slow, not gone)".
- **refused while the process is ours:** "running — :<port> refused (starting, or that receiver failed)".

Readers then run their own query with their own timeout, and failures stay `JaegerUnreachable` or `WatcherBlind`, naming the URL.

Amended 2026-10-17: the audit found the code reading a stale record beside a running unrecorded daemon as "stale" and calling that daemon a stray, where this decision has it found; Build Phase 8 brings the code back to this decision (amendment 7). A reader reaches the daemon only in the running and found states; a partly running daemon reads to a reader as no daemon, and `status` reports it broken (amendment 3).

Every reader goes through this one resolver:
- `resolveLocal` (`sources.ts:99-112`), behind `promises status`, `watch`, `promise_health`, the admin and catchup
- the span reader when no endpoint is given (`promises/telemetry.ts:339-345`)
- look standing (`look-standing.ts:263`)
- the evaluator's `liveOtlpEndpointSync` (`status.ts:118-126`)
- `update`'s own-project jaeger sync (`update.ts:507-526`)
- `demo` (`demo.ts:64-84`)
- `telemetry reset`

Confidence high.

Makes true: A7 (no status read, health check, promise reader, admin page or evaluator lookup removes the record; slow reads as slow, and a stale record stays named), A8 (a busy reader reads a real daemon as slow and its record survives), A13 (with the record missing, `promises status`, the admin and the editor read the running daemon's traces) and A28 (the evaluator exports to the recorded or found daemon and writes no no-op-logger line while one runs).

**D4. A lost daemon is found from `ps` and its listening sockets, and its record is written again.** A finder reads the process list (D2), then the sockets each daemon process listens on: `lsof -nP -a -p <jaeger>,<otelcol> -iTCP -sTCP:LISTEN -Fpn`. lsof exits 1 whenever any selection is empty, so stdout is parsed and the exit code ignored. On Linux without lsof, `/proc/<pid>/fd` socket inodes are joined to the LISTEN rows of `/proc/net/tcp{,6}`.

The sockets are the truth, and roles are labelled in order:
1. **By the stored address** (D1).
2. **By Jaeger's own defaults,** 4318 for traces and 16686 for the interface, which a daemon started before this change uses (the one on this machine on 2026-10-16 does).
3. **For any other port, from the rendered yaml:** only when its mtime is not after the process start (with about 5 s allowed) and every port it names is among the sockets. After D5 a start renders the yaml only right before it spawns.
4. **Otherwise null:** status says which role it could not read. A port is never guessed.

A Jaeger is paired with the collector holding the stored logs port. Failing that, it is paired with the same-home collector that started closest after it, within 20 s.

When several own daemons run with no record, the finder takes the one holding the stored traces port, which is the one applications are handed, and lists the rest as strays. If none holds it, it takes none and lists them all. The finder never writes or changes the stored address.

**Writing the record.** The finder writes it with an exclusive create (`flag: "wx"`) under `<home>/telemetry.lock`, using the existing `acquireLockAsync` (`lib/agents/lock.ts:120`). Only the finder whose create succeeds sends the finding's reports (D9). The evaluator finds synchronously (`spawnSync` of `ps` and `lsof`) and writes the record the same way.

Amended 2026-10-17: the finder lives in `lib/telemetry/daemon-find.ts`, not `daemon-state.ts` (amendment 5); pairing is by start time only, and the order labels are applied in differs from the list above (amendment 9).

Makes true: A10 (ports read from sockets, not the config file, and the record written again), A12 (several daemons: take the one on the stored traces port and list the rest; none on them: take none and list all), A13 and A28. Confidence moderate: tested on macOS here, while the Linux `/proc` path is unexercised, and the impl carries a verification item for it.

**D5. `start` takes over a found daemon and never restarts one it was not asked to.** `start` decides with a pure `startPlan(state, holders) → takeover | start | refuse(holders)`:
- **The record names our running daemon:** report it, start nothing.
- **A daemon is found:** take it over. Write the record with its real ports, print "took over the running daemon" with its PIDs and ports, and exit zero.
- **None is found:** choose the address if none is stored, then preflight its four ports (D1), then start or refuse.

A daemon found on ports other than its stored address, such as the one now on this machine (traces 4318, interface 16686, MCP 62843, logs 62841), is taken over where it is and reported broken for `one-daemon-on-its-own-ports`, naming each port that differs. If no address is stored yet, the takeover chooses it first by D1's rule; a found daemon's own ports are never adopted as the address unless they are the block's. Only an explicit `telemetry restart` moves it. A restart triggered by `init`, `update` or `status` would erase every trace in the in-memory store. Every promise would then flip to no signal, and a broken report still waiting to open its incident would vanish. Start, takeover and every record write are serialized under `<home>/telemetry.lock`.

Makes true: A5 (a daemon on other ports: `status` says which differ, and `restart` brings it onto the stored address), A11 (record missing, daemon running: `start` takes it over, starts nothing and exits zero), A12 and A25 (after a takeover, `stop` stops that daemon and says, non-zero, if a process will not stop). Reverses the 2026-08-16 decision that `start` never takes over.

**D6. `register` ensures one daemon and writes only its own project's MCP entry.** `telemetryRegister` replaces `daemonStart({allowPortBump: true})` (`telemetry.ts:257-266`) with `ensureDaemon("register")`, which applies D5's `startPlan`, and so chooses the address at first setup. At first setup a held block port is replaced by a picked one and register succeeds. When a stranger holds a port of an address already stored, register still records the project, prints the refusal naming the holder, and exits 1.
- **Exit codes:** that later collision is the only refusal left to a first-time setup's commands. `init`, `update` and enabling the extension still finish. Their hook runner catches the failure and prints "<name>: on_enable hook failed" (`extensions.ts:800-808`), and the refusal reaches the person through inherited stdio. `init` does not fail on the daemon, the lesson of 1.36.2. Whether `init` should exit non-zero in that case is Sandy's, listed under Risks.

The MCP entries:
- **`upsertJaegerEntry` (`mcp-config.ts:86-95`):** writes only when the URL differs.
- **Where every project's entry is rewritten today:** `syncAllRegisteredProjectsMcp` (`telemetry.ts:36-55`), which upserts the jaeger entry of every project in the registry, is called by four commands: `start` (`telemetry.ts:103`), `restart` (`:203`), `register` (`:280`, after the start; its comment says it refreshes "ALL registered projects" because the MCP port changes per spawn) and `reset` (`:476`).
- **`register`:** its call at `:280` is replaced by an upsert of its own project's entry only, at the stored MCP port.
- **`start` and `reset`:** drop their calls entirely.
- **`restart`:** its call at `:203` is replaced. When it moves a daemon off old ports, it re-points only the entries that name exactly that daemon's old MCP port; when the ports do not change, it writes nothing. `nothing-starts-a-second` names enabling, `init` and `update`, not an explicit restart.
- **`ensureMcpJson` (`mcp-config.ts:54-70`):** adds `jaeger: http://localhost:<stored mcp>/mcp` when `local-telemetry` is enabled and an address is stored; with none stored it adds no `jaeger` entry, and the next register writes it. An `update` on a project that already has the extension never runs `register` (`extensions.ts:637`), so this is how such a checkout gets the entry.
- **Moving the 18 live entries off 62843:** each project's own `update` moves its entry (own-project-only and write-on-difference already, `update.ts:507-526`), or the one `telemetry restart` that moves this machine's daemon does.
- **`INDUSK_SKIP_TELEMETRY_AUTOSTART=1`:** still skips the start.

Makes true: A4, A16 (with a daemon running, `init`, `update` and enabling start none and register against it; with none running, they start exactly one on the stored address, choosing it first when none is stored), A17 (register points its own entry at the stored MCP port and leaves every other project's entry as it was), A18 (register's upheld or broken report) and A27 (start, restart and takeover leave a `.mcp.json` already on the stored MCP port unchanged; a checkout with none gets one naming `indusk` and `jaeger` at the stored MCP port). Reverses the 2026-08-19 decision that the automatic start bumps ports.

**D7. `reap` stops this home's strays as well as orphans.** A stray is an own process of this home (D2) that the record does not name. `reapPlan(state)` returns the strays plus the orphans, scoped to this home: today's `reapOrphans()` reaps every orphan on the machine, even when a test calls it. Reap never signals a temporary-home daemon from the real home or a process that is not InDusk's. It prints each process it stopped, and names each one that would not stop with a non-zero exit. With no record, reap stops nothing that a takeover might want: it lists every own daemon and tells the person to run `start` first.

Amended 2026-10-17: the audit found `reapPlan` returning this home's strays only, dropping the orphans this decision keeps; Build Phase 8 brings the code back to this decision (amendment 7). Reap reports to the recorded daemon only (amendment 8).

Makes true: A19, A20 (reap stops every stray, including one whose config exists, and leaves the recorded daemon and strangers alone), A21 (reap prints what it stopped, exits non-zero on one that will not stop, and reports) and A22 (two temporary-home daemons, the record naming one: reap stops the other, and the recorded one still receives traces). Reverses in part the 2026-08-16 decision that only a process with a missing config is reaped.

**D8. Jaeger's own tracing is switched off with `jaeger_query.enable_tracing: false`.** Measured with the bundled Jaeger 2.17.0, six variants side by side for about 50 s each:
- baseline: 17 lines containing `4317`
- `service.telemetry.traces.level: none`: 17
- `service.telemetry.traces.processors: []`: 18
- `OTEL_TRACES_EXPORTER=none`: 17
- `OTEL_SDK_DISABLED=true`: 16
- `jaeger_query.enable_tracing: false`: 0

Every variant still took traces. The noise comes from the query extension's own tracer, which ignores both `service.telemetry` and the `OTEL_*` variables. `jaeger validate` rejects unknown keys, so a misspelling fails loudly. Confidence high.

The key goes in three places:
- `renderJaegerConfig`'s `jaeger_query` block (`daemon.ts:221-227`)
- the shipped `packages/telemetry-binaries-shared/jaeger-config.yaml`
- `renderServerConfig`'s `jaeger_query` block (`server.ts:285`)

The comment "Noise, not an error" (`templates/server/Dockerfile:34-35`) is removed.

The start records `logOffset`, the size of `telemetry.log` just before it spawns. For a found daemon, status instead scans back from the end of the log to the first line timestamped before Jaeger's start. Two timestamp formats occur: `2026/10/16 19:13:04` and `2026-10-16T19:13:17.583-0400`. A self-tracing line is one containing `4317` and either `traces export` or `addrConn.createTransport failed`.

Makes true: A23 (the shipped Jaeger with the rendered config writes no self-tracing line over half a minute while traces and logs still arrive; the row names this key) and A24 (`status` counts such lines since the daemon started and reports).

**D9. Each clause's signal is a span sent by the InDusk command that knows the answer.** No usable tracer provider exists in the CLI. `initEvalOtel` (`eval/otel.ts:148-216`) is the wrong one for four reasons:
- `OTEL_EXPORTER_OTLP_ENDPOINT` overrides the daemon, so a shell exporting Dash0 would send these reports to Dash0.
- It is switched off exactly when the record is missing.
- Its batch processor needs a flush before exit.
- It is a global singleton under `indusk-eval-agent`.

The reports use the SDK-free path the watcher probe already uses (`watcherSpanBody` and `sendWatcherSpan` in `promises/probe.ts`), through a small reporter beside it:
- **Deciding:** a pure `daemonReports(moment, state) → Report[]` decides what to send.
- **Sending:** `sendDaemonReports(otlpPort, reports)` posts to the recorded or found daemon's traces port. It times out after about 2 s, never throws, and posts only after D2 has confirmed the daemon is InDusk's.
- **Promise fields:** each span's promise fields are set by the one function that already sets them (`markPromise` in `promises/mark.ts`). The wire word for broken therefore stays the one every InDusk writer uses today, and `mark-first` changes it once for all writers (`/decisions/one-promise-language`: readers take both spellings, writers switch together).
- **Clause key:** `indusk.clause` is added to `vocabulary.ts` as `PROMISE_MARK.clause`. It is the key named by D1 of `mark-first`'s proposed ADR (on branch `plan/mark-first`), the decision that a signal's spans carry both promise and clause. Today's readers do not read that key yet, so every broken symptom opens with the clause's name.
- **Span body:** `watcherSpanBody` gains span events and a service-name argument.
- **Service name:** the reports go under their own service, `indusk-telemetry`. The probe's volume, under `indusk-watcher`, would otherwise fill the 1,500-trace query limit (`promises/telemetry.ts:170`) through which broken reports are read. Readers list every service from Jaeger and query each (`promises/telemetry.ts:347-354`), so the new service is read with no reader change.
- **Wire-word check:** the reporter is added to `signal-writers.test.ts`.
- **Project:** reports from telemetry commands carry no `indusk.project`, which readers keep (`marksBetween`, `promises/telemetry.ts:281-305`).

| Clause | Who sends it, and when | Upheld | Broken (symptom opens with the clause name) |
|---|---|---|---|
| `one-daemon-on-its-own-ports` | `telemetry status` on every run that finds a daemon; `start` and `restart` once ready or after a takeover; each after reading the stored address, `ps` and `lsof`. Attributes: both PIDs, the four stored ports, block or picked (with each held block port and its holder) | one InDusk Jaeger and one collector hold the four ports of the stored address; ports picked at first setup are upheld | each extra InDusk process (PID, start time, ports), or each stored port the daemon does not hold, with the port it holds instead. A start refused by a stranger on a stored port sends nothing: no InDusk daemon is there to receive it. A second daemon started by an install older than this change is heard at the next `status` |
| `a-read-never-loses-the-daemon` | upheld: a promise reader (`promises status`, `watch`, `promise_health`, the admin), at the moment of its local probe, when `resolveLocal` reached the daemon through its record. It is its own span under `indusk-telemetry`, carrying the reader's `indusk.project`, sent beside the probe span (which stays under `indusk-watcher`), throttled to one per project per 15 min (stamp-file mtime in the home, injected clock). Broken: sent by whoever finds a lost daemon (`status`, `start`, `register`, `resolveLocal`, the evaluator, `update`), after it rewrote the record | a reader of this project reached the daemon through an intact record within the window | "a-read-never-loses-the-daemon: the record was missing while jaeger <pid> (started <t>) ran; found by <command>". A loss cannot be reported when it happens: the read that removed the record does not know it erred, and with no record no command knows where to send. Every loss found reads broken, because the finder cannot tell a faulty read from an older install or a person. The clause's other half, a slow port read as gone, sends nothing when a read errs that way without touching the record; its backstop is the brief's second expectation, the evaluator's no-op-logger lines |
| `a-lost-daemon-is-found` | the finder, after writing the record (found PIDs, ports, command); also every start that spawned a daemon, once ready, after reading the process list | a lost daemon was found and its record rebuilt, or a start had nothing beside it | a start finds another InDusk daemon beside the one it started, named by PIDs, start time and ports. A finder that cannot recognise a daemon sends nothing; the brief's first expectation (starts with no shutdown before them) is the backstop |
| `nothing-starts-a-second` | `register`, at its end. Attributes: the project, and whether it found, took over or started the daemon | no InDusk daemon beside the recorded one, and no other project's entry changed | the second daemon by both PIDs, or each other project's entry changed (path, old address, new). A refusal sends nothing |
| `strays-are-cleared` | `reap`, at its end, to the recorded daemon; nothing if there is none | no stray remains | each stray still running (PID, start time, ports) |
| `the-log-is-readable` | `status` while the daemon runs | zero self-tracing lines since this daemon started (D8) | the count and the first such line |

The throttle exists because each long-lived reader probes up to once every 30 s (`PROBE_CACHE_MS`), about 2,880 a day. Unthrottled, that would fill the query limit within about 13 hours of the 7-day window and turn every count into a lower bound. The evaluator's post is fire-and-forget, so in a short-lived hook process the report can be lost; the record is still written.

Row A9 of the clause plan, the assertion that a reader's read through the record sends an upheld report "on its probe", is read here as "at its probe": the report is sent at the probe's moment, as its own throttled span, not as attributes on the probe span, so the probe's volume never decides how many reports the window holds.

These reports are telemetry the running daemon receives. A test run produces none of a clause's signal: unit rows assert what `daemonReports` decides from the reads handed to it, and only the live check proves a report reaches a reader.

Amended 2026-10-17: the moments in the table above are narrowed to what the code sends (amendment 8); a finding's report names only the command that found the daemon (amendment 6); `promises status` words a break by the rule the admin uses (amendment 4).

Makes true: A6 (`status`'s report for `one-daemon-on-its-own-ports`), A9 (a reader's probe through the record carries the upheld report, and a reader that had to find the daemon sends the finding's broken one instead), A14 (the finding's two reports, and a start's report for `a-lost-daemon-is-found`), A15 (the live check: on this machine, `start` and then `status` each find the daemon with its record moved aside; one daemon remains on the stored address; `promises status` shows the promise broken naming `a-read-never-loses-the-daemon`; the interface shows both upheld finding reports), A18, A21 and A24. Confidence moderate: the throttle's 15 minutes and the service split are judgements. Jaeger's in-memory store returning the newest traces first once the limit is hit has also not been checked, and the impl carries a verification item for it.

**D10. Code that decides takes its reads; the daemon commands become thin shells.** One `DaemonReads` bundle carries:
- `record()` and `writeRecord(meta, exclusive)`
- `address()` and `writeAddress(address)` (exclusive create, once)
- `processes()`, `listening(pids)` and `holders(ports)`
- `stat(path)`, `logSince(offset | time)` and `now()`

These pure functions sit over it: `daemonProcessOf`, `homeKind`, `chooseAddress`, `daemonState`, `startPlan`, `reapPlan`, `daemonReports`, `selfTracingLines`, `jaegerEntryChange` and `renderStatus(state) → lines`. Every rule row is then a unit test (`lesson: code-that-decides-takes-its-clock-and-its-reads`). The four rows that start a real Jaeger (A2, A8, A22, A23) are contract tests in the system tier (`lesson: everyday-tests-never-wait`).

Tests that pin today's behaviour are rewritten, not added beside:
- **`port-guard.test.ts`:** lines 95-102 (`--allow-port-bump` restores the bump) are deleted, replaced by `startPlan` unit rows for A3 and A4. Lines 54-85 become "names the holder", and line 87 (port 0 means any) holds in temporary homes only.
- **`orphans.test.ts`:** lines 72-78 stay true for orphans. The file gains the stray rule (A20), and its fixtures name `<home>/telemetry-collector.yaml`.
- **`telemetry-mcp-port-sync.test.ts`:** lines 77-96 become "restart keeps the stored address and leaves entries byte-for-byte unchanged". Its second test is reversed (A17), and its third stays.
- **`telemetry-cli-lifecycle.test.ts`:** asserts all four ports printed (A1) and new PIDs on the same ports after a restart. `telemetry-restart-port-pin.test.ts` covers all four ports.
- **New `telemetry-address.test.ts`:** `daemonAddress`, `telemetry address` and the scan for port literals in reader modules (A29). `chooseAddress`'s cases (block, picked, another home's daemon refused, a lost file reusing a running daemon's ports) join `port-guard.test.ts` for A3 and A4.

Command-line identity breaks two helpers that write a record naming the test's own PID:
- **`startFakeQueryPort` (`helpers/local-jaeger.ts`):** used by five files, two of them in `indusk-admin`. It becomes a separate process with a daemon-shaped command line (a script at `…/telemetry-binaries-test-arch/bin/jaeger --config=file:<home>/telemetry-jaeger.yaml`, as `orphans.test.ts` already does).
- **`liveDaemon` in `otel.test.ts:203-245`:** takes injected reads.

Amended 2026-10-17: the modules and the reads bundle as built (amendment 5).

Makes true: every unit row, and A26. Confidence high.

## Amendments (2026-10-17)

Decisions taken after this ADR was accepted on 2026-10-16, each found while building or by the audit. The decisions above still read as accepted; each amendment says what changed and why. Rows cited are from the impl's Test Trajectory and, for A30–A42, from the clause plan's additions.

**Amendment 1 (D1). The address can be chosen again on purpose, by `indusk telemetry address --reset`, and by nothing else.** D1 said nothing moves the stored address, and Risks asked whether to offer a way to choose it again. Sandy decided on 2026-10-16 to offer one. `--reset` runs D1's choosing rule again under `<home>/telemetry.lock`. It keeps every port the running daemon's record holds, when the recorded Jaeger is still this home's. It replaces each block port a stranger holds with a free port. It writes the file, and prints the old and the new address and that every application given the old one needs the new one. It refuses and exits 1 when another home's InDusk daemon holds a block port. It is the way out of two refusals: a stored port that a stranger has taken for good (D1's later collision), and an address file that cannot be read (amendment 2). Both refusals name it. Row A30, the assertion that `--reset` chooses again by the same rule, keeps the running daemon's ports, prints old and new, and is the only way the address changes, holds it. So "never moved" in D1, in the brief and in the clause `one-daemon-on-its-own-ports` means never moved by InDusk on its own.

D1's "a lost address file" paragraph is built like this, by the same rule `--reset` uses:
- A start that finds the daemon running through its record chooses nothing; the address stays missing until a takeover, a start or `--reset`.
- A takeover keeps every port the taken daemon holds for its role, read from its sockets. A start beside a record whose Jaeger is alive keeps the ports that record holds, through `runningDaemonPorts`, the one read `--reset` uses. The address written again therefore says where the daemon is, and `status` reports no difference without a restart. A role the daemon holds no port for is chosen by the first-setup rule. Row A38, the assertion that a lost address file written again keeps every port the running daemon holds, holds it.

**Amendment 2 (D1). An address file that exists but cannot be read refuses a start by name, and the file is written whole.** The build first read a damaged file (cut short, or a port that is not a number) as no file, so the next start chose again, which D1 says never happens. Now `readAddress` tells three cases apart: none, stored, and unreadable. In the real home, a start, restart, register or takeover with an unreadable file refuses, names the file and what is wrong with it, chooses nothing, moves no port, leaves the file as it was, and points at `--reset`. `indusk telemetry address` says the file is unreadable and exits 1. The file is written to a temporary file first. A first-setup write then links it into place, which fails if a file is already there, so it stays an exclusive create. `--reset` renames it into place. Either way a reader sees the whole file or the old one. This replaces D1's `flag: "wx"` write. Row A33, the assertion that an unreadable file is never taken for a missing one and that the address is written whole, holds it. Found by the falsification phase, Build Phase 6.

**Amendment 3 (D3, D9). A partly running daemon is reported broken while its Jaeger lives.** D9's table had `status` report `one-daemon-on-its-own-ports` "on every run that finds a daemon". The build reported only a fully running one, so a daemon whose collector had died, the case the promise most needs heard, sent nothing. Now `status` also reports a partly running daemon when the recorded Jaeger is alive, since that Jaeger holds the traces port and can receive the report. The broken symptom names each recorded process that is gone and the stored ports it no longer holds, for example "otelcol 102 not running, no longer holding logs port 24319". When the recorded Jaeger is dead, nothing is sent: nothing is there to receive it. Row A32, the assertion that a record naming a running Jaeger and a dead collector makes `status` send a broken report naming both, holds it. Found by Build Phase 6. The resolver behind every reader decides what D3 left open: it follows the record in the running state and in the partly running state while the recorded Jaeger is alive, since traces and the interface are Jaeger's and only logs need the collector; a reader reports no daemon only when the recorded Jaeger is gone, so readers and `status` agree that the daemon is there and broken. Row A41, the assertion that a record naming a live Jaeger and a dead collector is reached by every reader through the record, holds it.

**Amendment 4 (D9). `promises status` says broken by the rule the admin and the editor use.** The live check, row A15 (on this machine, `start` and `status` each find the daemon with its record moved aside, and `promises status` shows the promise broken naming `a-read-never-loses-the-daemon`), was red only on wording: the command listed breaks but never printed "broken". Sandy chose to make status say it. `formatStatus` (`lib/promises/status.ts`) prefixes a behaviour promise's break count with "broken — " while a break is still live, or "broke — fixed — " when every break's incident is fixed, as decided by `healthOf` (`lib/promises/health.ts`), the rule the admin and the editor read. The falsification phase then found the command judging every section by the incident rule. It now takes each source's rule from `ruleFor`: the newest signal for the local section when the project also has a production source, and its incidents otherwise. Row A34, the assertion that a project with a production source judges the local section by the newest signal and the production section by its incidents, holds it; it guards the existing promise `a-promise-is-upheld-or-broken`, so that the command line and the admin say the same word for the same source.

**Amendment 5 (D2, D4, D10). Where the code lives.** Finding a lost daemon has its own module, `lib/telemetry/daemon-find.ts` (`findDaemon`, `findDaemonSync`, `candidatesOf`, `takeOverLocked`, `describeFinding`). `daemon-state.ts` keeps the state, its rendering, the self-tracing count and the resolver. `OwnProcess` and `ownProcess` live in `daemon-process.ts`, so the finder imports no value from the state module and no import cycle forms. `portsOfRecord` and `portDifferences` in `daemon-address.ts` are the one reading of a record's four ports by role and the one comparison of them with the stored address. Status words a difference as "traces on 4318 (expected 24318)" and a report as "MCP on 62843, expected 24317"; a port the finder could not read (0) is no difference. Row A35, the assertion that one definition reads a record's ports and one compares them, holds it. D10's reads bundle, `DaemonReads`, also carries `addressProblem()`, `lock()` and `lockSync()` (the home's lock), `renderedPorts()` (the ports the rendered configs name), and an optional `report()`. `report()` is a no-op outside the real home, so a temporary home's daemon receives no reports. Done in the cleanup phase, Build Phase 7; nothing printed or sent changed.

**Amendment 6 (D9). A finding's report names only the command that found the daemon.** The reporter had a fallback that named the finder "a command" when none was given. It is gone: the `found` moment reports nothing without a finding, and every caller passes the name of the command it is. A guessed name in a symptom is the kind of guess this plan removes.

**Amendment 7 (D3, D7). The stale record and reap's orphans: the decisions stand, and the code follows them.** D3 decides that a record naming processes that are gone, while this home's daemon runs unrecorded, is a lost record: the daemon is found and its record written again. D7 decides that `reap` stops this home's strays and the orphans, daemons whose config file (and so whose home) is gone, and never a live daemon. The audit on 2026-10-17, by a reader who did not build the plan, found the code departing from both: with a stale record the running daemon was counted as strays, so readers saw no daemon and `reap` would have stopped it, and `reapPlan` returned strays only, so orphans were no longer reaped. Build Phase 8 restored both. A record naming only dead processes beside this home's running daemon is read as a lost record: the finder, under the home's lock and after re-reading that every process the record names is dead, removes that record, and its exclusive create writes the daemon that runs; a record naming a live process is never removed. `reap` then stops nothing while the record is lost. `reap` stops this home's strays plus every orphan of any home, each re-read by its command line before the signal, and never the recorded daemon, a process found running with no record, another live home's daemon or a stranger. Row A36, the assertion that a stale record beside a running daemon is read as lost, the daemon found and its record rewritten, and `reap` stopping nothing, holds the first. Row A37, the assertion that `reap` stops a daemon whose home was deleted and still never this home's recorded daemon, another live home's or a stranger's, holds the second.

**Amendment 8 (D9). The moments each command reports at, as the code sends them.**
- **`status`:** reports `one-daemon-on-its-own-ports` and `the-log-is-readable` only while the recorded Jaeger is alive, that is, in the running state or a partly running one with Jaeger up (amendment 3). When the record is missing, `status` finds the daemon first. As the finder it sends the finding's two reports, then the status reports on the state it reads again.
- **A start or restart that spawned a daemon:** once the daemon is ready, sends `one-daemon-on-its-own-ports` and `a-lost-daemon-is-found` (upheld when nothing runs beside it). So does `register` when it starts the daemon, since it starts through the same path.
- **A takeover:** sends the finding's two reports when its exclusive create wrote the record, then the `one-daemon-on-its-own-ports` report only. It does not send the start's `a-lost-daemon-is-found` "nothing beside it" report.
- **`register`:** at its end, sends `nothing-starts-a-second` only when the daemon then reads as running. It writes only its own project's entry, so the "another project's entry changed" half of the broken symptom never fires; the report breaks only on a second daemon.
- **`reap`:** sends `strays-are-cleared` only to the daemon the record names, and only while the record names a live process. A dry run sends nothing.
- **Every report:** sent only from the real home.

**Amendment 9 (D1, D2, D4). Smaller places the code differs, each decided by the code.**
- **Who is this home's (D2):** own(H) compares the real path of the config file's directory with the real path of H, and the exact strings when a path cannot be resolved, so a home reached through a link, or `/private/var` for `/var`, is the same home. It is found, taken over, stopped and reaped like one named by the exact path, and a home that resolves elsewhere is not. Row A39, the assertion that a daemon whose home is spelled through a link is this home's own, holds it.
- **Pairing (D4):** a Jaeger holding the stored traces port is paired with the same-home collector holding the stored logs port, however much nearer another collector started; the rest are paired by the collector that started closest after the Jaeger, within 20 s. A lone Jaeger and a lone collector pair even when a start time cannot be read, when the address paired nothing. Row A40, the assertion that finding pairs by the stored address first, holds it.
- **Labelling (D4):** a trusted rendered yaml wins over the stored address, which wins over Jaeger's defaults. The defaults (4318, 16686) apply only when neither of the others names the traces port.
- **Which daemon is taken (D4):** a lone pair is taken whatever its ports. Among several, the one holding the stored traces port is taken, or 4318 when no address is stored.
- **The later-collision refusal (D1):** it suggests `reap` only when the holder is an orphan or this home's stray, the processes `reap` can stop; for a live InDusk daemon of another home it names that home and says `INDUSK_HOME=<home> indusk telemetry stop`. In the real home it also names `--reset`. Row A42, the assertion that the refusal suggests `reap` only where it can act, holds it.
- **The evaluator's logs:** they go to the stored logs port (`evalLogsEndpoint`), not the traces port. That settles the Risks entry "the evaluator's log export is still misrouted", taken here at Sandy's word (row A31, the assertion that the evaluator's log records go to the logs port and none is answered 404).

## Alternatives Considered

### The standard 4318 on the laptop, fixed
This ADR's first proposal: 4318, 4319, 16686 and 16687, fixed, with a held port refused. Rejected by Sandy on 2026-10-16. 4318 is every OpenTelemetry tool's default, so a person's other tools are the likeliest to hold it, and InDusk would refuse to start on exactly the machines where telemetry is already in use. Applications would reach the daemon by their SDK's default, which is guessing the address: the day another collector holds 4318, the application's traces go there and InDusk's readers see nothing. A block of InDusk's own and an address handed out make the address something everyone reads.

### Bump to a free port on every start
The 1.37.0 behaviour: a start that found its port taken moved to a random one. Rejected against A4 (every start uses the stored address) and A16 (`init`, `update` and enabling start no daemon beside a running one). It moves the address on every start, and each move splits the writers, still sending to the old address, from the readers following the new one; on 2026-10-16 that left applications on 4318 and Claude Code's `jaeger` entry on 54677.

### Refuse at first setup when a block port is held
Rejected against A3 (at first setup a held block port is replaced by a free port picked once). It blocks a person's setup over telemetry, a port they have never heard of, on a machine where nothing is wrong. Picking once is safe because nothing has been handed the address yet; after that it is stored and never moves.

### Store the address per project
Rejected against the promise itself: every reader of promises, every InDusk command and every application on a machine reaches the same one daemon. One daemon serves every project, so per-project addresses could disagree, and the second project to choose would find the first project's daemon on the block. The record cannot hold it either, since `stop` removes the record.

### Keep the port bump for the automatic start only
Rejected against A4 (no start in the real home uses a port other than the stored address) and A16 (`init`, `update` and enabling start no daemon beside a running one). A bump is a second daemon, the defect itself. With the holder identified, the 1.36.2 case is a takeover.

### Restart a daemon found on old ports automatically
Rejected against A5 (only an explicit `restart` moves a daemon onto the stored address) and the in-memory store (Sandy, 2026-10-16). A restart triggered by `init` or `status` erases every trace in the health window, so promises flip to no signal and an unopened broken report vanishes.

### Keep the status sweep with a longer port timeout
Rejected against A7 (no read removes the record) and A8 (a busy reader reads slow, not gone). Any timeout can be exceeded by a loaded event loop, and the sweep would still delete a live daemon's record. Commit `b7f82bf98` (2026-10-05) already tried a retry.

### Identity by a port answering, by start time, or by the binary file existing
Rejected against A25 (identity by command line, as `stop` does) and A10 (a running daemon is found when the record is missing). A port answering cannot tell whose process holds it. Start time fails a slow start against the 5 s tolerance. Requiring the binary to exist misses a daemon started from a relinked install, as this machine's 2026-10-02 collector was.

### Liveness only (`kill(pid, 0)`) for readers
Rejected against A13 (readers find a running daemon when the record is missing) and A25. A recycled PID would read as the daemon and hide a real one from the finding.

### Read a found daemon's ports from its yaml alone
Rejected against A10 (ports read from the sockets, not the config file). The yaml is rewritten on every start and can describe another process: on 2026-10-16 PID 60080 served 4318 while the yaml said 54678.

### Take over the newest daemon when several run
Rejected against A12 (take the one holding the stored traces port). The newest is not necessarily the one applications reach.

### Sync every registered project's MCP entry on register or start
Rejected against A17 (register leaves every other project's entry as it was) and A27 (start leaves a `.mcp.json` already on the stored MCP port unchanged). It is the re-pointing `nothing-starts-a-second` forbids. With a stored port it is also needless churn.

### Send the reports through `initEvalOtel`
Rejected against A9 and A14 (the finding's reports reach the found daemon). The provider is off exactly when the record is missing, and an exported `OTEL_EXPORTER_OTLP_ENDPOINT` would send the reports to Dash0. A new `NodeTracerProvider` in the CLI was also rejected, as more weight than one POST needs.

### Reports on the `indusk-watcher` service, unthrottled
Rejected against A6 and A9. The probe's volume would push broken reports past the 1,500-trace query limit, and every count would become a lower bound.

### `service.telemetry.traces.level: none`, `traces.processors: []`, or `OTEL_TRACES_EXPORTER=none`
Rejected against A23 (no self-tracing line over half a minute). Each was measured, and each still wrote 16–18 lines in 50 s, the same as the baseline.

### Several daemons, each on its own ports (`instance-ports`)
Superseded by Sandy on 2026-10-16. It contradicts A4 and the clause `one-daemon-on-its-own-ports`: several daemons mean readers must choose among them, which is the split this plan removes. Handing an application the address does not need more than one daemon.

### Fail `init` when a stranger holds a port of the stored address
Not adopted. At first setup nothing refuses, so this is only the later collision. It is the 1.36.2 failure mode, and `init` is not the place to fail on the daemon. `register` exits 1, and the hook runner prints it. Sandy may overrule this; see Risks.

## Consequences

### Positive
- Claude Code's `jaeger` MCP entry, every promise reader, the evaluator and every application handed the address reach the same daemon, at one address stored once and read by all of them.
- A person's other OpenTelemetry tools keep 4318; InDusk never competes with them for it, and a port held at first setup costs a picked port, not a failed setup.
- A read can no longer lose the daemon, and a daemon lost by an older install or by hand is found by the next command that looks.
- The recovery commands recover the state InDusk made: `start` takes over, `reap` clears strays, and `restart` moves a daemon onto the stored address.
- `.mcp.json` is written only when its jaeger URL changes.
- The daemon's log shrinks to what a person needs, which drops two-thirds of its lines.
- Each clause has a signal the running daemon receives, from the command that knows the answer.

### Negative
- An application no longer reaches the laptop daemon by its SDK's default port. Until [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/) writes the stored address into each application `init` scaffolds, an application must be given it by hand (`indusk telemetry address`), and one instrumented before this change, sending to 4318, reaches nothing once the daemon moves onto the block.
- A process that is not InDusk's taking a port of the stored address after first setup blocks the daemon until a person frees the port or chooses the address again with `indusk telemetry address --reset` (amendment 1), because InDusk never moves it on its own. `init` and `update` print the refusal and carry on without telemetry.
- A lost address file with no daemon running is chosen again, and may get new picked ports; one with a daemon running on picked ports may too, unless `--reset` is used (amendment 1).
- An address file that cannot be read stops every start until `--reset` (amendment 2).
- Readers that used to be read-only now write the record when they find a lost daemon, under a lock and an exclusive create.
- Three clauses report only when a person runs a telemetry command: `the-log-is-readable`, most of `one-daemon-on-its-own-ports` and `strays-are-cleared`. Between runs they read no signal.
- A lost daemon's break is reported when it is found, which may be long after it happened. A slow daemon misread as gone without touching the record sends no report; its backstop is the brief's second expectation.
- The finding needs `lsof`, or `/proc` on Linux. Without either, ports read as unknown and roles as null.
- Five test files and two helpers are rewritten, two of the files in `indusk-admin`.

### Risks
- **The live check breaks the promise on purpose.** A15, the live check that moves the record aside on this machine, sends a real broken report for `a-read-never-loses-the-daemon`. This repository names no production source, so a `promises watch` run in the health window would open an incident against this plan and reopen it with a Maintenance phase. Proposed: run A15 as written, after the restart in A5, with no `watch` running in that window. Sandy's to accept.
- **Sandy's choice on exit codes, now for one case.** At first setup nothing refuses. When a later start finds a port of the stored address held by a stranger, `register` exits 1, and `init` and `update` finish with the refusal printed. Sandy may prefer `init` (and the admin's new-project flow) to exit non-zero there.
- **A stranger squatting a stored port has no way out but freeing it.** Settled 2026-10-16: `indusk telemetry address --reset` is that way out (amendment 1); every application handed the old address then needs the new one.
- **Linux is unexercised.** The `/proc` fallback for reading sockets has not run. Mitigation: the impl carries a verification item running the finder on Linux (the always-on image is one), or `lsof` is made a stated requirement.
- **Query order is assumed.** Jaeger's memory store returning the newest traces first once the query limit is hit is moderate confidence. If it does not, the throttle matters more. Mitigation: an impl verification item that fills a temporary daemon past the limit and reads a fresh broken report back.
- **The evaluator's log export is still misrouted.** It posts to `<traces endpoint>/v1/logs`, which is Jaeger's traces port (`otel.ts:307-309`), and Jaeger answers 404. With the logs port in the stored address the fix is one line, but no row of this plan names it. It is left to [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/), which owns where logs are sent, or taken here at Sandy's word. Settled 2026-10-16: taken here (amendment 9, row A31).
- **gRPC exporters reach nothing.** An SDK exporting over gRPC finds no receiver, because only OTLP/HTTP is in the stored address. Low confidence on which SDKs default to gRPC. Left to [a-new-project-starts-instrumented](../a-new-project-starts-instrumented/), which hands the HTTP address.
- **A hook process can lose a report.** A finding inside a short-lived hook sends its report fire-and-forget. The record is still written, so only the report is lost.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/telemetry/cli.md`. It covers `start` taking over, the stored address and how it is chosen, the new `telemetry address` command (and `--json`), the port options limited to temporary homes, `status`'s five states and three-way port answers, `reap`'s strays, and `restart` keeping and moving ports. It removes `--allow-port-bump` and the flag text at lines 32-33, which says a taken port is auto-bumped and `0` auto-picks one.
- Update: `apps/docs/src/reference/telemetry/overview.md`. A ports table (InDusk's block: 24318 traces, 24319 logs, 24316 interface, 24317 MCP; a free port picked once for any held at first setup; stored in `~/.indusk/telemetry-address.json`, kept, never moved; why InDusk leaves 4318 to a person's other tools), and the enable-time steps at lines 95-98 rewritten: `register` takes over or starts the one daemon, and writes the project's `jaeger` entry at the stored MCP port only when it differs, instead of "auto-starts the daemon" and "the daemon's current `mcpPort`".
- New: a section in `apps/docs/src/reference/telemetry/overview.md` on what counts as an InDusk daemon process (D2) and what the record is.
- Update: `apps/docs/src/guide/getting-started.md:123-133`, "Telemetry: the daemon looks up but no traces arrive". The recovery path becomes `status` (which lists strays and a stranger on a stored port), `start` taking over, and `reap` stopping strays as well as orphans; the 1.36.2 sentence at line 133 is replaced.
- Update: `apps/docs/src/guide/always-on.md` (lines 114-118, 251, 269 name 16687 as the server's query port), with one sentence saying a recording server keeps the standard 4318 and 16687 as its query port on Fly, because it is a dedicated machine, while the laptop daemon runs on InDusk's own block.
- Update: `apps/indusk-mcp/extensions/local-telemetry/skill.md` (line 83, "it auto-bumps if the default is taken") and `apps/indusk-mcp/extensions/local-telemetry/.env.example` (the header's auto-bump paragraph, and the "Jaeger MCP: auto-picked free port" line, which becomes the stored MCP URL, `http://localhost:24317/mcp` when the block was free, with `indusk telemetry address` named as where to read it). The installed copy under `.indusk/extensions/local-telemetry/` follows through `update`.

### Diagrams
- A Mermaid flow in `apps/docs/src/reference/telemetry/cli.md`: a start or register reads the record, then the process list and sockets. It ends at running, takeover, start on the stored address (choosing it first if none is stored), or refuse naming the holder, with the report each one sends.

### Changelog
In `apps/docs/src/changelog.md`, under the release that ships this plan:
- Changed: the local daemon runs on InDusk's own ports (24318 traces, 24319 logs, 24316 interface, 24317 MCP), or on free ports picked once in place of any held at first setup; the address is stored and never moves. A recording server keeps the standard 4318.
- Changed: an application no longer reaches the local daemon on the SDK's default 4318; `indusk telemetry address` prints the address to give it.
- Added: `indusk telemetry address` (`--json`, `--reset`).
- Changed: `start` and `init` take over a running InDusk daemon instead of starting a second, and a stored port later held by another process is refused, naming it.
- Changed: no read deletes the daemon's record, and a lost daemon is found from the process list.
- Changed: `reap` stops strays.
- Changed: Jaeger no longer logs failing to trace itself.
- Removed: `--allow-port-bump`.

### ADR in Docs
- Yes: `apps/docs/src/decisions/daemon-found-not-guessed.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/promises/the-daemon-readers-follow-is-the-one-running.md`
- [telemetry-from-day-one master](../telemetry-from-day-one/master.md), child 1 of 7
- `mark-first`'s proposed ADR, D1 (spans carry promise and clause), on branch `plan/mark-first`
- `/decisions/one-promise-language`, `/decisions/watcher-heartbeat`, `/decisions/promise-sources`
- `.indusk/planning/archive/local-telemetry/adr.md`, the original daemon decisions of 2026-04-20
- `apps/docs/src/changelog.md:620, 626`, the 1.36.2 regression and the 2026-08-16 port guard
- Commits `138ec1b9f` (the record sweep, 2026-04-20), `31dcfd4ea` (the auto-start bump, 2026-08-19), `f41230daa` (`stop` judges by command line, 2026-10-07)
