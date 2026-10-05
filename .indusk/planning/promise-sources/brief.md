---
title: "Promise sources — local and production, side by side"
date: 2026-10-04
status: draft
workflow: feature
---

# Promise sources — Brief

## Problem

A project reads its promises from one Jaeger: the deployed server if
`promises.jaeger` names one, otherwise the local daemon, never both
([research](research.md)). A developer working toward a deploy needs both at
once. Local is the closed loop before deployment: smoke runs, and the demo's
"fails locally first" step. Production is what is actually happening to users.

The research also found that `promises watch --source deployed` is only a
label: it reads whatever the one source is.

## Direction

1. **Two sources, no new configuration.** `local` is always the project's
   telemetry daemon. `production` is the server `promises.jaeger` already
   names, when it names one. A project without `promises.jaeger` reads local
   only, exactly as today, so absence stays the rule and nothing migrates. More
   than one remote (staging, several workbenches) can come later as a list.
2. **Every reader reads each source and reports per source.** `readPromiseMarks`
   gains a per-source form that returns one result per source. *Watcher blind*
   and *unreachable* become that source's result instead of an exception for
   the whole read, so one dead source never hides the other.
   - **`promises status`:** one section per source.
   - **`promise_health`:** a `sources` list, each with its own rows. The
     `/catchup` skill says which source a violation came from.
   - **`promises watch --source deployed`:** reads production; `local` and
     `smoke` read local. The flag finally means what it says.
3. **The admin shows both.** Each behaviour promise gets a chip per source,
   labelled `local` and `production`, so the same promise can be green in
   production and red on your laptop. A source that is blind or unreachable
   says so on its own row.
4. **Production outranks local where there is one answer to give.** The
   sidebar's red-plan mark and `/catchup`'s "raise this first" come from
   production when the project has one. A red local promise during
   development is expected work, not an emergency, so it is shown but not
   raised. Without production, local is the answer, as today.

## Success criteria

- One project shows its local and production health on one page, each with
  its own state.
- A source that is unreachable or blind says so without hiding the other.
- `watch --source deployed` records from the production server, and
  `--source local` from the laptop.
- A project with no `promises.jaeger` behaves exactly as it does today.

## Out of scope

More than two sources; per-developer credentials; the timeline
([promise-timeline](../promise-timeline/brief.md), next).

## Part of

[indusk-demo](../indusk-demo/master.md), step 1.
