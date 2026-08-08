---
title: "The Shape check — craft feedback at the phase boundary"
date: 2026-08-08
status: accepted
---

# The Shape check — craft feedback at the phase boundary

## Goal

**An agent that writes badly-shaped code hears about it in the phase that wrote it, not four phases later at plan close.**

Today the only craft feedback in the lifecycle is `/cleanup`, which runs after every phase is finished. That is correct for *structural decomposition* — you cannot judge a module boundary before the modules exist — but it is far too late for the ordinary case of "this inline block wanted to be a named function." In `dawn-verify`, a Phase 2 decision to write report rendering as inline `console.error` calls surfaced in **Phase 7**, where the code had to be extracted before the fix could be tested at all. When this ships, that finding arrives in Phase 2 and costs seconds.

## Y-Statement

**In the context of:**
executing a multi-phase plan through `/work` in the Claude Code lane, where each phase writes code and closes on a set of gates before the next phase begins.

**Facing:**
the fact that the only craft review in the lifecycle happens at plan close, so local shape problems — an inline block that wanted a name, a component doing two jobs, a client island inlined into a server component — are discovered after several more phases have been built on top of them, when the fix is larger, riskier, and sometimes blocking (a badly-shaped unit can be untestable until it is extracted).

**We decided for:**
a `Shape` check performed by the executing agent itself at the phase boundary, after verification is green and before the context gate, scoped to the files that phase changed, judged against the craft rules of the project's enabled domain extensions, with findings appended as ordinary checklist items to the current phase.

**And against:**
new gate types in the plan document (four independent definition sites, 51 existing impls, and an unrecognized `####` heading fails silently rather than loudly); heuristic detection such as file- and function-length thresholds (it cannot read craft rules written in prose, and would have missed the reference case entirely); a separately spawned checker agent (unnecessary when the executor is already a model, and it would import the thin lane's cost model into a lane that does not have it); making findings block the phase (a judgment call is fuzzier than the structural gates that block today, and a false positive halting an unattended run is a worse failure than a late extraction); and extending `/cleanup` to run per-phase (it would conflate intra-unit craft with inter-file decomposition, and the rule of three genuinely needs the finished shape).

**To achieve:**
craft feedback at the moment it is cheapest to act on, sourced from a standard the project sets rather than one the tool hardcodes, without adding a single new structure to the plan document or requiring any change to plans already in flight.

**Accepting:**
that the agent reviews its own work, so the review carries author bias; that judgment quality has no test and can only be calibrated by observation; that a per-phase review costs tokens on every phase that touches code; and that this ships only in the Claude Code lane, leaving `atdawn run` without craft feedback until a later plan ports it.

**Because:**
the extensions already express craft rules as prose, and prose rules require a reader that understands prose — which the executing agent already is, at no additional call. That single fact collapses the cost objection in this lane and makes the extension-sourced standard achievable rather than aspirational.

## Context

Full survey in [research.md](research.md); direction in [brief.md](brief.md); assertions in [test-plan.md](test-plan.md).

The deciding principle established during research: **a check belongs at the phase boundary when it can be answered from the phase's delta, and at close when it needs the finished whole.** Falsification and structural cleanup need the whole; craft does not.

Two facts from the codebase constrain the implementation:

- **Gate vocabulary is closed in four independent places** (`impl-parser.ts` ×2, `check-gates.js`, `validate-impl-structure.js`), and an unrecognized `#### Phase N Shape` heading does not error — `currentGateType` retains its previous value and the items beneath are silently misclassified as implementation items.
- **`/cleanup` already delegates craft knowledge to enabled extensions** rather than hardcoding it, and those rules are natural-language ("minimize `"use client"` boundaries, push them as deep as possible"; "one component per file for non-trivial components").

## Decision

### 1. Executor behavior, not plan structure

Shape adds no gate heading, no validator rule, and no change to any of the 51 existing impl.md files. It is a step in `/work`'s per-phase completion order, exactly as running the test suite is.

The precedent is `atdawn verify`: nobody writes "run verify" into a plan — the executor performs it at the boundary and reports. Plan documents describe *what the plan commits to*; they are not a place to enumerate the checks the executor always runs.

### 2. The executing agent performs the judgment — not heuristics, not a spawned checker

This is the decision that makes the rest work, and it turns on one observation: **in the Claude Code lane the executor is already a model.** Shape therefore requires no extra model call, no subagent, and no new capability. The library supplies facts (which files changed, which extensions are enabled, what their rules say); the skill instructs the review; the agent performs it inline.

Heuristics were rejected on a specific failure: the reference case from `dawn-verify` was **not an oversized file**. It was ~15 lines of inline rendering that should have been a named pure function — invisible to any line-count threshold, and identifiable only by asking "should this have a name and a test?" More decisively, extension craft rules are *prose*. A heuristic engine cannot consume them, so choosing heuristics would force re-expressing every rule as machine-readable config — duplicating knowledge and breaking the convention that extensions own tool knowledge.

A spawned checker agent was rejected as unnecessary here and premature: it imports the thin lane's cost model into a lane that does not have it. When Shape ports to `atdawn run`, that lane will need a real extra call — and that is the right place to pay for it, in the plan that does the port.

### 3. Shape is intra-unit; `/cleanup` stays inter-file

The operational line, which keeps the two rituals from arguing over territory:

| | Shape (per phase) | Cleanup (at close) |
|---|---|---|
| Question | Is this unit well-formed *as written*? | What should the finished output decompose into? |
| Scope | Within a file or unit | Across files |
| Needs | The code just written | The whole plan's output |

`dawn-verify` supplies one clean example of each. The inline renderer was wrong the moment it was written (Shape). `resolveImplPath` duplicated across `run` and `verify` **could not exist** until Phase 2 built the second copy (Cleanup).

The test plan pins this from both sides: A8 requires that Shape not flag cross-file duplication, and A9 requires that `/cleanup` still does — because "Shape ignores it" must not quietly mean nobody catches it.

### 4. Findings append to the current phase

A finding becomes an ordinary unchecked checklist item in the phase being worked. This reuses the mechanism `/falsify` and `/cleanup` already established — a ritual's output is work the plan then does — so nothing new is invented for how a finding becomes action, and the existing gate machinery makes it non-ignorable: a phase cannot close with unchecked items.

Blocking was rejected. Structural gates block because they are decidable; craft is a judgment, and an unattended run halted by a false positive is a worse outcome than an extraction landing one phase late.

### 5. A shared phase-boundary ledger answers "what did this phase change"

Shape needs the files the current phase touched. `/work` commits per item on a plan branch, but nothing records where a phase began.

Rather than build a Shape-specific marker, this introduces a **generic phase-boundary record** — `{plan, phase, sha, at}` appended when a phase starts — designed for the boundary rather than for one consumer. Future boundary checks (`verify` when it wires into this lane, `Challenge` when it lands) read the same artifact.

This is deliberate debt-avoidance: `dawn-verify` already ships a verify ledger, and adding a second, near-identical, single-consumer ledger would be the beginning of a family of them. The record is created on demand — absent means no phase has started, not that anything is broken — and, per the lesson from `dawn-verify`, **it is machine state and must be excluded from any "what else changed" comparison**, or it will silently satisfy the diff checks that other detections depend on.

### 6. Shape runs only after verification is green

Same ordering `/cleanup` already obeys. Restructuring code whose correctness is unproven is how a refactor hides a bug, and a phase with failing tests has a more urgent problem than shape.

### 7. Craft rules come from enabled extensions

Shape reads the enabled domain extensions' skills for what counts as a well-formed unit; it hardcodes nothing. Turning an extension off changes what Shape flags (A11). A library/CLI project with neither `nextjs` nor `react` enabled falls back to the general move — extract a function or module.

## Alternatives Considered

### New `#### Phase N Shape` gate type
Rejected. Four independent definition sites must be updated in lockstep, 51 existing impls would need consideration, and the failure mode is silent: an unrecognized heading misclassifies its items rather than erroring. High blast radius to make visible something the executor can simply do.

### Heuristic detection (file length, function length, duplicate blocks)
Rejected. Cheap and deterministic, but it cannot read prose craft rules, and it would have missed the very case that motivated the plan. Its appeal is testability, which the executor-judgment design recovers differently — by testing the *machinery* deterministically and declaring the judgment layer untestable with a calibration trigger (U1).

### A separately spawned checker subagent
Rejected for this lane, deferred to the port. Unnecessary when the executor is a model; it would add cost and a new capability to solve a problem the lane does not have.

### Blocking findings
Rejected. A judgment-model false positive halting an unattended run is worse than a late extraction. Appended items are non-ignorable without being fatal.

### Extending `/cleanup` to run per phase
Rejected. It conflates two activities that need different amounts of the system to exist, and it would push the rule of three into phases where the third occurrence has not happened — producing extraction churn as the shape moves.

## Consequences

### Positive
- Craft feedback lands where it is cheapest to act on, in the phase that produced the code.
- Zero change to plan structure, the validator, or existing plans — nothing to migrate.
- No extra model call in the Claude Code lane; the executor already is one.
- The project's craft standard stays in its extensions, settable per project.
- Establishes the phase-boundary record and the "checker emits findings" pattern that `Challenge` will reuse.

### Negative
- The agent reviews its own work — author bias is real.
- Judgment quality has no test; only calibration by observation.
- Per-phase review costs tokens on every code-touching phase.
- The thin lane gets nothing until a later plan ports it.
- Introduces one new piece of machine state (the boundary record).

### Risks
- **Shape becomes a nag.** If it fires on every phase, its items become noise to tick through and it is worse than nothing. Mitigation: "nothing to do" must be a recorded, common outcome (A4), and U1's trigger — two consecutive plans with human-judged-wrong findings reopens calibration as a falsification hypothesis.
- **Author bias weakens the review.** Mitigation: the rules come from *outside* the agent (the extensions), so it checks against an external standard rather than its own taste. The repo's own precedent supports the shape: `/falsify` is explicitly "same agent, different question — no persona, no separate session," and it has been productive.
- **The boundary record becomes a second ledger.** Mitigation: it is generic by construction and future boundary consumers read it rather than adding their own. Consolidate with the verify ledger if and when verify wires into this lane.
- **Scope creep into Cleanup's territory.** Mitigation: A8/A9 pin the line from both sides in the test suite, not just in prose.

## Documentation Plan

### Pages
- **New**: `apps/docs/src/guide/shape.md` — what the Shape check is, when it runs, how findings appear, and the intra-unit vs inter-file line against `/cleanup`.
- **Update**: `apps/docs/src/guide/cleanup-ritual.md` (or equivalent) — narrow its stated scope to inter-file structure and point at Shape for local craft.
- **Update**: `apps/docs/src/reference/skills/work.md` — the per-phase completion order gains a step.
- **New**: `apps/docs/src/decisions/lifecycle-rebalance.md` — this ADR at close.

### Diagrams
- Mermaid in `guide/shape.md`: the per-phase order (implementation → verification → **shape** → context → document) with the close-out rituals beside it, showing which question each answers.

### Changelog
- "Added the Shape check — per-phase craft review in `/work`, sourced from enabled domain extensions, with findings appended as checklist items to the phase that wrote the code."

### ADR in Docs
- Yes — `decisions/lifecycle-rebalance.md`, sidebar entry beside the Dawn decisions.

## References
- [research.md](research.md) — the deciding principle, gate-vocabulary blast radius, and the `dawn-verify` evidence
- [brief.md](brief.md) — accepted direction and the Shape/Cleanup boundary
- [test-plan.md](test-plan.md) — 11 assertions + U1's calibration trigger
- `.indusk/planning/archive/dawn-verify/` — the inline-renderer case (Shape) and the `resolveImplPath` duplication (Cleanup)
- `apps/indusk-mcp/skills/cleanup.md` — the extension-sourced craft precedent
- `.indusk/planning/indusk-v2-dawn/master.md` — Tier-2 judgment checker, the sibling this unblocks
