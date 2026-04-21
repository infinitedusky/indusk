# local-telemetry

Machine-global OTel backend for InDusk dev loops. A single daemon (Jaeger + OTel Collector core, as native binaries) absorbs the `development` profile's traces and logs; the agent queries it through MCP, you query it through `indusk telemetry *`. Staging and production OTel continue to route to Dash0 unchanged.

Required-by-default — every `indusk init` and `indusk update` (1.28.0+) enables it automatically. Opt out via `"disabled_extensions": ["local-telemetry"]` in `.indusk/config.json` only if you really need to.

## Quickstart

```sh
# After `indusk init` / `indusk update` at 1.28.0+:
indusk telemetry status     # confirms daemon is running
pnpm dev                    # emit some traces
indusk telemetry services   # see the services that have emitted
indusk telemetry tail       # live logs
```

The Jaeger UI is at `http://localhost:16686`.

## What you get

- **Traces** — Jaeger v2 bundles `jaeger_mcp`, exposed in every registered project's `.mcp.json` as the `jaeger` MCP server (8 agent-facing tools: `search_traces`, `get_trace_topology`, `get_span_details`, `get_services`, `get_span_names`, `get_trace_errors`, `get_critical_path`, `health`).
- **Logs** — otelcol core runs a logs-only pipeline terminating in a rotating JSONL file sink at `~/.indusk/telemetry/logs.jsonl` (10 MB × 5 backups). Queried via the custom `tail_logs` MCP tool or the `indusk telemetry tail` CLI.

## Full documentation

- Architecture + env routing + migration from Dash0-only: [reference/telemetry/overview](https://indusk.dev/reference/telemetry/overview)
- CLI reference: [reference/telemetry/cli](https://indusk.dev/reference/telemetry/cli)
- Agent diagnosis patterns: [`skill.md`](./skill.md) in this directory

## Opting out

Add to `.indusk/config.json`:

```json
{
  "disabled_extensions": ["local-telemetry"]
}
```

Both `indusk init` and `indusk update` respect this silently — no daemon started, no `.mcp.json` wired, no registry entry. Remove the entry and re-run `indusk update` to opt back in.
