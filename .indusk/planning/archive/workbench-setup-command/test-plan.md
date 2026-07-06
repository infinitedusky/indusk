---
title: "Workbench Setup Command — `indusk setup` — Test Plan"
date: 2026-06-30
status: accepted
---

# Workbench Setup Command — `indusk setup` — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean `indusk setup <cloned-repo-path>` is working. Each assertion names the mechanism by which it will be tested — not the test code, but the test approach. These become the source rows for the impl's `## Test Trajectory` table.

The defining constraint, settled in the brief: `setup` is **sugar over the existing `init --workbench` machinery**, defaulting to a **non-destructive symlink-in-place** topology, **zero flags**, and **erroring on collision**. The assertions below pin both the new happy path and the guarantees that make it safe (repo untouched, dirty trees allowed, no regression to `init --workbench`).

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk setup <path>` on a freshly-cloned repo — with no other files or flags — produces a workbench at `<path>-workbench`, and `indusk worktree list` run there reports the config valid and the trunk resolving. | vitest integration (spawn CLI against a `git init`'d tmp repo) |
| A2 | After `setup`, the wrapped repo still exists at its original path with all its files intact — nothing is moved. | vitest integration |
| A3 | After `setup`, the user can create a worktree (`indusk worktree create <slug>`) and it appears as a working sibling directory inside the workbench. | vitest integration |
| A4 | Running `setup` against a path that is not a git repository (or does not exist) fails with a clear, actionable error message and leaves no half-made workbench dir behind. | vitest integration |
| A5 | Running `setup` when `<repo>-workbench` already exists fails with a clear message pointing at `indusk update`, and the existing workbench's contents are left untouched. | vitest integration |
| A6 | A repo with uncommitted changes and untracked files can be set up successfully — a dirty working tree does not block `setup`. | vitest integration |
| A7 | Setting up a workbench via the existing `indusk init --workbench --wrapped-repo X --sibling-parent Y` command still produces a working workbench, identical to before the refactor. | vitest integration (regression) |

## Notes

- All assertions are testable against ephemeral `git init` tmp repos using the established pattern (`INDUSK_HOME=<tmpdir>` redirect, tmp project dirs) — no external services, no paid integrations, nothing deferred. There is no Untestable Assertions section.
- A1 and A3 are deliberately separate: A1 asserts setup *succeeds and reports valid*, A3 asserts the workbench is *actually functional* (a worktree can be created and used). Config-valid is necessary but not sufficient.
- A2 + A6 together pin the symlink-in-place guarantee: the repo is neither moved (A2) nor required to be clean (A6). A6 mirrors the real ursa dogfood, where the repo was dirty at setup time.
- A7 is the guardrail for the init.ts refactor — extracting the shared workbench-init function must not change `init --workbench`'s observable behavior. It belongs in the trajectory at `Writable at: Phase 0` (the command works today; the test pins current behavior before the refactor lands).
- A5's "untouched" clause may be tested by writing a sentinel file into the pre-existing workbench and asserting it survives the rejected `setup`.
