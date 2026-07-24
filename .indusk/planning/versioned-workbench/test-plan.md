---
title: "Versioned Workbench — Test Plan"
date: 2026-07-23
status: draft
---

# Versioned Workbench — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names the mechanism by which it will be tested — not the test code, but the test approach. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. Nearly all of them are testable with two local clones of a `file://` bare remote — no network or second machine required until the final manual smoke.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A second developer who clones the workbench repo sees the first developer's full planning history, lessons, and `current.md` session sections. | vitest integration (two clones of a bare `file://` remote) |
| A2 | A change made in one workbench appears in another workbench after its next sync point, with no manual git commands run by either developer. | vitest integration |
| A3 | Any edit to a workbench file is committed automatically, with a timestamp-style message, without prompting the developer for anything. | vitest integration (mutate file, observe commit appear) |
| A4 | Two workbenches editing concurrently both get their changes to the remote — neither ever sees a conflict prompt, a blocked command, or an error demanding manual resolution. | vitest integration (interleaved push races) |
| A5 | When two machines append to the same coordination file (`current.md` sections, `semantic-graph.log`, `highlights.jsonl`), both machines' entries survive in the merged file. | vitest integration |
| A6 | With the remote unreachable, edits still commit locally and agent work is never blocked; after the remote comes back, the pending changes arrive there without user action. | vitest integration (remove/restore the bare remote path) |
| A7 | On a fresh clone, rebuilding the semantic graph reconstructs the original workbench's anchors from the pulled event log. | manual smoke (needs indusk-infra FalkorDB) |
| A8 | The trunk symlink, worktree directories, doppler service token, and per-app env pulls never appear in the shared remote. | vitest integration (remote tree listing + check-ignore) |
| A9 | A second developer following the onboarding steps (clone workbench repo, clone wrapped repo, link trunk) ends up with a working workbench on their machine. | manual smoke (Sandy, second checkout location) |

## Untestable Assertions

(none — every assertion above is exercisable with local clones or a one-time manual smoke)

## Notes

- A4 deliberately covers both the push-reject retry loop and blind content resolution — the observable contract is "nobody is ever asked to resolve anything," regardless of which mechanism handled it.
- A5 is the union-merge falsification surface flagged in the brief: the dedup was built for rebase noise, not multi-writer logs, so this is where concurrent-append behavior gets proven rather than assumed.
- The brief's accepted risk (blind merge silently reverting a checkbox) intentionally has no assertion — it's recorded as acceptable, and belongs to the falsification ritual, not the success contract.
- "Within seconds" latency is not pinned to a number in A2; the assertion is about zero manual steps, with latency observed qualitatively in A9's smoke.
