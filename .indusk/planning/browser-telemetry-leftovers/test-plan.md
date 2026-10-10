---
title: "Browser telemetry leftovers — Test Plan"
date: 2026-10-10
status: draft
---

# Browser telemetry leftovers — Test Plan

## Purpose

The behavioral assertions that, together, mean a click's trace reaches the
project's own services on any origin it names, and that `init` writes and says
nothing vendor-specific. Grouped by the promise in the [brief](brief.md) they
prove; each names the smallest level that proves it.

## Behavioral Assertions

### `a-click-and-its-server-work-share-a-trace` — every request the browser makes to the project's own services, on its own origin or any origin or origin pattern the project names, carries the trace it started in.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A click on an instrumented page that makes a request to the page's own origin sends that request with the click's trace in its `traceparent` header. | unit |
| A2 | With an API origin named in the project's setting, a request to that origin carries the click's trace; a request to an origin not named carries no trace header, so a third party's CORS never blocks it. | unit |
| A3 | A named origin pattern, such as every preview URL under one domain, covers each origin that matches it and no other. | unit |
| A4 | A project scaffolded by `indusk init`, its frontend on one port calling its API on another with the API's origin named, shows in local Jaeger one trace that starts at the click and holds the server's spans. | live check |

### `init-writes-no-vendor-into-an-app` — nothing `indusk init` writes into an application names or imports an observability vendor, and what it prints names what it wrote.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A5 | Running `indusk init` on a React SPA, a Next.js app and a Node service writes no file that names or imports an observability vendor, and every line it prints about a file it created names that file and the OpenTelemetry SDK in it. | unit |
| A6 | No instrumentation template the package ships names or imports an observability vendor. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A7 | When the project's frontend calls an API on another origin, `indusk init` tells the person the setting to name it in and that the API must allow the `traceparent` header in its CORS settings. | unit | the decision to prefer capability over configuration: the two places to configure are said, not left to be discovered |
| A8 | The trajectory audit no longer counts a row that mentions only a vendor's name as evidence of telemetry. | unit | the second half of the backlog entry this plan owns; a vendor name is not instrumentation |

## Notes

- A1–A3 run the shipped browser template in the browser test environment with
  its network faked, so the headers sent are read directly; the OpenTelemetry
  web packages become dev dependencies of the package that tests the template.
- A4 is run once, by hand, and recorded in the plan; it needs a scaffolded
  project with a separate API, which no fixture has today.
