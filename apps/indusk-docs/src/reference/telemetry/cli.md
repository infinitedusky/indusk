---
title: Local Telemetry — CLI Reference
---

# Local Telemetry — CLI Reference

The `indusk telemetry` subcommand manages the local telemetry daemon (Jaeger + OTel Collector core) on your machine. The daemon is machine-global — one set of processes serves every registered InDusk project on the machine.

Available since indusk-mcp **1.28.0**.

## Quick reference

```
indusk telemetry start [--otlp-port N] [--ui-port N]   # Start the daemon
indusk telemetry stop                                  # Stop the daemon
indusk telemetry restart [--otlp-port N] [--ui-port N] # Stop then start
indusk telemetry status                                # Report state + ports + PIDs
```

Query subcommands (`tail`, `trace`, `services`, `reset`) land in Phase 5 alongside the MCP tool surface. This page will expand then.

## `indusk telemetry start`

Start the telemetry daemon (Jaeger + otelcol). Spawns both binaries as detached child processes that survive terminal close. Writes daemon metadata to `~/.indusk/telemetry.{pid,json,log}`.

```sh
indusk telemetry start [--otlp-port <port>] [--ui-port <port>]
```

**Flags:**

- `--otlp-port <port>` — Jaeger's OTLP HTTP port where services emit traces. Default `4318`. Use `0` to auto-pick a free port. If the requested port is taken, the CLI auto-bumps to a free one and prints the chosen value.
- `--ui-port <port>` — Jaeger UI port (`http://localhost:{port}`). Default `16686`. Same auto-bump behavior.

**Exit codes**: `0` on success, `1` on spawn failure. Failure reasons include platform package not installed, Jaeger or otelcol not becoming ready on its health port within 15s, or invalid port values.

**Already-running case**: if the daemon is already up, `start` reports the existing state without spawning a second set of processes (idempotent).

**Sample output**:

```
Starting telemetry daemon (Jaeger + otelcol)...
  OTLP:      http://localhost:4318
  Jaeger UI: http://localhost:16686
  PIDs:      jaeger=72113 otelcol=72117
  Logs:      ~/.indusk/telemetry/logs.jsonl
  Daemon log: ~/.indusk/telemetry.log
```

## `indusk telemetry stop`

SIGTERM both daemon processes (Jaeger + otelcol). Polls for exit up to 3 seconds; if either process hasn't exited, SIGKILLs the survivors. Cleans up `~/.indusk/telemetry.pid` + `~/.indusk/telemetry.json`.

Identity gate: if the recorded PIDs don't verify (not alive OR not listening on recorded ports — i.e., PID-reuse after crash), the daemon reports "stopped" without SIGTERM'ing the PIDs (avoids killing a stranger's process that inherited the recycled PID).

**Sample output**:

```
Telemetry daemon stopped (jaeger=72113 otelcol=72117).
```

Or, if SIGKILL was required:

```
Warning: Telemetry daemon (jaeger=72113 otelcol=72117) did not exit within 3s; forced with SIGKILL.
```

## `indusk telemetry restart`

Equivalent to `stop` + a 200ms pause for OS port release + `start`. Picks up new binaries after `npm i -g @infinitedusky/indusk-mcp@<newer>` triggers a platform-package refresh — the daemon's next spawn uses the newly-installed binaries.

This is the load-bearing post-upgrade flow: `start` is intentionally idempotent (no-op on running daemon), so `restart` is how you cycle in fresh binaries.

```sh
indusk telemetry restart [--otlp-port <port>] [--ui-port <port>]
```

## `indusk telemetry status`

Report current daemon state. Gates on `verifyIdentity(pid, port)` for BOTH Jaeger and otelcol — PID liveness AND port listening — so a PID-reused-after-crash situation doesn't false-positive as "running."

**Running output**:

```
Telemetry daemon: running
  OTLP:      http://localhost:4318
  Jaeger UI: http://localhost:16686
  PIDs:      jaeger=72113 otelcol=72117
  Started:   2026-04-20T22:45:00.000Z
Registered projects 0 (registry lands in Phase 4)
```

**Not-running output**:

```
Telemetry daemon: not running
Registered projects 0 (registry lands in Phase 4)
```

## Daemon files

| Path | Purpose |
|------|---------|
| `~/.indusk/telemetry.pid` | Jaeger's PID (primary process). Read by `status`/`stop` for the liveness probe. |
| `~/.indusk/telemetry.json` | Full metadata — both PIDs, all ports, start time, binary paths, platform, log path. |
| `~/.indusk/telemetry.log` | Interleaved stdout + stderr from Jaeger + otelcol. First place to look when diagnosing a spawn failure. |
| `~/.indusk/telemetry-jaeger.yaml` | Jaeger config rendered with auto-picked ports. Inspectable but regenerated every `start`. |
| `~/.indusk/telemetry-collector.yaml` | otelcol config rendered with auto-picked ports. Inspectable but regenerated every `start`. |
| `~/.indusk/telemetry/logs.jsonl` | Structured logs received by otelcol, rotating file (10 MB × 5 backups = 50 MB buffer). |

## Environment variables

- `INDUSK_HOME` — overrides the default `~/.indusk/` root. Used primarily by tests to isolate daemon files from a developer's real setup. If you set it, all the above paths root under it.

## See also

- [Overview](./overview) *(pending Phase 5)* — architecture diagram, MCP tool surface, env routing, migration from Dash0-only.
- ADR: `.indusk/planning/local-telemetry/adr.md` (source-of-truth architectural decision).
- Spike findings: `.indusk/planning/local-telemetry/spike-findings.md` (Phase 1 measurements + binding decisions).
