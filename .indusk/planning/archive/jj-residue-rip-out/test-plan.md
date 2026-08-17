---
title: "jj Residue Rip-Out — Test Plan"
date: 2026-08-13
status: accepted
---

# jj Residue Rip-Out — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean the jj rip-out is actually finished — as opposed to believed finished, which is the state the project has been in since 2026-06-27.

The central assertion is A1, and its value is entirely in its **red window**. An audit that has never been observed failing is indistinguishable from the one this plan exists to replace. A1 must be authored against the current tree, seen to fail, and named the specific violations before any removal lands.

The assertions here become the source rows for the impl's `## Test Trajectory` table.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | A repo-wide audit of live source across both `indusk-mcp` and `indusk-admin` reports no code that executes jj and no configuration field offering jj as an option. | vitest unit (static audit over the source tree) |
| A2 | The same audit reports no violation against the preserved historical record — the planning archive, the superseded git-or-jj decision and lesson pages, the SCM guide page, and the three bundled community lessons that use jj as their worked example. | vitest unit (same audit, fixture paths) |
| A3 | With no `jj` executable on PATH, the admin scorecards page still displays a commit message for every scorecard that has one. | vitest integration (PATH stripped of jj) |
| A4 | The commit message displayed for a scorecard matches that commit's actual git message. | vitest integration (temp git repo) |
| A5 | No text rendered anywhere in the admin UI instructs the reader to run a jj command. | vitest unit (audit over admin component copy) |
| A6 | A project whose `.indusk/config.json` still contains `scm: "jj"` runs `indusk update` to completion with no error and no jj-related nudge printed. | vitest subprocess integration |

### Which assertions drive the work, and which guard it

This split matters for the trajectory, because three of these six pass the moment they are written and cannot show a red state.

**Drivers — red today, green only after removal:**

- **A1** — fails today on `apps/indusk-admin/src/lib/vcs.ts` (argv-level `jj` execution) and on the `scm?: "jj" | "git"` field.
- **A5** — fails today on `Scorecards.tsx` (3 strings) and `scorecards/page.tsx`.
- **A6** — fails today because `indusk update` prints the nudge by design.

**Guards — pass today, must keep passing:**

- **A3** and **A4** already pass, because the current `vcs.ts` falls back to git when jj is missing or the id is unknown. They do not force the removal; they prove the removal did not break the feature that the jj branch was nominally serving. This is exactly the shape a regression guard should have, and it will be declared as one rather than dressed up as a red test.
- **A2** passes trivially today, because the current audit does not scan those paths at all. Its job begins the moment A1's audit is widened: it pins the boundary so a future widening cannot start flagging the decision record. An audit that fires on the archive would be disabled within a week.

## Untestable Assertions

None. Every assertion in this plan is mechanically checkable — which is itself the point, given that the failure being corrected was a check that could not fail.

## Notes

- **A1's audit must match at the argv level, not by symbol name.** The predecessor's five patterns (`getScm`, `lib/scm/detect`, `semantic-graph/jj`, `NotAJjRepoError`, `getJjReachable`) are all TypeScript identifiers, and the surviving violation was a string in an `execFileSync` argument list. Symbol-name matching is what made the old audit blind; repeating it would reproduce the bug.
- **A1 and A2 are in tension by construction** — widen far enough to catch argv-level jj, but not so far that the ~60 archived planning files and two superseded doc pages start failing. Author them together, or A2 will be written to fit whatever A1 happens to do.
- **Removing `scm?` from the config type is compile-time only.** Verified 2026-08-13: `.indusk/config.json` is read via plain `JSON.parse` into a TypeScript `interface` — there is no zod schema and no runtime validation, so an old config carrying `scm: "jj"` parses fine and the field is simply ignored. A6 pins that behavior rather than assuming it.
- A3's mechanism needs jj genuinely absent from PATH, not merely a mocked failure — a mock would pass against code that still tries jj first, which is the condition being removed.
- **Consumer-shipped surfaces were audited on 2026-08-13 and are clean**: `apps/indusk-mcp/skills/`, `hooks/`, `extensions/`, and `templates/` contain zero jj references. The predecessor plan's B6 assertion covered the skills and held.
- **The three bundled community lessons under `apps/indusk-mcp/lessons/community/` are a deliberate keep.** They ship to every consumer via `indusk sync pull`, and each uses jj as its worked example: `graceful-degrade-architecture-trap` is *about* the git-or-jj → git-only arc, `brief-author-bias-ground-truth-verification` uses a false jj claim as its evidence, and `anchor-shell-trigger-patterns-no-substring` quotes `["jj describe", "git commit"]` as the bug it teaches against. Removing jj from them would leave three lessons that assert something happened without saying what. A2 must exempt this directory explicitly, or the widened audit fires on three shipped files and gets switched off — the same end state as the audit this plan is replacing.
