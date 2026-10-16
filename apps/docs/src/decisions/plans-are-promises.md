# Plans are promises — a promise stated as clauses, closed per clause

**Decided 2026-10-16.** Full ADR: `.indusk/planning/archive/plans-are-promises/adr.md`.

## Goal

**A plan can state each of its promises as clauses, plan every clause's signal and tests before the ADR, and close only when every clause is proved.**

A promise was one sentence with no parts, so a promise of five clauses with one tested read as kept.

## What was decided

- **Opt-in.** `clauses: required` in a brief's frontmatter holds that plan to clauses; every promise it makes needs at least one. Plans without it close as they always did.
- **Clauses in the brief and the registry.** Sub-entries under a promise in the brief (a split, a limit, or "rests on" another promise); `indusk promises declare --clause` writes them into the promise's registry file; the contract check refuses a brief and registry that disagree.
- **The clause plan is `test-plan.md`.** One section per promise, one subsection per clause with a `Signal:` line, read by `clause-plan.ts`. No new document, so the roughly sixty sites that name the test plan are unchanged.
- **Rows name clauses.** `clause: <promise>/<clause>` in a row's `For` cell, read by both copies of the row-purpose reader; the clause's test file carries the same token.
- **Closing per clause.** A promise with clauses is proved when each split and limit clause has a passing row whose test file carries the clause token, and each resting clause's promise is in force or proved in the same close. Cycles and self-resting clauses are refused.

## Tradeoffs accepted

- The document is still called the test plan in the lifecycle and the cockpit; "clause plan" is prose until a rename.
- A third token grammar in the `For` cell, kept in two copies guarded by a parity test.
- "Proved" still means a row marked passing whose file carries the token; proof by signal is `mark-first`'s.
- "Promises that share code share a plan" is planner guidance, not a check.
- Known gaps recorded in the retrospective: a promise of only resting clauses cannot close; `change` and `replace` carry no clauses; health does not yet read resting clauses.

## Alternatives rejected

A clause-plan file per promise (the lifecycle, admin and parity pins all name one test plan); clauses only in the brief (the promise outlives the plan); a `Clause` column on the trajectory (every reader of `For` would need a second cell); making clauses mandatory at once (every open and archived plan would be refused).

## See also

- [Briefs guide](/guide/briefs), [test trajectory guide](/guide/test-trajectory), [promises CLI](/reference/cli/promises).
