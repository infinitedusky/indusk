# OpenTelemetry Extension

**Date**: 2026-03-31
**Status**: Accepted

## Decision

Make OTel a core part of every InDusk project — scaffolded by `init`, enforced by a gate in every impl phase, backend-agnostic via standard OTLP.

## What We Built

- **Four runtime templates**: Node.js (full SDK + FilteringExporter), Next.js (server: @vercel/otel, client: OTel Web SDK), React SPA (OTel Web SDK), Python (opentelemetry-distro)
- **Category-based filtering**: instrument everything, control export volume via `OTEL_ENABLED_CATEGORIES`
- **Pino structured logging**: dual output (stdout + OTLP), trace context correlation
- **OTel gate**: fifth enforcement gate on every impl phase — are new code paths observable?
- **Dash0 auto-setup**: `extensions enable dash0` reads `.env` credentials and configures the MCP server

## Why

Services get built without observability. When something breaks, agents query Dash0 but traces aren't there. Adding instrumentation after the fact is harder than having it from the start. The OTel gate ensures every phase considers observability — the same way verification ensures every phase considers correctness.

## Key Choices

| Choice | Decision | Alternative rejected |
|--------|----------|---------------------|
| Logging library | Pino | Winston (slower, heavier) |
| Backend coupling | Backend-agnostic (OTLP standard) | Dash0-specific SDK |
| Browser SDK | @opentelemetry/sdk-trace-web | @dash0/sdk-web (vendor-locked) |
| Next.js server | @vercel/otel | Manual NodeSDK (more complex) |
| Filtering | Category-based at export | Sampling (loses entire categories) |
| Gate enforcement | Fifth gate in every phase | Optional check (gets skipped) |

## Impact

Every project created with `indusk-mcp init` is observable from day one. The OTel skill teaches agents how to produce high-quality telemetry. The gate ensures it doesn't get forgotten.
