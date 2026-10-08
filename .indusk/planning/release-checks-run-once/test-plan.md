---
title: "Release checks run once — Test Plan"
date: 2026-10-08
status: draft
---

# Release checks run once — Test Plan

## Purpose

The behavioural assertions that, together, mean the slow tests run once per piece of code and that the landing and release steps fit any project. Each names the smallest level that proves it. They become the impl's Test Trajectory rows.

## Behavioral Assertions

### `slow-checks-run-once-per-tree` — the slow test tier runs at most once for the same code

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | After a fully green slow run at landing, releasing the same code (with only the version bump and changelog entry on top) skips the slow tests and says which run covered them | unit |
| A2 | Releasing after any file that ships, or any test or test configuration, changed since the green run runs the slow tests | unit |
| A3 | A slow run that was not fully green (a test failed, one package's tier failed, or the leaked-daemon guard failed) covers nothing: the next release runs the tests | unit |
| A4 | A slow run over a tree with uncommitted changes to what it tests covers nothing; and release with such changes runs the tests | unit |
| A5 | A green run recorded in a plan's worktree is found by the release on `main`, the same project home from both | unit |
| A6 | The release command, run for real on this repository after a green landing run on the same code, publishes without running the slow tests again, and the record names the run it trusted | live check |

### `landing-and-release-name-the-projects-commands` — the steps name the project's own commands

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A7 | The landing and release steps every project installs name none of dusk's own commands or paths (`pnpm test:system`, `pnpm release`, `release-guard.sh`, `PACKAGED_PATHS`, `apps/docs/src/changelog.md`, `apps/indusk-mcp/…`) | unit |
| A8 | A project that declares its slow tests, its release command, its version file and its changelog gets those named back when it asks what landing and release will run | unit |
| A9 | A project that declares none is told plainly that landing runs no slow tier and release has nothing to publish, rather than given commands it does not have | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A10 | Landing still refuses a plan that has not been accepted, and still runs the everyday suite | unit | regression guard over `nothing-ships-until-accepted` and `everyday-suite-stays-fast`: the landing step changes |

## Notes

- A6 is the only one that needs the real publish; it is recorded when this plan's own release runs.
- Which paths count as "what ships and tests it" for dusk, and how another project declares its own, is the ADR's question; A2 and A5 hold whatever it decides.
