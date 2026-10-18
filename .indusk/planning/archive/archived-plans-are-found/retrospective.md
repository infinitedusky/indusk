---
title: "Archived plans are found"
date: 2026-10-18
---

# Archived plans are found — Retrospective

## What We Set Out to Do

The retrospective archives a plan before it lands, and closing two plans in two days
needed the plan moved out of the archive and back because commands could not find it.
The promise: every command that acts on a plan finds it in the planning folder or,
failing that, in the archive, through one lookup; a plan in both is read from the
planning folder; re-approval reads the approved brief from its path at approval.

## What Actually Happened

Two build phases after a test phase. The impl lookup, the plan-copy record, the
workbench plan and its code file, `papers publish` and `get_plan_status` now ask one
lookup, `findPlanFolder` in `lib/promises/plan-folder.ts`; re-approval reads the
approved brief at its pre-archive path and the registry at the project's real root.
Eleven rows, all passing.

## Getting to Done

**Two of the bugs in the brief did not exist.** Test Phase 1 found that `accept` and
`land` already found an archived plan with a live worktree; the brief's "accept recorded
nothing" came from an inference about a refusal, not a reproduction. Those rows became
regression guards. The real failures were the impl lookup (behind `plans tests
--landing`) and re-approval.

**Build Phase 1 duplicated a lookup that already existed.** The cold audit found that
`lib/promises/plan-folder.ts` already answered "where is this plan's folder", with a
check that refuses the archive folder itself, a file and a path with separators; the new
`planFolder` had none of it, and a few places still built the path by hand, so an
archived workbench plan would still have been refused. Build Phase 2 deleted the copy and
routed everything through the existing one. Scoping had searched for the two broken
lookups and never for an existing function answering the question.

**The phase's test set went red on load, not on the change.** About 100 reached
process-starting tests ran in one parallel batch and timed out (load about 130); each
failing file passed alone. That is a flaw in `tests-never-make-us-wait`'s test set,
carried to its follow-up.

## What We Learned

- **Write the failing test before naming a bug in a brief.** Two of three named
  failures were inferred and did not reproduce.
- **Before writing a function, search for one that answers the same question**, not only
  for the code that is broken; the existing one here was better than the new one.
- **Reached process-starting tests in one parallel batch overload the machine.** The
  plan test set's "reached" half is unreliable when it reaches the system tier.

## What We'd Do Differently

- Search `src` for the concept ("plan folder"), not only for the broken call sites,
  before writing the impl.
- Reproduce each reported failure in Test Phase 1 before the brief states it as fact.

## Insights Worth Carrying Forward

The audit paid for itself twice in two plans: both times it found that the build
duplicated or narrowed something. That is the case for `audit-concerns-are-answered`
and `a-promise-claims-what-the-plan-builds`.

## Quality Ratchet

No Biome rule would have caught a duplicated concept. No rule added.

Shape findings: 0 raised (Build Phases 1 and 2 both reviewed, nothing to change), 0
judged wrong by a human. Shape is intra-unit and could not have seen the duplicate
across files; the audit did.

## Metrics

- Files touched: about 25
- Trajectory rows: 11, all passing (2 regression guards)
- The phase's test set: 98 files in 61 s (Build Phase 1); 102 files, red on load, in
  about 250 s (Build Phase 2)
- Falsification and cleanup skipped with reasons; the audit's findings became Build
  Phase 2
