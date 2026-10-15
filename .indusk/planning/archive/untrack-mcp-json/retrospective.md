---
title: "Untrack .mcp.json — retrospective"
date: 2026-10-11
---

# Retrospective — untrack-mcp-json

## What We Set Out to Do

Stop versioning `.mcp.json` (this repository tracked a file its own ignore rule lists, and the telemetry daemon rewrote its jaeger port on every start: 26 commits touched it), and make sure a checkout without one gets one from a command.

## What Actually Happened

- **Build Phase 1:** `.mcp.json` untracked (`git rm --cached`); new `lib/mcp-config.ts` holds `ensureMcpJson` (create-if-missing, never rewrites) and the jaeger file helpers moved out of `telemetry.ts`; `indusk update` calls it before the migrations run.
- **Build Phase 2 (falsification):** a file the daemon's sync creates now names the `indusk` server too (T7), and `createPlanWorktree` gives a new plan worktree a copy of the trunk's file (T8) — git used to carry it, and the default workflow gives every plan its own worktree.
- **Cleanup** skipped with reasons; **audit** written by a cold reader.
- Diff: 11 code and doc files, about +306 / −80, plus plan documents.

## Getting to Done

- **The second promise was not true when it was approved.** I measured it only after approval: `indusk update` creates no `.mcp.json` (its MCP handling is guarded by the file existing), `init` creates one holding only `indusk`, and no built-in extension declares an `add_command` for `update` to run. The promise was narrowed (Sandy, "narrow it") from "the project's declared servers" to "names the `indusk` server", and T4 was retired.
- **A probe leaked two real telemetry daemons.** `indusk update` in a temp project with a real `INDUSK_HOME` enabled `local-telemetry` (required-by-default), which started a Jaeger; deleting the temp dir orphaned it. Killed by PID; tests now pin `INDUSK_SKIP_TELEMETRY_AUTOSTART=1`.
- The spike-first approach to the earlier `instance-ports` question found the file was tracked against its own ignore rule: the "port delegation" problem was largely a tracking problem.

## What We Learned

- **Measure the promise's premise before approving it.** "One command writes the keep-list" was believed because the pieces existed (`init`, extension registration); none of them did what the sentence needed in a clone.
- **Taking a file out of git moves its provisioning onto every other path that makes a checkout.** A tracked file reaches worktrees, clones and CI for free; untracking it needs each of those paths named (here: `update`, the daemon's sync, `createPlanWorktree`).
- **A command that "just updates" can have side effects.** `update` enables required extensions and starts a daemon; a test or a probe that runs it must pin the autostart off.

## What We'd Do Differently

- Run `update` and `init` against a bare clone before drafting the promise, as the first step of the plan, not after approval.

## Audit findings left open (advisory)

- **"Never overwrites a `.mcp.json` that exists" is wider than the code.** `update`'s step 5b rewrites an existing file to remove retired graphiti/cgc entries and to migrate `npx` to `npx --yes` (behaviour that predates this plan). What holds is that the *creation* step never touches an existing file. T5 only exercises a hand-added server those branches do not touch. The sentence should be narrowed to the creation step, or T5 extended; left as written pending the person's call.
- T3 checks the `indusk` key in a temp repo, not a real clone; T6 calls `upsertJaegerEntry`, not the daemon's per-project loop; `removeJaegerEntry` and the "created" line have no row.
- Workbench code worktrees (`startWorkbenchPlan`) do not go through `createPlanWorktree` and get no `.mcp.json`; in a workbench Claude Code runs at the root, where `update` writes one.
- A fresh clone gets `indusk` only: `jaeger` arrives at the next daemon sync or when `local-telemetry` is enabled, and posthog needs its token set up by hand.
- After pulling the commit that untracks the file, git deletes it from a clone's working tree once; `indusk update` writes a fresh one. The changelog says so.

## Shape numbers

Shape raised 1 finding across all phases (Build Phase 1: the inline create-if-missing block in `update` wanted a name, fixed in place); 0 judged wrong by a human.

## Release

Nothing published; this project installs its own build at landing.
Landed on main at 1962bb2a, 2026-10-12.
