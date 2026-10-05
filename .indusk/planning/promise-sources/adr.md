---
title: "Promise sources — local and production, side by side"
date: 2026-10-04
status: proposed
---

# Promise sources — ADR

## Goal

A developer sees each promise's health on their laptop and in production at
once, in every reader. A production break raises the alarm; a local break is
shown as work in progress. See [brief.md](brief.md), [research.md](research.md)
and [test-plan.md](test-plan.md).

## Y-Statement

**In the context of** the promise readers (`promises status`, `promises
watch`, `promise_health`, the admin), which all go through
`readPromiseMarks`, which resolves exactly one source;

**facing** a developer who needs the local loop before deploying and
production's truth after, and a `watch --source deployed` flag that only
labels what it reads;

**we decided for** two named sources: `local` (the daemon, always) and
`production` (the server `promises.jaeger` already names). One function reads
every source and returns a result per source, including that source's failure.
The readers render per source, and the alarm comes from production when there
is one;

**and against** a new `promises.sources` config list, a merged
"worst of both" health, and treating either source's failure as a failure of
the whole read;

**to achieve** both truths on one page with no migration, where one dead
source never hides the other;

**accepting** two reads per refresh instead of one, and a status exit code
that reflects the whole picture.

## Decision

**D1 — Sources are derived, not configured.** `resolveMarkSources(root)`
returns `local`, from `$INDUSK_HOME/telemetry.json`, and `production` when
`promises.jaeger` is set (the same URL, intake and credential rules as today,
the same refusals for an unusable URL or a missing credential). Each `MarkSource`
gains a `name`. The single `resolveMarkSource` is removed: one definition. A
project without `promises.jaeger` has one source, `local`, exactly as today.

**D2 — One read per source, failure per source.** `readSources(root,
registry, opts)` reads every source and returns `SourceRead[]`: either
`{ name, label, ok: true, marks }` or `{ name, label, ok: false, kind:
"unreachable" | "blind", where, reason }`. It never throws for a source's
failure. `readPromiseMarks(root, registry, { source })` stays as the
one-source read and still throws as today. Its default source is the **alarm
source** (D5), so every existing caller and test reads what it reads today.

**D3 — `promises status`:** one section per source, headed with its name and
URL, each laid out as status prints today. It exits 0 when every source
answered and heard, and 2 when any source is unreachable or blind, after
printing the others. A failing source is said, never shown as zero.

**D4 — `promise_health`:** adds `sources`, one entry per source with its rows
and `needsAttention`, or its failure. The top-level `source`, `promises` and
`needsAttention` stay, holding the alarm source's, so existing consumers read
what they read today (A7). `/catchup`'s skill text names the source of each
raised violation.

**D5 — The alarm source is production when it exists, otherwise local.**
`needsAttention` at the top level, the admin sidebar's red-plan mark, and
catchup's "raise first" all come from it. Local-only breaks appear in local's
section and chips, and are not raised (A6).

**D6 — `promises watch --source`:** `deployed` reads `production`, and is
refused naming `promises.jaeger` when none is set. `local`, `smoke` and
`desk` read `local`. The incident's `source:` field is unchanged.

**D7 — The admin:** `readHealth` caches one read per source. Each behaviour
promise gets one chip per source, labelled with the source name, through the
existing `HealthChip` and its label map. A failed source shows its banner (the
unknown-health or *watcher blind* banner) within its own section. With one
source, the page renders exactly as today.

## Alternatives Considered

### A `promises.sources` list in config

Rejected for now: it adds a migration and a schema for a third source nobody
has asked for. `local` plus `promises.jaeger` covers the demo and every
existing project. A list is the obvious next step when a second remote
appears.

### One merged health per promise ("worst of both")

Rejected: it hides exactly what the demo shows, the same promise green in
production and red locally. It also turns every local experiment into a
production alarm.

### Failing the whole read when one source fails

Rejected: a laptop with no daemon running would blank production's health,
and a production outage would hide the local loop. That is the opposite of
"say what you know".

## Consequences

- **Positive:** both truths on one page; `--source` means what it says; no
  migration.
- **Negative:** two Jaeger reads per admin refresh, each with its own probe.
  Both are cached as before.
- **Risk:** the top-level `promise_health` fields now hold only the alarm
  source. A consumer that wanted local there must read `sources`. Only catchup
  reads the tool today.

## Documentation Plan

- Update `guide/promises.md`: a "Local and production" section.
- Update `reference/cli/promises.md`: status per source, its exit codes, and
  `watch --source`.
- Update `reference/skills/catchup.md`: the source of a raised violation.
- Admin overview: chips per source.
- Changelog: Added.
- `decisions/promise-sources.md` at close.

## References

- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- `.indusk/planning/archive/day-always-on/adr.md` D5 (a project names its Jaeger)
- `.indusk/planning/archive/watcher-heartbeat/adr.md` D1 (the probe in the read path)
