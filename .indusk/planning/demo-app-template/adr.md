---
title: "Demo app template — a seat-holds example in this repository"
date: 2026-10-07
status: accepted
---

# Demo app template — a seat-holds example in this repository

## Goal

**One command gives a stranger a running app whose promise holds, and one click breaks it where InDusk sees it.**

Today nothing but InDusk's own evaluator and test suite marks a promise, so the promise loop can only be described, not shown. After this, a person copies the seat-holds example, holds a seat on its page, watches its promise hold in the admin, presses the fault switch, and watches the promise break with the span that broke it, in under two minutes.

## Y-Statement

**In the context of:**
a demo, a showing at Lazer and a public launch that must show InDusk's promise loop, a promise held, broken and caught by telemetry, in a form a stranger can try.

**Facing:**
the need for an app small enough to read in a minute, a promise anyone understands, a break that appears in seconds, and an example that does not rot between releases, while keeping InDusk's rule that an app marks promises with plain OpenTelemetry and no InDusk code.

**We decided for:**
a seat-holds example at `examples/seat-holds/` in this repository, part of the workspace so it is tested with the package and shipped inside it; a small Node server with one static page and in-memory seats; plain OpenTelemetry marks on each release, judged against a short hold window; a fault switch on the page that makes releases late; one promise shipped in its own registry; a Fly config and Dockerfile; and `indusk demo [dir]`, which copies the example from the installed package, initialises it and starts it.

**And against:**
a separate demo repository (stars split across two places, and it goes stale), a framework page (more to read, nothing the demo needs), a database (the promise is about timing, not persistence), a fault switch only in an environment variable (a restart in the middle of the demo), and copying the example from GitHub with `degit` (needs the network and drifts from the installed version).

**To achieve:**
the brief's three promises: the example starts with its promise holding, its break is caught locally, and its deployed page answers.

**Accepting:**
a new CLI command and an example folder in the published package, seats that vanish on restart, and a fault toggle that must be turned off where the example is deployed.

**Because:**
an example beside the package is tested on every landing and cannot fall out of step with the version a person installs, and every part of the demo, from the page to the break, uses only what InDusk already reads.

## Context

[research](research.md) holds the background and the decisions from the 2026-10-07 conversation; the [brief](brief.md) holds the three promises; the [test plan](test-plan.md) holds A1–A10. The promise mark is defined in `apps/docs/src/guide/always-on.md`, "Adopting it in an application".

## Decision

**D1 — Where it lives.** `examples/seat-holds/`, added to `pnpm-workspace.yaml` so `pnpm test` runs its unit tests, and copied into the package (`examples/` in `files`) so `indusk demo` can copy it from the installed version. It depends on nothing from InDusk: a copied example must run on its own.

**D2 — The app.** Node and TypeScript, the server on `node:http` (no framework), one static page with a little plain JavaScript, seats in memory. Three operations: hold a seat, book a held seat, and release. A held seat that is not booked is released when its window passes; the window is a few seconds in the demo, from configuration. The rules (hold, book, release, lateness) are a pure module that takes the clock as an input (A1, A2, A6), and a sweeper calls it once a second.

**D3 — The mark.** `@opentelemetry/sdk-node` with the OTLP HTTP exporter, configured by the standard environment variables, with `service.name` and `deployment.environment` on the resource. Each release is a span carrying `indusk.promise = a-held-seat-is-released-in-time` and `indusk.promise.outcome`: `upheld` when the seat came free within its window plus a tolerance, `violated` otherwise, with an `indusk.promise.violated` event whose symptom names the seat and how late it was. Nothing else in the app knows about InDusk.

**D4 — The fault switch.** A toggle on the page, `POST /fault`, that makes the sweeper skip releases for a few seconds, so they come free late. It is on only when `SEAT_HOLDS_FAULT_TOGGLE=1`, which the local start sets and the Fly config does not; there, `SEAT_HOLDS_FAULT=slow-release` turns it on at start for the production act.

**D5 — The registry.** The example carries `.indusk/promises/a-held-seat-is-released-in-time.md` (a behaviour promise, `enforced`, its test named) and an `.indusk/config.json` naming its domain, so `indusk promises check` passes in a fresh copy (A3).

**D6 — `indusk demo [dir]`.** Copies `examples/seat-holds` from the installed package into `dir` (default `./seat-holds`), runs `git init` and `indusk init` there, installs its dependencies, starts the local telemetry daemon and the example, registers the project with the admin, and prints the page's and the admin's addresses. It refuses, writing nothing, when `dir` exists and is not empty.

**D7 — Deploy.** `examples/seat-holds/fly.toml` and a `Dockerfile`: one machine, the page on 8080, OTLP pointed at the project's server by secrets. A10 deploys it once and requests the page.

## Alternatives Considered

### A separate repository, cloned

The first draft's choice. Attention splits between two repositories, a separate example goes stale, and the clone drifts from the installed version.

### `npx degit` from GitHub

Standard and small, but it needs the network and copies whatever is on the branch, not what the installed version expects.

### A framework (Next.js, Express) and a database

More to read in a demo whose point is the promise. A seat hold is about time; nothing in A1–A10 needs persistence.

### A fault switch in an environment variable only

Turning it on means restarting the app on camera. The page toggle keeps the break one click; the variable stays for the deployed app.

## Consequences

### Positive
- The demo, Lazer and the launch share one example, and every landing tests it.
- The example is the test bed incident-recording and the VS Code extension need.

### Negative
- The package grows by one small example and one command.
- Seats vanish on restart; fine for a demo, wrong for anything else, and the README says so.

### Risks
- **A deployed fault toggle.** Mitigation: it is off unless `SEAT_HOLDS_FAULT_TOGGLE=1`, and the Fly config does not set it.
- **The example's OpenTelemetry versions fall behind.** Mitigation: it is a workspace package, so dependency updates and `pnpm test` reach it.

## Documentation Plan

### Pages
- New: `apps/docs/src/guide/try-it.md`, the two-minute walkthrough (copy, hold, break, see it).
- New: `examples/seat-holds/README.md`, the example on its own, including deploy.
- Update: `apps/docs/src/reference/cli/` with `indusk demo`.

### Diagrams
- None; the walkthrough's screenshots carry it.

### Changelog
- Added: the seat-holds example and `indusk demo`.

### ADR in Docs
- Yes: `apps/docs/src/decisions/demo-app-template.md` at close.

## References
- [research](research.md), [brief](brief.md), [test plan](test-plan.md)
- [indusk-demo master](../indusk-demo/master.md), script steps 1 and 6
- `apps/docs/src/guide/always-on.md`
