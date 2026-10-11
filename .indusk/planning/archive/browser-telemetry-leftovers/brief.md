---
title: "Browser telemetry leftovers — a click and its server work share a trace"
date: 2026-10-10
status: accepted
workflow: bugfix
---

# Browser telemetry leftovers — Brief

What the audit found and what was decided on the way are in
[research.md](research.md).

## Expectations

1. **The next project scaffolded with `indusk init` shows one trace from a click to the server, in local Jaeger.**
   - Measure: a trace in the local Jaeger whose root is a browser user-interaction span and which holds the server's spans for that request
   - Look: the first project initialized after this lands, or the seat-holds demo if it gains browser instrumentation first

## Promises

### This plan makes

1. **`a-click-and-its-server-work-share-a-trace`** (state). In a project `indusk init` instrumented, every `fetch` or XMLHttpRequest the browser makes in a click's call to the project's own services — on its own origin or on any origin or origin pattern the project names — carries the trace the click started, so the server's spans and its promise marks belong to the click that caused them. A request made after a native `await` in the handler is not promised.
2. **`init-writes-no-vendor-into-an-app`** (structure). Nothing `indusk init` writes into an application's source names or imports an observability vendor (a destination telemetry is sent to), and what it prints names the file it created and the OpenTelemetry SDK in it, for every scaffold it writes: browser, Node and Python. An OpenTelemetry distribution such as `@vercel/otel` is not a vendor in this sense.

### Existing promises

**Must not break**

None.

**Changes**

None.

**Replaces**

None.

### Not promised

- A click's trace across a native `await` in a handler: zone.js cannot follow native `async`/`await` and no browser carries a context across it yet (AsyncContext). Documented in the otel skill; backlog entry in `known-issues.md`.
- An existing project's template: `init` skips files that exist and `update` does not refresh them (backlog entry in `known-issues.md`).
- `indusk-always-receives-the-telemetry` — InDusk is always a destination, others are added and removed freely: the backlog feature plan [telemetry-destinations](../telemetry-destinations/brief.md).
- Browser instrumentation in the seat-holds demo: demo-rehearsal, or the tray work after the launch.
- The glow on the page when a promise breaks: the tray, after the launch.

## Depends On

- None.

## Blocks

- `telemetry-destinations` (not yet a plan) builds on the template this plan fixes.
