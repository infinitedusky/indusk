---
title: "Browser telemetry leftovers"
date: 2026-10-10
status: complete
---

# Browser telemetry leftovers — Research

## Question

Does `indusk init` still write a vendor's browser SDK into applications, as
the master plan's backlog says, and what stands between a click in the browser
and the server work it causes sharing one trace?

## Background

Raised while talking about the cockpit becoming a tray on the running
application (2026-10-10): a promise broken in server-side logic should make the
part of the page the person was using glow. The link is trace context — the
browser's click starts a trace, the request carries it, the server's spans and
promise marks join it — so the browser half of every scaffolded app has to
carry the trace to wherever the project's services are.

## Findings

Audit of the main checkout at `c61d2444`:

1. **The scaffold is already vendor-neutral.** Since v1.6.0 (`f1a37ca2`) both
   the Next.js and the React SPA branches of `init` copy
   `templates/instrumentation.web.ts`: `WebTracerProvider`, the OTLP HTTP
   exporter, fetch, document-load and user-interaction instrumentation. No
   `@dash0/sdk-web` anywhere in the package's code or templates.
2. **What `init` prints says otherwise.** For a React SPA it prints
   `create: src/instrumentation.ts (React SPA — @dash0/sdk-web)`, under the
   comment "browser instrumentation via Dash0 Web SDK"
   (`apps/indusk-mcp/src/bin/commands/init.ts:951–961`). The file is the OTel
   one; the message is false.
3. **The backlog entry is stale.** `.indusk/planning/master.md` (the "Bugfix,
   not a step" entry of 2026-09-18) describes the vendor SDK as still
   scaffolded.
4. **Its other half is open.** `"dash0"` is still in the trajectory audit's
   telemetry keywords (`apps/indusk-mcp/src/lib/trajectory/audit.ts:22`).
5. **The trace stops at the browser for any other origin.** The template calls
   `new FetchInstrumentation()` with no `propagateTraceHeaderCorsUrls`, so
   `traceparent` is sent only to the page's own origin. A frontend on
   `localhost:5173` calling an API on `localhost:3000` produces two unrelated
   traces. OTel's default is deliberate: a custom header on a cross-origin
   request triggers a CORS preflight, and a server that does not allow
   `traceparent` makes the browser block the request.
6. **No test reads what `init` writes for the browser**, and no promise covers
   it.
7. **The seat-holds demo has no browser instrumentation**; only its server is
   traced.

## Decisions

- **Capability over configuration** (Sandy, 2026-10-10): "the capability is
  what's going to sell the idea." Cross-origin propagation is in, for every
  setup — same origin; local split ports; hosted dev environments with
  preview URLs, by origin pattern; and, later, environments InDusk runs
  itself, where InDusk fills the list in. Sent only to origins the project
  names, never to every origin, so third-party requests are never blocked.
- **InDusk always receives the telemetry** (Sandy, 2026-10-10): a vendor or
  company extension adds a destination beside InDusk's; destinations other
  than InDusk's are added and removed freely; InDusk's is never removed. The
  promise is `indusk-always-receives-the-telemetry` (structure). **Not this
  plan** — Sandy: "two phases, the telemetry destinations is not critical at
  all." It is the follow-on below.

## Follow-on: `telemetry-destinations` (feature, not critical)

Today a scaffolded app reads one endpoint variable, so pointing it at a vendor
replaces InDusk instead of adding to it, and the vendor extensions (`dash0`)
are read-only. The plan: the templates send to InDusk's collector by default;
an extension adds an exporter to that collector (the daemon's Jaeger, itself an
OTel Collector distribution, and the always-on server's); the promise above.
Open: whether production fan-out runs through the always-on server or the app
sends to two endpoints directly — a gateway for a company's whole telemetry
stream is a load and uptime question the local case does not have. Recorded
in the master plan's backlog by this plan.

## Sources

- `apps/indusk-mcp/templates/instrumentation.web.ts`
- `apps/indusk-mcp/src/lib/telemetry/daemon.ts` — the daemon's Jaeger OTLP
  receiver already allows any origin (CORS `*`)
- OpenTelemetry JS `@opentelemetry/instrumentation-fetch`:
  `propagateTraceHeaderCorsUrls` (strings or regular expressions)
