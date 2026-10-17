# The daemon is found, not guessed — one address, one daemon, a record that is rebuilt

**Decided 2026-10-16, amended 2026-10-17.** Full ADR: `.indusk/planning/daemon-found-not-guessed/adr.md` · **Reference:** [the daemon's ports](../reference/telemetry/overview.md#the-daemons-ports), [what counts as InDusk's daemon](../reference/telemetry/overview.md#what-counts-as-the-daemon), [the promise's signal](../reference/telemetry/overview.md#the-promises-signal), [`indusk telemetry`](../reference/telemetry/cli.md)

## Goal

**One InDusk telemetry daemon per machine, on InDusk's own ports, chosen once and stored, that every reader, every InDusk command and every application reaches; a read never loses it, a lost one is found from the process list, nothing starts a second, and its own commands clear what InDusk left behind.**

On 2026-10-16 one machine ran three Jaegers and four collectors with no record naming any of them. Applications reached the Jaeger on 4318, Claude Code's `jaeger` MCP entry reached a second on 54677, every promise reader said no daemon was running, and the evaluator had written 2,303 "endpoint unset; falling back to no-op logger" lines. `telemetry start` refused, `reap` skipped all seven processes, and only killing them by hand cleared the machine.

## What was decided

| Question | Decision |
|---|---|
| Where does the daemon listen? | One address per machine, chosen once at first setup and stored in `~/.indusk/telemetry-address.json`: InDusk's own block (24318 traces, 24319 logs, 24316 interface, 24317 MCP), or a free port picked once in place of any block port a process that is not InDusk's holds at that moment. InDusk never moves it on its own: not on stop, restart, the record's loss or an automatic start. `indusk telemetry address` prints it for `init` to hand to an application, and `indusk telemetry address --reset` is the one deliberate way a person chooses it again. An address file that exists but cannot be read refuses every start by name rather than counting as none, and the file is always written whole. **Rejected:** the standard 4318 (every OpenTelemetry tool's default, so a person's other tools are the likeliest to hold it, and applications would guess the address); a bump to a free port on every start (it splits the writers, who were handed the old address, from the readers); refusing first setup over a held port; an address per project. A recording server keeps 4318: it is a dedicated machine. |
| What is an InDusk daemon? | A process running InDusk's shipped Jaeger or collector binary with its `--config` file in this home. Not a port answering, not a start time, not the binary file still existing. One definition, used by `stop`, `reap`, the finder and every reader. |
| Can a read lose the daemon? | No. The status sweep that deleted the record when a port was slow to answer is gone; only `stop` removes the record and only `start` writes over one. One resolver answers every reader of the local daemon, and a slow port reads as slow, never gone. A record naming processes that are gone, while this home's daemon runs unrecorded, is a lost record: the daemon is found and the record written again. |
| What if the record is lost? | The next command that looks finds the daemon: Jaeger and collector from the process list, their ports from the sockets they listen on (`lsof`, or `/proc` on Linux), a role no socket can name left unknown and never guessed. It writes the record again under a lock with an exclusive create. When several run, it takes the one holding the stored traces port. |
| What does `start` do with a daemon already running? | Takes it over. Never restarts one it was not asked to (a restart erases the in-memory trace store, so promises would flip to no signal). A daemon found on old ports keeps running there, reported broken, until `telemetry restart`. Once the address is stored, a stranger holding one of its ports makes `start` refuse, naming the holder. |
| What does `register` do? | Ensures the one daemon and writes only its own project's `.mcp.json` entry, and only when it differs. It never re-points other projects. |
| What does `reap` stop? | Every Jaeger or collector of this home that the record does not name, whether its config file is still there or not, and every orphan: a daemon whose config file, and so whose home, is gone. Never the recorded daemon, another live home's daemon or a process that is not InDusk's. With no record it stops nothing and says to run `start` first. |
| How is Jaeger's own noise stopped? | `jaeger_query.enable_tracing: false`, in every Jaeger configuration InDusk renders or ships. Measured with Jaeger 2.17.0 against five other settings (`service.telemetry` levels and processors, `OTEL_TRACES_EXPORTER`, `OTEL_SDK_DISABLED`): only this one took the count of lines about failing to trace itself from 17 to 0. |
| How is the promise seen? | See below. |

## How the promise is seen

The promise is `the-daemon-readers-follow-is-the-one-running`, in six parts. Each part's signal is a span the running daemon receives, sent by the command that knows the answer when it knows it, as the service `indusk-telemetry`. The reports bypass the evaluator's OpenTelemetry provider: its exporter follows `OTEL_EXPORTER_OTLP_ENDPOINT` (a shell exporting Dash0 would send them there), is off exactly when the record is missing, and needs a flush a short-lived command does not get. They use the plain post the watcher probe uses, set their promise fields through the one function every InDusk writer uses, and carry the part's name on the span. They go under their own service because the probe's volume would otherwise fill the 1,500-trace window through which broken reports are read, and a promise reader's upheld report is throttled to one per project every 15 minutes for the same reason. `status` reports a partly running daemon (a collector that has died beside a live Jaeger) broken, naming what is gone; with the Jaeger dead there is nothing to receive a report. A finding's report names only the command that found the daemon. `promises status` prints "broken — " or "broke — fixed — " on a break count by the rule the admin and the editor use, each source judged by its own rule. Which command sends which part is a table in [the promise's signal](../reference/telemetry/overview.md#the-promises-signal).

## Consequences accepted

- An application no longer reaches the laptop daemon by its SDK's default port; it needs the address `indusk telemetry address` prints, which the sibling plan `a-new-project-starts-instrumented` writes into new applications.
- A stranger taking a stored port after first setup stops the daemon from starting until a person frees the port or chooses the address again with `--reset`, because InDusk never moves it on its own.
- Readers such as the admin and the evaluator now write the record when they find a lost daemon.
- Three parts report only when a telemetry command runs, and a lost daemon's break is reported when it is found, not when it happens.
- Finding a daemon needs `lsof`, or `/proc` on Linux, which has not yet been run on Linux.
- Applications exporting over gRPC reach nothing: only OTLP over HTTP is in the stored address.

## Amended 2026-10-17

Decisions taken while building, recorded as amendments in the full ADR:

- **`--reset`.** `indusk telemetry address --reset` chooses the address again by the first-setup rule, keeping the ports the running daemon holds, and prints the old and the new address. It is the way out of a stored port taken for good by another program and of an unreadable address file.
- **An unreadable address file** refuses a start, naming the file and `--reset`; `telemetry address` says it is unreadable. The file is written to a temporary file and then linked or renamed into place.
- **A partly running daemon** is reported broken by `status` while its Jaeger is alive to receive the report.
- **`promises status`** says broken, or broke and fixed, by the rule the admin and the editor use, per source.
- **Where the code lives.** Finding a lost daemon is its own module (`lib/telemetry/daemon-find.ts`), and a record's ports are read and compared with the address in one place.
- **A finding's report** names only the command that found the daemon.
- **The stale record and reap's orphans.** An audit found the code reading a record naming only dead processes, beside a running daemon, as strays, and reap no longer stopping orphans. The decisions above stand and the code now follows them: that record is a lost record, so the daemon is found, the dead record removed under the lock and written again, and `reap` stops nothing; `reap` stops this home's strays and orphans, and never the recorded daemon or a live daemon of another home.
- **Five smaller places the code was narrower than the decision, now built.** A lost address file is rebuilt from the address the running daemon recorded when it started or was taken over (the record carries it, picked ports and holders included), so the daemon is on its stored address and `status` reports no difference. A daemon with no recorded address, such as one from before the address existed on 4318, never lends its ports: the address is InDusk's block, or picked ports where the block is held. A daemon's home is matched by its real path, so a home reached through a link, or `/private/var` for `/var`, is this home. Finding pairs a Jaeger holding the stored traces port with the collector holding the stored logs port first, and by start time only for what the address does not pair. Readers reach a half-running daemon's Jaeger through the record, and report no daemon only when the recorded Jaeger is gone. A refused start suggests `reap` only for an orphan or this home's stray, and for a live daemon of another home names that home and `INDUSK_HOME=<home> indusk telemetry stop`.
- **Report moments.** A takeover sends the finding's reports and the ports report, `register` reports only when the daemon then runs, and `reap` reports only to the recorded daemon. Reports are sent only from the real home. The evaluator's logs go to the logs port.

## Superseded

The several-daemons-per-machine design (`instance-ports`) is superseded: several daemons mean readers must choose among them, which is the split this decision removes. `--allow-port-bump` is removed.
