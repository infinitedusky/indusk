---
title: "Clean release build — only today's source ships, and no command is built from a string"
date: 2026-10-09
status: draft
workflow: bugfix
---

# Clean release build — Brief

## Expectations

1. **The researcher's advisory closes with the range we state, and their next scan of the package finds nothing.**
   - Measure: the advisory published as ≤ 1.33.0, fixed in 1.33.1; the researcher's reply after reviewing this release.
   - Look: when the advisory is published, and on the researcher's review.

## Promises

### This plan makes

1. **`a-release-ships-only-its-own-source`** (structure). Every compiled file in a published package comes from a source file in the repository at release time; a build starts from an empty output folder and leaves the `indusk` command runnable.

2. **`commands-take-values-as-arguments`** (state). Every command InDusk runs with a value from a person, a manifest or the network receives that value as one argument, never inside a shell string, so a value with quotes, semicolons or `$(…)` arrives as text.

### Existing promises

**Must not break**

- **`dusk-installs-its-own-build`**. A clean build must leave the linked `indusk` executable; emptying `dist/` once already broke it.

**Changes**

None.

**Replaces**

None.

### Not promised

- Publishing the GitHub Security Advisory and deprecating 1.33.0 and earlier on npm — Sandy's, outside the code.
- The commands a project's own config defines (the worktree setup command): they are commands, run as written.
- Crediting the researcher — a changelog line in this plan's release, not a promise.

## Depends On

- None.

## Blocks

- The release that credits Timur Juraev (casablanka).
