---
title: "telemetry stop stops what it started — Test Plan"
date: 2026-10-07
status: accepted
---

# telemetry stop stops what it started — Test Plan

## Purpose

What must be true for `indusk telemetry stop` to stop its own daemon and say so honestly. Grouped by the promise each proves.

## Behavioral Assertions

### `telemetry-stop-stops-what-it-started` — `indusk telemetry stop` stops the Jaeger and otelcol it started, even when their ports are slow to answer; it never signals a process that is not its own, and never reports them stopped while they still run.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | A recorded process that is alive and running this daemon's own binary with this daemon's own config is stopped, whether or not its port answers. | unit |
| A2 | A recorded process ID now held by some other program is left alone, and its record is still cleared. | unit |
| A3 | When a process of its own is still running after the stop, stop says so and keeps the record, rather than reporting it stopped. | unit |
| A4 | A real daemon started and then stopped leaves no Jaeger or otelcol running from its home. | contract |
