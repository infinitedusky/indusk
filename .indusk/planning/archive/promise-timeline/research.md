---
title: "Promise timeline — Research"
date: 2026-10-05
status: complete
workflow: feature
---

# Promise timeline — Research

## Question

The brief's direction was set by Sandy on 2026-10-03 and revised on
2026-10-05 after promise-sources. What does it rest on, measured: how many
marks a timeline draws, what reading them costs, how far back each source
reaches, and what an incident records about its own life?

## Findings

### How many marks there are

Measured against the local daemon on 2026-10-05, over seven days:

- `every-commit-evaluated`: **368 traces**, the oldest at 2026-10-02 17:26 —
  about 120 a day, one per evaluated commit.
- `gates-ran-at-every-checkoff`: **0** — nothing marks it in this repository.
  It is the "hollow promise" case the brief names: a row that must say so,
  not draw empty health.
- Production (the Fly server) holds only the deploy smoke's marks today. The
  demo app will mark on every request, so its volume will be
  traffic-shaped: hundreds to thousands an hour, not a hundred a day.

### What a read costs

A mark is read through Jaeger's `GET /api/traces` with a tag filter, one
query per service per promise name (`markedSpans`,
`apps/indusk-mcp/src/lib/promises/telemetry.ts`). Jaeger returns **whole
traces**, not the marked span: the seven-day query above returned
**10.9 MB** for 368 traces. The evaluator's traces carry logs and long
attributes, so a mark costs about 30 KB to read.

- Locally that took 0.11 s.
- Against the Fly server it is 10.9 MB over the network for one promise. The
  Promises page re-reads on every refresh (`admin.refresh_ms`, 5 s by
  default; the health read is cached for exactly that long). A timeline that
  re-reads the whole window each refresh would move megabytes a second.
- One query returns at most 1,500 traces (`TRACE_LIMIT`). At request-rate
  marking that is minutes of history, so the window cannot be one query.
- Jaeger's query API has no aggregation — no count-per-bucket endpoint. The
  only aggregation path is the collector's span-metrics connector feeding a
  metrics store, which neither the daemon nor the server runs.

### How far back each source reaches

- **Local**: the daemon keeps traces in memory (`max_traces: 100000`,
  `apps/indusk-mcp/src/lib/telemetry/daemon.ts`) and loses them on restart.
  The running daemon started 2026-10-02 17:25, and the oldest mark is one
  minute later: local history is "since the daemon last started", here 2.5
  days.
- **Production**: badger on the server's volume, kept across restarts — the
  history that lasts weeks, as the brief says.

### What an incident records

An incident file (`.indusk/promises/incidents/*.md`) carries `opened`,
`last_seen`, `traces` and `status: open | fixed`. **It has no time at which
it was fixed.** Marking an incident fixed changes `status` and nothing else,
so the brief's "band from the time it opened to the time it was fixed" has
no end to draw. The fixed time exists only in git history, as the commit
that changed `status`. The two incidents fixed so far were marked by hand.

An incident's `traces` are the violation trace ids it records, so "is this
violation's incident fixed?" is a lookup by trace id — what the brief's
red-versus-purple rule needs. Incidents also carry `source` (`local`,
`smoke`, `deployed`, `desk`).

### What the admin already has

- The Promises page already groups by owner plan, domain, state or kind,
  with a button row (`apps/indusk-admin/src/components/Promises.tsx`). The
  brief's "by plan or by domain" exists; collapsing does not.
- Since promise-sources, each behaviour promise has one health chip per
  source, the alarm source's first. `healthOf`
  (`apps/indusk-admin/src/lib/promise-health.ts`) decides a chip's colour and
  is already called once per source.
- The admin reads incidents through the registry (`registry.incidents`), and
  the package's `recorded()` reads an incident's traces.

## Open Questions

- Bucket size per window: an hour for a week, a minute for an hour? The page
  needs a sensible default and the drawing needs a fixed bucket count.
- Whether to read incrementally — keep what was read and ask only for what is
  new since — or to cache whole-window reads for longer than one refresh.
- Whether to add a `fixed` time to incidents (written when status becomes
  `fixed`) or derive it from git history.

## Sources

- Local Jaeger query API, 2026-10-05: `GET /api/traces?service=indusk-eval-agent&tags={"indusk.promise":"every-commit-evaluated"}` over seven days.
- `apps/indusk-mcp/src/lib/promises/telemetry.ts` (`markedSpans`, `TRACE_LIMIT`), `sources.ts` (`readSources`).
- `apps/indusk-mcp/src/lib/telemetry/daemon.ts` (in-memory store, `max_traces`).
- `.indusk/promises/incidents/*.md` frontmatter.
- `apps/indusk-admin/src/components/Promises.tsx`, `src/lib/promise-health.ts`.
