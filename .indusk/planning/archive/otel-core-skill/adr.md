---
title: "OpenTelemetry Extension — ADR"
date: 2026-03-31
status: accepted
---

# OpenTelemetry Extension — ADR

## Y-Statement
In the context of **making every indusk-mcp project observable from day one**,
facing **services being built without instrumentation and agents unable to debug because telemetry data doesn't exist**,
we decided for **OTel auto-instrumentation scaffolded by `init`, Pino structured logging, and a category-based filtering exporter**
and against **manual instrumentation setup, Winston, or backend-specific SDKs**,
to achieve **automatic observability with zero friction and the foundation for autonomous agent feedback loops**,
accepting **additional packages in every project and LLM-cost for Graphiti episode capture from telemetry**,
because **instrumentation that doesn't exist by default never gets added, and agents need production feedback to self-correct**.

## Context
Services get built without observability. Agents query Dash0 but traces aren't there because nothing was instrumented. The numero project proved the pattern works (game-server, admin-server instrumented with FilteringExporter) but it was done manually. This ADR standardizes it so every project gets it from `init`.

## Decisions

### 1. `init` scaffolds OTel instrumentation
**Decision**: `indusk-mcp init` detects the runtime and creates a working `instrumentation.ts` (or Python equivalent) with auto-instrumentation, Pino logging, and the filtering exporter.

**What `init` does for a Node.js/TypeScript project:**
- Installs: `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/exporter-logs-otlp-http`, `pino`, `pino-opentelemetry-transport`
- Creates `instrumentation.ts`:
  - Auto-instrumentation for HTTP, Express/Fastify, database clients
  - FilteringExporter wrapping the OTLP exporter
  - Console exporter as fallback (when no OTLP endpoint configured)
  - `OTEL_SERVICE_NAME` set from project name
- Creates `logger.ts`:
  - Pino instance with dual transport: stdout + pino-opentelemetry-transport
  - Structured JSON output with trace context correlation
- Wires into entry point (documents `-r` flag or `instrumentation.ts` hook)

**What `init` does for a Next.js project:**
- Same packages plus Next.js-specific setup
- Creates `instrumentation.ts` in the app root (Next.js 13.4+ hook)
- Configures `next.config.js` experimental instrumentation hook if needed

**What `init` does for a Python project:**
- Installs: `opentelemetry-distro`, `opentelemetry-instrumentation`, `opentelemetry-exporter-otlp`
- Creates `instrumentation.py` with auto-instrumentation
- Documents `opentelemetry-instrument` CLI wrapper

**Rationale**: Instrumentation that requires manual setup never gets added. By making it part of `init`, every project starts observable.

**Alternatives rejected**:
- Extension-only (no `init` integration): requires explicit opt-in, defeats "every project from day one"
- Separate `init-otel` command: adds a step people forget

### 2. Pino as the structured logging standard
**Decision**: All application services use Pino for structured logging. Framework apps (VitePress, Next.js) use their native logger but ensure OTLP-compatible output.

**Configuration:**
```javascript
const logger = pino({
  transport: {
    targets: [
      // Always: stdout for local dev / Docker logs
      { target: 'pino/file', options: { destination: 1 } },
      // When OTLP endpoint configured: send to backend
      ...(process.env.OTEL_EXPORTER_OTLP_ENDPOINT ? [{
        target: 'pino-opentelemetry-transport',
        options: {
          logRecordProcessorOptions: [{
            recordProcessorType: 'batch',
            exporterOptions: { protocol: 'http' }
          }]
        }
      }] : [])
    ]
  }
})
```

**Rationale**: Pino is the fastest Node.js structured logger. It supports multiple transports natively — stdout and OTLP simultaneously. The `pino-opentelemetry-transport` package is maintained by the Pino team (official, not third-party).

**Alternatives rejected**:
- Winston: slower, heavier, more config. The `@opentelemetry/winston-transport` exists but Winston's plugin architecture adds complexity.
- Console.log: no structure, no trace context, no OTLP transport.
- Be flexible (let projects choose): inconsistency across projects means the skill can't teach concrete patterns.

### 3. Category-based filtering exporter
**Decision**: All spans get an `otel.category` attribute. A `FilteringExporter` wraps the real exporter and drops spans from disabled categories before export.

**Standard categories:**
| Category | What it covers |
|----------|---------------|
| `http` | HTTP server/client requests (auto-instrumented) |
| `db` | Database queries (auto-instrumented) |
| `business` | Domain events: hand dealt, user registered, payment processed |
| `inference` | LLM/AI calls: Gemini, Claude, embeddings |
| `state` | State transitions: game started, order status changed |
| `system` | Infrastructure: health checks, cron jobs, queue processing |

**Runtime control:**
- Environment variable: `OTEL_ENABLED_CATEGORIES=http,business,inference`
- Default in dev: all categories enabled
- Default in production: configurable per deployment

**Implementation:**
```typescript
class FilteringExporter implements SpanExporter {
  constructor(private inner: SpanExporter, private enabledCategories: Set<string>) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void) {
    const filtered = spans.filter(span => {
      const category = span.attributes['otel.category'] as string;
      return !category || this.enabledCategories.has(category);
    });
    if (filtered.length > 0) {
      this.inner.export(filtered, resultCallback);
    } else {
      resultCallback({ code: ExportResultCode.SUCCESS });
    }
  }
}
```

**Rationale**: Removes the fear of over-instrumenting. Adding a span is always safe — you only pay export cost for enabled categories. Proven in numero with `FilteringExporter` + `globalThis.__numero_telemetry_state`.

**Alternatives rejected**:
- No filtering (export everything): too noisy in production, expensive at scale
- Sampling instead of filtering: loses specific categories entirely rather than controlling by type
- Build-time removal: requires redeploy to change what's visible

### 4. Console exporter as default (no backend required)
**Decision**: Out of `init`, before any backend is configured, traces go to a console exporter (stdout JSON). When a backend extension (Dash0) is enabled, the OTLP exporter is added alongside.

**Rationale**: The project is observable immediately. You don't need Dash0 set up to see traces during development. The console exporter is noisy but functional. When you're ready for real observability, enabling Dash0 adds the remote exporter without changing instrumentation code.

**Alternatives rejected**:
- Local Jaeger: requires Docker container, adds infrastructure. Good for CI but too heavy for "works out of the box."
- No default exporter: traces are silently dropped, defeating the purpose of auto-instrumentation.

### 5. OTel extension provides knowledge and verification
**Decision**: A built-in extension with a skill file (instrumentation patterns), health checks, and verification commands. The extension does NOT do setup — `init` handles that.

**Skill teaches:**
- Span naming: `{domain}.{entity}.{action}` — e.g., `poker.hand.deal`, `auth.session.create`
- Custom attributes: add domain-specific data to every span
- Error propagation: always with trace context, never swallowed
- Log levels: ERROR (broken), WARN (degraded), INFO (business events), DEBUG (dev)
- When to add manual spans: business events, state transitions, inference calls — anything auto-instrumentation doesn't cover

**Health checks:**
- `instrumentation.ts` exists
- OTel SDK packages are installed
- Exporter is configured (console at minimum, OTLP if backend enabled)

**Verification commands:**
- `pnpm otel:check` — validates instrumentation setup
- During `/work`: "are new code paths instrumented?" as a gate

**Rationale**: The extension is the knowledge layer. It doesn't duplicate what `init` does (setup) — it teaches the agent how to use what `init` created and verifies it stays correct.

### 6. Backend decoupled via OTLP standard
**Decision**: The OTel extension knows nothing about Dash0 or any backend. Connection is through standard OTLP env vars that the backend extension provides.

**Env vars (set by backend extension, not OTel extension):**
- `OTEL_EXPORTER_OTLP_ENDPOINT` — where to send traces/logs
- `OTEL_EXPORTER_OTLP_HEADERS` — auth headers (e.g., Dash0 auth token)

**Rationale**: OTel is a standard. The instrumentation is the same whether you use Dash0, Grafana, Jaeger, or write to files. Coupling to a specific backend would limit adoption and create unnecessary dependencies.

### 7. Autonomous feedback loop (future integration)
**Decision**: Design the OTel extension with the autonomous feedback loop in mind, but don't implement it in this plan.

**The loop:**
```
Agent writes code → OTel instruments it
  → Traces/logs flow to Dash0
    → Agent queries Dash0 via MCP
      → Agent discovers issues (errors, latency, failures)
        → Agent fixes the code
          → Discoveries become Graphiti episodes
            → Context beam surfaces learnings in future sessions
```

**What this plan enables:** the instrumentation layer (steps 1-2). The query layer (step 3) is the Dash0 extension. The memory layer (steps 5-6) is the context-graph plans. This plan doesn't implement the loop but ensures instrumentation is present so the loop has data to work with.

## Documentation Plan

### Pages
- New: `reference/tools/otel.md` — what the extension does, span naming conventions, category taxonomy, how to add manual spans
- Update: `guide/getting-started.md` — mention OTel as part of what `init` creates

### Diagrams
- Mermaid flow diagram: log/trace flow from code → Pino/OTel SDK → FilteringExporter → stdout / OTLP → backend
- Category filtering diagram showing which spans pass through

### Changelog
- Added: OpenTelemetry extension with auto-instrumentation scaffolding, Pino structured logging, category-based filtering

### ADR in Docs
- `decisions/otel-extension.md` — publish to docs site

## Consequences

### Positive
- Every project is observable from `init` — no manual setup
- Pino + OTel transport gives structured logs with trace correlation out of the box
- Category filtering enables aggressive instrumentation without production noise
- Backend-agnostic — works with Dash0, Grafana, Jaeger, or just console
- Foundation for autonomous agent feedback loops

### Negative
- Additional packages in every project (~5-6 npm packages)
- Console exporter is noisy during development (can be disabled)
- FilteringExporter adds a thin layer of complexity to the trace pipeline
- Agent needs to learn span naming conventions and when to add manual spans

### Risks
- `pino-opentelemetry-transport` is relatively new — may have edge cases with high-volume logging
- Auto-instrumentation may conflict with framework-specific setups (Next.js has its own instrumentation hook)
- Category taxonomy may need to evolve as we discover what projects actually need
- Console exporter during dev may confuse developers who don't know what the output is

## References
- [Brief](brief.md)
- [Research](research.md)
- [Pino OpenTelemetry Transport](https://github.com/pinojs/pino-opentelemetry-transport)
- [OpenTelemetry JS SDK](https://opentelemetry.io/docs/languages/js/)
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- numero project: `FilteringExporter` pattern in `game-server/src/instrumentation.ts`
