---
title: "Day step 4b′ — Always-on — Research"
date: 2026-09-19
status: complete
---

# Day step 4b′ — Always-on — Research

## Question

Day step 4b closed the promise loop on a laptop: a run marks a behaviour
promise, the local telemetry daemon's Jaeger holds the mark, `indusk promises
watch` records an incident and reopens the owning plan. What does it take for
the same loop to cover a **deployed** application — staging and production,
running when no developer machine is on — and to tell a person when a promise
breaks there?

Settled before research (2026-09-19, in conversation):

- **Write-back is detect-and-notify only.** The always-on side keeps the
  traces and sends a notification; incidents and Maintenance phases are still
  written by `watch` in a developer's checkout, never by a server with write
  access to the repository.
- **Notification is a Slack incoming webhook** — one POST per new violation.
- **The InDusk admin stays local.** It reads the always-on Jaeger; a hosted
  InDusk UI is out of scope, with "someone other than the developer needs the
  board" as the trigger to revisit (a read-only health page beside Jaeger
  being the smaller move).
- **Health stays as day-monitor ADR D9 built it:** green when seen upheld,
  red when violated in the window, hollow "unverified" when no run marked it.
- **Where it runs** is this research's to lay out.

## Findings

### What 4b left local-only

- **Every reader asks the local daemon.** `readPromiseMarks` →
  `markedSpans` → `daemonStatus()` (`lib/telemetry/status.ts`), which reads
  `$INDUSK_HOME/telemetry.json` and queries `http://localhost:<uiPort>`. There
  is no way to name another Jaeger. `status`, `watch` and the admin's health
  read all go through that one call, so a configurable source lands in one
  place.
- **The daemon only renders in-memory storage.** `renderJaegerConfig` in
  `lib/telemetry/daemon.ts` writes `memory: max_traces: 100000`; the shipped
  `jaeger-config.yaml` mentions a `JAEGER_STORAGE=badger` escape hatch the
  daemon code does not implement. A restart loses every trace.
- **The daemon binds with no authentication.** OTLP and the query API accept
  anything that can reach the port — fine on a laptop, not on a server.
- **`watch` reads the whole registry** (plan documents) to know which
  promises exist and who owns them. A server running detection without a
  checkout does not have it; the mark itself carries the promise's name.
- **The admin's Promises page does not refresh itself.** Only the plan page
  wraps `LiveRefresh` (`readAdminRefreshMs`, default 5000 ms).
- **Nothing surfaces promise health in a session.** `list_promises` returns
  the registry and incidents; there is no MCP tool for what `status` prints,
  and `/catchup` does not look at promises. (Asked "what's next" on
  2026-09-19, the agent read the plan masters and never checked promises.)
- **Deployed marks carry no project id.** 4b's `indusk.project` is set by
  InDusk's own evaluator; an application's spans carry only their resource
  attributes (`service.name`, conventionally `deployment.environment`).

### The Jaeger InDusk already ships can be a server (verified 2026-09-19)

Against the `jaeger` v2.17.0 binary in `@infinitedusky/telemetry-binaries-*`:

- **Basic auth guards ingestion and the query API.** The build includes the
  `basicauth` extension (not `bearertokenauth`). With it on the OTLP HTTP
  receiver and on `jaeger_query`'s HTTP endpoint: no credentials → 401;
  `-u user:pass` → 200, for both `POST /v1/traces` and `GET /api/services`.
  An OTel SDK sends it with the standard
  `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <base64>`.
- **Badger persists across a restart.** With
  `jaeger_storage.backends.<name>.badger` and `ephemeral: false`, a trace
  loaded, the process killed and restarted, is returned by
  `/api/traces/<id>`. No new storage dependency.
- **Linux builds already ship** (`telemetry-binaries-linux-x64`,
  `-linux-arm64`), so a Linux server needs no new download path.
- Jaeger tries to export its own traces to `localhost:4317` and logs a
  connection warning when nothing listens; noise, not an error.
- Basic auth sends credentials in every request, so anything off localhost
  needs TLS in front (the host's TLS, or a reverse proxy).

Components present: receivers `jaeger kafka nop otlp zipkin`; processors
`adaptive_sampling attributes batch filter memory_limiter tail_sampling`;
exporters `debug jaeger_storage_exporter kafka nop prometheus`; connectors
`forward spanmetrics`; extensions `basicauth expvar healthcheckv2 jaeger_mcp
jaeger_query jaeger_storage pprof remote_sampling remote_storage sigv4auth
storage_cleaner zpages`.

### Where it could run

What the server must do: accept OTLP over HTTPS from staging and production;
keep Jaeger with badger on a persistent disk; answer the query API over HTTPS
to developer machines (the admin, `status`, `watch --source deployed`); run a
detection pass on a schedule and POST to Slack.

| Option | Reachability from staging/production | TLS | Persistent disk | Schedule | Effort / cost |
|---|---|---|---|---|---|
| **Beside the app's staging** (same provider/network) | Private network possible for OTLP; the query API still has to be reachable from developer machines | the provider's | the provider's volumes | the provider's cron, or a timer on the box | lowest friction if that provider runs long-lived processes; ties the monitor to one app's infrastructure |
| **A small VPS** (one Linux box) | public HTTPS endpoint | Caddy or similar in front | the box's disk | `systemd` timer or cron | a few dollars a month; the box, its updates and its TLS are ours to run |
| **A container host with volumes** (Fly.io and similar) | public HTTPS endpoint, provider TLS | the host's | a mounted volume | the host's scheduled machines, or an in-process interval | an image to build and publish; the least server upkeep |

All three run the same thing — the shipped Jaeger with a server config and a
scheduled pass — so the choice is packaging and a reference deployment, not
architecture. A pass that runs *inside* the long-running process (an interval
timer) needs no scheduler at all, on any of the three.

### Detection on the server without a checkout

- A pass can find violations from the marks alone: query spans tagged
  `indusk.promise.outcome=violated` newer than the last pass, group by
  promise, and notify. It needs the promise **names** only if it is to skip
  unregistered ones.
- To notify once per violation, not once per pass, the server keeps a small
  "last seen" record (the newest violation time per promise, or the trace ids
  already announced) on the persistent disk.
- Owner and root-cause bookkeeping stay local: the developer's
  `watch --source deployed` reads the same Jaeger, and 4b's dedupe (a trace
  already in any incident is never counted again) already prevents a second
  incident for a violation Slack announced.

### Slack incoming webhooks

- One secret URL per channel; `POST` JSON `{"text": "..."}` (optionally
  `blocks`). No app install beyond creating the webhook, no bot token.
- The URL is a credential: it belongs in the server's environment (the
  `doppler` extension is the project's env layer), never in a committed file.
- A message can link to the trace in the server's Jaeger UI
  (`<query-url>/trace/<traceId>`), which is behind the same basic auth.

### Staging and production in one Jaeger

- The OTel convention is the resource attribute `deployment.environment`
  (`deployment.environment.name` in newer semantic conventions). Jaeger stores
  resource attributes as process tags, queryable per trace.
- 4b's incident `source` vocabulary already has `deployed`; the environment
  is a separate fact the incident and the Slack message can carry.

### Raising it in a session

- An MCP tool returning what `status` prints (violations per promise, open
  incidents, unrecorded violations) is small: `readPromiseMarks` plus the
  registry.
- `/catchup` and "what's next" are skill text; the change is an instruction
  to call that tool first and report open incidents and unrecorded violations
  before the roadmap.

## Open Questions

- Badger's retention: the default span TTL in Jaeger v2's badger backend, and
  whether it should be set from the quiet window.
- One server per application, or one server for every application a developer
  watches — and, if shared, whether `service.name` alone keeps projects apart
  or deployed marks need `indusk.project` too.
- How the credential for the query API reaches a developer's machine (per
  project env via the `doppler` extension, or `~/.indusk/config.env` as dash0
  does).
- Whether the scheduled pass runs as a separate process (cron/timer) or an
  interval inside the same long-running process as Jaeger.

## Sources

- The shipped binary: `jaeger components`, and the basic-auth / badger probes
  above (2026-09-19).
- `apps/indusk-mcp/src/lib/promises/telemetry.ts`, `lib/telemetry/status.ts`,
  `lib/telemetry/daemon.ts`, `packages/telemetry-binaries-shared/jaeger-config.yaml`.
- Archived day-monitor plan: `.indusk/planning/archive/day-monitor/` (ADR D4,
  D9; retrospective).
- Slack incoming webhooks: https://api.slack.com/messaging/webhooks
- OpenTelemetry resource semantic conventions (`deployment.environment`).
