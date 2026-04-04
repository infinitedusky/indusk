# Dash0 Observability

Dash0 provides access to your OpenTelemetry data — logs, traces, and metrics — via two interfaces: the MCP server (for in-session tool calls) and the CLI (for terminal operations and agent mode).

## Two Interfaces

**MCP Server (remote, streamable HTTP — NOT an npm package):**
- This is a remote server hosted by Dash0, not a local npm package. No `npx`, no `npm install`.
- Used by Claude Code tools directly during sessions
- Provides 23 tools for logs, traces, metrics, services
- Configured in `.mcp.json` with a URL and auth token

**CLI (`dash0` binary):**
- Installed via `brew install dash0hq/dash0-cli/dash0`
- Auto-detects Claude Code and enables agent mode (JSON output, no prompts)
- Use for: log queries, trace lookups, PromQL metrics, dashboard management, asset deployment
- **All query commands require `--experimental` flag**
- Key commands:
  - `dash0 --experimental logs query --from now-1h` — search logs (default time range is very narrow, always specify `--from`)
  - `dash0 --experimental traces get <trace-id>` — fetch trace details by ID (no search/query for traces — use logs to find trace IDs first)
  - `dash0 --experimental metrics instant --query 'sum(...)'` — PromQL queries
  - `dash0 dashboards list` — view dashboards
  - `dash0 apply -f assets.yaml` — deploy dashboards, views, checks (GitOps)

## When to Use Dash0

- **Test failures**: query recent logs/traces to see what happened in the service during the test
- **Debugging production issues**: search logs for errors, find related traces by trace ID
- **Performance investigation**: query metrics (PromQL) to check latency, throughput, error rates
- **Deployment verification**: check traces and error rates after deploying a change
- **During /work verification**: if a verification step involves checking service health, query Dash0
- **Dashboard management**: use the CLI to create/update dashboards from YAML definitions

## MCP Tools Reference

The MCP server provides 23 tools. The key ones for debugging:

### Logs
- **`getLogRecords`** — Query logs with filters, time range, pagination. Returns summary table.
  - **Dataset**: check `env/components/dash0.env` for the dataset per profile (local, staging, production). If no composable.env component exists, check `.indusk/extensions/dash0/.env` for a `DASH0_DATASET` value. If neither exists, ask the user which dataset to use and remember it for the session.
  - `timeRange` requires ISO timestamps: `{"from": "...", "to": "..."}`
  - `filters`: `[{"key": "service.name", "operator": "is", "value": "game-server"}]`
  - `logAttributeKeys`: specify which attributes to show in the table (e.g. `["service.name", "otel.scope.name"]`)
  - Returns log record IDs for drilling into full details
- **`getFullLogRecord`** — Get ALL attributes of a single log record by ID. Use this to see custom attributes (roomCode, walletAddress, agent name, etc.) that aren't in the summary table.
- **`getLogCorrelations`** — Find patterns and correlations in logs

### Traces
- **`getSpans`** — Search for spans (traces) with filters and time range
- **`getTraceDetails`** — Get full trace tree by trace ID, including hierarchy, events, and comparison to similar spans
- **`getSpanCorrelations`** — Find patterns in spans

### Services
- **`getServiceCatalog`** — All services with RED metrics (requests, errors, duration) and dependency map
- **`getServiceDetails`** — Deep dive into a single service

### Metrics
- **`promql`** — Run PromQL queries
- **`getMetricCatalog`** — List available metrics
- **`getMetricDetails`** — Details on a specific metric

### Other
- **`getAttributeKeys`** / **`getAttributeValues`** — Discover what attributes exist in the data
- **`listDashboards`** / **`listDatasets`** — List dashboards and datasets
- **`getFailedChecks`** / **`getFailedCheckDetails`** — View check failures
- **`searchKnowledgeBase`** — Search Dash0 documentation

### MCP Usage Pattern — Traces First

**Always start with spans.** Logs are correlated with traces, so finding the right trace first helps you find the right logs — not the other way around.

```
1. getSpans (last 30s, no filters) → scan recent spans for anything matching your investigation
2. Found a relevant span? → getTraceDetails to see the full request chain
3. Use trace/span IDs to find correlated logs → getLogRecords with traceId filter
4. getFullLogRecord → drill into a specific log for all attributes
```

**Why traces first:**
- Spans show the full request lifecycle — what happened, how long, what called what
- Logs are attached to spans via trace context — the trace tells you which logs matter
- Starting with logs means guessing at filters; starting with spans gives you the map

## When to Use MCP vs CLI

| Task | Use |
|------|-----|
| Query logs during a session | MCP `getLogRecords` (preferred) or CLI |
| Get full log details with all attributes | MCP `getFullLogRecord` (by log record ID) |
| Search traces by service or ID | MCP `getSpans` or CLI `traces get <id>` |
| Get full trace hierarchy | MCP `getTraceDetails` (preferred) |
| Run PromQL metrics query | Either — MCP for simple, CLI for complex |
| Deploy dashboard from YAML | CLI (`dash0 apply -f`) |
| Diagnose a failing service | MCP `getSpans` (last 30s) → `getTraceDetails` → `getLogRecords` (by traceId) |
| CI/CD observability checks | CLI (scriptable, agent mode) |
| Discover available attributes | MCP `getAttributeKeys` / `getAttributeValues` |

## CLI Usage Patterns

### Query logs
```bash
# Always use --experimental and --from (default range is too narrow)
source ~/.zshrc  # ensure DASH0_API_TOKEN is available
dash0 --experimental logs query --from now-1h --limit 10

# Filter by service
dash0 --experimental logs query --from now-1h --filter "service.name is game-server"

# Filter by severity
dash0 --experimental logs query --from now-1h --filter "otel.log.severity.range is_one_of ERROR WARN"

# CSV output for readability
dash0 --experimental logs query --from now-1h -o csv

# Include custom columns
dash0 --experimental logs query --from now-1h -o csv \
  --column time --column severity --column service.name --column body

# JSON output (OTLP format)
dash0 --experimental logs query --from now-1h -o json --limit 5
```

### Get trace details
```bash
# Traces don't have a search/query — you need a trace ID
# Get trace IDs from logs first, then fetch the trace:
dash0 --experimental traces get <trace-id>

# Follow span links to related traces
dash0 --experimental traces get <trace-id> --follow-span-links
```

### Authentication
The CLI uses profiles. If auth fails, ensure the profile has the token:
```bash
dash0 config profiles list           # check existing profiles
dash0 config profiles create dev \
  --api-url https://api.europe-west4.gcp.dash0.com \
  --auth-token $DASH0_API_TOKEN \
  --dataset dev
```

If the profile exists but auth still fails, pass `--auth-token` explicitly:
```bash
dash0 --experimental logs query --auth-token "$DASH0_API_TOKEN" \
  --api-url "https://api.europe-west4.gcp.dash0.com" \
  --dataset dev --from now-1h
```

**Important:** Claude Code's shell may not have `DASH0_API_TOKEN` loaded. Run `source ~/.zshrc` before any `dash0` command if you get auth errors.

## Setup

### MCP Server

**Important:** The Dash0 MCP server is a remote hosted service, not an npm package. Do not use `npx` or install anything for the MCP server. You only need a URL and an auth token.

Add the MCP server via the Claude Code CLI:

```bash
source ~/.zshrc  # ensure DASH0_API_TOKEN is available
claude mcp add -t http -s project \
  -H "Authorization: Bearer $DASH0_API_TOKEN" \
  -- dash0 "https://api.YOUR_REGION.dash0.com/mcp"
```

**Important:** The type is `http` (not `streamable-http` or `streamableHttp`). Get your auth token from Dash0: Organization Settings > Auth Tokens. The URL is your Dash0 API endpoint + `/mcp`.

**Never manually edit `.mcp.json`** — always use `claude mcp add`.

### CLI

```bash
brew tap dash0hq/dash0-cli https://github.com/dash0hq/dash0-cli
brew install dash0hq/dash0-cli/dash0

dash0 config profiles create dev \
  --api-url https://api.europe-west4.gcp.dash0.com \
  --auth-token YOUR_AUTH_TOKEN \
  --dataset dev
```

The CLI auto-detects Claude Code sessions and switches to agent mode (JSON output, no confirmation prompts, structured errors on stderr).

## Workflow Integration

### During verification
When a verification step involves checking that a service is working correctly, don't just check the HTTP status — query Dash0 for:
- **Recent spans first**: use MCP `getSpans` with a short time range (last 30s) to see what the service just did — look for errors, slow spans, or missing expected operations
- **Then correlated logs**: once you have a trace ID from a relevant span, use `getLogRecords` filtered by that trace ID to see exactly what happened during that request
- **Only use broad log queries as a fallback** if no spans are present (e.g., the service isn't instrumented yet)

### During debugging
When something fails:
1. **Get recent spans first** — use MCP `getSpans` with a short time range (last 30s–1m). Don't filter yet — scan the results for spans matching what you're investigating.
2. **Drill into the trace** — found a relevant span? Use `getTraceDetails` to see the full request chain, timing, errors, and hierarchy.
3. **Find correlated logs** — use the trace ID from step 2 to query `getLogRecords` with a `traceId` filter. This gives you exactly the logs tied to that request, no guessing.
4. **Check metrics** — is this a new problem or an existing one? Compare error rates over time.

### During retrospective
Query Dash0 for metrics that show the impact of the plan:
- Error rate before vs after
- Latency changes
- New services or endpoints that appeared

## Connecting to OpenTelemetry

Dash0 ingests standard OpenTelemetry data. If your services already export OTLP telemetry, point the OTLP exporter at Dash0's endpoint. See [Dash0 docs](https://www.dash0.com/documentation/dash0) for setup per language.

## Known Issues

- **CLI `--experimental` required**: All query commands (logs, traces, metrics) require the `--experimental` flag. This will change when these commands become stable.
- **Default time range is narrow**: Always specify `--from` when querying logs. Without it, you may get empty results.
- **CLI has no trace search**: The CLI can only fetch traces by ID (`traces get <id>`), not search for them. Use the MCP `getSpans` tool to search spans — it supports filters and time ranges. The CLI requires you to already have a trace ID.
- **Profile auth may not load in Claude Code shell**: Run `source ~/.zshrc` before `dash0` commands if auth fails.
