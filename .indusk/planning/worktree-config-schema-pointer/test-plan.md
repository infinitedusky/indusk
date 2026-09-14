---
title: "Worktree config schema pointer — Test Plan"
date: 2026-09-14
status: accepted
---

# Worktree config schema pointer — Test Plan

## Purpose

Four assertions, all observable from outside the package: what is on disk
after the extension is enabled, and what the shipped template says. A1 is the
bug; it is red today and the fix turns it green. The rest guard the two ways
the fix could be half-done.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | After enabling the worktree extension on a fresh workbench, the starter config's `$schema`, resolved relative to the config file, names a file that exists on disk | vitest integration — real `on_enable.sh` on a workbench fixture |
| A2 | The shipped schema beside the configs is byte-identical to the package's `config.schema.json`, and a second enable after the package copy changes refreshes it | vitest integration — same fixture, enable twice with a modified package copy between |
| A3 | A config that already exists before enabling is left byte-untouched while its sibling schema is still written | vitest integration — pre-seed a config, enable, compare |
| A4 | The shipped template no longer contains a pointer that climbs out of the configs folder | vitest unit — grep the template for `../` in `$schema` |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | VS Code offers key completion in a materialized config | Needs an editor; no headless check for editor behavior | One manual smoke at close, recorded in the impl's checkoff text |

## Notes

- A1 through A3 spawn the real hook rather than reproducing its copy logic in
  TypeScript; the bug lived in the hook's output, so the test reaches it over
  the process boundary.
- A4 is a grep guard against the template regressing to a relative climb; it
  also passes if someone deletes `$schema` entirely, which is acceptable
  (no pointer beats a wrong one) but A1 would then fail, so the pair holds.
