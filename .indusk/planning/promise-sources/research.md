---
title: "Promise sources — Research"
date: 2026-10-04
status: complete
workflow: feature
---

# Promise sources — Research

## Question

What would it take for one project to read its promises from its local
telemetry daemon and its deployed server at the same time, and show both?

## Findings

### One decision, one source

`resolveMarkSource(root)` (`apps/indusk-mcp/src/lib/promises/telemetry.ts`)
returns exactly one `MarkSource`: the server named in `promises.jaeger`
(`url`, `otlp_url`, `credential_env`) when there is one, otherwise the local
daemon from `$INDUSK_HOME/telemetry.json`. A named server without its
credential refuses rather than falling back to local, by design: answering a
question about production with a laptop's traces is the worst outcome.

`readPromiseMarks(root, registry, opts)` calls it once, probes that source
(`probeWatcher`, the watcher-blind check), and returns one `MarkedSpansResult`.

### Four readers, all through that one call

| Reader | Where | What it does with the result |
|---|---|---|
| `promises status` | `bin/commands/promises.ts` | prints one block per promise; header names the Jaeger it read |
| `promises watch` | `lib/promises/watch.ts` | opens or extends incidents; reports the Jaeger it read |
| `promise_health` | `lib/promises/health.ts`, `tools/plan-tools.ts` | one report with `source`, rows and `needsAttention`; `/catchup` reads it |
| the admin | `indusk-admin/src/lib/promise-health.ts` (`readHealth`, `healthOf`), used by the Promises page and the project layout | one cached read per project; one chip per promise |

Because there is exactly one call, adding sources changes one function's shape
and four callers' rendering. No reader reaches Jaeger another way.

### `--source` on watch is a label, not a choice

`promises watch --source local|smoke|deployed` sets the incident's `source:`
field (`INCIDENT_SOURCES`: `local`, `smoke`, `deployed`, `desk`). The read
itself goes wherever `resolveMarkSource` points. So
`watch --source deployed` on a project that names no server reads the
laptop's Jaeger and labels the result "deployed". Named sources would make the
flag mean what it says.

### Each source already carries what a reader needs

`MarkSource` has the endpoint (with credentials), a label, `remote`, and the
intake URL for the probe. The probe cache is keyed by query URL, so two sources
probe independently. *Watcher blind* and *unreachable* are per source already;
they are thrown, which with several sources must become per-source results
rather than one exception for the whole read.

### Configuration

`.indusk/config.json` `promises` holds `domains`, `quiet_window_days`,
`jaeger`. `ensureConfigBlock` adds missing blocks on `update` without
clobbering, keyed on presence.

### The admin's shape

`HealthRead` is `{ ok, marks }` or `{ ok: false, unknownSince, where, blind? }`
per project; `healthRows` maps it to one `HealthRow` per promise, rendered by
`HealthChip` and `HealthDetail` (`components/PromiseHealth.tsx`), with chip
colours in `bars/labels.ts` under the render-parity pin. Two sources mean two
reads, cached separately, and two chips per behaviour promise.

## Open questions

- Should the sidebar's red-plan rollup consider every source, or production
  only? A red local promise during development is expected work, not an
  emergency.
- With two sources, which one does `promise_health`'s `needsAttention` (what
  `/catchup` raises first) count?
- Does `promises.jaeger` stay as the one-source spelling, or become a
  `production` entry by migration? Absence-as-rule has worked so far.

## Sources

- `apps/indusk-mcp/src/lib/promises/telemetry.ts`, `health.ts`, `watch.ts`, `probe.ts`, `vocabulary.ts`
- `apps/indusk-mcp/src/bin/commands/promises.ts`, `src/tools/plan-tools.ts`, `src/lib/config.ts`
- `apps/indusk-admin/src/lib/promise-health.ts`, `src/components/PromiseHealth.tsx`, `src/app/p/[project]/promises/page.tsx`, `src/app/p/[project]/layout.tsx`
