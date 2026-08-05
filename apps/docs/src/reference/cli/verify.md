# `atdawn verify`

Phase-boundary verification for work Dawn **didn't** execute.

```bash
atdawn verify <plan> --phase <n>
```

## Why this exists

Every other enforcement in InDusk lives in the write path. `check-gates` is a `PreToolUse` hook: it sees an old string and a new string, decides, and refuses *before* the edit lands. That works in the two lanes Dawn controls — [`atdawn run`](./run.md), where Dawn owns the executor, and Claude Code, whose PreToolUse seam is verified deny-capable.

It does nothing for the third tier. Work done in Cursor, in a hookless `claude` session, or by hand arrives already applied, already checked off, with no before-state to diff against. `verify` is the enforcement for that tier: **detection at the phase boundary, reconstructed from git.**

It also closes a gap that was never tier-specific. Nothing in InDusk has ever executed a test as part of gate enforcement — `check-gates` reads the Test Trajectory's `State` column and trusts it, and the [goalpost guard](./run.md) deliberately permits `planned → written → passing` as honest progress. So the word `passing` has always been an unverified self-report, in **every** lane. `verify` is the first thing that checks it against a test run.

## What it detects

| Detection | Catches |
|---|---|
| **premature-checkoff** | A phase advanced while an earlier phase's gate item is still unchecked |
| **test-first** | A trajectory row still `planned` at the phase where it was writable |
| **goalpost** | Assertion text edited, `Passes at` deferred, or a row deleted since the baseline |
| **red-test** | A row marked `passing` whose referenced test does not pass |
| **phantom** | An item checked off with no corresponding change in the diff |

## It never repairs

`verify` renders a verdict and exits. It performs no revert, no re-dispatch, no repair. The only write it ever makes is appending its own ledger record — and only on a clean verdict.

This is deliberate. Reverting belongs to Dawn's agent-integration component, and it inherits a constraint established the hard way during `dawn-hook-parity`'s falsification: `git reset` unstages, but it cannot un-write a working tree. **What has been written can only be accounted for, not unwritten.** A detector that reports is honest about that.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Clean — the phase's claims hold; a ledger record was appended |
| `1` | Rejected — one or more findings, or a bad invocation |

A rejecting run is designed to fail a calling script or CI step.

## The baseline chain

`verify` needs a "before". Since Dawn wasn't running when the work happened, it reconstructs one from a chained ledger at `.indusk/verify/ledger.jsonl`:

```json
{"plan":"dawn-verify","phase":2,"sha":"a1b2c3d","trajectory":"sha256:…","timestamp":"2026-08-05T…"}
```

The baseline for phase N is the record for the **highest phase below N** of that plan. With no such record, `verify` bootstraps from the merge base with the trunk.

```mermaid
flowchart LR
    MB(["merge-base<br/>with trunk"]) -->|"bootstrap<br/>(no ledger yet)"| P1["verify --phase 1"]
    P1 -->|"appends<br/>{phase:1, sha}"| L1[("ledger")]
    L1 -->|"baseline"| P2["verify --phase 2"]
    P2 -->|"appends<br/>{phase:2, sha}"| L2[("ledger")]
    L2 -->|"baseline"| P3["verify --phase 3"]

    style MB stroke-dasharray: 5 5
```

The chain is a **byproduct of verifying**, not a ceremony you have to remember before dispatching work. That matters: a pre-dispatch snapshot command would fail silently in exactly the case this exists for — the time you forgot to run it.

### Two failure-safety rules

**A rejecting verify records nothing.** Only a clean verdict appends. A rejected phase must never become the yardstick the next phase is measured against.

**A corrupt ledger refuses loudly.** A malformed line throws rather than being skipped. Skipping would shorten the chain, and a shortened chain degrades into bootstrap mode — producing a confident report against the wrong baseline. That failure is indistinguishable from success from the outside, so it has to be loud.

This is the deliberate **inverse** of the [pending-eval queue](./run.md), which writes its marker *before* the risky operation so a crash leaves a gap rather than a double-eval. Different danger, opposite rule.

## Requirements

`verify` refuses to run outside a git repository rather than reporting a clean phase — a workbench root is deliberately not a git repo, and silence there would mean verifying nothing while appearing to verify everything.

## See also

- [`atdawn run`](./run.md) — the controlled-lane counterpart, where gates enforce in the write path
- [Test Trajectory](../../guide/test-trajectory.md) — the table `verify` checks its claims against
