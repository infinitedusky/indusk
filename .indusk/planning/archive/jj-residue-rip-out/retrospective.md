---
title: "jj Residue Rip-Out"
date: 2026-08-16
---

# jj Residue Rip-Out — Retrospective

## What We Set Out to Do

Finish the jj removal that [`git-only-substrate`](../archive/git-only-substrate/) declared complete on 2026-06-27 (1.31.0), and replace the enforcement test that could not have caught what it missed.

The brief's framing turned out to be the important one: the problem was never "some jj code survived." It was that a green test had made the project believe otherwise for seven weeks.

## What Actually Happened

31 files, **+1269 / −307**, 18 commits, five phases, twelve trajectory rows — all terminal, no deferred rows, no blocked rows.

The removals were mechanical and took a fraction of the effort. Nearly all of the work went into the guard, and the guard turned out to be wrong in **four independent ways**, discovered by four different mechanisms:

| # | Blind spot | Found by |
|---|---|---|
| 1 | **Path scope** — `SRC_ROOT` was `apps/indusk-mcp`, never scanned `apps/indusk-admin` | Scripted census during triage |
| 2 | **Pattern scope** — all five patterns were TypeScript identifiers; the violation was an argv string | Reading the predecessor's test-plan assertion |
| 3 | **Line-at-a-time matching** — the call site spans two lines, so a per-line scan misses it *even with a correct pattern* | Opening `vcs.ts` before writing the fix |
| 4 | **File-type scope** — `.ts`/`.tsx` only, blind to the hooks (`.js`), skills (`.md`) and manifests (`.json`) that ship to consumers | `/falsify` |

Numbers 1 and 2 were the predecessor's. Number 3 would have defeated my fix for 1 and 2 if I hadn't opened the file. **Number 4 was mine** — I corrected the predecessor on two axes and reproduced its exact failure on a third, then shipped it, and only falsification caught it.

What number 4 was hiding: `getting-started.md` — the first page a new user reads — advertised **`/jj`** among its available skills. `skills/jj.md` was deleted in 1.31.0. A dead instruction sat on the front door for seven weeks, the rip-out shipped past it, and the replacement guard was structurally incapable of seeing it because a guide is prose.

`/cleanup` then found a fifth thing, in code this plan had itself written.

## Getting to Done

The through-line of this plan is **green and red both lying**, five separate times:

1. **A6 would have reported "skipped."** Its suite `skipIf`s on a missing CLI binary. In a fresh worktree `dist/` doesn't exist, so the row would have looked authored while never running. Caught by checking for `dist/` before trusting the run.
2. **`turbo typecheck` was not a task.** The Build Phase 3 verification step ran `pnpm turbo typecheck`, got no output, and was checked off. It had been silently doing nothing. Typechecking is real, but it arrives via `build`, which is literally `tsc`.
3. **`vitest` exited 0 having run nothing.** A verification command inherited a drifted shell cwd, printed `No test files found, exiting with code 0`, and would have read as a pass to anything checking the exit code.
4. **A12's first red was a spawn failure.** The probe used bare `sh` under a PATH narrowed to git only; `spawnSync sh ENOENT` failed both assertions before either ran.
5. **A3's guard had been proving nothing since Test Phase 1.** It asserted jj's absence with `execFileSync("sh", …)` under that same narrowed PATH. `.toThrow()` passed on the ENOENT — it would have passed whether or not jj was reachable.

Five and four are the same defect, and I wrote both. The one that matters is five: it shipped green through three phases, a falsification pass, and a merge, and was only found because `/cleanup` forced a second look at the same PATH construction.

**The gate hooks earned their keep, repeatedly.** They blocked three separate edits: once because the worktree-kickoff item sits inside Test Phase 1 and the test-first rule covers it too, and twice because a trajectory row's State column still said `written`/`planned` while the checklist claimed the work was done. Every one was a real bookkeeping lapse of mine, and none would have been caught by a human reading the file.

**Two claims I made and later had to correct.** I wrote that `git-tmp-project.ts` had "zero importers since the day it was written" — `git grep` at its adding commit shows one, deleted later by the makeover. It was *orphaned*, not unadopted, which is a different diagnosis. And I marked a commit `feat(indusk-mcp)!:` when nothing in it breaks a consumer who isn't importing `InduskConfig` and setting a no-op field.

## What We Learned

- **A "search for X, expect zero" test has more independent scopes than it looks like.** Not two (path, pattern) but at least four — add *matching granularity* (line vs whole-file) and *file type*. Each fails silently and independently; auditing one catches none of the others. The eval agent materialized a lesson covering the first two; the other two are the ones that actually bit.
- **Preservation has to be encoded, not decided.** The changelog was ruled preserved history in Build Phase 2 and recorded only in prose. It was never added to the exemption list, because nothing scanned `.md` — so the decision was invisible to the machine until scope widened and immediately threatened to flag it. A decision recorded only in prose is not a decision the system holds.
- **A green enforcement test is a claim that nobody re-checks.** The predecessor's own retrospective had *already* flagged "zero matches in production source was green" as something falsification had to see past. The same failure then survived inside the very test meant to catch it. Passing tests are where belief accumulates unexamined.
- **A test's precondition can fail silently and every downstream assertion still passes.** `pathWithoutJj()` returned PATH *unchanged* when its `which` lookup failed, so "jj is absent" was false while A3 stayed green. A precondition that degrades instead of throwing is worse than no precondition, because it manufactures confidence.
- **Deliberately extracting the broken version first is worth the extra step.** Carrying the fragile algorithm into the new helper so A12 could go red against it is what exposed the `which`-lookup failure. Writing the correct version straight away would have produced a green test and left the real defect undescribed.

## What We'd Do Differently

- **Audit the guard's scope along every axis before writing the fix, not after.** I corrected path and pattern because those were the two the predecessor's assertion named. Nothing made me ask "what *else* is scope?" until falsification did. The census that established the removal scope should also have established the *audit's* scope.
- **Check that a verification command exists before checking off a verification item.** Three of the five false signals were commands that ran and reported nothing. Reading output rather than exit codes catches all three, and costs nothing.
- **Treat "this passes on my machine's layout" as a finding, not a pass.** `pathWithoutJj()` worked here only because git is at `/usr/bin/git` and jj at `/opt/homebrew/bin/jj`. On a Homebrew-git machine it would have silently removed git. A12 now plants both binaries in one directory rather than trusting the host.
- **Say what a `!` means before typing it.** The breaking-change marker went on a commit that breaks nothing. No tooling consumed it here, but history is read by people.

## Insights Worth Carrying Forward

The reusable shape is not about jj. It is: **when you delete something and write a test to keep it deleted, the test's scope is itself an untested artifact.** It has axes (path, pattern, granularity, file type), each can be narrower than reality, and the failure mode is a green test plus a confident claim. The only cheap defence found here was to watch the test fail first, against a real violation, and to say in the plan what the red output must name.

Second, smaller: **a plan that fixes an enforcement mechanism should expect to find its own new mechanism defective.** Falsification found blind spot 4 and cleanup found defect 5 — both *in this plan's own output*, not in the legacy code it was replacing.

## Quality Ratchet

No Biome rule would have caught any of this. The five false signals were absent commands, drifted working directories, spawn failures, and regex scope — none of them lint-visible. The `noDuplicateObjectKeys` and `noUnusedVariables` findings that surfaced during verification were pre-existing at baseline and untouched by this plan.

The nearest thing to an automatable rule is "an enforcement test must be observed failing before it is trusted," which is process, not lint — it is now expressed as a plan-authoring habit (name the red output in the phase) rather than a rule.

**Shape findings: 2 raised, 0 judged wrong by a human.**

- Build Phase 1 — extract the shared matcher from the audit file. Raised, then **narrowed by the executor**: extracting the whole loop would have been extraction for its own sake, so only `matchesIn` came out. Narrowing during execution is not a human overrule; the finding was directionally right and over-scoped.
- Build Phase 5 — both test files resolved `REAL_GIT` with bare `sh` while carrying comments teaching the opposite. Raised and fixed.
- Build Phases 2, 3, 4 — reviewed, nothing found. Three files were recorded as considered-and-left with reasoning.

This is **not** a second consecutive plan with human-judged-wrong findings, so no calibration hypothesis is triggered against `lifecycle-rebalance`.

## Metrics

- **Sessions spent**: 1
- **Files touched**: 31 (+1269 / −307)
- **Commits**: 18
- **Phases**: 5 (1 test, 3 build, 1 falsification, 1 cleanup — falsification and cleanup are build phases 4 and 5)
- **Trajectory rows**: 12, all `passing`; 0 deferred, 0 blocked
- **Test suite at close**: `indusk-mcp` 1006 passed / 0 failed (155 files); `indusk-admin` 149 passed / 2 failed — both failures are `http-*` server-boot tests that pass in isolation (7.33s and 6.70s, over vitest's 5s default), the known-red-on-main class
- **Defects found in this plan's own output**: 2 (one by `/falsify`, one by `/cleanup`)
- **False green/red signals caught**: 5
- **Gate-hook blocks**: 3, all genuine bookkeeping lapses
