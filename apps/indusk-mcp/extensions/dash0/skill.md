# Dash0 Observability

Dash0 provides access to your OpenTelemetry data — logs, traces, and metrics — via two interfaces: the MCP server (for in-session tool calls) and the CLI (for terminal operations and agent mode).

## Two Interfaces

**MCP Server (remote, streamable HTTP):**
- Used by Claude Code tools directly during sessions
- Provides 23 tools for logs, traces, metrics, services
- Configured in `.mcp.json`

**CLI (`dash0` binary):**
- Installed via `brew install dash0hq/dash0-cli/dash0`
- Auto-detects Claude Code and enables agent mode (JSON output, no prompts)
- Use for: log queries, trace lookups, PromQL metrics, dashboard management, asset deployment
- Key commands:
  - `dash0 logs query` — search logs
  - `dash0 traces get <trace-id>` — fetch trace details
  - `dash0 metrics instant --query 'sum(...)'` — PromQL queries
  - `dash0 dashboards list` — view dashboards
  - `dash0 apply -f assets.yaml` — deploy dashboards, views, checks (GitOps)

## When to Use Dash0

- **Test failures**: query recent traces to see what happened in the service during the test
- **Debugging production issues**: search logs for errors, find related traces by trace ID
- **Performance investigation**: query metrics (PromQL) to check latency, throughput, error rates
- **Deployment verification**: check traces and error rates after deploying a change
- **During /work verification**: if a verification step involves checking service health, query Dash0
- **Dashboard management**: use the CLI to create/update dashboards from YAML definitions

## When to Use MCP vs CLI

| Task | Use |
|------|-----|
| Query logs during a session | MCP tools |
| Search traces by service or ID | MCP tools |
| Run PromQL metrics query | Either — MCP for simple, CLI for complex |
| Deploy dashboard from YAML | CLI (`dash0 apply -f`) |
| Diagnose a failing service | MCP tools (faster, in-session) |
| CI/CD observability checks | CLI (scriptable, agent mode) |
| Get trace details for debugging | Either |

## Setup

### MCP Server (enabled automatically by `extensions enable dash0`)

The `.mcp.json` entry is added when you enable the extension:

```json
"dash0": {
  "type": "streamableHttp",
  "url": "YOUR_ENDPOINT_URL",
  "headers": {
    "Authorization": "Bearer YOUR_AUTH_TOKEN"
  }
}
```

Get your endpoint URL and auth token from Dash0: Organization Settings > Endpoints > MCP, and Organization Settings > Auth Tokens.

### CLI

```bash
brew tap dash0hq/dash0-cli https://github.com/dash0hq/dash0-cli
brew install dash0hq/dash0-cli/dash0

dash0 config profiles create dev \
  --api-url https://api.us-west-2.aws.dash0.com \
  --auth-token YOUR_AUTH_TOKEN
```

The CLI auto-detects Claude Code sessions and switches to agent mode (JSON output, no confirmation prompts, structured errors on stderr).

## Workflow Integration

### During verification
When a verification step involves checking that a service is working correctly, don't just check the HTTP status — query Dash0 for:
- Recent error traces for the service
- Error rate metrics before and after your change
- Log entries matching the feature you modified

### During debugging
When something fails:
1. Check logs first — search for errors in the relevant service
2. Find the trace — use the trace ID from logs to get the full request flow
3. Check metrics — is this a new problem or an existing one? Compare error rates over time.

### During retrospective
Query Dash0 for metrics that show the impact of the plan:
- Error rate before vs after
- Latency changes
- New services or endpoints that appeared

## Connecting to OpenTelemetry

Dash0 ingests standard OpenTelemetry data. If your services already export OTLP telemetry, point the OTLP exporter at Dash0's endpoint. See [Dash0 docs](https://www.dash0.com/documentation/dash0) for setup per language.
