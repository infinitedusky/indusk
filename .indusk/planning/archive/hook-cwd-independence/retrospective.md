---
title: "Hook cwd independence — Retrospective"
date: 2026-09-17
status: complete
---

# Hook cwd independence — Retrospective

Written 2026-09-17, two days after the impl completed (2026-09-15). The plan
landed on `main` directly and was never archived; the trunk-guard close-out
found it in the active list with every ritual satisfied and no retrospective.

## What We Set Out to Do

A half-day bugfix with a large blast radius. Every InDusk gate is a Claude Code
hook registered as `node .claude/hooks/<name>.js`, a path relative to the
directory Claude Code runs hooks in — the session's *current* directory, which
moves with every Bash call that ends in a `cd`. From `apps/indusk-mcp` the file
does not exist, node exits 1, and to Claude Code an exit other than 2 is a
non-blocking error the model never sees. The gate is off and nothing says so.

This was observed, not inferred: `workbench-trust-fixes`' retrospective found
two trajectory rows still `written` after eight phase closes that Gate B of
`check-gates` exists to refuse, and the transcript put each unrefused checkoff
minutes after a `cd` into the package. Sandy cut the brief on 2026-09-15 from
four things to the one that was the bug; the other three (row terminality at
close, a gate ledger, a test-helper migration) went to the plans that own them.

## What Actually Happened

Everything the cut brief named shipped: one test phase, one build phase, one
falsification phase. Seven trajectory rows, all passing. Twelve commits, ten
files, +257/−25.

**One definition, and a migration.** `hookCommand(name)` in
`lib/hook-command.ts` is the registered form; `init` and `update` both import
it, this repository's settings carry it, and `absolutizeHookCommands` rewrites
a command *exactly equal* to the old relative form on `update` — a command with
arguments or another path is someone's deliberate edit and is never touched.
The rewrite keeps the file's indentation, so "changes nothing else" held
byte-for-byte on a two-space file from `init` and a tab-indented one from the
migration module.

**The live proof needed a real session.** Claude Code snapshots hook
registrations at session start, so the session that made the change still ran
the relative form. The proof came from a fixture project `init`ed with the
rebuilt CLI and a headless `claude -p` session told to `cd apps/x` and then
edit a checkoff Gate B should refuse; it was refused, verbatim, with the file
unchanged.

**Falsification found the fix had made things worse somewhere.** Reading the
shipped command: `node "${CLAUDE_PROJECT_DIR}"/…` under a host that does not
set the variable becomes `node /.claude/hooks/…`, which loads from *no* cwd —
every gate off everywhere instead of off from subdirectories. A POSIX `:-.`
default degrades to the old behaviour instead. The second hypothesis: `init`
re-run over a project carrying the relative form compared commands by string
equality, saw six "new" absolute commands and appended a second entry per
matcher, and the next `update` would rewrite the six relative survivors into
six more absolute ones — every hook running twice. `init` now absolutizes
before it merges. Chasing that row red exposed a third, pre-existing bug: the
local-mode settings overlay's `deepMerge` deduplicated strings only and
appended every object, so a re-run in local mode registered the whole hook set
twice regardless of form. It dedups by JSON now, the equality `deepStrip`
already used.

## Getting to Done

- **A stale `dist/`.** After the `:-.` edit, the package build printed nothing
  and A6/A7 stayed red against the old output; `pnpm exec tsc` inside the
  package rebuilt it. Read the built file, not the build's exit, before
  trusting a CLI-boundary test.
- **The validator read a fixture's row id as a cross-reference.** The live
  proof note quoted the fixture impl's one row id; `impl-corpus` refused the
  plan's impl until the id was elided. trunk-guard hit the same rule two days
  later with another plan's id, and it is now a lesson.
- **Shape could not run from inside the Verification gate.** The item that
  records the review sits in the gate, so `verificationIsGreen` is false until
  it is checked, so `prepareShapeReview` skips. Reviewed by hand twice. This
  was the second plan to hit it; trunk-guard was the third and recorded the
  circularity as a small in the master.
- **`update.ts` had a pre-existing unused import** (`resolvePath`) and
  `init.ts` an unused `noIndex`; neither this plan's, both noted, both still
  there at trunk-guard's close.

## What We Learned

- **A fix that depends on a host variable must degrade to the old behaviour
  when the variable is unset, never to a path that cannot exist.** The first
  form of the fix was strictly worse than the bug under any harness that did
  not set `CLAUDE_PROJECT_DIR`; a shell default made it strictly better.
  Reading the shipped string as a shell would, not as the author intended it,
  is what found this.
- **A merge that compares whole entries appends duplicates the moment one
  member changes.** `init`'s settings merge and the overlay's `deepMerge` both
  had this shape; trunk-guard's Build Phase 2 found `init`'s again for a
  *new* hook joining an existing matcher, and its cleanup made
  `ensureHookRegistered` the one registration path. Cleanup here recorded "two
  settings walks, not three" and deferred; the third arrived in two days.
- **A gate whose absence is indistinguishable from its approval is not a
  gate** (the principle `workbench-trust-fixes` applied five times). This
  plan applied it to the hook loader itself: a load failure is an exit 1 that
  Claude Code treats as permission.

## What We'd Do Differently

- **Write the retrospective on the day.** Every ritual was satisfied on
  2026-09-15; the archive step waited two days for an unrelated close-out to
  notice. The seven-day retrospective health error (`b7633a5a`) exists now;
  this plan would not have tripped it, which says the window is generous.
- **Test the shipped string under an unset variable in Test Phase 1.** A6 was
  writable at Phase 0 and would have caught the `/.claude/hooks/…` form before
  it shipped.

## Insights Worth Carrying Forward

- The one-definition pattern (`hookCommand`) made trunk-guard's registration a
  one-line addition two days later and gave its cleanup a natural home for
  `ensureHookRegistered`. A module that owns one fact attracts its siblings.
- Falsification by *reading the shipped artefact as its runtime would* (a
  shell expanding an unset variable; `init` comparing strings) found two
  defects that no test written from the author's intent would have.

## Follow-ons

- Recorded in the root master under trunk-guard's close-out: the Shape
  Verification item's circularity with `prepareShapeReview` (three plans now).
- `update.ts:4` unused `resolvePath` import and `init.ts` unused `noIndex` —
  pre-existing lint, still present, owner: whoever next edits those files on a
  branch.

## Quality Ratchet

No Biome rule proposed; the defects were a shell-expansion semantics and a
merge-by-whole-entry shape, neither lint-shaped.

**Shape numbers**: 0 findings across two phases, both reviewed by hand because
the library could not run from the Verification gate; two left-as-is notes
(the two settings walks; the two dedup equalities). 0 judged wrong.

## Metrics

| | |
|---|---|
| Commits on `main` (landed directly, 2026-09-15) | 12 |
| Files / lines | 10 files, +257/−25 |
| Trajectory rows | 7, all passing (5 planned, 2 falsification) |
| Falsification | 2 hypotheses, both confirmed red, plus 1 pre-existing bug found chasing A7 |
| Cleanup | skipped with reason (two copies, not three) |

## Landed

Landed on `main` directly on 2026-09-15 (`4ae33e85`…`3dd61e6a`); archived
2026-09-17 during trunk-guard's close-out. Shipped in no release yet: the
Unreleased changelog carries it alongside trunk-guard.
