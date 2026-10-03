---
title: "watch opens an incident and silently does not reopen its owner — Test Plan"
date: 2026-10-02
status: accepted
---

# watch reopen collision — Test Plan

## Purpose

What must be true for a broken promise to always reach a plan that owns it, or
to say loudly that it did not. Each assertion names how it is tested. The
impl's Test Trajectory rows come from this table.

Every assertion is observed the way a person meets it: run
`indusk promises watch` against a project whose promise has been broken, and
read what it prints, what it exits with, and what it wrote into the owner's
`impl.md`. The violations come from a real local Jaeger, as the existing watch
tests do — a stubbed source would test the stub.

## Behavioral Assertions

| ID | Assertion (what a person running `watch` sees) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | After an incident file is deleted while its Maintenance phase stays in the owner's impl, the next violation of that promise on the same day opens an incident with a new id (`…-2`), and the owner gains a new Maintenance phase for it — the numero case | vitest integration: CLI against a promise fixture and a real local Jaeger (system tier) |
| A2 | A violation while an incident is already open extends that incident: no second Maintenance phase, no error line, exit 0 — today's behaviour, kept | vitest integration, same fixture (system tier) |
| A3 | When a new incident's Maintenance heading already exists in the owner's impl (written by hand, or carried over any other way), `watch` still records the incident, prints an error naming the owner and the heading, and exits non-zero | vitest integration, same fixture (system tier) |
| A4 | Any run in which a newly opened incident did not reopen its owner — a collision, an owner that is not a plan folder, or an unreadable worktree record — exits non-zero, so a script or a person checking the exit code cannot read it as success | vitest integration, same fixture (system tier) |

## Notes

- **A4 widens the brief by one line.** The brief named the collision; reading
  the CLI found its two other "did not reopen" outcomes (`no-owner`,
  `copy-problem`) also print an error and then exit 0. Same failure, same
  fix — one exit-code rule for every reopen that did not happen. Drop A4 if
  the exit code should stay as it is for those two.
- **A3's mechanism, corrected while writing the impl (2026-10-02).** Once the
  allocator skips every id the owner's impl already names, `watch` can no
  longer produce a collision — the numero case becomes A1. So A3 is tested
  where a collision is decided and where it is reported: the reopen, handed an
  opened incident whose heading exists, refuses with a collision and writes
  nothing; and the report of a watch result carrying one prints the error
  naming owner and heading and gives a non-zero exit. vitest unit, everyday
  suite. The assertion itself is unchanged.
- A1, A2 and A4 need the telemetry daemon, so they run in `pnpm test:system`,
  beside `monitor-watch.test.ts`, not in the everyday suite.
- A1 and A3 are reproducible against today's code, so both are written red in
  Test Phase 1; A2 is a regression guard that passes the moment it is written.
