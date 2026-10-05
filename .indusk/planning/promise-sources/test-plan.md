---
title: "Promise sources — Test Plan"
date: 2026-10-04
status: accepted
---

# Promise sources — Test Plan

## Purpose

What must be true for a developer to see their promises' local and production
health side by side. Every assertion reads real Jaegers: a local daemon
(`helpers/local-jaeger.ts`) as `local`, and a real always-on server
(`helpers/always-on-server.ts`) named in `promises.jaeger` as `production`.
Each source holds different marks, so a reader that mixes them up fails.

## Behavioral Assertions

| ID | Assertion (what a developer sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | `promises status` for a project naming a production server shows two sections, local and production, each with that source's own violations and upheld marks | vitest system: CLI over a real daemon and a real server holding different marks |
| A2 | `promise_health` reports both sources, each with its own rows, and says which source each violation came from | vitest system: the MCP tool over the same two |
| A3 | The admin's Promises page shows a chip per source for each behaviour promise, so one promise reads green in production and red locally on the same page | vitest HTTP against `next dev` |
| A4 | When one source is unreachable or watcher blind, every reader says so for that source and still shows the other source's health | vitest system: the server stopped (or a fake that answers and hears nothing) while the daemon runs; CLI, tool, admin |
| A5 | `promises watch --source deployed` records incidents from the production server and `--source local` from the laptop: a violation only in production is recorded by the first and not the second | vitest system: watch twice over the two sources |
| A6 | A violation only in local is shown, but does not raise the alarm when a production source exists: no red mark in the admin sidebar, and `/catchup`'s "raise first" list (`needsAttention`) names only production's | vitest system + HTTP + the skill text |
| A7 | A project that names no production server behaves exactly as today: one source, local, with every reader's output unchanged | vitest system: the existing monitor and watcher suites, plus a project with no `promises.jaeger` read through each reader |

## Notes

- **A7 is the regression guard.** Absence of `promises.jaeger` has been the
  rule since day-always-on, and every existing test runs that way. They must
  pass unchanged.
- **A6 encodes the brief's decision** that local breaks are work in progress
  while production breaks are alarms. Without a production source, local
  raises the alarm, as it does today; that half is A7.
