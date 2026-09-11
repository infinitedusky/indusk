---
title: "Workbench Trust Fixes — Retrospective"
date: 2026-09-10
status: complete
---

# Workbench Trust Fixes — Retrospective

## What We Set Out to Do

Five weeks before this plan, the versioned-workbench work made the workbench
root a git repository so a team could share one. That was the right change,
and it also removed, without anyone noticing, the thing that made four safety
mechanisms safe. Each of them (`indusk run`'s commit loop, the cleanup file
scan, the evaluator's repo lookup, and `workbench restore`) took one folder as
its whole world and had only ever been stopped from doing damage in a
workbench by tripping over "this is not a git repository". That was a
coincidence, not a guard, and once the root became a repository nothing
tripped.

The brief ([brief.md](brief.md)) was careful about what kind of finding this
was: none of the four had been seen to fail. They were found by reading, on
2026-09-03, and the brief describes scenarios nothing prevents, not incidents.
The exception was the fifth item, the gate reminder, which was not a scenario:
it had never once reached a model since the day it was written, because it
wrote to stderr and exited 0, which a PostToolUse host routes to the debug
log.

The direction was one principle applied five times, the principle `verify`
already followed: a tool that cannot answer correctly refuses loudly and says
why. It never guesses, and it never reports the happy case. Phase A (the
reminder plus the four refusals) blocked Dawn 6.5 and Midnight; Phase B
(bash-lane parity, small silent degradations, the record) trailed.

There was no ADR. The decisions were all of the form "make this surface honest
using the readers that already exist", and the brief said so.

## What Actually Happened

The plan touched 78 files, +2,736 / −896 lines, across 72 commits on
`plan/workbench-trust-fixes`, in nine phases: a Test Phase 1 that authored
every assertion red first, seven build phases, a falsification phase and a
cleanup phase. Twenty-four trajectory rows, all green at close; thirteen new
test files; one new fixture family. The package suite closed at 1,225 passing,
5 skipped, 0 failing, and the branch carries no Biome diagnostics that main
does not (it removed two).

Everything the brief named shipped in the shape the brief named, with three
divergences worth recording:

- **The fixture came first, and it is the real deliverable.** Test Phase 1
  opened with `helpers/versioned-workbench.ts`: a root that is `git init`ed,
  repos declared with `path` and `worktrees`, nested or sibling layouts. Until
  it existed the regression net was structurally blind to the whole class,
  because every workbench fixture in the suite reproduced the pre-1.37 shape.
  Twelve of the thirteen new test files stand on it.
- **One invariant was over-claimed and falsification corrected the claim,
  not just the code.** A7 is the trajectory row asserting that a commit from a
  workbench-root cwd is never attributed to the workbench repo. Falsification
  row A20 showed that is wrong: the workbench repo receives commits too (plan
  documents), and "never the workbench" would score a checkbox commit against
  the code repo's unrelated HEAD. The invariant is now "a commit is attributed
  to the repository that received it", implemented as newer-HEAD-wins with the
  code repo on ties, and the choice is logged.
- **`workbench-mode-rail-integrity` was closed, not re-scoped.** Its
  remaining premise (that the workbench root has no git history) had been
  false since 1.37.0, and its blocker named an MCP tool deleted in July.
  `graph-knowledge-architecture` went to the archive in the same phase for the
  reason CLAUDE.md had been carrying for weeks.

Falsification found five defects and a sixth while fixing one of them.
`linkTrunk` did not create the link's parent directory on a sibling layout
with a two-segment path, and once it did, the link pointed at itself, because
its relative target was computed from the workbench root rather than from the
link's own directory. A22 asserts that the link *resolves to the clone*, which
is what caught the second bug; a test asserting "restore does not crash" would
have passed it.

Cleanup extracted two shared units (`hooks/_impl-phases.js`, the one hook-side
walk from an impl body to its phases and items, pinned by count; and
`helpers/test-git.ts`, the one throwing git runner for fixtures) and left four
oversized pre-existing files as they were, with the reasons recorded. It also
declined to extract a refusal helper from the three refusal sites, because
`dawn-workbench-execution`'s `resolveExecutionRoots` is their designated home
and building the abstraction the next plan replaces is the wrong move.

## Getting to Done

The unplanned work fell into two kinds: the ordinary friction of a fresh
worktree, and one finding that surfaced only at this retrospective and is
more important than anything the plan set out to fix.

**Ordinary friction.** A fresh worktree needs `pnpm install`, `pnpm build`
and the admin bundle before its suite matches main's; without them 150 tests
skip and 9 fail for environment reasons. An Edit to `_hook-paths.js` failed
silently under a Biome rewrap while its sibling edit succeeded, leaving
`attribution` undefined and every eval test red until it was reapplied. Two
regression pins went red for the wrong reason first: A24's fingerprint was the
unescaped regex text and matched nothing, and A16's first pattern matched
"repository", runtime messages and the historical record. Two existing tests
encoded the rules this plan replaced and had to be updated with the reason in
a comment. A verification item named a test glob that does not exist. None of
this is new, and all of it was caught by running the thing.

**The finding.** Step 4a of this retrospective found two trajectory rows, A1
and A3, still in state `written` although Build Phase 1 had closed and eight
phases had been checked off after it. Their tests pass; only the state cells
were never flipped. That is a bookkeeping omission, and it is exactly the
omission the `check-gates` hook's Gate B exists to refuse: replaying the first
Build Phase 2 checkoff through the hook today blocks it, naming both rows. So
the question was why the hook had not blocked it on the night.

The transcript answers it. Every InDusk hook is registered as
`node .claude/hooks/<name>.js`, a path relative to the current directory, and
Claude Code runs hook commands in the session's current working directory,
which drifts with every `cd` in a Bash call. The first Build Phase 2 checkoff
was made two minutes after a Bash call that ended inside `apps/indusk-mcp`.
From there `node .claude/hooks/check-gates.js` cannot find the file, exits 1,
and an exit code other than 2 is a non-blocking error the host does not show
the model. The gate was off. It was off again for every Phase 9 checkoff,
made from the same directory, while A24 (the cleanup phase's pin) still read
`planned`. The three Gate A refusals that did fire in the session all came
seconds after a Bash call that had `cd`ed back to the worktree root.

Nothing prevents the same for every other hook. `validate-impl-structure`,
`claude-md-budget`, `gate-reminder`, `workbench-sync` and `eval-trigger` are
registered the same way, so a commit made while the cwd sits in a
subdirectory is a commit the evaluator never sees. That case has not been
confirmed from the log and is recorded as a scenario, not an observation; the
gate case was observed and replayed.

Two more things the close-out could not see: the retrospective's Step 0 gate
passed with those two rows non-terminal, because `checkRetrospectiveReadiness`
checks only that the falsification and cleanup *phases* have every checkbox
ticked (the skill text claims a stronger condition than the code performs);
and `auditPlanAtClose` reports `blocked` and deferred rows only, so a row left
`written` is invisible to it as well. The two rows were corrected to
`passing` here, as a retroactive phase close, and the whole finding is filed
as [hook-cwd-independence](../hook-cwd-independence/brief.md).

This plan's brief opened with "a guard that works by coincidence is not a
guard". The enforcement lane that gated the plan was one.

## What We Learned

- **A gate that fails to load is a gate that passes.** For a Claude Code
  hook, only exit 2 blocks; a module-not-found is exit 1, non-blocking, and
  invisible to the model. Any enforcement hook must resolve its own path
  independently of cwd (`$CLAUDE_PROJECT_DIR`) and must treat its own failure
  to run as a refusal, not a pass. The same shape as the gate reminder that
  wrote to a channel nobody read: the enforcement existed, the delivery did
  not.
- **Close-out asks the wrong question about rows.** Both close-out checks
  (the ritual gate and the trajectory audit) ask about phases and about
  `blocked`; neither asks "is every row terminal". The cheapest check that
  would have caught A1 and A3 is replaying `check-gates` over the final
  document, which is what this retrospective did by hand.
- **Fixtures encode the world the tests believe in.** Twelve versioned-
  workbench defects were found by *using* the feature after its plan closed
  green, and four more surfaces failed silently in that shape, because no
  fixture had a `git init`ed root. A regression net cannot see a shape it has
  no fixture for, and the fixture for the shape a feature exists for is the
  one most likely to be missing.
- **The first statement of an invariant is usually an over-claim.** "Never
  attribute to the workbench" was clean, testable and wrong; "attribute to the
  repository that received the commit" is the invariant. Falsification's
  value here was correcting a sentence, and the code followed.
- **Assert the outcome, not the absence of a crash.** Two bugs sat on one
  path in `linkTrunk`; the test that asserts the link resolves to the clone
  found both, and a test that asserted "restore exits 0" would have found
  neither.
- **A refusal is a user interface.** A13 exists because verify's refusal told
  the user to run it at a directory that did not exist. A refusal that names
  a wrong path is a silent wrong answer dressed as an honest one.
- **Libraries that address phases by number are blind to the test sequence.**
  `prepareShapeReview({ phase: 1 })` means Build Phase 1, so a test phase's
  craft review cannot be scoped or recorded by the Shape library; it predates
  test-phase-structure, the same way the admin UI's private phase regex does.
- **Do not build the abstraction the next plan replaces.** The rule of three
  was met by three refusal messages, and cleanup still declined to extract
  them, because their single home is already designated in the plan that
  lifts them. Recording that as a left-as-is with its reason is a decision the
  next plan can read.

## What We'd Do Differently

- **Replay the gates at close.** A close-out step that runs `check-gates`'s
  Gate A and Gate B over the whole final impl (every row, every phase) would
  have found the stale rows in seconds. It belongs in the ritual gate, not in
  a reader's diligence.
- **Fix the hook paths before the next plan runs under them.** Every gate in
  this repository is one `cd apps/indusk-mcp` away from off, and most test
  runs start with that `cd`. Until the follow-on lands, `cd` back to the
  repository root before any impl edit.
- **Treat "the hook did not complain" as no evidence at all.** The hook's
  silence during Build Phases 2 through 9 was read as passing. Silence from a
  gate is the same signal as a gate that is not installed, and a gate whose
  absence is indistinguishable from its approval is the exact defect this plan
  spent nine phases fixing elsewhere.
- **Let the ritual gate read the skill text, or the skill text read the
  gate.** The retrospective skill promises a row-level check the library does
  not perform. One of them should change, and the check is the cheaper one to
  add.

## Insights Worth Carrying Forward

- The hook-path finding is filed as
  [hook-cwd-independence](../hook-cwd-independence/brief.md): absolute hook
  commands in `init`/`update` and this repo's settings, a load-failure that
  refuses, and a row-level terminality check in the close-out gate. It should
  run before `dawn-workbench-execution`, because 6.5 will be executed under
  these gates.
- Follow-ons this plan named and did not take: the Shape library's test-phase
  awareness (with the next Shape change); three private `runHook` copies
  outside this plan's files; splitting `workbench.ts` by subcommand;
  `resolveExecutionRoots` absorbing the three refusal sites (6.5's).
- `dawn-workbench-execution` lifts the refusals installed here case by case.
  This plan made every surface honest; that plan makes them able.

## Quality Ratchet

No new Biome rule. The mistakes in this plan were of three kinds, and none is
a lint shape: a regex written as its escaped source text, a grep pattern too
broad for the corpus, and an enforcement command that resolves relative to a
drifting cwd (JSON content Biome does not read). The one lint-adjacent lesson,
that a `noConsole` sweep deleted the line that delivered the gate reminder, is
an allowlist fact already recorded in CLAUDE.md, not a rule to add. The
branch removed two pre-existing diagnostics and added none.

Shape findings: **2 raised, 0 judged wrong by a human.** Build Phase 5 named
the clone target (`cloneTarget`, written three times); Phase 8 named the
attribution rule (`attributeRootCommit`, three inline branches). Both were
fixed in their phase. One considered-and-left-alone was recorded
(`workbench-helpers.sh`'s second scan) and nothing-found was recorded on the
other seven phases. Test Phase 1's review was done by hand because the
library cannot address a test phase. This is not a second consecutive plan
with findings judged wrong; the streak is zero.

## Metrics

- Sessions spent: 3 (planning on 2026-09-09; one execution session from
  21:40 on 2026-09-09 to 13:10 on 2026-09-10, compacted twice; this close-out)
- Files touched: 78
- Lines added/removed: +2,736 / −896
- Commits on the branch: 72
- Trajectory rows: 24 (18 planned, 5 falsification, 1 cleanup), all passing at
  close
- New test files: 13; one new fixture family (`versioned-workbench.ts`) and
  two shared helpers extracted (`test-git.ts`, `hook-runner.ts` extended)
- Package suite at close: 1,225 passed, 5 skipped, 0 failed
- Defects found by falsification: 5 hypothesized, 6 fixed
- Gate coverage during execution: Gate A fired 3 times; Gate B fired 0 times
  and should have fired at least once (found at retrospective)
