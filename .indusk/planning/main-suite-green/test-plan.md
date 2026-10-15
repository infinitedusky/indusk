---
title: "main-suite-green — Test Plan"
date: 2026-10-14
status: accepted
---

# main-suite-green — Test Plan

## Purpose

The assertions that, together, mean main's everyday suite passes and a large impl gets one contract answer. Most rows are the failing tests themselves, brought up to the behaviour they guard; each file carries the promise it now proves.

## Behavioral Assertions

### `a-large-impl-gets-the-same-contract-answer` — The contract check gives the same answer for an impl of any size every time it runs, so a large impl is never refused at random when it is written.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A1 | An impl of 200 KB handed to the contract check on stdin, written in two parts with a pause between, gets the same answer on each of five runs, and the answer is the one the check gives for that impl read from its file. | unit |

### `the-everyday-suite-passes-on-main` — pnpm test, run from the root of a clean main with every package at once, passes.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A2 | Every impl in the planning corpus that validated before still validates; the two archived impls that cite rows they do not have are the only additions to the known failures. | unit |
| A3 | The Jaeger URL is normalized in one place; a file path's trailing-slash trim elsewhere is not counted as a second. | unit |
| A4 | Creating, assigning, reading and releasing a plan worktree leaves git status clean in every checkout, with the worktree's `.mcp.json` written. | unit |
| A5 | The registry scan names a test that spawns the CLI directly without `INDUSK_HOME`, and does not name one that goes through the test helper that sets it. | unit |
| A6 | A break recorded for a new incident adds one inbox entry, whatever today's date; an incident over a day old still gets its reminder. | unit |
| A7 | Accepting a new project ends its conversation's agent and streams each step, in a run where every package's tests run at once. | unit |

### `a-component-has-one-implementation` — (as it will read) Each component the mockups of a landed plan name is implemented once in the app, and every screen renders that one implementation rather than its own copy.

| ID | Assertion (user-visible behavior) | Level |
|----|-----------------------------------|-------|
| A8 | A component named only by the approved mockups of a plan that has not landed is not reported as unimplemented; one named by a landed plan's mockups and missing from the app is. | unit |

### Not for a promise

| ID | Assertion (user-visible behavior) | Level | Why |
|----|-----------------------------------|-------|-----|
| A9 | `pnpm test` from the root of the plan's branch, merged with main, passes. | live check | the live proof of `the-everyday-suite-passes-on-main`; rows A2–A8 name its files |

## Notes

- A7's cause is not yet known (load, a shared port or lock, or a fixed timeout); the build phase diagnoses it before fixing.
- A6 is `lesson: code-that-decides-takes-its-clock-and-its-reads`.
