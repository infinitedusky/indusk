---
title: "The PR Shape — what a mergeable change carries"
date: 2026-09-04
status: accepted
---

# The PR Shape

**What this is:** the definition Day is built toward. A pull request is
approvable when it carries a fixed set of artifacts. Each artifact proves one
thing, each is produced by one discipline, and each gets a binary verdict. The
reviewer reads artifacts and verdicts, never the diff.

This document is the anchor. The review surface renders it, every check along
the way exists to produce one row of it, and every Day sub-plan closes one gap
in it. Change the shape here first; everything else follows.

## Premise

- A passing test is evidence only if the test is trustworthy. TDD needed the
  same person checked twice, once for the test and once for the code, and the
  check was a reading. An agent goal-seeks toward "passes", so the builder's
  testimony is worth nothing and a reading does not scale.
- So the check moves into the artifacts: red observed before green, test bound
  to claim, claims approved by a human before code exists, every later change
  to a claim visible.
- **Neither side reads code.** The author and the reviewer both need to
  understand software: trade-offs, what a claim should say, what is missing.
  The shape catches dishonesty and drift. It does not catch poor judgment;
  internally consistent and bad is still bad, and that stays a human call.
- **The boundary is fixed, the path is free.** The PR requires the artifacts.
  How a developer produces them is their own business. InDusk is the
  opinionated path that checks along the way, and each artifact pulls its
  discipline in behind it: red-before-green pulls tests-first, the plan pulls
  planning, promise health pulls telemetry. A team that reaches the shape
  another way has met the standard.

## The artifacts

| # | Artifact | Proves | Produced by | Verdict | Today |
|---|----------|--------|-------------|---------|-------|
| 1 | **Plan** (brief, ADR) | Intent and trade-offs, approved by a human | `/planner`; frontmatter status | present / absent | exists |
| 2 | **Contract** (the claims) | What "done" means, approved before code | test-plan → Test Trajectory `Asserts`; impl `approved` | approved / unapproved | exists as a prose column + frontmatter |
| 3 | **Amendment log** | Every claim changed after approval, with its reason | verify's goalpost guard | per amendment: reasoned / unreasoned | partial: `detectGoalpostDrift` detects, records nothing |
| 4 | **Red observed** | The test failed against code without the change | Test Phase 1; verify against the ledger baseline | red observed / never red / unverified | **missing**: the `State` cell is prose the author writes |
| 5 | **Green at head** | The claim is upheld now | verify `detectRedTests`, exit codes | upheld / not upheld / unverified | exists |
| 6 | **Binding** | The test dies when the claimed behavior is broken | mutation of the claim's code, per row | bound / unbound / unverified | **missing**: done by hand once (Dawn A8 matrix, 8/8 kills) |
| 7 | **Uncovered surface** | Changed code no claim exercises | per-row coverage, runner-specific, extension-owned | list; each entry acknowledged / unacknowledged | **missing** |
| 8 | **Probe log** | The reviewer's questions and their executed verdicts | the review itself | per probe: red (finding) / green (new claim) | **missing**: `/falsify` is author-side |
| 9 | **Promise linkage** | Production invariants the change touches, and their health | Midnight | per promise: enforced / known-violated, with incidents | **missing**: Midnight brief |
| 10 | **Process record** | Phases closed in order, gates **ran** at every checkoff (a ledger line per hook invocation with its verdict) and passed, rituals run, commits scored | hooks, gate ledger (`hook-cwd-independence`), eval rail, phase-boundary record | present / absent | exists; amended 2026-09-14 — a gate whose absence is indistinguishable from its approval is not a gate, so "passed" without "ran" is absent |

Rules that apply to every row:

- **Verdicts are binary.** Never a score. A score is a target the builder
  goal-seeks against; a verdict terminates.
- **"Unverified" is a verdict, not a pass.** A check that could not run reports
  that it could not run. It never reports the reassuring case (lesson on file:
  a detector must never report "could not check" as either a pass or a
  failure).
- **Nothing in the table is produced by the builder asserting it.** Rows 1 and
  2 are human approvals; rows 3 through 7 and 9 are machine observations; row 8
  is the reviewer's; row 10 is infrastructure's.

## What the reviewer does

1. **Completeness.** Read the claims, in English. Is this what I wanted built?
   Nothing about the code answers this. It is the one question that stays
   human, and the one where a rubber stamp does the most damage.
2. **Evidence.** Read the verdicts on rows 3 through 6. Not the tests.
3. **Probe.** Ask "what about X". The system authors the scenario and runs it.
   The answer is executed, never argued. Red is a finding; green becomes a
   claim. The reviewer's questions accrete into the contract.
4. **Uncovered surface.** For each file on row 7, acknowledge it or demand a
   claim. This is the only reading anyone does, and the report says why.
5. **Promise health.** Row 9: which invariants this change touches, and whether
   any is currently violated.

**Stopping rule:** approve when every row has a verdict, every uncovered file
is acknowledged, and you have no more probes. A diff review has no stopping
rule, because there is always something to say about code. This one does.

**Amended 2026-09-14.** "The verdicts are green" is not enough on its own.
The Process record's gate ledger has to show that the gates *ran* at every
checkoff, because the workbench-trust-fixes retrospective found eight
checkoffs that passed a gate which had silently failed to load. The reviewer
reads the ledger before the verdicts; a checkoff with no ledger line makes
the Process record absent, and the stopping rule does not start.

## What it is not

- **Not a diff review.** No finding is admissible unless it is tethered to a
  claim, a probe, or an uncovered file. Untethered code-quality findings are
  what makes existing AI review destructive: no stopping rule, and a score the
  builder chases.
- **Not a new process.** The path is free. The boundary is fixed.
- **Not a substitute for judgment.** See the premise.

## Acceptance test for the shape itself

Plant one defect per row class on a real project and hand the bundle, without
the diff, to someone who did not write the code:

- a test that was born green (row 4)
- a claim silently weakened after approval (row 3)
- a test asserting the wrong property under the right name (row 6)
- a changed file no claim touches (row 7)
- a promise the change violates (row 9)

Every plant caught, no false positive on an honest PR, and the reviewer reaches
a verdict without opening the diff. This is dawn-verify's matrix pattern
applied one layer up.

## Open questions

- **Where the write surface lives.** Probe, approval, and acknowledgement are
  writes. The admin UI is read-only by decision; the candidates are the admin
  UI gaining a narrow write path, a VS Code extension, or CLI plus files on
  disk (maxim 6). Day's first ADR settles this.
- **What a row's code is.** Binding (row 6) mutates "the claim's code", and
  rows do not name code sites today. Candidates: a `Code` column beside `Test`,
  Midnight's `promise:` annotations, or derivation from row 7's coverage.
- **Row 7 is runner-specific.** Coverage per test file belongs to the testing
  extension; core reads a file-level report and never parses runner output.
