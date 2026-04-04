---
title: "OpenTelemetry Extension"
date: 2026-03-31
status: accepted
---

# OpenTelemetry Extension — Brief

## Problem
Services get built without observability. When something breaks, agents query Dash0 but the data isn't there because nothing was instrumented. Structured logging is inconsistent — some services use `console.log`, others use Winston, others use nothing. This makes debugging reactive instead of proactive.

OTel should be as fundamental as type checking or linting — present from `init`, not added as an afterthought.

## Proposed Direction
Three pieces:

### 1. `init` scaffolds instrumentation
When `indusk-mcp init` runs, it:
- Detects the runtime (Node.js, Next.js, Python)
- Installs the appropriate OTel SDK packages
- Creates `instrumentation.ts` (or Python equivalent) with auto-instrumentation configured
- Wires it into the service entry point
- Sets `OTEL_SERVICE_NAME` from the project name

This happens for every project. No opt-in needed.

### 2. OTel extension (skill + health checks + verification)
A built-in extension that provides:
- **Skill**: instrumentation patterns, structured logging conventions, span naming, custom attributes, error propagation with trace context
- **Health checks**: is `instrumentation.ts` present? are OTel packages installed? is the exporter configured?
- **Verification commands**: "are traces being emitted?" as a gate during `/work`

The skill teaches the agent:
- Every service gets instrumented from day one
- Use Pino for structured logging in application services
- Business events get manual spans: `poker.hand.deal`, not `processRequest`
- Add domain attributes to spans: `roomCode`, `playerId`, `handNumber`
- Errors always propagate with trace context
- Log levels have meaning: ERROR (broken), WARN (degraded), INFO (business events), DEBUG (dev)
- Framework apps (VitePress, Next.js) use their own logger but ensure OTLP-compatible output

### 3. Category-based filtering
All instrumentation is categorized so it can be toggled on/off without code changes:
- Every span gets an `otel.category` attribute: `http`, `db`, `business`, `inference`, `state`, etc.
- The `instrumentation.ts` scaffold includes a `FilteringExporter` that wraps the real exporter
- A runtime config (env var, global state, or config file) controls which categories are active
- Default in dev: everything on. Production: selective based on what you need to see.

This removes the fear of over-instrumenting. Instrument everything — business events, state transitions, inference calls, database queries — and control the noise at the filter level. Adding a span is free; you only pay export cost for categories you've enabled.

The pattern is already proven in numero (`FilteringExporter` + `globalThis.__numero_telemetry_state`). The OTel extension standardizes it so every project gets it.

### 4. Default works without a backend
Out of `init`, before any backend is configured:
- Pino logs go to stdout (always)
- Traces/spans go to a console exporter (prints to stdout as JSON)
- Everything works locally, you see it in your terminal

When you enable the Dash0 extension, the OTLP exporter is added alongside the console exporter. Logs and traces flow to both stdout and Dash0. The instrumentation code never changes — only the exporter config.

### 5. Backend decoupled
The OTel extension handles instrumentation only. The backend (where traces go) is handled by separate extensions:
- **Dash0 extension** (already exists, preferred): provides endpoint, auth headers, dataset config, and an MCP server the agent can query
- Future: Grafana, Jaeger, or any OTLP-compatible backend

Connection is through standard OTLP env vars (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`), which live in the backend extension's `.env`, not in the OTel extension.

### 6. Autonomous feedback loop (future)
The ultimate goal: the agent monitors its own work through OTel data and self-corrects.

```
Agent writes code → OTel instruments it
    → Traces/logs flow to Dash0
        → Agent queries Dash0 via MCP (errors, latency, failures)
            → Agent fixes issues
                → Discoveries become Graphiti episodes
                    → Next session's context beam surfaces what was learned
```

This is where OTel + Dash0 + Graphiti converge. OTel generates the data, Dash0 stores and queries it, Graphiti remembers what was learned from it. The OTel extension is the instrumentation layer that makes this loop possible.

## Context
- Dash0 extension already exists — it's the viewing/querying side
- numero project has OTel working (game-server, admin-server instrumented) but it was added manually, not via any system
- Research validated: `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` for Node.js, `@vercel/otel` or `instrumentation.ts` for Next.js
- Pino is the preferred logging library for application services
- Python has equivalent: `opentelemetry-distro` + `opentelemetry-instrumentation`

## Scope

### In Scope
- `init` creates `instrumentation.ts` with auto-instrumentation for detected runtime
- `init` installs OTel SDK packages
- OTel built-in extension with skill, health checks, verification
- Node.js/TypeScript instrumentation (Express, Fastify, HTTP, database)
- Next.js instrumentation (`instrumentation.ts` hook)
- Python instrumentation (for Graphiti, CGC, and Python services)
- Pino as default structured logger for application services
- Span naming conventions and custom attribute patterns
- Category-based filtering exporter (instrument everything, control export volume)
- Standard category taxonomy: `http`, `db`, `business`, `inference`, `state`, etc.
- Runtime toggle for categories (no redeploy needed)
- Integration with plan/work/verify skills (instrumentation as a gate)

### Out of Scope
- Dash0 configuration (already handled by Dash0 extension)
- Backend-specific setup (Grafana, Jaeger, etc.)
- Custom collector deployment
- Browser/client-side instrumentation
- Performance benchmarking of instrumentation overhead

## Success Criteria
- `indusk-mcp init` in a new Node.js project creates a working `instrumentation.ts`
- Health check reports whether OTel is configured and packages are installed
- Agent knows to add instrumentation when implementing new endpoints or business logic
- Traces flow to configured backend (Dash0) without manual setup beyond enabling the Dash0 extension
- Structured logging via Pino with trace context correlation works out of the box

## Depends On
- Extension system (completed)
- Dash0 extension (completed, provides the backend)

## Blocks
- Nothing directly — but improves every subsequent plan that involves services
