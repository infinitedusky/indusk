---
title: "Hook cwd independence — Test Plan"
date: 2026-09-15
status: accepted
---

# Hook cwd independence — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the
bug is fixed. Each names the mechanism by which it will be tested. The
assertions become the rows of the impl's Test Trajectory.

Every assertion crosses the process boundary the bug lives on: a hook command
as Claude Code would run it (through a shell, in some cwd, with the host's
environment variable set), or the built CLI writing a real settings file. A
test that imported the new constant and checked its string would prove the
string and nothing about whether a gate fires.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | On a project set up by `indusk init`, running a gate's registered command from a subdirectory of the project (the way Claude Code runs it, through a shell with `CLAUDE_PROJECT_DIR` set to the project root) refuses a checkoff that Gate B should refuse, with the same message the root gives. Today the same command from the subdirectory exits 1 with a module-not-found error and refuses nothing. | vitest, built CLI on a temp project; the command is read from the settings file init wrote and spawned via `sh -c` |
| A2 | After `indusk init`, every hook command in the project's settings file names the hook by the host's project-root variable, and none is relative to the current directory. | vitest, built CLI on a temp project |
| A3 | On a project whose settings file carries the six relative hook commands (a project initialized before this fix), `indusk update` leaves six absolute commands and changes nothing else in the file: every other key, matcher, and hook is byte-identical. | vitest, built CLI on a seeded temp project |
| A4 | A second `indusk update` changes the settings file by zero bytes, and a hook command a user customized (anything but the exact old relative form) survives both updates untouched. | vitest, built CLI, same fixture as A3 plus one custom command |
| A5 | The source that writes settings (`init.ts`, `update.ts`) and this repository's own `.claude/settings.json` contain no cwd-relative hook command. | vitest, source grep (the shape `hooks-record-parity.test.ts` uses) |

## Untestable Assertions

None. The whole defect is reachable from a test: the host's behavior this
depends on (commands run in the session cwd, `CLAUDE_PROJECT_DIR` set) is
documented, and the test reproduces it by spawning through a shell with the
variable set.

## Notes

- A1 uses `check-gates` and a Gate B refusal (a phase closing with a
  non-terminal trajectory row) because that is the observed failure. Gate A
  would do; one is enough to prove the load.
- A3's "changes nothing else" is asserted structurally: parse before and
  after, replace the six commands in the *before* with their expected
  absolute forms, and expect deep equality with the *after*. A byte
  comparison would fail on the formatter's whitespace, which is not the
  claim.
- A4's custom command is `node .claude/hooks/check-gates.js --strict` — the
  relative prefix with an argument — so the migration's exact-match rule is
  exercised at its edge rather than with an obviously foreign string.
- Tests that spawn the CLI skip when `dist/` is not built
  (`SHOULD_SKIP`), as every CLI-boundary test here does; the plan's worktree
  kickoff builds it.
