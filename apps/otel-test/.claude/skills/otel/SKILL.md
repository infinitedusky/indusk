# OpenTelemetry

Every service is instrumented from day one. `init` creates the instrumentation files. This skill teaches you how to use them.

## What's Already Set Up

After `init`, your project has:
- `instrumentation.ts` — auto-instruments HTTP, database, and framework calls
- `filtering-exporter.ts` — controls which span categories get exported
- `logger.ts` — Pino structured logger with stdout + OTLP dual output

## When to Add Manual Spans

Auto-instrumentation covers HTTP requests and database queries. You need manual spans for:

- **Business events**: `poker.hand.deal`, `auth.session.create`, `order.checkout.complete`
- **State transitions**: `game.state.waiting_to_active`, `payment.status.pending_to_settled`
- **Inference calls**: `inference.gemini.generate`, `inference.embedding.create`
- **Batch operations**: `migration.run`, `cron.cleanup.expired_sessions`

If it's a meaningful action that you'd want to see in a trace, add a span.

## Span Naming

Use `{domain}.{entity}.{action}`:

```typescript
const tracer = trace.getTracer('my-service');

// Good
tracer.startSpan('poker.hand.deal');
tracer.startSpan('auth.session.create');
tracer.startSpan('settlement.receipt.sign');

// Bad
tracer.startSpan('processRequest');
tracer.startSpan('handle');
tracer.startSpan('doThing');
```

## Custom Attributes

Always add domain-specific data to spans:

```typescript
const span = tracer.startSpan('poker.hand.deal');
span.setAttribute('otel.category', 'business');
span.setAttribute('room.code', roomCode);
span.setAttribute('hand.number', handNumber);
span.setAttribute('player.count', players.length);
// ... do work ...
span.end();
```

## Categories

Every manual span should get an `otel.category` attribute. This controls whether it gets exported:

| Category | What it covers | Examples |
|----------|---------------|----------|
| `http` | HTTP server/client requests | Auto-instrumented |
| `db` | Database queries | Auto-instrumented |
| `business` | Domain events | hand dealt, user registered, payment processed |
| `inference` | LLM/AI calls | Gemini generate, embedding create |
| `state` | State transitions | game started, order status changed |
| `system` | Infrastructure | health checks, cron jobs, queue processing |

Control which categories are exported via `OTEL_ENABLED_CATEGORIES`:

```bash
# Export only HTTP and business spans
OTEL_ENABLED_CATEGORIES=http,business node -r ./instrumentation.ts src/index.ts

# Export everything (default)
node -r ./instrumentation.ts src/index.ts
```

## Structured Logging with Pino

Use the project logger, not `console.log`:

```typescript
import { logger } from './logger';

// Good — structured, with context
logger.info({ roomCode, players: players.length }, 'hand started');
logger.error({ err, traceId: span.spanContext().traceId }, 'settlement failed');
logger.warn({ queueDepth: 150, threshold: 100 }, 'queue depth approaching limit');

// Bad — unstructured string
console.log('Hand started for room ' + roomCode);
console.log('Error: ' + err.message);
```

### Log Levels

| Level | Meaning | When to use |
|-------|---------|------------|
| `error` | Something is broken | Unhandled errors, failed operations that should succeed |
| `warn` | Degraded but functional | Approaching limits, fallback behavior triggered |
| `info` | Business events | State transitions, user actions, completed operations |
| `debug` | Development details | Variable values, flow tracing — disable in production |

## Error Propagation

Errors must always include trace context:

```typescript
try {
  await processSettlement(hand);
} catch (err) {
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  logger.error({ err, traceId: span.spanContext().traceId }, 'settlement failed');
  throw err; // re-throw with context preserved
}
```

Never swallow errors silently. Every catch block should either:
1. Re-throw with context
2. Log with trace correlation and handle completely

## Framework-Specific Notes

### Next.js
The `instrumentation.ts` file in the app root is loaded via the Next.js instrumentation hook (13.4+). No `-r` flag needed.

### Python
Use the `opentelemetry-instrument` CLI wrapper:
```bash
opentelemetry-instrument python your_app.py
```
Or import the instrumentation module before your app code.

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OTEL_SERVICE_NAME` | Service name in traces | Project name (set by init) |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Backend URL | Not set (uses console exporter) |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers for backend | Not set |
| `OTEL_ENABLED_CATEGORIES` | Comma-separated active categories | All enabled |
| `LOG_LEVEL` | Pino log level | `info` |

When no `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces go to the console exporter (stdout). Enable a backend (like Dash0) to send traces remotely.

## Verification

During `/work`, check:
- Are new endpoints/business logic instrumented?
- Do manual spans have meaningful names and category attributes?
- Are errors recorded with trace context?
- Is structured logging used (not console.log)?
