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
  - hook-cwd-independence
  - dawn-workbench-execution
  - admin-ui-phase-progress
  - day-promises
  - day-monitor
  - day-claim-evidence
  - day-claim-binding
  - day-uncovered-surface
  - dawn-agents
  - day-probe
  - day-pr-review
  - indusk-release
---

# Day — Master Plan

**Day is the review layer**: it packages what the loop produced into the
[PR shape](pr-shape.md) and gives the reviewer a job that does not require
reading code. Dawn is *who executes*, Day is *what the human does at the
boundary*. Together they are InDusk V4, shipped as one thing; Day is the
destination the streams in the root master lead to.

**The frame (2026-09-17).** Day's core primitive is the **contract**: what a
human approves before code exists, and what the artifacts then prove was met
honestly. A contract has two kinds of clause. *Change clauses* are true once
the change lands and retire with the plan; *promise clauses* are commitments
the system keeps for as long as it runs and any later change can break. Steps
5–7 and 9 make change clauses honest at review time. Step 4a builds promise
clauses as a primitive (registry, states, links, promotion at close, the
change rule). Step 4b — what was called Midnight — is the telemetry half of
the promise system: it detects a promise violation in the running system,
records the root cause as an incident, and wakes the owning plan. Step 10 is
where a reviewer reads both kinds of clause without opening the diff.

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
| 0 | **The shape defined** | all | **accepted 2026-09-10** | `pr-shape.md` accepted; every later component names its row | [pr-shape.md](pr-shape.md) |
| 1 | **Trust the substrate** | 10 | **closed 2026-09-10** (24 rows green, falsified, cleaned, retrospective, archived); `plan/workbench-trust-fixes` awaits merge. Retrospective found the gates themselves cwd-relative and silently off from a subdirectory → [hook-cwd-independence](../hook-cwd-independence/brief.md), brief draft, recommended before component 2 | Zero silent wrong answers from run / cleanup / eval in every workbench shape (its brief) | [workbench-trust-fixes](../archive/workbench-trust-fixes/brief.md), Phase A |
| 2 | **The floor runs in workbenches** | 5 | **closed 2026-09-16** (19 rows green, falsified 3, cleaned, retrospective, archived) — `run` and `verify` execute across the plan-root/code-root split for one declared repo, evals name their repo; matrix held 5/5, 0 false positives (`archive/dawn-workbench-execution/matrix.md`) | dawn-verify's 6-cell matrix re-run inside a workbench, 5/5 caught, 0 false positives | [dawn-workbench-execution](../archive/dawn-workbench-execution/brief.md), Dawn 6.5 |
| 3 | **Execution visible live** | 10 | **closed 2026-09-17** (37 rows green, falsified 6, cleaned, retrospective, archived) — one `lifecycle.ts` read by `list_plans`, the retrospective gate and the admin; three live bars; phases keyed `{kind, number}` through Shape and the boundary record; `ui prune` cleared 2,296 dead entries. Follow-on: the parity corpus must exclude the plan in flight (root master, "Small, not a step") | Active phase and per-stage gate states update without reload; Test/Build sequences render | [admin-ui-phase-progress](../archive/admin-ui-phase-progress/brief.md) |
| 4a | **Promise clauses — the contract's second kind of clause, as a primitive** | 9 | brief 2026-09-17 (the writing half exists in looper; numero has the typed contract and no promises) | Numero and dusk each hold enforced promises with code sites and tests, `indusk promises check` in CI; a closing plan promotes a claim; a change touching a promise's site without naming it is recorded as such | [day-promises](../day-promises/brief.md) |
| 4b | **Monitor — promise violation detection and root cause, from the running system's telemetry** | 9 | brief rewritten 2026-09-17 (was `midnight`; exists nowhere — looper's nine incidents were all recorded by hand, none detected) | An alert from the running system (local under Jaeger counts) names the promise that broke; the incident records the root cause and where it ran; the owning plan reopens | [day-monitor](../day-monitor/brief.md) |
| 5 | **Claims proved honestly — red observed, amendments recorded** | 3, 4 | not started; also takes the per-invocation gate ledger (`.indusk/gates.jsonl`) that `hook-cwd-independence` cut and no step picked up | A born-green row and a silently amended claim are both reported; an honest plan is clean | `day-claim-evidence` |
| 6 | **Binding — the test dies when the behaviour it claims is broken** | 6 | not started; needs 4a (a promise's code site is one candidate for "the claim's code") and 5; carries the amendment-log rule (2026-09-14): no decision crosses a phase boundary until it is written into the plan, and `/work` checks the Amendment log is current at every fresh-phase hand-off — a decision that lives only in the conversation is testimony | A test asserting the wrong property under the right name reports *unbound*; a real test reports *bound* | `day-claim-binding` |
| 7 | **Uncovered surface — changed code no claim exercises, acknowledged** | 7 | not started | A changed file no row exercises is listed; acknowledgement is recorded and survives re-verification | `day-uncovered-surface` |
| 8 | **Any executor — a phase dispatched to a non-Claude agent is verified the same way** | 10 | not started; absorbs `cursor-support` (archived 2026-09-14): Cursor as an executor | Dawn 7's own: a phase dispatched to a non-Claude agent is verified and its verdict recorded | [dawn-agents](../indusk-v2-dawn/master.md), Dawn 7 |
| 9 | **Probe — a reviewer's question becomes an executed scenario** | 8 | not started | A reviewer's question becomes an executed scenario with a verdict; green accretes as a new row | `day-probe` |
| 10 | **The review — a verdict without reading the diff** | 1–10 | not started; carries `documentation-phase-gate`'s question (archived 2026-09-14): where docs land is decided by the bundle, not per phase. **Carries the gate ledger** (2026-09-15, from `hook-cwd-independence`'s cut): every hook invocation appends one line to `.indusk/gates.jsonl` (hook, file judged, verdict, exit code, time) through one `_gate-ledger.js` hook module with a `lib/gates/ledger.ts` twin, registered with every "what changed" detector and given `merge=union` in the commit that first writes it; the Process record (artifact 10 of the shape) is its reader, so it is built when the reader is | The shape's own acceptance test: one plant per row class, all caught, approval reached from the bundle alone | `day-pr-review` |

**Small steps** — not in the sequence, runnable whenever a gap opens:

| # | Item | Status | Acceptance test | Sub-plan |
|---|------|--------|-----------------|----------|
| S1 | **A release names its plans** | brief draft 2026-09-17 (from the 1.50.0 release, which took four attempts) | `indusk release minor` on a trunk with landed plans writes one release commit naming them and a dated changelog heading with nothing edited by hand; each named plan's retrospective gains "Released in"; `check_health` names landed-and-unreleased plans | [indusk-release](../indusk-release/brief.md) |

## Order

**0 → 1 → {2, 3} → {4a, 5, 7} → {4b, 6} → 8 → 9 → 10**, with S1 and the
`hook-cwd-independence` close-out any time. Re-ordered 2026-09-17 with 0–3
closed.

- **0 first, on paper.** Nothing else is scoped until the shape is accepted;
  every component below names the row it closes.
- **1 gates everything** for the reason the root master gives: signals that
  lie are not worth building on. (Closed.)
- **2 and 3 built the floor** — execution in the shape every real project
  has, and a live view of where a plan stands. (Closed.)
- **4a, 5 and 7 are three independent lanes.** They share no code: 4a is the
  promise registry and its checks; 5 is two `verify` detections and the gate
  ledger; 7 is a coverage report the testing extension owns. Any two can run
  at once in separate worktrees.
- **4b needs 4a** and local Jaeger, which is installed: the telemetry half
  watches promises the primitive defines, in any running system — a local
  run is one. Dash0 is only for the `deployed` source.
- **6 needs 4a and 5.** Binding mutates "the claim's code", and a promise's
  code site is one of the two candidates for what that code is (the other is
  a `Code` column); its verdict shape follows 5's. 4b and 6 can run at once.
- **8 before 9** so that the probe runs against work any executor produced.
- **10 last**, and it is where the shape is proven, not where it is designed.

**On parallel execution.** Two lanes at once is achievable today by hand: two
sessions, worktree-per-plan, `indusk agent list` flagging a shared tree, and
the planning documents merging once at landing (Step 10 of the retrospective;
`master.md` conflicts are resolved by hand there, so two lanes should not
both edit this table mid-flight). Running lanes without a human per session is
step 8's territory (Dawn 7, "any executor"), not something the sequence can
assume before it exists.

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
- **Whether `indusk run` reads the promise-violation signal** — resolved
  2026-09-17 as step 8's decision, not step 4b's: the sequence already puts
  promises before "any executor", and an unattended executor is the consumer
  that would want the signal.

## Sub-plans

| Plan | Component | Stage |
|------|-----------|-------|
| `day-promises` | 4a — promise clauses as a primitive: registry, states, links, promotion, the change rule | brief 2026-09-17 |
| `day-monitor` | 4b — the telemetry half: span link, violation counts, `monitor`, alert → incident → root cause → reopen (was `midnight`) | brief rewritten 2026-09-17 |
| `day-claim-evidence` | 5 — observed red, amendment log, gate ledger | not created |
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
