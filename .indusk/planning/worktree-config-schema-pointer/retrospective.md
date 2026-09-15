---
title: "Worktree config schema pointer — Retrospective"
date: 2026-09-15
status: complete
---

# Worktree config schema pointer — Retrospective

## What We Set Out to Do

Sandy opened a materialized worktree config in an editor and noticed its first
line pointed at a file that was not there. The starter config the worktree
extension writes says `"$schema": "../../config.schema.json"`, which from
`.indusk/worktree-configs/` names a file at the project root that nothing puts
there. The pointer had never resolved, in any project, since the template was
written.

The brief called it two lines: ship the schema beside the configs, point the
template at it. Nothing else noticed the bug, because the command-line
validator loads the schema from inside the package and never reads the
pointer — only editors lost validation, silently.

## What Actually Happened

Four phases rather than two, 439 lines across 13 files, 36 commits, and the
plan ended up changing three subsystems the brief never mentioned: the ignore
generator, the update path, and the extension hook runner.

The two-line fix was right and shipped in Build Phase 1. Everything after it
came from asking what the fix implied.

**The relative path was never fixable by adjusting the dots.** Enabling an
extension copies only its `manifest.json` into the project, so the schema
never left the package and no relative path could reach it. That reframed the
fix from "correct a path" to "ship a file", which is what made the next three
phases necessary.

**Falsification found three things, all confirmed by reading before a line was
written.** The changelog promised existing projects the schema on the next
`indusk update`, and no code path re-ran an enabled extension's hook, so the
promise was false. The schema is package-owned and would have been committed
into a shared workbench repo, where two teammates on different versions rewrite
it at each other. And a restored clone got the shared configs and no schema,
which is the same dead update path.

**The retrospective's own docs audit found a fourth**, described below.

## Getting to Done

Five corrections, four of them to my own work.

**The manual smoke was wrong twice before it was right.** U1 asks whether an
editor actually resolves the pointer. The first pass credited grey ghost text
reading `"preflight": []` as schema completion; it was Copilot's inline
suggestion, and Sandy demonstrated it appeared identically with the pointer
broken. The second pass took a single type error as proof, which shows *a*
schema loaded but not *which*. Sandy pushed again, and the third version is a
controlled contrast: two schema files that disagree about whether
`trunk_branch` may be a number, one pointer flipped between them, everything
else held constant. Only that version distinguishes "a schema is loaded" from
"this file is loaded through this pointer", which is the entire claim the plan
makes. Two caching traps sit on that path: a failed lookup is remembered until
the schema cache is cleared, so the file must exist before the pointer names
it.

**A6 passed before its fix existed.** Plain `git status --porcelain` collapses
an untracked directory to a single line, so a filter looking for the schema's
path matched nothing and the test reported green while git was in fact offering
the file. Asking for all untracked files made it red for the reason it claimed.

**A7 overclaimed, then failed for a fixture reason.** Its first version
simulated a clone by copying directories, weaker than the row's text, so it was
rewritten against a real `workbench restore` with a bare remote. That version
stayed red because the fixture had no extension manifest — and a real clone
receives one, since the ignore rules deny only `.env*` under
`.indusk/extensions/`. The fixture was unrepresentative, not the code.

**Shape caught a convention violation in my own fix.** The first version of the
update step hardcoded `"worktree"` inside `update.ts` and re-implemented a
mechanism that file already had: an `on_update` hook fired for every enabled
extension a hundred lines above. CLAUDE.md says extensions own tool knowledge.
The manifest declares the hook now, core fires what is declared, and routing it
through the one hook runner fixed a second thing — `update`'s own `execSync`
skipped the `INDUSK_BIN` substitution that the project marks test-critical, so
a declared hook resolved `indusk` differently depending on which of two runners
fired it.

**The retrospective found the fix incomplete.** Auditing whether the changelog
described what was actually built, I checked the claim that a managed ignore
file "gains the rule". `refuseIfIgnoreCannotHold` returns early when every repo
declares its worktree location — correctly, since a declared layout needs no
deny-by-default rule — and the top-up sat behind that return. So a declared
workbench whose ignore file predated this change could never receive the rule
and kept offering the schema to its shared repo: exactly the defect A6 exists to
prevent, on the layout the project treats as modern. A6 could not see it because
its own fixture declares no `worktrees`. Phase 4 split the rules in two,
machine-local for every layout and deny-by-default for flat only, and moved the
top-up before the return. The naive fix would have been wrong: appending the
deny rule to a declared workbench inverts an ignore file this module refuses to
rewrite.

That finding also cost a fifth correction. A8 was first written as a unit test
naming the new signature, which made the file fail to *load* — an absent test
wearing a failure's clothes. It was rewritten to drive `workbench sync` over the
CLI boundary, where it could be red today on its own assertion.

## What We Learned

- **A guard that returns early for one case must not carry unrelated work
  behind it.** The declared-layout return was correct about refusals and
  silently correct about nothing else. Everything sequenced after it inherited
  a condition that had nothing to do with it.
- **A test can pass because its query cannot see the thing it asks about.**
  `git status --porcelain` collapses untracked directories; the filter was
  looking for a path git had no reason to print. Ask what the command actually
  outputs before trusting a filter over it.
- **A positive result shows a mechanism ran, not which mechanism.** One type
  error proved a schema was loaded. Only two files that disagree, with one
  pointer flipped between them, prove which file was loaded and through what.
  When the claim is about *which*, the test needs a contrast, not an
  observation.
- **A fixture that omits what a real environment supplies produces a red you
  will misread as a defect.** The clone had no extension manifest, so `update`
  correctly did nothing, and the failure looked like the update fix not
  working.
- **Signature changes cannot be tested from the inside first.** A unit test
  naming a not-yet-existing signature fails to load, which is indistinguishable
  from a failing assertion by exit code. Reach the behaviour over a boundary
  that exists today — here the CLI.
- **A hook that materializes package-owned files needs an update path, not just
  an enable path.** `autoEnableExtensions` skips what is already enabled and
  `extensionsUpdate` is third-party only, so an extension enabled before a
  release keeps whatever its hook wrote at that time, forever.
- **A file the package owns must never enter a shared repo.** The version it
  tracks differs per machine, so sharing it makes two teammates overwrite each
  other on a schedule set by whoever ran a command last.

## What We'd Do Differently

- **Audit the docs claim against the code before writing the claim.** The
  declared-layout hole was found by checking a sentence I had already
  published. Had the changelog entry been written by reading
  `refuseIfIgnoreCannotHold` rather than by describing the intent, the gap
  would have surfaced in Phase 2.
- **When a falsification row makes a universal claim, check its fixture covers
  the universe.** A6 says "never shared" and tested one layout. The row's own
  wording was the signal that its fixture was too narrow.
- **Design the editor smoke as a contrast from the start.** Three attempts at
  U1 all produced real output; only the third produced evidence. A manual check
  whose passing state is also its failing state is not a check.

## Insights Worth Carrying Forward

The plan's rules are in CLAUDE.md: extensions ship only their manifest, so
anything their output points at must be shipped by the hook; an enabled
extension's `on_enable` never fires again, so `on_update` is how an upgrade
reaches it; machine-local package-owned files need ignore rules that reach
every layout. The docs carry the same facts for users in the workbench
reference and the changelog.

No follow-on plan is owed. The one open question this plan deliberately did not
take — rewriting the stale `../../` pointer inside configs users already have —
stays out of scope, and the changelog tells them it is a one-line hand edit.

## Quality Ratchet

No new Biome rule. The five corrections were a misread editor affordance, a git
porcelain behaviour, two unrepresentative fixtures, and a convention violation
Shape already caught — none is a lint shape. The branch introduced no new
diagnostics; the two that exist on the changed files are identical on main.

**Shape findings: 5 raised, 0 judged wrong by a human.** Test Phase 1 and Build
Phase 1 each recorded nothing-found after review. Phase 2 raised three, all
accepted and worked: the hardcoded extension name, the second hook runner, and
a delegating wrapper that became an export alias. Phase 3's Shape step is the
cleanup ritual's territory by design. Phase 4 changed two files under an
existing pattern and raised nothing. This is not a second consecutive plan with
findings judged wrong; the streak remains zero.

## Metrics

- Phases: 4 (test, build, falsification, cleanup) plus a fifth fix phase the
  retrospective forced
- Trajectory rows: 8, all passing
- Files touched: 13
- Lines added/removed: +439 / −23
- Commits: 36
- Full suite at close: 1,292 passed, 5 skipped, 0 failed
- Defects found by falsification: 3 hypothesized, 3 confirmed, 5 fixed (two
  more surfaced while fixing)
- Defects found after falsification: 1, by the retrospective's docs audit
- Corrections to my own work: 5
