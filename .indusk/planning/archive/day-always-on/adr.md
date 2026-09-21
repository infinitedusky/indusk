---
title: "Day step 4b′ — Always-on"
date: 2026-09-19
status: accepted
---

# Day step 4b′ — Always-on

## Goal

**A promise broken by a deployed system is kept, announced and recorded while
every developer machine is off.**

Today the loop only runs where a developer is sitting: the marks land in a
local daemon's in-memory Jaeger, and a promise can only be caught breaking in
a run on that machine. A promise a deployed application breaks in production
at 03:00 leaves no trace anywhere, and nobody learns of it. After this step the mark reaches a
server that never sleeps and keeps it on disk, Slack says which promise broke
in which environment within one pass, and the next `watch` on a developer's
machine records the incident and reopens the plan that owns it.

## Y-Statement

**In the context of:**
a promise loop that works end to end on a laptop — an application marks a
behaviour promise with plain OpenTelemetry, the local telemetry daemon's
Jaeger holds the mark, and `indusk promises watch` records an incident and
reopens the owning plan — and applications that now run in staging and
production, where the promises actually break.

**Facing:**
a monitor that only exists while a developer's machine is on and whose store
is in memory: spans from deployed systems reach nothing, a restart loses what
was collected, no one is told when a promise breaks, and a session asked
"what's next" reads the roadmap without ever looking at promise health.

**We decided for:**
an always-on server built from the Jaeger InDusk already ships — badger
storage on a persistent volume, basic auth on both the OTLP receiver and the
query API — that runs its own detection pass on an interval and posts one
Slack message per new violation; plus a per-project setting that points
`status`, `watch` and the admin at that server instead of the local daemon,
an MCP tool that reports promise health, and `/catchup` and "what's next"
reporting violations before the roadmap. Fly.io is the reference deployment.

**And against:**
a hosted InDusk UI (it would need a synced clone of every repository and an
auth story of its own); a server that commits incidents and Maintenance
phases to the repository; a hosted observability backend as the source; a
bespoke ingest service in front of Jaeger; and an external scheduler for the
detection pass.

**To achieve:**
one loop that covers local runs and deployed ones with the same mark, the
same query, the same incident shape and the same reopened plan — so adopting
promises in a deployed application is configuration and code marks, not a
second system.

**Accepting:**
that a person still records the incident (the server only detects and
notifies), that a violation is announced no faster than the pass interval,
that basic auth over TLS is the whole authentication story, and that the
reference deployment's own behaviour can only be checked by hand.

**Because:**
the parts of the loop that must live off the machine are exactly two —
keeping the trace and telling someone — and both are satisfied by what InDusk
already ships plus a webhook, while everything that writes to the repository
stays where a person can see it before it lands.

## Context

- Day step 4b (`/decisions/day-monitor`, archived plan) built the mark, the
  query, incidents, reopening and `monitor`, all against the local daemon.
- The research (`research.md`) verified against the shipped Jaeger v2.17.0:
  basic auth guards OTLP ingestion and the query API (401 without, 200 with),
  and badger keeps traces across a restart. Linux builds already ship.
- Settled in conversation, 2026-09-19: detect-and-notify only; Slack incoming
  webhook; the admin stays local; day-monitor's health rule unchanged; Fly.io
  as the reference deployment.

## Decision

### D1. The server is the shipped Jaeger, configured as a server

No new backend and no bespoke ingest service. The same `jaeger` binary the
`local-telemetry` extension installs, with: `jaeger_storage.backends.*.badger`
on a persistent volume (`ephemeral: false`); the `basicauth` extension on the
OTLP HTTP receiver **and** on `jaeger_query`'s HTTP endpoint; self-telemetry
off. Published as a container image built from the platform's Linux binary,
plus the configuration rendered from environment variables (credentials,
ports, volume path, webhook URL, interval, window).

### D2. Detection runs inside the same process, on an interval

The image runs one long-lived process: Jaeger, and a pass that wakes on an
interval, queries its own Jaeger for spans marked violated since the last
pass, and notifies. No cron, no scheduled machine, no second deployable — a
scheduler is one more thing that can silently stop, and the pass is a loop.

### D3. The pass announces once, and is failure-safe

A small record on the same volume holds the trace ids already announced (and
the newest violation time seen), pruned by the window. A violation is marked
announced **only after** Slack accepted it: a pass that cannot reach Slack
leaves it unannounced, logs that it could not announce, and the next pass
sends it. The inverse of a ledger written before the work, which day-monitor
and the eval rail both learned the hard way.

### D4. The server never writes to the repository

It keeps traces and sends messages. Incidents, Maintenance phases and root
causes are written by `indusk promises watch` in a developer's checkout, where
a person reviews and commits them. No bot with write access, no branch of
machine-authored plan documents, no GitHub token on the server.

### D5. A project names its Jaeger; absence means local

`.indusk/config.json` gains `promises.jaeger: { url, credential_env }` —
the query URL and the **name of the environment variable** holding
`user:password` (never the credential itself). One resolver decides local
daemon versus named remote, and `readPromiseMarks` — already the one call
`status`, `watch` and the admin share — uses it. A project that names none
behaves exactly as today; nothing migrates.

### D6. The environment is a fact from the span, or unknown

`deployment.environment` (the OpenTelemetry resource attribute) is carried
from the span into the Slack message, the incident's frontmatter and the
admin's row. A span without it reads "environment unknown" — never guessed
from the service name or the server it arrived at.

### D7. Health keeps day-monitor's rule

Green means seen upheld in the window, red violated, hollow "unverified" when
no run marked it, amber declared `known-violated`, grey retired. A promise
nothing exercises stays hollow rather than green: for a deployed app that
hollow chip is how an unmarked or unexercised path shows itself.

### D8. The Promises page refreshes like the plan page

The same `LiveRefresh` at the project's `admin.refresh_ms`, so a violation
arriving while the page is open turns the chip red without a reload. No new
polling mechanism.

### D9. A session is told before it plans

An MCP tool returns promise health for the project — violations per promise
in the window, open incidents, and violations not yet recorded as incidents —
and `/catchup` and the "what's next" answer report open violations before the
roadmap. The tool reads through the same `readPromiseMarks` and registry, so
the CLI and the agent cannot disagree.

### D10. Fly.io is the reference deployment

An always-on machine (auto-stop **off** — a stopped machine drops pushed
spans and runs no pass), a persistent volume for badger, provider TLS on
`*.fly.dev` (basic auth sends credentials on every request and needs it), 512
MB–1 GB. The image runs anywhere; a small VPS behind a TLS proxy is the named
alternative. The deployment's own behaviour is U1/U2 in the test plan: a
written deploy-and-break procedure, run once by hand, recorded in the
retrospective.

## Alternatives Considered

### A hosted InDusk UI
The admin reads plans, incidents and registries from the checkouts on a
developer's machine, including plan worktrees. Hosting it means a synced
clone of every repository, freshness, and login. Rejected for this step; if
someone other than the developer needs the board, the smaller move is a
read-only health page beside Jaeger, which needs no checkout.

### The server writes incidents to the repository
Fully automatic, and the tempting shape. Rejected: it puts a bot with write
access in the loop, and machine-authored plan documents land without anyone
reading them. Detect-and-notify keeps every repository write in a session a
person controls — and 4b's dedupe already stops the later `watch` from
double-recording what Slack announced.

### A hosted observability backend as the source
Settled in day-monitor and unchanged: an optional query surface for people,
never a dependency of the loop. The loop must run on a laptop and a cheap box
with nothing else installed.

### An external scheduler for the pass
cron, a systemd timer, or a provider's scheduled machine. Rejected: a second
moving part that fails silently and differs per host, to run a loop the
process can run itself.

### Bearer tokens or OIDC on the endpoints
The shipped build has `basicauth` and `sigv4auth`, not `bearertokenauth`.
Rejected as a reason to build or ship a different binary; basic auth over TLS
is adequate for one server holding one project's traces, and the credential
is an environment variable on both ends.

### A separate server per environment
One Jaeger per staging and per production would keep them apart by
construction. Rejected: the environment is already a resource attribute on
every span (D6), and two servers double the cost, the credentials and the
deployment procedure.

## Consequences

### Positive
- The loop covers deployed systems with the same mark, query, incident and
  reopened plan; adoption is configuration and code marks.
- Traces survive restarts, so a violation is not lost because a process
  cycled.
- A violation reaches a person through Slack without anyone running anything,
  and reaches the next session through `/catchup` without anyone remembering.

### Negative
- A violation is announced no faster than the pass interval.
- An incident still requires a developer to run `watch`; until then the record
  exists only as a Slack message and a trace.
- One more thing to run, with a bill and a credential to rotate.

### Risks
- **The volume fills.** Badger keeps everything it is given. Mitigation: a
  retention setting on the storage and a documented volume size; an open
  question in the research to resolve in the impl.
- **The webhook URL leaks** (it is a bearer credential in a URL). Mitigation:
  environment only, never committed; rotation is creating a new webhook.
- **Basic auth without TLS** would expose credentials. Mitigation: the
  reference deployment is TLS-terminated by the provider, and the
  documentation says a plain-HTTP deployment is not supported.
- **Trusting Slack as the record.** A message is not an incident; the plan
  documents are. Mitigation: `/catchup` reports violations *not yet recorded*,
  so an announced-but-unrecorded violation keeps surfacing.

## Documentation Plan

### Pages
- New: `guide/always-on.md` — what runs where when the loop leaves the
  laptop, and how to adopt it in an application.
- New: `reference/cli/telemetry-server.md` (or a section of the existing
  telemetry reference) — the server image, its environment variables, the
  Fly.io reference deployment, and the deploy-and-break procedure.
- Update: `reference/cli/promises.md` — the remote source, `watch --source
  deployed`, the environment on incidents.
- Update: `guide/promises.md` — the loop diagram gains the deployed path.
- Update: `reference/admin-ui/overview.md` — the live Promises page and the
  environment on a violated row.
- Update: `guide/index.md`'s "What runs where" — the always-on row stops
  saying "nothing yet".

### Diagrams
- The loop diagram in `guide/promises.md`, extended: app → server → Slack, and
  server → `watch` on a developer machine → incident → Maintenance phase.

### Changelog
- One entry: the always-on server, Slack notification, the per-project remote
  source, the live Promises page, and promise health in a session.

### ADR in Docs
- Yes: `decisions/day-always-on.md`, at close.

## References
- `research.md` (this plan) — the verified server behaviours and the hosting
  comparison.
- `.indusk/planning/archive/day-monitor/adr.md` — D1 the mark, D4 the one
  query, D6 incidents, D9 health.
- `test-plan.md` (this plan) — 21 assertions; U1/U2 for the deployment.
