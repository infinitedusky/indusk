---
title: "Versioned Workbench — Test Plan"
date: 2026-07-23
revised: 2026-08-17
status: accepted
---

# Versioned Workbench — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the feature is working. Each assertion names the mechanism by which it will be tested — not the test code, but the test approach. When all assertions can be made true by an architecture, we have a feature; when all assertions are passing in code, the feature is shipped.

The assertions here become the source rows for the impl's `## Test Trajectory` table. Nearly all of them are testable with two local clones of a `file://` bare remote — no network or second machine required until the final manual smoke.

## Revision — 2026-08-16 (post indusk-makeover, pre-ADR)

The brief's `Depends On` required revisiting this document once `indusk-makeover` landed. It has (impl completed, awaiting retrospective), and it removed Graphiti + CodeGraphContext entirely. Two consequences:

- **A7 is withdrawn, not renumbered.** The semantic-graph rebuild assertion has no subject: nothing reads or writes `.indusk/graph/semantic-graph.log` post-makeover. The brief predicted this drop by ID, so the ID stays visible as withdrawn rather than being recycled onto an unrelated assertion.
- **`semantic-graph.log` leaves the union-merge set in A5.** The remaining append-shaped coordination files are `current.md` sections and `highlights.jsonl`.

Second revision driver: the brief's In Scope gained the workbench manifest + bootstrap bullet (2026-07-24, from the avoca POC) but no assertion ever covered it. A10–A15 close that gap. They are the assertions the ADR's central multi-repo decision has to satisfy.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A second developer who clones the workbench repo sees the first developer's full planning history, lessons, and `current.md` session sections. | vitest integration (two clones of a bare `file://` remote) |
| A2 | A change made in one workbench appears in another workbench after its next sync point, with no manual git commands run by either developer. | vitest integration |
| A3 | Any edit to a workbench file is committed automatically, with a timestamp-style message, without prompting the developer for anything. | vitest integration (mutate file, observe commit appear) |
| A4 | Two workbenches editing concurrently both get their changes to the remote — neither ever sees a conflict prompt, a blocked command, or an error demanding manual resolution. | vitest integration (interleaved push races) |
| A5 | When two machines append to the same coordination file (`current.md` sections, `highlights.jsonl`), both machines' entries survive in the merged file. | vitest integration |
| A6 | With the remote unreachable, edits still commit locally and agent work is never blocked; after the remote comes back, the pending changes arrive there without user action. | vitest integration (remove/restore the bare remote path) |
| ~~A7~~ | ~~On a fresh clone, rebuilding the semantic graph reconstructs the original workbench's anchors from the pulled event log.~~ **Withdrawn 2026-08-16** — indusk-makeover removed Graphiti/CGC; the assertion has no subject. | — |
| A8 | The trunk symlinks, worktree directories, doppler service token, and per-app env pulls never appear in the shared remote. | vitest integration (remote tree listing + check-ignore) |
| A9 | A second developer following the onboarding steps ends up with a working workbench on their machine. | manual smoke (Sandy, second checkout location) |
| A10 | A developer who has cloned only the workbench repo runs one documented command and ends up with every declared repo cloned beside the workbench and linked into it — without cloning or linking anything by hand. | vitest integration (bare `file://` remotes standing in for the declared repos) |
| A11 | Running that same command again on an already-materialized workbench reports every repo as already present and changes nothing on disk. | vitest integration (re-run, diff the tree) |
| A12 | When one declared repo cannot be cloned, the developer is told which repo failed and what to fix, the other declared repos are still materialized, and re-running after the fix completes the workbench. | vitest integration (one unreachable remote among several) |
| A13 | A workbench declaring two repos presents both as trunks, each with its own worktrees listed under it — no repo's worktrees are attributed to the other. | vitest integration + manual smoke (avoca-next-workbench) |
| A14 | In a workbench declaring two repos, creating a worktree makes it in the repo the developer named; naming no repo when the choice is ambiguous fails with a message listing the declared repos rather than picking one. | vitest integration |
| A15 | After materializing a fresh workbench, the developer is shown the complete list of files they must still supply out-of-band, and no file on that list is present in the shared remote. | vitest integration (cross-check the printed list against `git ls-tree` of the remote) |
| A16 | A developer who pulls a plan phase marked complete, whose code has not reached them, can tell that the code is missing rather than reading the phase as delivered. | vitest integration (two clones; push plan docs only, withhold the code repo's commits) |
| A17 | In a workbench where the plan documents and the code live in different repos, verification never reports checked-off work as phantom on the strength of a diff that could not have contained the code — it either checks the repo holding the code, or refuses and says which repo it could not identify. | vitest integration (workbench fixture with a real second repo; assert the refusal path, not only the pass path) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | A developer on a machine with no prior SSH host-alias configuration can complete onboarding. | SSH host aliases (e.g. `github-avoca`) are machine config outside any repo; a test that provisioned them would be testing the fixture, not the product. | A15 forces the alias requirement into the printed out-of-band list, so the gap is announced at the moment it bites rather than discovered by a failed clone. |

## Notes

- A4 deliberately covers both the push-reject retry loop and blind content resolution — the observable contract is "nobody is ever asked to resolve anything," regardless of which mechanism handled it.
- A5 is the union-merge falsification surface flagged in the brief: the dedup was built for rebase noise, not multi-writer logs, so this is where concurrent-append behavior gets proven rather than assumed.
- The brief's accepted risk (blind merge silently reverting a checkbox) intentionally has no assertion — it's recorded as acceptable, and belongs to the falsification ritual, not the success contract.
- "Within seconds" latency is not pinned to a number in A2; the assertion is about zero manual steps, with latency observed qualitatively in A9's smoke.
- A12 is the assertion that forbids a partial restore from reporting success. The failure this codebase keeps re-learning is a checker that cannot distinguish "could not do the job" from "job done" — a restore that clones 1 of 2 repos and exits 0 is that failure wearing new clothes.
- A13 and A14 exist because the singular is currently load-bearing in 10 non-test files (80 occurrences), 35 of them in shell scripts with no type checker. Both assertions are observable at the CLI, so they hold regardless of how the singular gets widened.
- A17 is a **refusal** assertion by design. Phantom detection currently cannot run in a workbench at all — `assertGitRepo` refuses because the root is not a git repo — and this plan makes the root a git repo, which removes that refusal by accident rather than by decision. An acceptance-shaped test ("verify reports correctly on a healthy workbench") cannot detect a detector that has quietly stopped checking; only asserting the refusal can. Same reasoning as the standing lesson that every rule needs a test asserting a refusal.
- A16 keeps the two-clock skew observable without committing to a design for it. The assertion is that the developer can *tell*, not that any particular banner, badge, or ref-check exists — the ADR records the skew as accepted, so the bar is visibility, not prevention.
- A10–A12 are authorable against `scripts/bootstrap.sh` in the avoca POC today — the behavior exists, it just isn't in the product. That makes them Phase 0 rows in the impl's trajectory, not deferred ones.
