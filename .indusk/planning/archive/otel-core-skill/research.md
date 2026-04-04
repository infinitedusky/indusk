---
title: "OpenTelemetry as a Core Skill"
date: 2026-03-24
status: complete
---

# OpenTelemetry as a Core Skill — Research

## Question
How should OpenTelemetry be integrated into indusk-mcp as a core development practice — not an optional extension but a fundamental part of how every project is built?

## Findings

### Current State
- Dash0 exists as a built-in extension — it's the backend where you view OTEL data
- No instrumentation guidance exists in any skill
- Projects add OTEL as an afterthought, if at all
- When debugging, agents query Dash0 but the data isn't there because services weren't instrumented
- Structured logging is inconsistent across services

### OTEL in Node.js/TypeScript
- `@opentelemetry/sdk-node` is the main SDK for auto-instrumentation
- `@opentelemetry/auto-instrumentations-node` covers Express, Fastify, HTTP, DNS, etc.
- For Next.js: `@vercel/otel` or manual setup with `instrumentation.ts` (Next.js 13.4+)
- Structured logging: Winston with `@opentelemetry/winston-transport` or Pino with `pino-opentelemetry-transport`
- OTLP exporter sends to any backend (Dash0, Grafana, Jaeger, self-hosted collector)

### What Should Be Instrumented
- **Every HTTP endpoint** — automatic via auto-instrumentation
- **Database queries** — automatic via Drizzle/Prisma/pg instrumentation
- **External API calls** — automatic via HTTP instrumentation
- **Business logic events** — manual spans: "player joined table", "hand dealt", "settlement processed"
- **State transitions** — structured log events: `{ event: "hand_started", roomCode, players, blinds }`
- **Errors** — always with trace context so you can correlate log → trace → service

### What the Skill Should Teach
1. Every service gets instrumented from day one — no exceptions
2. Use structured logging (JSON, not string concatenation) with trace context
3. Business events get manual spans, not just HTTP auto-instrumentation
4. Name spans descriptively: `"poker.hand.deal"` not `"processRequest"`
5. Add custom attributes to spans: `roomCode`, `playerId`, `handNumber`
6. Errors propagate with trace context — never swallow without logging
7. Log levels have meaning: ERROR (broken), WARN (degraded), INFO (business events), DEBUG (development)

### Scaffold Requirements
- Detect runtime: Node.js (Express/Fastify), Next.js
- Install the right packages for the runtime
- Create `instrumentation.ts` with auto-instrumentation configured
- Configure OTLP exporter (default: stdout for dev, env var for production endpoint)
- Wire into service entry point (`-r` flag or `instrumentation.ts`)
- If composable.env exists, add OTEL env vars to components
- If Dash0 extension enabled, configure Dash0 as the exporter endpoint

### Integration Points with Existing Skills
- **Plan**: every impl phase that adds endpoints, state changes, or external calls should include OTEL items
- **Work**: after implementing, check "are new code paths instrumented?"
- **Verify**: "are traces being emitted?" as a verification gate
- **Document**: document what's traced and what custom spans exist
- **Retrospective**: "did we have enough observability to debug issues that came up?"

## Open Questions
- Should `init-otel` be a separate command or part of `init`? Separate seems right — not every project needs it on day one, but once added it's always there.
- Should the skill be prescriptive about logging library (Winston vs Pino) or just require structured OTLP-compatible output?
- How do we verify instrumentation in CI? Health check that spans are being emitted?

## Sources
- OpenTelemetry JS SDK: https://opentelemetry.io/docs/languages/js/
- Next.js instrumentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
- Dash0 OTLP ingestion: https://www.dash0.com/documentation/dash0
