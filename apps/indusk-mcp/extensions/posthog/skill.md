# PostHog Product Analytics

PostHog provides access to your product's user-behavior data — events, persons, insights, session replays, feature flags, experiments, and error tracking — via PostHog's official remote MCP server. You query it with `mcp__posthog__*` tools during a Claude Code session.

## One Interface (Remote MCP, No CLI)

PostHog ships an **official remote MCP server** hosted at `mcp.posthog.com`. It's a streamable-HTTP server — not an npm package, no `npx`, nothing runs locally. The single endpoint routes to your PostHog region (US/EU) based on the API key.

The exact tool surface evolves with PostHog's product; after enabling, check the `mcp__posthog__*` tools available in-session rather than trusting a static list. The stable areas are:

- **Insights & analytics** — list/read insights, run analytical queries (HogQL, PostHog's SQL dialect) against event data
- **Feature flags** — list flags, read flag definitions and rollout state
- **Persons & events** — look up users and their event streams
- **Error tracking** — list and inspect captured errors
- **Experiments** — A/B experiment definitions and results
- **Dashboards** — dashboard inventory
- **Docs search** — query PostHog's own documentation

## Auth Model — Personal API Key, Not Project Token

The MCP server authenticates with a **personal API key** (`phx_...`, from PostHog Settings > Personal API Keys) sent as a Bearer header. Two sharp edges:

- **NOT the project token** (`phc_...`). The project token is the write-side ingestion key your app's SDK uses to *send* events. It will not authenticate the MCP server.
- The personal key's **project access decides what the tools can see**. A key scoped to one project queries only that project; an org-wide key sees everything. Scope the key to what the agent actually needs.

Config lives in `.indusk/extensions/posthog/.env` (`POSTHOG_MCP_URL` + `POSTHOG_MCP_API_KEY`); the manifest wires both into `.mcp.json` on `indusk extensions enable posthog` / `indusk update`.

## Extension Scope — Read-Side Only

This extension wires the **read side** — how Claude *queries* PostHog. It does NOT configure how your app *emits* events to PostHog. Event capture (`posthog-js`, `posthog-node`, the `phc_` project token, autocapture config) is a runtime concern managed by your project's env setup — root `.env.local`, Docker compose env, Vercel env, etc.

The split: **posthog extension = query PostHog (read). App env = capture to PostHog (write).**

## When to Use PostHog

- **Behavior questions**: "do users actually hit this flow?" — query events, funnels, and insights instead of guessing
- **Feature flag debugging**: check a flag's rollout state and targeting when behavior differs between users/environments
- **Session replay triage**: find replays for a user or error to see what actually happened in the UI
- **Error tracking**: list recent captured exceptions, correlate with releases
- **Experiment readouts**: pull A/B results when deciding whether a variant ships
- **Pre-change validation**: before removing or refactoring a user-facing path, check whether anyone still uses it

PostHog is the **product analytics** layer — what users do. It is not the observability layer — what your services do internally. For logs/traces/metrics use `dash0`, `datadog`, or `local-telemetry`; the two layers are complementary, not alternatives (PostHog's error tracking overlaps at the edges, but service-side diagnosis belongs to the observability extensions).

## Troubleshooting

**"401 / unauthorized"**: you're probably using the `phc_` project token. Swap in a `phx_` personal API key.

**"Tools see the wrong project / no data"**: the personal key's project access is the visibility boundary. Re-scope the key in PostHog Settings, or check which project it grants.

**"MCP server not appearing"**: confirm `.mcp.json` has a `posthog` entry (`indusk extensions enable posthog` re-registers it), then restart Claude Code — MCP servers load at session start.

## See Also

- [Extensions index](../README.md) — full catalog of InDusk extensions with decision matrix
- [`dash0/skill.md`](../dash0/skill.md) / [`datadog/skill.md`](../datadog/skill.md) — service observability (logs/traces/metrics); complementary layer, not an alternative
- [`local-telemetry/skill.md`](../local-telemetry/skill.md) — local dev-time observability
- [PostHog MCP docs](https://posthog.com/docs/model-context-protocol) — the canonical reference; tool list, auth, regions
