---
title: "The watcher proves it is watching — Test Plan"
date: 2026-10-03
status: draft
---

# The watcher proves it is watching — Test Plan

## Purpose

What must be true for "nothing broke" to mean the watcher was listening. Each
assertion names how it is tested; the impl's Test Trajectory rows come from
this table. Everything that reads Jaeger is tested against a real one — the
local daemon through `helpers/local-jaeger.ts`, the server through
`helpers/always-on-server.ts`, Slack through `helpers/slack-capture.ts` — never
a stub of the thing whose silence is the subject.

## Behavioral Assertions

| ID | Assertion (what a person reading promise health sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | With the local daemon running and listening, `promises status` and `promise_health` read promises exactly as today — a probe that comes back changes nothing a person sees | vitest integration (system tier): real local Jaeger, a project with a marked promise |
| A2 | When the Jaeger a project reads answers its queries but never returns what is sent to it — a Jaeger that is not this project's — `promises status`, `promise_health` and the admin's Promises page say **watcher blind**, naming where they looked, and show no promise counts: not "0 violations", not green | vitest integration (system tier): a query port that answers like Jaeger and stores nothing (`startFakeQueryPort`), the CLI, the MCP tool, and the admin over HTTP |
| A3 | With the daemon stopped, every reader says the watcher cannot be reached — as today — and never a count | vitest integration (system tier), the same three readers |
| A4 | Reading promise health repeatedly within half a minute sends one probe, not one per read: the admin page refreshing every five seconds does not fill Jaeger with probes | vitest integration (system tier): count probe spans in Jaeger after a burst of reads |
| A5 | `/catchup` reports "watcher blind" on its own line, ahead of the roadmap, when `promise_health` says so — and never reports promise counts in that state | vitest unit over the skill text (package and installed copies, the existing skill-pin pattern) |
| A6 | The always-on server records a heartbeat on every pass: its own Jaeger holds a heartbeat span no older than one pass interval | vitest integration (system tier): the real server binary, a short pass interval |
| A7 | When the server's heartbeat goes stale — its intake stops receiving — Slack gets **one** "watcher blind since <time>" message, not one per pass; when heartbeats resume, **one** "watcher recovered" message | vitest integration (system tier): the real server, the intake blocked and restored, Slack captured |
| A8 | A promise declared with "expect an event at least every X" needs attention when no mark of it has arrived for longer than X while the watcher is listening; a promise without it, silent for as long, does not | vitest integration (system tier): two promises, one with the expectation, no marks, a listening Jaeger |

## Notes

- **A2 is the founding case.** On 2026-10-01 a test's leaked Jaeger answered on
  the default ports and every reader reported a healthy backend with seven
  silent days. Its mechanism must be a Jaeger that *answers*, not one that is
  down — down is A3, and has been handled since day-monitor.
- **A4 pins the cost of probing.** The window is "about half a minute"; the
  impl names the number and the row holds it.
- **A7 must not depend on the path it reports broken.** The server posts to
  Slack, which does not travel OTLP or Jaeger; the test blocks the intake and
  expects the message anyway.
- **A8's expectation is a registry field.** Its name and grammar are the ADR's
  to settle; the assertion is about what a person sees.
