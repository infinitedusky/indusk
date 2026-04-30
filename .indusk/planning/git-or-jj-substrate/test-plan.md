---
title: "git-or-jj-substrate — Test Plan"
date: 2026-05-03
status: accepted
---

# git-or-jj-substrate — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean a user can run InDusk on a plain-git repo end-to-end without the system noticing or caring. Each assertion names the mechanism that will verify it. The assertions become the source rows for the impl's Test Trajectory.

Two perspectives are covered: **the new git user** (everything works without jj installed) and **the existing jj user** (nothing regresses).

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Running `indusk init` in a fresh git-only repo (no jj installed) completes successfully and writes `scm: "git"` to `.indusk/config.json`. | end-to-end script (spawn `indusk init` against a tmpdir git repo with `PATH` stripped of jj) |
| A2 | Running `indusk init` in a fresh jj repo completes successfully and writes `scm: "jj"` to `.indusk/config.json`. | end-to-end script (spawn `indusk init` against a tmpdir jj repo) |
| A3 | Running `indusk update` on an existing project whose `.indusk/config.json` is missing the `scm` field detects the SCM and adds the field; running it a second time is a no-op (idempotent). | end-to-end script |
| A4 | Running `indusk graph sync` on a git-mode project exits 0, prints a "git mode — semantic graph unavailable" message to stderr, and writes no events to `.indusk/graph/semantic-graph.log`. | end-to-end script |
| A5 | Running `indusk graph sync` on a jj-mode project produces the same event-log output it produces today (no regression on the jj path). | vitest integration (existing sync-engine tests stay green) |
| A6 | Running `indusk eval baseline --task <path>` on a git-mode project completes without error and produces a baseline scorecard entry. | end-to-end script |
| A7 | The evaluator prompt sent to Claude tells the agent to run `git show ${shortSha}` on a git-mode project, and `jj diff -r ${changeId}` on a jj-mode project. | vitest unit (snapshot `buildEvaluatorPrompt` output for both SCM values) |
| A8 | After a user runs `git commit -m "..."` inside a git-mode InDusk project, a scorecard entry appears in `.indusk/eval/results.log` within 60 seconds. | manual smoke against a real Claude Code session in a git-only fixture project |
| A9 | A new `git.md` skill ships alongside `jj.md`, describing the do-then-commit workflow with `git commit -m "..."` cadence; the existing `jj.md` skill is unchanged. | vitest unit (file presence + content markers — `git commit -m` appears, `jj describe` does not appear in `git.md`; `jj.md` byte-equal to its current content) |
| A10 | The work skill's per-item commit cadence guidance shows both forms — `jj describe`/`jj new` for jj-mode and `git commit -m` for git-mode — rather than hardcoding one SCM as the only path. | vitest unit (regex over installed `work.md` confirms both `jj describe` and `git commit` appear in the commit-cadence section) |

## Notes

- A1/A2/A3/A4/A6 share an end-to-end harness pattern: spawn `indusk` CLI as a subprocess against a tmpdir, with controlled `PATH` to make jj available or absent. Build one helper.
- A8 is the only manual-smoke row. We can't automate this in a unit test because the eval hook fires inside Claude Code's tool-execution path, not a CLI invocation. Equivalent automation would require driving Claude Code itself, which is out of scope. Manual smoke procedure: drop `.indusk/` into a fresh git-only fixture, open it in Claude Code, make a trivial code edit, `git commit -m "test"`, watch `.indusk/eval/results.log` for a new entry within 60s.
- A9's "byte-equal" check on `jj.md` is the load-bearing regression guard — guarantees we don't accidentally break the jj workflow while editing prose nearby.
- A7 covers prompt text symmetry. The actual content of `git show` vs `jj diff -r` is a syntactic difference, not a quality difference — Claude can read either format equally well.
- No `Untestable Assertions` section needed. The work has clean external boundaries (config file shape, CLI exit codes, prompt strings, skill file contents); everything reduces to a deterministic check.
