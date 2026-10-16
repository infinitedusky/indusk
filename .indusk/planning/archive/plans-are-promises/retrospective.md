---
title: "Plans are promises"
date: 2026-10-16
---

# Plans are promises — Retrospective

## What We Set Out to Do

A promise was one sentence with no parts, so a plan closed when any passing test row named it. The brief (`brief.md`) set out to let a plan state each promise as clauses (splits, limits, resting on another promise), plan every clause's signal and tests before the ADR, and close only when every clause is proved. Older plans were to stand untouched. Proving a clause by its signal was carved out to `mark-first`, and running phases as a graph to `run-the-master`.

## What Actually Happened

Shipped: `clauses: required` as a per-brief opt-in; clauses as sub-entries under each promise in the brief; a `clauses` list in the registry written by `indusk promises declare --clause` and held equal to the brief by the contract check; the clause plan as sections in the existing `test-plan.md` (one reader, `clause-plan.ts`); a `clause: <promise>/<clause>` token in a row's `For` cell, read by both copies of the row-purpose reader; closing per clause (a passing row per split and limit clause, a resting clause proved by its promise being in force, siblings in the same close allowed, cycles refused); `findPromise`, one lookup replacing five; `clause-rules.ts`; and the planner and planning rules teaching it. Diff against `main`: 68 commits, 48 files, +2384/−115, of which `lib/` is 16 files, +651/−35. The ADR held: opt-in, one document, one token. The brief's own promise ended held as five clauses in the registry.

## Getting to Done

- **Falsification found a real deadlock.** A plan making two promises where one rests on the other could never close: closing looked only at what was already enforced, so the dependent was refused and, since one refusal blocks the whole confirm, neither was ever enforced. Fixed by letting a sibling proved in the same close count, and refusing cycles. This is also why the code does something the brief never said (siblings count), recorded as such by the audit.
- **Falsification also found** that an indented bullet in an older brief was read as a clause and silently dropped a promise (a regression of the "older plans stand" promise), and that a clause could rest on itself or on a promise that does not exist with the registry check saying nothing. All three hypotheses were confirmed and fixed.
- **The cold audit found the plan would not have closed by its own rules.** Its live check row named a shell command where a test file belongs, so closing would have read it as a missing file; its own promise had no clauses in the registry; and a clause was proved by any file naming the promise, without naming the clause. Build Phase 6 fixed all three, so the plan's promise is held as five clauses each proved by a file carrying its clause token.
- **Close-out found two more breaks the phase-level runs had not.** The everyday suite, run once at the retrospective, failed in two places this plan caused: the admin's type check (two test fixtures lacked the new `clauses` field on `RowPurpose`) and the impl corpus test (two impl task lines, edited in Build Phases 5 and 6, carried code or a row label on the line, which `phase_summary: required` refuses). Both fixed in their own commits; the suite is then green (see Step 4 below). Phases ran only the tests they touched, and nothing ran the admin's type check or the corpus until here.

## What We Learned

- A plan has to be checked against its own rules before it closes; this plan shipped a closing rule it did not satisfy, and only a reader that did not build it noticed.
- A rule that changes a shared type (`RowPurpose`) breaks fixtures in other packages that no phase-level test run touches; the everyday suite is the first thing that sees them.
- A closing check that counts rows proves bookkeeping, not testing: "passing" is text, and until the test file carries the clause token, a clause can read proved while nothing tests it. The token-in-file check narrowed that gap, and proving by signal (`mark-first`) closes the rest.
- Falsification pays most where one rule composes with another (a promise resting on another promise, plus one refusal that blocks a whole confirm).

## What We'd Do Differently

- Run the plan against its own contract check and confirm in a dry reading at the end of Build Phase 3, not after the audit; the three defects Build Phase 6 fixed were all visible then.
- Run the everyday suite once before the falsification phase, so a shared-type change is caught while the phase that made it is still open.
- Make the Shape collector loadable under the work step's runtime; in Build Phase 5 it did not load and the review was read by hand, which is a review that did not run closing as done.

## Insights Worth Carrying Forward

- Opt-in by a brief frontmatter flag kept 150+ promises and every archived plan valid by construction; use it again for the next structural rule.
- A token in an existing cell (`clause:` in `For`) reached every reader of `purpose.promises` without a new column.
- Deferred, recorded as follow-ups rather than fixed here:
  1. A promise made only of resting clauses can never close (no row names the promise; the old row check fires).
  2. The MCP `declare_promise` `clauses` argument and the build review's use of the registry have no row.
  3. `change` and `replace` cannot carry clauses, so after declaration the registry copy cannot be edited and brief and registry reconcile only by withdrawing the promise.
  4. `split` and `limit` are treated identically (both need a passing row); the kinds are labels.
  5. `indusk plans start` fails under `indusk init --local` (it git-ignores `.indusk/`, and the start fails at `git add` on the brief). Its own bug plan.
  6. The Shape collector (`prepareShapeReview`) failed to load under `tsx` in Build Phase 5; worth a look.
  7. Biome flags an unused import in `lib/promises/store.ts`; it predates this plan.
  8. Health and standing do not read `rests-on` clauses, so "its health is that promise's health" holds only at close time; the plan page does not render the clause plan as such; "written before the ADR" has no ordering rule.
- Out of scope by the brief: proving a clause by its signal belongs to `mark-first`.

## Quality Ratchet

No missing Biome rule: the recurring errors were structural (a shared type's fixtures; an impl line carrying code), caught by the type check and the impl corpus test, both of which already exist. Nothing added to `biome.json`. The one Biome finding on the diff's neighbourhood (an unused import in `lib/promises/store.ts`) predates the plan.

**Shape numbers.** Across eight Shape items in the impl, Shape raised one finding that required a change (Build Phase 6: pull the clause-token loop out of `judge` into `clauseTokenRefusals`); it was acted on. It also produced three explicit reviewed-and-left decisions (Build Phase 4 `rowProofs`, Build Phase 5 test fixtures, Build Phase 6 `clauseTokenPattern`) and four "nothing to change" passes (Build Phases 1, 2, 3 and 5; the Build Phase 5 one was read by hand because the collector did not load). Findings a human judged wrong: 0 (the user has judged none wrong). No streak to report.

## Test and release notes

- Plan tests: 7 files, 107 tests pass (the clause, confirm, cleanup-gate, check, declare, purpose and close tests). `pnpm promises:check`: 153 promises, 144 enforced, 8 declared, none known-broken.
- Everyday suite (`pnpm test`), first run at close: 2 failures (admin type check, impl corpus), both caused by this plan and fixed; second run green: indusk-mcp 456 files / 3115 tests, admin 119 files / 763 tests, indusk 58, seat-holds 5.
- `indusk checks show`: no slow tests at landing; landing installs with `pnpm install:local`; a release command is declared but nothing is published or bumped by this plan, and the version stays. Publishing is the operator's.

Landed on main at 8235644f, 2026-10-16.
