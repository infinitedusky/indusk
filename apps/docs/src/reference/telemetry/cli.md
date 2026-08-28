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

Query subcommands (`tail`, `trace`, `services`, `reset`) — see [Query subcommands](#query-subcommands) below.

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

## Query subcommands

Once the daemon is running, four query subcommands provide human-readable access to the data otelcol + Jaeger have collected. Each one targets a different signal, so the command you reach for depends on what you're looking for:

| Subcommand | Target | Backend |
|------------|--------|---------|
| `tail`     | log records | otelcol's file sink (`~/.indusk/telemetry/logs.jsonl`) |
| `trace`    | a single trace's span tree by ID | Jaeger REST (`/api/traces/<id>`) |
| `services` | list of services that have emitted spans | Jaeger REST (`/api/services`) |
| `reset`    | wipe in-memory trace storage + log sink | daemon lifecycle |

Agent-facing equivalents exist as MCP tools wherever the signal maps cleanly (see `tail_logs` for logs, and the bundled `jaeger_mcp` extension for traces — exposed as the `jaeger` MCP server in every registered project's `.mcp.json`).

### `indusk telemetry tail`

Print recent log records from the file sink, filtered by service, level, and lookback window. The same filter shape as the `tail_logs` MCP tool, but human-formatted as `ISO [LEVEL] service message` lines instead of JSON.

```sh
indusk telemetry tail [--service <name>] [--level <level>] [--since <minutes>] [--limit <n>]
```

**Flags:**

- `--service <name>` — filter by `service.name` resource attribute. Exact match. Omit to see all services.
- `--level <level>` — minimum severity: `error` / `warn` / `info` / `debug` / `any`. Default `any`. `warn` means "warn and above" (i.e., also `error`).
- `--since <minutes>` — how far back to look. Default `5`. Capped at 240 for the MCP tool; the CLI has no hard cap but the sink is bounded at 50 MB.
- `--limit <n>` — max records to print. Default `50`. If more records match than `limit`, the CLI prints the most recent `n` and reports how many were elided.

**Sample output**:

```
2026-04-20T22:46:10.123Z [ERROR] indusk-mcp           Failed to reach the collector: ECONNREFUSED
2026-04-20T22:46:11.445Z [INFO ] indusk-mcp           Retrying in 500ms
...
(showing last 50 of 87 matching records — raise --limit to see more)
```

**No-match output**: `No log records in the last 5 minute(s) for service=indusk-mcp at level>=warn.` No exit-code failure — "nothing happened in your window" is a normal result.

**Empty sink**: `No log sink yet. Emit some logs or start the daemon.` — exits `0`. The file is created lazily by otelcol on the first log record received.

### `indusk telemetry trace <id>`

Fetch a single trace's full span tree from Jaeger via its REST query API (`/api/traces/<id>`). Prints the raw JSON response (one root + all descendant spans with timing + attributes).

```sh
indusk telemetry trace <trace-id>
```

Use this for debugging a specific trace the agent or your own code has already surfaced (e.g., an eval-agent scorecard that referenced a trace ID, or a log line with a correlation ID). To browse for traces interactively, use the Jaeger UI at `http://localhost:{ui-port}` — the UI is the right tool for trace discovery; `trace <id>` is the right tool for drilling into a known one.

**Exit codes**: `0` on success, `1` if the daemon isn't running or Jaeger returns non-2xx.

### `indusk telemetry services`

List every service that has emitted at least one span, one per line. Backed by Jaeger's `/api/services`.

```sh
indusk telemetry services
```

**Sample output**:

```
indusk-mcp
admin-ui
numero-api
```

**No services yet**: prints `(no services have emitted traces yet)` — exits `0`. Common when you've just started the daemon and haven't run anything that emits OTel.

### `indusk telemetry reset`

Wipe the daemon's in-memory trace storage and truncate the log sink file. Equivalent to `stop + truncate ~/.indusk/telemetry/logs.jsonl + start`. Useful when you want a clean slate before reproducing an issue — e.g., you want the next `tail` to show only records from this run.

```sh
indusk telemetry reset [--otlp-port <port>] [--ui-port <port>]
```

**Not exposed as an MCP tool** — it's a human-triggered clean-the-slate action. An agent that thinks it needs this almost certainly needs a narrower `tail --since 1` or a specific `trace <id>` instead.

**Flags**: same `--otlp-port` / `--ui-port` behavior as `start`.

**Sample output**:

```
Stopping daemon + clearing buffers...
Daemon restarted with fresh buffers.
  OTLP:      http://localhost:4318
  Jaeger UI: http://localhost:16686
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

- [Overview](./overview) — architecture diagram, MCP tool surface, env routing, migration from Dash0-only.
- ADR: `.indusk/planning/local-telemetry/adr.md` (source-of-truth architectural decision).
- Spike findings: `.indusk/planning/local-telemetry/spike-findings.md` (Phase 1 measurements + binding decisions).
