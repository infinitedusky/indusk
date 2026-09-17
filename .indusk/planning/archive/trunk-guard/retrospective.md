---
title: "Trunk guard — Retrospective"
date: 2026-09-17
status: complete
---

# Trunk guard — Retrospective

## What We Set Out to Do

A bugfix plan with a one-line motivation from Sandy: "maybe indusk and
workbenches don't allow work on main." Worktree-per-plan was the default and
every close-out landed by merge, but nothing enforced it; on 2026-09-17 one
session committed a skill step, a release-guard fix, a feature and another
session's WIP straight to `main` in one afternoon, while a second session
edited a skill on `main` beside it. The release guard refuses an unmerged
packaged *branch*; it had no opinion about a packaged edit made on trunk.

The fix was a PreToolUse hook shaped like the CLAUDE.md budget hook, on two
matchers: Edit/Write refuses code on a protected branch, and Bash refuses a
`git commit` that would take code there — the second line for edits made
through `sed`, `python` or a heredoc, which the Edit gate never sees. Plan
documents, lessons, settings, `CLAUDE.md` and `AGENTS.md` stay editable on
trunk, because those are the writes a plan makes before it has a worktree and
after it has landed. A `chore(release):` commit is exempt; two off switches
are deliberate and visible; in a workbench the declared code repository's
branch is judged.

## What Actually Happened

Everything the brief named shipped, in one test phase and four build phases:
the hook, its registration, a falsification phase and a cleanup phase. Eleven
trajectory rows, all passing. 27 commits, 20 files, +1616/−130; the code
(hook, `init`, `update`, the hook-command module, five test files) is 10 files
at +1049/−72.

**The hook is what the brief drew, plus the realpath rule.** Seven tests
went red on the first run: macOS reports a temp dir as `/var/folders/…` and
its git root as `/private/var/folders/…`, so a file under one root never
appeared to be inside the other. Every path the hook compares now passes
through `real()`, which resolves a not-yet-existing file (a Write) through
its nearest existing ancestor. The second first-run red was `echo git commit`
matching the commit regex; command position (start, or after a separator)
fixed it and became the shape the falsification later widened.

**Registration found a bug older than the plan.** `init`'s settings merge
checked whether *every* command of a matcher group was present and, when one
was missing, appended the whole group. The moment a new hook joined the
existing Edit/Write matcher, every hook in it was registered twice — eleven
registrations where eight belonged. `hook-cwd-independence`'s count caught it;
`init` now merged per hook. The fix also recorded the fifth hand-rolled copy
of "is this hook in that group; if not, add it", which cleanup later removed.

**Falsification found the commit gate read one spelling of shell.** Reading
the shipped hook after Build Phase 2 turned up three gaps, each a spelling an
agent uses daily and each confirmed red before its fix: `git -C <repo>
commit` (and `-c`, `--no-pager`) with the judged repository moved by `-C` or
by a `cd` earlier in the same command; `bash -c "git commit …"`, `sh -c '…'`
and backticks (`$(…)` was already read through `(`); and `git commit -am …`
or `git commit -m … <path>`, both of which commit files that were never
staged. Twelve of sixteen cases were red on their own claim; the four
negatives (`git commitment`, a quoted phrase inside `--grep`, `$(…)`, nothing
staged) were green from the start and stayed as guards. A small argument
tokenizer now tells a flag, its value and a pathspec apart. One red on the
fix's first run: the match begins *at* the separator, so the text before it
ended in one `&` of `&&` and the `cd` segment was not recognised until the
split was on separator characters rather than operators.

**Cleanup made one way to register a hook.** `ensureHookRegistered` in
`lib/hook-command.ts` replaced four targeted-ensure blocks in `update.ts`
(eval-trigger, workbench-sync, claude-md-budget, trunk-guard) and the merge
loop in `init.ts`. `update.ts` lost 81 lines for 14; `hookFileOf` lets
`init`'s full-command config go through the same door. The workbench-sync
block used to check presence across every PostToolUse group and register
into Edit/Write; the helper checks the group it registers into.

## Getting to Done

- **The plan worktree had no admin build.** Nine `indusk ui` daemon tests
  and the tarball test failed until `pnpm --filter indusk-admin build` and
  `scripts/bundle-admin.js` ran in the worktree. Neither failure was the
  plan's; both cost a suite run each to diagnose. A worktree kickoff that
  builds the admin bundle would remove this from every future plan.
- **The impl validator read another plan's row id as a reference.** A
  verification note said "`registry-leak-scan` A22" to name the scan's
  assertion, and `impl-corpus` refused this impl: any `A` + digits inside a
  Verification block is a cross-reference to *this* trajectory. Reworded to
  name the file and the assertion in words.
- **The registry leak scan is textual.** `runCli` pins `INDUSK_HOME` for
  every spawn, but the scan reads the test file for the name and flagged the
  registration test until its header said so.
- **Two Shape gates.** Shape refused to review Build Phases 2 and 4 until the
  Verification block was fully checked — including the "Shape" item itself.
  The workaround was to check that item as "performed; the record is the
  items appended below", then run the library. The item and the library
  disagree about which comes first; see Follow-ons.
- **The `cd` drift.** Twice a `git add` failed on a pathspec because the
  shell's working directory had moved to `apps/indusk-mcp` between calls;
  absolute paths from then on.

## What We Learned

- **A hook that reads shell must be falsified against the spellings agents
  actually use, not the one the author types.** `git commit` in command
  position is one of at least four ways an agent commits in a day: `git -C
  <repo> commit`, `cd <repo> && git commit`, `bash -c "git commit …"`, `git
  commit -am …`. Every one was a hole in the shipped hook, and every one was
  in this repository's own git history from the same afternoon. The reading
  list is now in the hook's header and the guide row, with the gap named:
  a script that commits inside itself is out of sight by the brief.
- **The fifth copy's bug hides in the fourth's shadow.** Four ensure blocks
  in `update.ts` shared a shape by comment ("same targeted-ensure shape as
  the eval-trigger block above") and none shared code; when the fifth copy
  was written in `init.ts` it carried a duplicate-group bug the other four
  did not, and nothing about the four made it visible. The rule of three had
  been passed twice before this plan arrived.
- **The impl validator's cross-reference rule is a vocabulary rule.** Inside
  a Verification block, `A22` *is* a row of this plan, whatever the prose
  around it says. Name another plan's assertion by its file and its words.
- **Realpath every path a hook compares.** The telemetry registry learned
  this in 2026-07 (`/var` ↔ `/private/var`); the hook learned it again on
  its first run. It is now a lesson, not a gotcha in one module.

## What We'd Do Differently

- **Read the last two days of `git log -p` for the command shapes before
  writing a command regex.** The three falsification hypotheses were all
  present in the session's own history; the hunt would have been a Test
  Phase 1 row instead of a Build Phase 3.
- **Open the worktree with the admin bundle built.** Two full-suite runs
  were spent on an environment gap, not a code gap.
- **Write the cleanup extraction in Build Phase 2, when the fifth copy was
  written.** The shape was named in the Shape left-as-is note and deferred
  to cleanup by the rules; the rules were right, and the cost of waiting two
  phases was small — but the fifth copy did ship a bug the helper would have
  prevented.

## Insights Worth Carrying Forward

- A guard's value is exactly the set of spellings it reads. Document the set
  where the next reader will look (the hook header, the hooks table), and
  name what is outside it, so "it's protected" is a claim with edges.
- A behaviour-parity refactor of five sites is safe when the sites already
  have callers under test (`init` and `update` had A5, `hook-cwd-independence`,
  `init-globsync-hooks`, `eval-trigger-git-mode`); the new unit's own test
  then covers the shapes the sites never exercised (a second group; a
  customised command).
- "Nothing staged, nothing to judge" was the right default for the plain
  `git commit`, and wrong for `-am` and pathspecs — the default was fine, the
  reading of *what would be committed* was incomplete. Judge the commit's
  intent, not the index alone.

## Follow-ons

- **Shape's "Shape" verification item vs. the library's green check.** The
  impl template puts a "Shape (Phase N): review …; record findings" item in
  the Verification block, and `prepareShapeReview` refuses to run until that
  block is fully checked. One of the two has to move: either the item is an
  implementation item (Shape's record already lands there) or the library
  ignores items that name Shape. Owner: `lifecycle-rebalance`'s follow-ons.
- **Worktree kickoff builds the admin bundle** (or the daemon tests skip
  with a named reason when `admin/` is absent). Owner: the next plan that
  touches `indusk ui` or the kickoff step.
- **No docs lessons page for this plan.** Trunk's `.vitepress/config.ts` is
  in another session's uncommitted hands, the sidebar cannot be edited on
  `main` under the guard this plan shipped, and a lessons page without a
  sidebar entry is unlisted. The lessons are registered in `.claude/lessons/`
  and this document; a `/lessons/trunk-guard` page can be added by the next
  docs-touching plan on a branch.
- **Pre-existing lint**: `noIndex` is destructured and unused in
  `init.ts:446`; not this plan's, left in place.
- **Out of the brief, considered and not authored**: `git cherry-pick`,
  `git revert`, `git am` and `git rebase` onto `main` land code without a
  `git commit` in the command. `git merge` is how landing works and must stay
  allowed. If trunk work reappears through those, a `cherry-pick`/`am`
  reading of the touched paths is the next hypothesis.

## Quality Ratchet

No Biome rule proposed. The mistakes this plan made — a regex reading one
spelling, a copy-pasted ensure block, a foreign row id in a note — are not
lint-shaped.

**Shape numbers**: raised 1 finding across four build phases (Build Phase 3:
`classify()`'s Bash branch had grown four jobs; extracted `commitAnchor` and
`commitCloser`), 0 judged wrong by a human. Two left-as-is notes (the
update.ts ensure shape deferred to cleanup, which took it; the hook file
under its cap). Not a second consecutive plan with a wrong finding.

## Metrics

| | |
|---|---|
| Commits on `plan/trunk-guard` | 27 |
| Files / lines | 20 files, +1616/−130 (code: 10 files, +1049/−72) |
| Trajectory rows | 11, all passing (7 planned, 3 falsification, 1 cleanup) |
| Falsification | 3 hypotheses, 12 of 16 cases red on first run, all fixed |
| Cleanup | 1 extraction (`ensureHookRegistered`), 5 sites removed |
| Full suite at close | 234 files / 1430 tests passed, 1 file skipped |
| CLAUDE.md | 61,416 bytes before the close-out compaction (budget 61,440) |
