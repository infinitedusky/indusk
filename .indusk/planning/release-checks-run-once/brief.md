---
title: "Release checks run once"
date: 2026-10-05
status: draft
workflow: feature
---

# Release checks run once — Brief

*Opened at planner-promises' landing (Sandy, 2026-10-05): "it's very, very
frustrating that we're running these massively long tests more than once."
The retrospective's landing step ran `pnpm test:system` (about six minutes),
and `pnpm release` runs it again minutes later on the same tree. The same
step names dusk's own commands (`pnpm test:system`, `pnpm release`,
`release-guard.sh`, `apps/docs/src/changelog.md`) in a skill every InDusk
project installs. A draft from that conversation, to be reworked in the
planner's conversation before it is accepted; nothing is declared.*

## Expectations

1. **Closing a plan no longer waits on the slow tier.**
   - Measure: wall time from the retrospective's landing step starting to the
     merge, for the next three plans that land, against planner-promises'
     (about eight minutes, two suites).
   - Look: when the third lands.
2. **A project that does not publish a package gets landing and release steps
   that apply to it.**
   - Measure: the next non-dusk project that closes a plan follows Steps 10
     and 11 without editing or skipping an instruction.
   - Look: at that project's first close.

## Promises

### This plan makes

1. **`slow-checks-run-once-per-tree`** (state). The slow test tier runs at
   most once for a given commit: release skips it when a green run already
   covered that exact commit, and runs it when `main` has moved since.
2. **`landing-and-release-name-the-projects-commands`** (structure). The
   landing and release steps name the commands a project declares in its
   config, never dusk's own paths.

### Existing promises

**Must not break**

- **`everyday-suite-stays-fast`**. Landing keeps running `pnpm test`; only the
  slow tier moves.
- **`everyday-tests-never-wait`**. Nothing slow moves into the everyday suite.

**Changes**

None.

**Replaces**

None.

### Not promised

- Removing the release-time run. Plans pile into one version, so release is
  the only point that tests what ships; the run is skipped only when it would
  repeat one already made on the same commit.
- CI. Running the tiers on a server is a different plan.

## Depends On

- planner-promises (closed 2026-10-05): the brief shape this draft is written
  in, and the landing step it changes.

## Blocks

- None.
