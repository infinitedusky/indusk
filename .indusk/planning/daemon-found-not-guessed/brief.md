---
title: "The daemon is found, not guessed"
date: 2026-10-16
status: accepted
workflow: feature
clauses: required
description: "One local telemetry daemon per machine, on InDusk's own ports, chosen once and handed to every application: a read never loses it, a lost one is found from the process list, nothing starts a second, and its own commands clear what InDusk left behind."
---

# The daemon is found, not guessed — Brief

The first of seven children of
[telemetry-from-day-one](../telemetry-from-day-one/master.md). InDusk lost track
of its own daemon and started another beside it, twice; on 2026-10-16 this
machine had three Jaegers and four collectors, no record, and readers that
answered four different ways. The background and the findings are in
[research.md](research.md). The machine was cleared by hand on 2026-10-16
(Sandy's choice) and runs one daemon, on 4318 and 16686 until this plan moves it
to InDusk's own ports. The standard 4318 is every OpenTelemetry tool's default,
so a person's other tools are the likeliest to hold it; InDusk, installed on
someone else's machine, takes a block of its own and hands the address to every
application, so a taken port never splits writers from readers (Sandy,
2026-10-16). InDusk never moves that address on its own. `indusk telemetry
address --reset` is the one deliberate way a person chooses it again, and it
prints the old and the new address. It is the way out of two refusals: a stored
port that another program has taken for good, and an address file that exists
but cannot be read (Sandy, 2026-10-16). "Never changed" in the first clause below
means never changed by InDusk; `--reset` is a person's act.

## Expectations

1. **This machine runs one InDusk daemon.**
   - Measure: the number of InDusk Jaeger processes (its binary, its config under `~/.indusk`) that `telemetry status` lists, and the number of starts in `~/.indusk/telemetry.log` with no shutdown line before them; expect one and zero.
   - Look: 30 days after landing.

2. **Readers stop losing the daemon.**
   - Measure: the evaluator's "endpoint unset; falling back to no-op logger" lines across `~/.indusk/projects/*/eval/system.log` per week; 2,303 in total before this plan; expect none while the daemon runs.
   - Look: 30 days after landing.

3. **The daemon's log is worth reading.**
   - Measure: the share of `~/.indusk/telemetry.log` lines that are Jaeger failing to trace itself; 67 % on 2026-10-16; expect none in lines written after landing.
   - Look: one week after landing.

## Promises

### This plan makes

1. **`the-daemon-readers-follow-is-the-one-running`** (behaviour). Every reader of promises, every InDusk command and every application on a machine reaches the same one local telemetry daemon.
   - **`one-daemon-on-its-own-ports`** (limit). At most one InDusk daemon runs on a machine, on one address chosen once and kept: InDusk's own port block (24318 for traces, 24319 for logs, 24316 for its interface, 24317 for its MCP server), or, when one of those is held at first setup, free ports picked once, recorded and never changed; every reader, every InDusk command and what `init` hands an application read that stored address and never assume one.
   - **`a-read-never-loses-the-daemon`** (limit). No status read, health check or promise reader deletes the daemon's record; a port slow to answer reads as slow, never as gone.
   - **`a-lost-daemon-is-found`** (split). When the record is missing, a running InDusk daemon is found from the process list, its record is written again, and `telemetry start` takes it over instead of starting another.
   - **`nothing-starts-a-second`** (limit). Enabling the telemetry extension, `init` and `update` never start a daemon beside a running one and never point another project's MCP entry somewhere else.
   - **`strays-are-cleared`** (split). `telemetry status` lists every InDusk daemon process the record does not name, and `telemetry reap` stops them.
   - **`the-log-is-readable`** (split). The daemon's log carries no lines of Jaeger failing to send its own traces.

### Existing promises

**Must not break**

- **`indusk-stops-only-its-own-daemons`**. Taking over and reaping judge a process by its command line, as `stop` does; nothing signals a process that is not InDusk's.
- **`everyday-tests-never-wait`**. A test's daemon still runs in a temporary home on its own random ports, in the system tier; the machine's address belongs to the real home only.
- **`the-mcp-config-is-not-tracked`**. With a fixed MCP port, `.mcp.json` stops being rewritten on every start, and stays untracked.
- **`a-clone-without-an-mcp-config-gets-the-keep-list`**. A checkout with no `.mcp.json` still gets one naming `indusk`, now with the fixed daemon port.
- **`every-commit-evaluated`**. The evaluator exports to the daemon the record names; it no longer falls back to a no-op logger while the daemon runs.

**Changes**

None.

**Replaces**

None.

### Not promised

- **Traces kept across a restart** — the daemon's store stays in memory (Sandy, 2026-10-16); a file-backed store is `every-broken-trace-is-kept`, in the later cut chosen 2026-10-15.
- **Several daemons on one machine, each on its own ports** — `instance-ports`' first promise; superseded by one daemon on one stored address (Sandy, 2026-10-16). Its churn promise is already kept: `.mcp.json` is untracked.
- **The recording server's ports** — a deployed server is a dedicated machine and keeps the standard 4318 (Sandy, 2026-10-16); only the laptop daemon, which shares a person's machine with their other tools, gets InDusk's own block.
- **Pruning the 2,663 dead entries in the project registry** — left in `known-issues.md`; the sync skips them.
- **Rotating the daemon's log** — once the noise is gone the log grows slowly; later, if it asks for it.

## Looks

None — this plan changes the daemon, its commands and their printed output; no screen of the admin or the editor is laid out differently.

## Depends On

- None.

## Blocks

- `.indusk/planning/a-new-project-starts-instrumented/` — it writes the stored address into each application `init` scaffolds; an application no longer reaches the daemon by the SDK's default port.
- `.indusk/planning/mark-first/` — its live check reads a clause through this daemon, and its closing rule asks it.
