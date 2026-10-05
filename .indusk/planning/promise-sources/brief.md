---
title: "Promise sources — local and production, side by side"
date: 2026-10-04
status: draft
workflow: feature
---

# Promise sources — Brief

## Problem

A project reads its promises from one Jaeger: the deployed server if
`promises.jaeger` names one, otherwise the local daemon, never both. A
developer working toward a deploy needs both at once: local for the closed loop
before deployment (smoke runs, the fail-locally-first step of the demo), and
production for what is actually happening to users.

## Direction

- `promises.sources`: a list of named sources in `.indusk/config.json`, e.g.
  `local` (the daemon) and `production` (`url`, `otlp_url`, `credential_env`).
  `promises.jaeger` keeps working as a one-source shorthand.
- Every reader (`readPromiseMarks`, `promises status`, `promise_health`, the
  admin, catchup) reads each source and reports per source. Each source gets
  its own probe and its own *watcher blind*.
- The admin's Promises page shows a column or chip per source, so the same
  promise can be green in production and red locally.
- `promises watch --source` already names where an incident came from; it
  reads the matching named source.

## Success criteria

- One project shows its local and production health on one page, each with
  its own state.
- A source that is unreachable or blind says so without hiding the others.

## Part of

[indusk-demo](../indusk-demo/master.md), step 1.
