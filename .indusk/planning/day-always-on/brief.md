---
title: "Day step 4b′ — Always-on"
date: 2026-09-19
status: draft
---

# Day step 4b′ — Always-on — Brief

## Problem

Day step 4b closed the promise loop, but only on a developer's machine: the
Jaeger that holds the marks is the local daemon, in memory, and a promise is
only caught breaking in a run on that machine while it is on. A deployed
application — staging, production — can break a promise at any hour, and
nothing receives the mark, nothing keeps it, and nobody is told. And even
locally, a session asked "what's next" does not look at promises at all.

## Proposed Direction

Run the same loop against deployed systems, with a server that never turns
off and a developer machine that reads from it.

1. **An always-on server built from what InDusk already ships.** The
   local-telemetry extension's Jaeger, in a server configuration: badger
   storage on a persistent disk, basic auth on OTLP ingestion and on the query
   API, TLS in front. Packaged as a container image that runs on any of the
   three hosting shapes the research lays out, with one documented reference
   deployment.
2. **Detection and notification on the server.** A pass on an interval,
   inside the same long-running process, finds violations newer than the last
   pass from the marks alone and posts one Slack message per new violation
   through an incoming webhook: the promise, the symptom, the environment
   (staging or production), and a link to the trace in the server's Jaeger UI.
   The server never writes to the repository.
3. **A project can name its Jaeger.** `.indusk/config.json` names a remote
   query URL, with the credential in the environment; the one read every
   consumer shares reads from it. `indusk promises status`,
   `watch --source deployed` and the admin then show the deployed system's
   promises — `watch` recording incidents in the developer's checkout exactly
   as 4b does, with the environment on the incident.
4. **The admin shows it live.** The Promises page refreshes on the project's
   interval, as the plan page does, and each violation names its environment.
   Health keeps day-monitor's rule: green once seen upheld, red when violated
   in the window, hollow "unverified" when nothing exercised it.
5. **A session raises it.** An MCP tool returns what `status` prints —
   violations per promise, open incidents, violations not yet recorded — and
   `/catchup` and "what's next" report those before the roadmap.

## Context

- Research: `.indusk/planning/day-always-on/research.md` — what 4b left
  local-only, the shipped Jaeger verified as a server (basic auth, badger
  across a restart), the three hosting shapes, Slack webhooks.
- Day step 4b: `.indusk/planning/archive/day-monitor/` and
  `/decisions/day-monitor`.
- Split from 4b on 2026-09-18; settled in conversation 2026-09-19:
  detect-and-notify only, a Slack incoming webhook, the admin stays local,
  D9's health rule kept.

## Scope

### In Scope

- The server configuration and container image; one reference deployment
  documented and run.
- The interval pass, its "already announced" record on disk, the Slack
  webhook.
- A per-project remote Jaeger source for `status`, `watch` and the admin,
  and the environment carried from the span to the incident and the chip.
- `watch --source deployed`.
- Live refresh on the Promises page.
- The MCP tool for promise health, and `/catchup` / "what's next" reporting
  it first.
- An end-to-end test: a deployed-shaped run breaks a promise, the server
  notifies, a developer's `watch` records it, a session raises it.

### Out of Scope

- **A hosted InDusk UI.** Revisit when someone other than the developer needs
  the board; the smaller move then is a read-only health page beside Jaeger.
- **The server writing to the repository** (commits, pushes, issues).
- **Adopting it in a particular application** — an application marks its own
  promises and points its OTLP at the server; that is the application's step,
  in its own repository.
- Notification channels other than a Slack incoming webhook.
- Absence-type promises (Day step 5's ledger).

## Success Criteria

- A promise broken in a deployed run appears in Slack within one pass
  interval, naming the promise, the symptom, the environment and a trace link,
  and appears once, not once per pass.
- The server keeps its traces across a restart and refuses OTLP and queries
  without credentials.
- On a developer's machine, the admin's Promises page for that project turns
  the promise red without a reload; `watch --source deployed` records the
  incident with its environment and reopens the owner.
- Asked "what's next", a session names the open violation before the roadmap.

## Depends On

- `.indusk/planning/archive/day-monitor/` (4b) — closed 2026-09-19.

## Blocks

- An application's adoption of promises in staging and production.
