---
title: "Plans in worktrees show their progress — Retrospective"
date: 2026-09-18
---

# Plans in worktrees show their progress — Retrospective

## What We Set Out to Do

Every plan is worked in its own worktree, and the admin and the MCP plan tools
read plans only from the trunk checkout. So the plan being worked was the one
plan whose progress never showed: day-promises read "impl approved, awaiting
/work" in the admin while its Build Phase 1 ran. The brief proposed a record,
written by the InDusk worktree command, that says which worktree holds which
plan; one resolver reading it for every reader; the worktree named on the page;
and every mismatch reported rather than guessed.

The first draft of the brief matched worktrees to plans by branch name. Sandy
rejected it — "a bug waiting to happen" — and the reading of the code agreed:
`indusk worktree create` named branches after the bare slug while every plan
worktree had been made by hand as `plan/<name>`, two conventions already, and a
name that did not match would have fallen silently back to the trunk copy. The
accepted brief records the assignment instead and ends it at the landing.

## What Actually Happened

Six build phases after one test phase, 29 trajectory rows, all passing. 51
commits, 44 files, +2724 / −266.

- **The record and the commands** (Build Phase 1): `indusk-plan-worktrees.json`
  in the shared git directory, `indusk worktree assign` and `release`, and a
  normal-mode `create` — which had refused outside a workbench, the reason every
  dusk worktree was made by hand.
- **The tools** (Build Phase 2) and **the admin** (Build Phase 3) read each
  plan's live copy from any checkout; the admin names the worktree, lists
  unassigned worktrees, and shows gone, doubled and malformed cases.
- **The lifecycle** (Build Phase 4): the work skill's kickoff creates through
  the command, the retrospective releases after the merge. The dogfood ran
  against the real registry: this plan's page, read from its worktree by an
  admin registered at the trunk, moved from 4 of 5 to 5 of 5 on a checkoff.
- **Falsification** (Build Phase 5) confirmed all five hypotheses red before
  fixing them: a plan archived on its branch crashed every admin page of the
  project and made `list_plans` throw; a folder deleted from a worktree did the
  same; twelve concurrent assigns kept six; `create` advised a command that
  refused; `create` forked from whatever branch the trunk was on.
- **Cleanup** (Build Phase 6): one porcelain parser, one report shape
  (`copySource`) shared by tools and admin, the trunk-branch list read by
  `lib/config.ts`, and the 565-line resolver split into record, commands and
  resolver modules.

The scope held two decisions made during the impl: workbenches are out (plan
documents there never live in a code worktree), and a project nested inside a
larger repository keeps reading the folder it was asked about.

## Getting to Done

- **Three rows were sequenced one phase early.** A8, A9 and A12 assert "the plan
  reads from" a copy by asking the MCP plan tool, which only learned to read the
  record in Build Phase 2. They moved to Build Phase 2 with the reason written
  under the trajectory. A12 had passed in Build Phase 1 for the wrong reason —
  "reads trunk after release" is also what a reader that ignores assignments
  shows — and was strengthened to check the worktree is read while assigned.
- **A single-definition pin caught the plan's own copy.** The record needed the
  shared git directory, and a new `gitCommonDir` in `lib/git.ts` was the second
  `--git-common-dir` spawn; `workbench-repos-single-definition.test.ts` refused
  it. `gitCommonDirOf` in `layout.ts` became the one spawn.
- **A fixture collision found a real bug.** The admin's
  `test-fixtures/sample-project` sits inside this repository, and the resolver
  climbed to dusk's trunk and listed dusk's plans as the fixture's. The fix
  applies the resolver only at the top of a checkout; A20 pins it, shown red
  against the pre-fix code after the eval agent pointed out the fix had only an
  incidental guard.
- **The impl named a package that does not exist.** Four commands filtered on
  `@infinitedusky/indusk-admin`; the package is `indusk-admin`, and a filter on
  a wrong name matches nothing. Results stood because the tests were run from
  inside the package; the commands were corrected to run as written.
- **A18's own test was broken.** Its section cutter searched for the next
  heading one character into the current one, so `## Step 10` matched itself
  and the section was one character long; the work-skill half passed only
  because its heading level differed. Fixed, with a guard that throws on a
  section under 200 characters, and shown red against the old skill text.
- **Environment, not code:** a fresh worktree has no admin build, so eight
  daemon and tarball tests failed until the admin was built and bundled; the
  daemon-identity tests fail on this machine because the telemetry collector
  holds port 65001 (queued in the root master); the admin's HTTP tests flake
  when the node and browser projects run together, on the trunk too.

## What We Learned

- **A record beats a naming convention for "which X belongs to Y".** Names are
  chosen by whoever runs the command, and two conventions already existed; a
  mismatch is silent. A record written by the one command that creates the
  thing, checked against the source of truth on every read, turns every
  mismatch into something the reader can say.
- **Falsify a feature against the lifecycle it participates in.** The worst
  bug here — archiving a plan on its branch crashing every page — sat in the
  window between two steps of the retrospective this very plan would run. The
  question that found it was "what does the plan's own close-out do to the
  thing this plan built?"
- **A read-modify-write record shared by processes loses writes in practice,
  not just in theory.** Twelve concurrent assigns kept six on the first run.
  The project already had the lock; the record did not use it until
  falsification made the loss visible.
- **A row's `Passes at` belongs to the phase that builds the reader it asks
  through, not the phase that builds its subject.** Three CLI rows asserted
  "the plan reads from it" through the plan tool and could not pass until the
  tool did.
- **A text-slicing test helper must assert that what it sliced is non-trivial.**
  A cutter that returned one character made a skill assertion meaningless, and
  one half of it passed by accident.

## What We'd Do Differently

- Write the record into the first brief. Branch-name matching was proposed
  before reading `indusk worktree create`; one look at it showed two conventions
  already in use.
- Put the plan's own close-out steps into the test plan's assertions. A21 was
  foreseeable from the retrospective skill's Step 9 and Step 10 alone.
- Read `package.json`'s `name` before writing a `--filter` into an impl, and run
  every verification command verbatim at least once.
- Scope formatter runs to the files an item changed. `biome check --write` on
  `package.json` converted it to tabs, a 286-line diff hidden inside a four-line
  change (tabs are the repo's style, so it stayed, but it should have been its
  own commit).

## Insights Worth Carrying Forward

The resolver's shape — a record in the shared git directory, written only by
commands under a lock, re-checked against git on every read, returning an
either-or result so a caller cannot use a map it should not — is reusable for
any per-machine fact about worktrees. A workbench version (naming a plan's
code worktree in the admin) is the natural follow-on and is out of scope here.

## Quality Ratchet

No new Biome rule. The mistakes were a wrong package name in a command, a
test helper that sliced the wrong span, and a formatter run on a file outside
the change — none is a lint pattern. Repo-wide `pnpm check` is red on the trunk
for files this plan did not touch (recorded in the impl's Notes).

**Shape findings: 2 raised, 0 judged wrong by a human.** Build Phase 1:
extract the per-plan classification in `resolvePlanCopies` into `copyFor`.
Build Phase 3: move the admin's unassigned list and record-error block into the
`Worktrees` module beside the chip. Test Phase 1 and Build Phases 2, 4, 5 and 6
recorded "nothing to change". No human reviewed the findings individually, so
"0 judged wrong" means none was contested, not that each was confirmed.

**The fix, used on itself:** after Step 9 moved this plan's folder into
`archive/` on its branch, resolving the plan from the trunk returned its
worktree's archived folder with `archivedInWorktree: true` — the state that,
before Build Phase 5, made `list_plans` throw and every admin page of dusk
return 500.

## Metrics

- Sessions spent: 1 (2026-09-18)
- Commits on the branch: 51
- Files touched: 44 (+2724 / −266)
- Trajectory rows: 29, all passing (20 planned, 5 from falsification, 4 from cleanup)
- Falsification: 5 hypotheses, 5 confirmed red, 5 fixed
- Largest module: 565 lines before cleanup, 274 after (resolver), with 161 (record) and 157 (commands)

---

Landed on main at d28ca5fb, 2026-09-18.
