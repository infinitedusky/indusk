# Datadog Observability

Datadog provides access to your observability data — logs, traces, metrics, monitors, dashboards, security signals, error tracking, feature flags, DBM, LLM observability — via Datadog's official remote MCP server. You query it with `mcp__datadog__*` tools during a Claude Code session.

## One Interface (No Local CLI)

Datadog ships an **official remote MCP server** (launched March 2026). It's hosted by Datadog at a regional endpoint (US1/US3/US5/EU1/AP1/US1-FED) and exposes 16+ core tools plus optional toolsets for APM, Error Tracking, Feature Flags, DBM, Security, and LLM Observability.

Unlike dash0, there is **no separate `datadog` CLI** that this extension wires up. Datadog's official `dd-cli` and the `datadog-agent` daemon are unrelated — they're for emit-side instrumentation, not for AI agents querying observability data. All in-session queries flow through `mcp__datadog__*` tools.

## Auth Model — OAuth, Not Tokens

Datadog uses **OAuth on first session launch**, not a static API token. This is different from dash0 (Bearer token in headers). What this means in practice:

- `.indusk/extensions/datadog/.env` only has `DATADOG_MCP_URL` (regional endpoint). No secrets.
- On first Claude Code session after the extension enables, you'll see an OAuth prompt — choose your Datadog account, complete the browser flow.
- Subsequent sessions reuse the OAuth token transparently. If it expires, the next session re-prompts.
- The OAuth-vs-token split means `datadog/.env` is safer to share (no credentials), but the extension is harder to use in headless / CI contexts where OAuth can't complete.

## Extension Scope — Read-Side Only

This extension wires the **read side** — how indusk-mcp and Claude *query* Datadog. It does NOT configure how your services *emit* telemetry to Datadog. Service emit (the Datadog agent, `dd-trace`, OTLP forwarding to Datadog's intake endpoint, etc.) is a runtime concern managed elsewhere — your project's env-management setup (root `.env.local`, composable.env profile-scoped component, Docker compose env, Vercel env, etc.).

The split: **datadog extension = query Datadog (read). Service env = emit to Datadog (write).** Keeping them separate means you can point dev services at a local daemon while the datadog extension still queries staging/prod data from the same session.

## When to Use Datadog

- **Test failures**: query recent logs/traces to see what happened in the service during the test
- **Debugging production issues**: search logs for errors, find related traces by trace ID
- **Performance investigation**: query metrics to check latency, throughput, error rates
- **Deployment verification**: check error rates and trace patterns after deploying a change
- **Monitor inspection**: list active monitors, check alert history
- **Security signals**: query security findings, check posture
- **LLM observability**: if your project uses Datadog's LLM Observability product, the MCP exposes prompt/response traces

If your project uses Dash0 instead of Datadog, prefer the dash0 extension — both are observability tools but they're typically not used in the same project.

## Key MCP Tools

The exact tool list depends on your toolset filter (`?toolsets=all` enables everything; `?toolsets=apm,logs,metrics` is a focused subset). Common tools include:

- `mcp__datadog__list_logs` / `mcp__datadog__search_logs` — query logs by query string + time range
- `mcp__datadog__get_trace` — fetch a trace by ID
- `mcp__datadog__list_services` — enumerate APM-instrumented services
- `mcp__datadog__query_metrics` — run metric queries
- `mcp__datadog__list_monitors` / `mcp__datadog__get_monitor` — monitor inspection
- `mcp__datadog__list_dashboards` — dashboard inventory
- `mcp__datadog__list_security_signals` — security findings
- `mcp__datadog__list_errors` — error tracking issues

The actual surface is product-enablement-dependent on your Datadog account. Run `mcp__datadog__list_tools` (or whatever the discovery tool is for your version) once after OAuth completes to see what's available.

## Troubleshooting

**"OAuth flow didn't open"**: the MCP server is unreachable or the URL is malformed. Re-check `.indusk/extensions/datadog/.env` and confirm the regional endpoint matches your Datadog site.

**"OAuth completed but tools return permission errors"**: your Datadog account doesn't have the product enabled (e.g., querying `list_security_signals` without Cloud Security Management enabled). Either enable the product in Datadog admin or narrow the toolsets filter to products you do have.

**"Empty results for known logs"**: the query may not match the log structure. Datadog log search uses faceted query syntax — start broader (just a service name + time range) before adding filters.

**"Tool calls are slow"**: Datadog's MCP server caches some queries; cold queries take longer. Subsequent calls in the same session resume cached state. If consistently slow, check Datadog status (status.datadoghq.com).

## See Also

- [`apps/indusk-mcp/extensions/dash0/skill.md`](../dash0/skill.md) — sibling observability extension; same problem space, different vendor + auth model
- [Datadog MCP Server docs](https://docs.datadoghq.com/bits_ai/mcp_server/) — the canonical reference; toolset list, auth flow, regional endpoints
