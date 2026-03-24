# Dash0 Observability

Dash0 provides access to your OpenTelemetry data — logs, traces, and metrics — directly from Claude Code via its MCP server.

## When to Use Dash0

- **Test failures**: query recent traces to see what happened in the service during the test
- **Debugging production issues**: search logs for errors, find related traces by trace ID
- **Performance investigation**: query metrics (PromQL) to check latency, throughput, error rates
- **Deployment verification**: check traces and error rates after deploying a change
- **During /work verification**: if a verification step involves checking service health, query Dash0

## Available Tools (from Dash0 MCP server)

Dash0's MCP server provides 23 tools. The most useful for development:

| Tool | When |
|------|------|
| Search logs | Find errors, warnings, or specific log messages |
| Search traces | Find request traces by service, endpoint, status, or trace ID |
| Query metrics (PromQL) | Check latency percentiles, error rates, throughput |
| List services | See what services are sending telemetry |
| Get trace details | Deep-dive into a specific trace's spans |

## Setup

1. Sign up at [dash0.com](https://www.dash0.com)
2. Get your API token from the Dash0 dashboard
3. Add the Dash0 MCP server to your `.mcp.json`:

```json
{
  "mcpServers": {
    "dash0": {
      "command": "npx",
      "args": ["@dash0hq/mcp-server"],
      "env": {
        "DASH0_API_TOKEN": "your-token-here",
        "DASH0_DATASET": "default"
      }
    }
  }
}
```

4. Enable the extension: `extensions enable dash0`

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
