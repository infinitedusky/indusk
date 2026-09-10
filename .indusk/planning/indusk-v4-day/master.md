---
title: "Day — Master Plan"
date: 2026-09-04
status: living
# Ordered children — the whole V4 sequence, in build order, so the admin
# sidebar shows it under one parent. A name with no folder yet renders as a
# placeholder. Day owns only the day-* plans; the others keep their own
# homes (dawn-* are also declared under indusk-v2-dawn and appear in both
# groups — the UI groups one level deep, and a link declared in two parents
# is two links, not a drift).
subplans:
  - workbench-trust-fixes
  - dawn-workbench-execution
  - admin-ui-phase-progress
  - midnight
  - day-claim-evidence
  - day-claim-binding
  - day-uncovered-surface
  - dawn-agents
  - day-probe
  - day-pr-review
---

# Day — Master Plan

**Day is the review layer**: it packages what the loop produced into the
[PR shape](pr-shape.md) and gives the reviewer a job that does not require
reading code. Dawn is *who executes*, Midnight is *what authority a test has*,
Day is *what the human does at the boundary*. Together they are InDusk V4,
shipped as one thing; Day is the destination the streams in the root master
lead to.

Open this file to answer "where are we." The shape itself lives in
[pr-shape.md](pr-shape.md) and is the authority on *what* is being built;
[thesis.md](thesis.md) is the *why* both documents assume.

## Rules for this plan

1. **One component, one sub-plan, closed before the next opens.** A sub-plan
   that grows a second component's work has failed. Split it.
2. **Every component names the shape row it closes and its acceptance test
   before work starts.** "Done" means the plant for that row is caught.
3. **Status is honest at the component level.** A sub-plan can be
   `impl complete` while its component is partial. Say so, in the table.

## Components

| # | Component | Shape rows | Status | Acceptance test | Sub-plan |
|---|-----------|------------|--------|-----------------|----------|
| 0 | **The shape defined** | all | **draft 2026-09-04** | `pr-shape.md` accepted; every later component names its row | [pr-shape.md](pr-shape.md) |
| 1 | **Trust the substrate** | 10 | brief draft | Zero silent wrong answers from run / cleanup / eval in every workbench shape (its brief) | [workbench-trust-fixes](../workbench-trust-fixes/brief.md), Phase A |
| 2 | **The floor runs in workbenches** | 5 | brief draft | dawn-verify's 6-cell matrix re-run inside a workbench, 5/5 caught, 0 false positives | [dawn-workbench-execution](../dawn-workbench-execution/brief.md), Dawn 6.5 |
| 3 | **Execution visible live** | 10 | brief draft | Active phase and per-stage gate states update without reload; Test/Build sequences render | [admin-ui-phase-progress](../admin-ui-phase-progress/brief.md) |
| 4 | **Promises and monitor** | 9 | brief, rewritten 2026-08-28 | A production alert names the promise that broke; the owning plan reopens | [midnight](../midnight/brief.md) |
| 5 | **Evidence per claim** | 3, 4 | not started | A born-green row and a silently amended claim are both reported; an honest plan is clean | `day-claim-evidence` |
| 6 | **Binding** | 6 | not started | A test asserting the wrong property under the right name reports *unbound*; a real test reports *bound* | `day-claim-binding` |
| 7 | **Uncovered surface** | 7 | not started | A changed file no row exercises is listed; acknowledgement is recorded and survives re-verification | `day-uncovered-surface` |
| 8 | **Any executor** | 10 | not started | Dawn 7's own: a phase dispatched to a non-Claude agent is verified and its verdict recorded | [dawn-agents](../indusk-v2-dawn/master.md), Dawn 7 |
| 9 | **Probe** | 8 | not started | A reviewer's question becomes an executed scenario with a verdict; green accretes as a new row | `day-probe` |
| 10 | **The bundle and the reviewer** | 1–10 | not started | The shape's own acceptance test: one plant per row class, all caught, approval reached from the bundle alone | `day-pr-review` |

## Order

**0 → 1 → {2, 3, 4} → {5, 6, 7} → 8 → 9 → 10.**

- **0 first, on paper.** Nothing else is scoped until the shape is accepted;
  every component below names the row it closes.
- **1 gates everything** for the reason the root master gives: signals that
  lie are not worth building on. Only trust-fixes Phase A gates; Phase B
  trails.
- **2, 3 and 4 run in parallel.** They share no code. 4 is the only one that
  adds a loop fed from outside the repo, which is why the root master puts it
  ahead of Dawn 7.
- **5, 6 and 7 need 2**, because every real project is a workbench and each
  of them is a `verify` detection. They can proceed alongside 4.
- **8 before 9** so that the probe runs against work any executor produced.
- **10 last**, and it is where the shape is proven, not where it is designed.

## Open decisions

- **Where the write surface lives.** Probe, approval and acknowledgement are
  writes. The admin UI is read-only by decision (`/decisions/indusk-admin-ui`).
  Candidates: a narrow write path in the admin UI, a VS Code extension, or CLI
  plus files (maxim 6). **Day's first ADR settles this**, under
  `day-claim-evidence`, because acknowledgement (row 7) is the first write.
- **What a row's code is.** Binding mutates "the claim's code" and rows name
  only test files today. Settled in `day-claim-binding`'s ADR; candidates in
  the shape's open questions.
- **Dawn 8 (Linear).** Recommended: defer. The bundle is a document and needs
  no coordination substrate to be reviewed; pull 8 in when a team wants
  `@dawn` on an issue.
- **Midnight's relationship to Dawn** stays Midnight's ADR's question. Day
  consumes both regardless of the answer.

## Sub-plans

| Plan | Component | Stage |
|------|-----------|-------|
| `day-claim-evidence` | 5 — observed red, amendment log | not created |
| `day-claim-binding` | 6 — mutation per row | not created |
| `day-uncovered-surface` | 7 — coverage per row, acknowledgement | not created |
| `day-probe` | 9 — reviewer question → executed scenario | not created |
| `day-pr-review` | 10 — bundle, review surface, `/review` role | not created |

Create each with `/planner` when its turn comes, not before.

## History

Founded 2026-09-04. The starting observation: the tooling InDusk built to
make models write better code has done its job, and what remains unclear is
what people need to do to *check* the result. Existing AI review reads the
diff against general quality priors, has no stopping rule, and produces a
score the builder chases. Day replaces the reading with a shape.
