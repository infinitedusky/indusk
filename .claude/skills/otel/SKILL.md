---
name: otel
description: OpenTelemetry instrumentation patterns — span naming, categories, structured logging, error propagation, sensitive data, and validation
---

# OpenTelemetry

Every service is instrumented from day one. `init` creates the instrumentation files. This skill teaches you how to produce high-quality telemetry.

## What's Already Set Up

After `init`, your project has instrumentation files for your runtime. See the OTel reference docs for the full list per runtime. The spans go to the local daemon by default: `indusk telemetry address` prints where it listens, and a set `OTEL_EXPORTER_OTLP_ENDPOINT` wins. The service is named after the project, and every span carries `indusk.project` and `deployment.environment` (`development` unless something sets it), from `telemetry-settings.ts`.

## Core Principle: Signal Density Over Volume

Every telemetry item should serve one of three purposes:
- **Detect** — help identify that something is wrong
- **Localize** — help pinpoint where the problem is
- **Explain** — help understand why it happened

If it doesn't serve one of these purposes, don't emit it.

## When to Add Manual Spans

Auto-instrumentation covers HTTP requests and database queries. You need manual spans for:

- **Business events**: `poker.hand.deal`, `auth.session.create`, `order.checkout.complete`
- **State transitions**: `game.state.waiting_to_active`, `payment.status.pending_to_settled`
- **Inference calls**: `inference.gemini.generate`, `inference.embedding.create`
- **Batch operations**: `migration.run`, `cron.cleanup.expired_sessions`

If it's a meaningful action that you'd want to see in a trace, add a span.

## Span Naming

Span names MUST be low-cardinality. The number of unique span names should be bounded and small.

### General pattern: `{domain}.{entity}.{action}`

```typescript
// Good — low cardinality
tracer.startSpan('poker.hand.deal');
tracer.startSpan('auth.session.create');
tracer.startSpan('settlement.receipt.sign');

// Bad — high cardinality (contains variable data)
tracer.startSpan(`process_payment_for_${userId}`);  // user ID in name!
tracer.startSpan(`GET /api/users/${id}`);            // path param in name!
```

Variable data (user IDs, order numbers, room codes) goes in **attributes**, never in the span name.

### Per-signal naming

| Signal | Format | Example |
|--------|--------|---------|
| HTTP server | `{method} {route}` | `GET /api/users/:id` |
| HTTP client | `{method} {template}` | `POST /checkout` |
| Database | `{operation} {collection}` | `SELECT orders` |
| Messaging | `{operation} {destination}` | `publish shop.orders` |
| Business logic | `{domain}.{entity}.{action}` | `poker.hand.deal` |

## Span Kind

Each span has exactly one kind. Choose based on the communication pattern:

| Kind | Use When | Examples |
|------|----------|---------|
| `SERVER` | Handling an inbound sync request | HTTP handler, gRPC handler |
| `CLIENT` | Making an outbound sync request | HTTP call, database query, outbound RPC |
| `PRODUCER` | Initiating an async operation | Publishing to a queue |
| `CONSUMER` | Processing an async operation | Processing a queued message |
| `INTERNAL` | Internal operation, no remote peer | In-memory computation, business logic |

Common mistakes:
- Using `INTERNAL` for everything — database calls are `CLIENT`, HTTP handlers are `SERVER`
- Using `CLIENT` for message publishing — that's `PRODUCER` (async, no response expected)

## Span Status

Only set error status explicitly. Success is the default.

```typescript
import { SpanStatusCode } from '@opentelemetry/api';

// Only set on error
span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });

// Don't set OK explicitly — it's the default
// span.setStatus({ code: SpanStatusCode.OK }); // unnecessary
```

## Custom Attributes

Always add domain-specific data to spans:

```typescript
const span = tracer.startSpan('poker.hand.deal', {
  attributes: {
    'otel.category': 'business',
    'room.code': roomCode,
    'hand.number': handNumber,
    'player.count': players.length,
  },
});
```

### Attribute hygiene

- Use snake_case with dots for namespacing: `room.code`, `player.count`
- Keep values low-cardinality where possible
- Never put variable-length user input in attributes without truncation

## Categories

Every manual span should get an `otel.category` attribute:

| Category | What it covers | Examples |
|----------|---------------|----------|
| `http` | HTTP requests | Auto-instrumented |
| `db` | Database queries | Auto-instrumented |
| `business` | Domain events | hand dealt, user registered, payment processed |
| `inference` | LLM/AI calls | Gemini generate, embedding create |
| `state` | State transitions | game started, order shipped |
| `system` | Infrastructure | health checks, cron, queue processing |

Control export via `OTEL_ENABLED_CATEGORIES`:

```bash
OTEL_ENABLED_CATEGORIES=http,business  # only these categories exported
```

Unset = all categories exported. Spans without a category are always exported.

## Structured Logging with Pino

Use the project logger, not `console.log`:

```typescript
import { logger } from './logger';

// Good — structured, with context
logger.info({ roomCode, players: players.length }, 'hand started');
logger.error({ err, orderId }, 'payment failed');

// Bad — unstructured string
console.log('Hand started for room ' + roomCode);
```

### Log levels

| Level | Meaning | When to use |
|-------|---------|------------|
| `error` | Something is broken | Unhandled errors, failed operations |
| `warn` | Degraded but functional | Approaching limits, fallback behavior |
| `info` | What happened, for diagnosis | Completed operations, state changes worth reading around a failure |
| `debug` | Development details | Disable in production |

### Structured logging safeguards

Never spread entire objects — explicitly pick safe fields:

```typescript
// BAD: spreads entire request body — may contain passwords, tokens, PII
logger.info({ ...req.body }, 'user signup');

// GOOD: explicitly select safe fields
logger.info({ userId: req.body.userId, plan: req.body.plan }, 'user signup');
```

## Trace Correlation in Logs

Every log inside an active span should carry trace context:

```typescript
import { trace, context } from '@opentelemetry/api';

function getTraceContext() {
  const span = trace.getSpan(context.active());
  if (!span) return {};
  const ctx = span.spanContext();
  // The keys the log transport itself writes, so the log and the span line up
  return { trace_id: ctx.traceId, span_id: ctx.spanId, trace_flags: `0${ctx.traceFlags.toString(16)}` };
}

logger.info({ ...getTraceContext(), orderId }, 'order placed');
```

Wrap this in a helper so every log call includes trace context automatically. Without it, logs are isolated events that can't be connected to the request that produced them.

## A Promise's Signal Is a Span

A behaviour promise's signal is a span, written with the app's `signal` helper (`./signal`, which `init` writes and you own), one call per verdict, from the place the behaviour happens:

```typescript
import { signal } from './signal';

signal.upheld({ promise: 'a-hold-is-released', clause: 'on-time', value: 812, bound: 1000 });
signal.broken({ promise: 'a-hold-is-released', clause: 'on-time', symptom: 'released 5.1 s late' });
```

A log line is for diagnosis and is never the signal. What a promise held to goes in a span, where the readers look.

## Error Propagation

Errors must always include trace context. Never swallow silently:

```typescript
try {
  await processSettlement(hand);
} catch (err) {
  // 1. Record on span
  span.recordException(err);
  span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
  
  // 2. Log with correlation
  logger.error({ err, ...getTraceContext() }, 'settlement failed');
  
  // 3. Re-throw — don't swallow
  throw err;
}
```

Every catch block should either:
1. Re-throw with context preserved
2. Log with trace correlation and handle completely

## Sensitive Data

Never attach these to spans, logs, or metrics:

| Category | Examples |
|----------|----------|
| Auth credentials | Passwords, API keys, bearer tokens, session cookies |
| Financial instruments | Credit card numbers, bank accounts, CVVs |
| Government IDs | SSN, passport numbers, tax IDs |
| Full auth headers | `Authorization`, `Cookie` header values |

For URLs, strip query parameters that carry tokens or user input:

```typescript
// BAD
span.setAttribute('http.url', 'https://example.com/callback?token=eyJhbG...');

// GOOD
span.setAttribute('http.url', sanitizeUrl(req.url));
```

For database queries, never include literal parameter values — use parameterized queries.

## Validation Checklist

After instrumenting a service, verify:

1. **Service appears in the local daemon** — `indusk telemetry address` says where it listens; the `get_services` tool of the `jaeger` MCP server lists your service name
2. **Resource attributes present** — `service.name`, `service.version`, `deployment.environment`
3. **Expected span names appear** — list your endpoints and business operations, verify each produces a span
4. **Attributes are populated** — check that domain attributes (`room.code`, `player.count`) are present
5. **Errors are tracked** — trigger an error, verify it appears with exception details and trace context
6. **Logs correlate with traces** — verify `trace_id` and `span_id` appear in log records

## Framework-Specific Notes

### Node.js (ESM)
- Load instrumentation with `--import`: `node --import ./src/instrumentation.ts src/index.ts`
- ESM requires `--import`, not `--require`

### Next.js
- Server: `instrumentation.ts` at app root, loaded automatically by Next.js (13.4+)
- Client: `src/instrumentation.web.ts`, import in your root client component
- Both server and client need separate instrumentation — they run in different environments

### React SPA (Vite)
- `import './instrumentation'` at the top of `main.tsx`
- Browser env vars use `VITE_` prefix: `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
- The browser template instruments `fetch` and `XMLHttpRequest` (axios); both send `traceparent` only to its own origin and to the origins or `*` patterns named in `VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO`; the named API must allow `traceparent` in its CORS settings (`Access-Control-Allow-Headers`), or the browser blocks the request
- Entries are origins with a scheme (`https://api.example.com`, `https://*.dev.example.com`); one without is ignored with a console warning
- An entry with a path covers that path and what is under it (`https://api.example.com/v1` covers `/v1/seats`, not `/v2`); a default port may be written or left off, for exact and pattern entries alike; the path is compared as written (`/Admin` is not `/admin`), host and scheme case are not; a query or fragment written on an entry is ignored, for exact and pattern entries alike
- Only a request made synchronously in the click handler is in the click's trace; one after a native `await`, from a `.then()` callback or a timer is in its own trace — make the request before the first `await`, or accept the separate trace

### Python
- Use `opentelemetry-instrument` CLI: `opentelemetry-instrument python your_app.py`
- Or import `instrumentation.py` before app code

## Environment Variables

### Server

| Variable | Purpose | Default |
|----------|---------|---------|
| `OTEL_SERVICE_NAME` | Service name | Named in `telemetry-settings.ts` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Backend URL | The daemon's stored traces address (`indusk telemetry address`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers | Not set |
| `OTEL_ENABLED_CATEGORIES` | Active categories | All |
| `LOG_LEVEL` | Pino log level | `info` |

### Browser

| Variable | Purpose |
|----------|---------|
| `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` / `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT` | Backend URL |
| `VITE_OTEL_EXPORTER_OTLP_HEADERS` / `NEXT_PUBLIC_OTEL_EXPORTER_OTLP_HEADERS` | Auth headers |
| `VITE_OTEL_PROPAGATE_TO` / `NEXT_PUBLIC_OTEL_PROPAGATE_TO` | Other origins that receive the click's trace (comma-separated; `*` is a pattern) |

## During `/work`

When implementing or reviewing code, check:
- Are new endpoints and business logic instrumented with manual spans?
- Do spans have meaningful names (low-cardinality, `{domain}.{entity}.{action}`)?
- Do spans have the right kind (SERVER, CLIENT, INTERNAL)?
- Do spans have `otel.category` and domain-specific attributes?
- Are errors recorded with `recordException` + `setStatus(ERROR)` + trace-correlated log?
- Is structured logging used (not `console.log`)?
- Is sensitive data excluded from attributes and logs?
