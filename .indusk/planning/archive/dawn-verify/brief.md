---
title: "Dawn Verify — Verification of work Dawn didn't do"
date: 2026-08-04
status: accepted
---

# Dawn Verify — Brief

## Problem

Dawn's enforcement lives in the write path. `check-gates` is a `PreToolUse` hook — it sees an old string and a new string, decides, and refuses *before* the edit lands. That works in the two lanes Dawn controls: `atdawn run` (Dawn owns the executor) and Claude Code (a verified deny-capable hook seam).

It does nothing for the third tier. Work done in Cursor, in a plain `claude` session, or by hand arrives already applied, already checked off, with no before-state to diff against. The [enforcement ladder](../indusk-v2-dawn/master.md) names prompting as "alignment lubricant, never enforcement" for that tier, and puts the real enforcement here: **phase-boundary verification**.

The master calls this the keystone, and it's honest about why: *the whole integration strategy rests on one untested assumption — that phase-boundary verification is sufficient enforcement when Dawn doesn't control the agent.* Components 7 (agent integration) and 8 (Linear) both assume it. Neither is safe to plan until it's answered.

Research surfaced a sharper reason this matters than the master's framing suggested. **Nothing in the entire system has ever executed a test as part of gate enforcement.** `check-gates` reads the Test Trajectory's State column and trusts it. The goalpost guard forbids flipping a row to `skipped`/`blocked` — but explicitly allows `planned → written → passing` as honest progress. So the word `passing` in a markdown table is, today, an unverified self-report in *every* lane, including the ones Dawn controls. The trajectory is the system's core credibility artifact, and no machine has ever checked it against reality.

## Proposed Direction

**`atdawn verify <plan> --phase N` — a detector that reconstructs the phase boundary from git and reports every way the claimed state fails to match the actual state.** It renders a verdict; it does not act on the repo.

Five detections, in the order they'd catch a dishonest phase:

1. **Premature checkoff** — a phase advanced while a prior phase's gate items sit unchecked.
2. **Test-first duty skipped** — a row still `planned` at the phase where it was writable.
3. **Goalpost drift** — Asserts text edited, `Passes at` deferred, a row deleted, or terminality self-assigned since the baseline.
4. **Red tests** — a row whose State says `passing` but whose test does not pass.
5. **Phantom work** — an item checked off with no corresponding change in the diff since the baseline.

Detections 1 and 2 reuse `check-gates` unchanged, reached through the existing `probePhaseClose` primitive — which already solves the hard part of running an edit-triggered hook against committed state by synthesizing a checkoff envelope against a temp copy. Detection 3 reuses `checkGoalposts` with a persisted rather than in-process baseline. **4 and 5 are new**, and 4 is the one that closes the credibility gap above.

Three decisions shape the build:

**Detect and report; never act.** Verify exits non-zero with a report naming each violation and the baseline it judged against. Reverting and re-dispatch belong to component 7. This keeps the keystone independently testable and lets component 6 close without depending on agent plumbing that doesn't exist. It also respects a hard-won constraint: `dawn-hook-parity`'s A11 hypothesis was refuted mid-fix on exactly this ground — `git reset` unstages but cannot un-write a working tree. What has been written can only be accounted for, not unwritten. A detector that reports is honest about that; a reverter would have to relitigate it.

**Row-level test attribution.** The trajectory gains an optional test-reference column. Verify runs the project's suite and maps each `passing` row to its actual result, so it catches a red row inside an otherwise-green suite — not just "the suite is red." Suite-level detection alone would miss the precise failure this is for.

**A chained verify ledger for the baseline.** Each successful verify appends `{phase, sha, trajectory-hash}`; the next verify uses the previous record as its baseline; the first bootstraps from the merge base with the trunk. The baseline is a *byproduct* of the previous verification rather than a ceremony someone must remember before dispatching work — which matters because a forgotten pre-dispatch snapshot would mean no verification, silently, in exactly the case this exists for. Both halves have in-repo precedent: the append-only JSONL ledger from `pending-evals.ts`, and the merge-base candidate-fallback chain from `cleanup/oversized.ts`.

## Context

Full findings in [research.md](research.md). The load-bearing ones:

- `probePhaseClose` ([probe.ts](../../../apps/indusk-mcp/src/lib/run/probe.ts)) is the reusable primitive, including a subtlety worth not reimplementing: rows writable at N+1 are the *next* phase's duty, so the probe copy neutralizes them before asking check-gates.
- `.indusk/config.json` already carries a `verify` block (`testRunner`, `linter`, `typeCheck`) that is typed, written at init, and **read by nothing that executes**. Verify would be its first real consumer.
- Blast radius is small: `probe` has 1 non-test importer, `goalposts` 2, `trajectory/parser` 2.
- Exit-code vocabulary is set by `run`: `0` clean, `3` paused at a human gate, `1` stopped loud.

Maxim alignment: this is maxim 1 (*the discipline that makes agentic output trustworthy*) at its most literal, and maxim 5 (*evidence over assertion*) turned on Dawn's own core artifact. Maxim 4 (*earn its weight*) is the live risk — see below.

## Scope

### In Scope

- `atdawn verify <plan> --phase N`, registered like `run` (one commander entry, one lazily-imported `src/bin/commands/verify.ts`).
- The five detections above, with a report that names each violation and the baseline SHA it judged against.
- The chained verify ledger, with merge-base bootstrap and honest degradation when a link is missing.
- An optional trajectory test-reference column, backward-compatible with every existing plan (absent reference ⇒ that row is not red-test-checkable, and verify says so rather than passing it silently).
- Resolving a runnable test command from the existing `verify` config block.
- **An acceptance experiment**: a deliberately bad phase, executed by a real external agent Dawn does not control, that verify must catch. Per maxims 5 and 8, the component does not close on unit tests alone.

### Out of Scope

- **Reverting, re-dispatching, or any repo mutation** — component 7.
- **Agent integration** — no Cursor/Codex adapter; the acceptance experiment drives an external agent by hand.
- **Tier-2 judgment checking** — reviewing a diff for "did it break something / ignore the instruction" is the named horizon upgrade, not this plan.
- **Retrofitting test references** into archived plans.
- **Verifying uncommitted working-tree state** — deferred unless the acceptance experiment shows external agents routinely leave work uncommitted, which is an open question rather than an assumption.

## Success Criteria

The master's acceptance test is the bar: *catches a bad phase executed in Cursor — premature checkoff, goalpost drift, red tests.* Concretely:

- A phase where an item is checked off with a prior gate unchecked → verify rejects, naming the item.
- A phase where a trajectory row's Asserts text was edited → verify rejects, showing was/now.
- A phase where a row says `passing` and its test is red → verify rejects, naming the row and the failure.
- A phase where an item was checked off with no diff since baseline → verify rejects, naming the item.
- A clean phase → verify exits 0 and appends its ledger record.
- A plan with no prior ledger record → verify bootstraps from the merge base and says which baseline it used.
- **The keystone question gets an answer, in writing**: after the acceptance experiment, the master's component 6 row records whether boundary verification held or leaked — and component 7's shape follows from that result rather than from assumption.

A negative result is a valid outcome. If verification proves insufficient at the boundary, that finding is the plan's deliverable and component 7 becomes per-agent seam work — which is exactly the branch the master already anticipates.

## Depends On

- `.indusk/planning/archive/dawn-hook-parity/` — completed; established that `ask` is the default in both lanes and that the gate scripts run identically outside Claude Code.
- `.indusk/planning/archive/dawn-external-orchestrator/` — completed; provides `probePhaseClose`, `checkGoalposts`, the gate runner, and the CLI shape.

## Blocks

- **Component 7 — `dawn-agents`.** Its shape is a direct function of this plan's result: thin skin over a proven command if boundary verification holds, per-agent seam work if it leaks.
- **Component 8 — `dawn-linear`.** Posts verified state back to an issue; there is nothing to post until there is a verdict.

## Open Questions for Review

1. **Does this earn its weight (maxim 4)?** Verify running a full suite at every phase boundary is real friction, and on a large project a slow one. Mitigation options: scope the run to the tests the trajectory references, or make suite execution a flag. Worth settling in the ADR rather than discovering at impl.
2. **What counts as "the test" for a row without a reference?** Backward compatibility says absent ⇒ unverifiable, and verify should report that as a gap rather than pass it. That makes every existing plan's rows unverifiable until annotated — acceptable, but it means the detection only bites on new work.
3. **Which external agent runs the acceptance experiment?** Cursor is what the master names. A plain hookless `claude` session is cheaper to script and equally uncontrolled. Both are defensible; the second is more reproducible.
