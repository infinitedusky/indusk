---
title: "Lifecycle Rebalance — the Shape gate"
date: 2026-08-07
status: accepted
---

# Lifecycle Rebalance — Brief

## Problem

Craft feedback arrives four phases too late.

When an agent writes eighty lines inline that should have been a named function, or extends an existing component instead of creating a new one, nothing says so until `/cleanup` runs at plan close. By then several more phases have been built on the bad shape, and the fix is larger and riskier than it would have been at the moment of writing.

`dawn-verify` is the evidence. In Phase 2 the report rendering was written as inline `console.error` calls. The cost surfaced in **Phase 7**, where `formatFinding` had to be extracted into its own module *before the fix could be tested at all* — and until that extraction, nothing asserted the report's shape. A check at Phase 2 costs seconds. The same miss cost an extraction five phases later.

There is no "wait for the third occurrence" argument here. A unit that should have been extracted is wrong the moment it's written.

## Proposed Direction

**Add a `Shape` check at the phase boundary in the Claude Code lane, as executor behavior rather than plan structure.**

After a phase's Verification items pass and before Context, `/work` reviews the code that phase wrote against the enabled domain extensions' craft rules. Findings are **appended as checklist items to the current phase**, which `/work` then executes — the same mechanism `/falsify` and `/cleanup` already use, so nothing new has to be invented for how a finding becomes work.

Three decisions shape it:

**Executor behavior, not a new gate type.** No `#### Phase N Shape` heading, no validator rule, nothing to retrofit into the 51 existing impl.md files. The precedent is `atdawn verify` — nobody writes "run verify" into a plan; the executor performs it at the boundary. This also dodges a real hazard: the gate vocabulary is defined independently in four places, and an unrecognized `####` heading **fails silently**, misclassifying its items as implementation items rather than erroring.

**Findings append to the phase.** Not blocking — a craft judgment is fuzzier than the structural gates that block today, and a false positive halting an unattended run is a worse failure than a late extraction. But not ignorable either: an appended item is unchecked, and a phase cannot close with unchecked items.

**Shape is intra-unit; Cleanup stays inter-file.** This is the line that keeps the two from colliding, and it is operational rather than a matter of taste:

| | Shape (per phase) | Cleanup (at close) |
|---|---|---|
| Question | Is this unit well-formed *as written*? | What should the finished output decompose into? |
| Scope | Within a file or unit | Across files |
| Examples | Inline block that wants a name; a component doing two jobs; a client island inline in a server component | Duplicate logic across modules; a rule copied into two lanes; the settled module boundary |
| Needs | The code just written | The whole plan's output |

`dawn-verify` produces one example of each: the inline renderer (Shape — wrong at Phase 2) and `resolveImplPath` duplicated across `run` and `verify` (Cleanup — the duplication didn't exist until Phase 2 built the second copy).

**Craft rules come from the enabled domain extensions**, not from this feature. The cleanup skill already delegates "what counts as a cohesive unit" to whatever extensions are on — `nextjs` ("minimize `"use client"` boundaries"), `react` ("one component per file for non-trivial components"), a library/CLI project falling back to "extract a function or module." Shape reads the same source, so a project's craft standard lives in one place.

## Context

Full survey in [research.md](research.md), which covers the broader rebalance this is the first slice of. The load-bearing findings:

- The deciding principle for *where* a check belongs: **what does the question need in order to be answerable?** The phase's delta, or the finished whole.
- Documentation churn is measured, not felt — `verify.md` was rewritten across 6 commits, and the retrospective audit (not five per-phase Document gates) caught a shipped-undocumented flag.
- Falsification genuinely needs the whole system: two of `dawn-verify`'s seven confirmed defects were structurally impossible to find before Phase 4.
- Gate vocabulary lives in four independent sites and fails silently on unknown headings — which is why this ships as executor behavior.

**Sequencing rationale:** Shape lands in the Claude Code lane first, before the thin lane and before the remaining rebalance work, so that every subsequent plan — including Dawn's own remaining components — is built with craft feedback already running. The tool that improves how code gets written should be in place *before* the next code gets written.

## Scope

### In Scope

- A `Shape` step in the `/work` per-phase completion order, after Verification, before Context.
- Deriving the files a phase actually changed, so the review is scoped to this phase's work.
- Reading craft rules from the enabled domain extensions rather than hardcoding them.
- Emitting findings as checklist items appended to the current phase.
- Recording a reasoned "reviewed, left as-is" when nothing warrants a change — a silent skip is indistinguishable from not running.
- Skipping phases with no code surface (docs-only, schema-only) explicitly rather than silently.

### Out of Scope

- **The thin lane.** `atdawn run` gets Shape in a later plan, once the Claude Code version has been dogfooded.
- **Challenge** (adversarial review of the diff for regressions / ignored instructions) — a separate judgment capability, its own plan, and the Dawn master already roadmaps it as the Tier-2 checker.
- **Documentation restructure** (per-phase capture, close-out composition) — separate plan.
- **Wiring `atdawn verify` into `runLoop`** — separate plan.
- **Changing `/cleanup`.** It keeps its structural, at-close scope; this plan only stops it from being the *first* time craft is mentioned.
- New gate types, validator rules, or any change to the 51 existing impls.

## Success Criteria

- A phase that writes an oversized inline block gets a checklist item naming the extraction, in that phase, before the next phase starts.
- A phase that writes well-shaped code adds no items and says so.
- A phase with no code surface is skipped with a stated reason.
- Craft rules trace to an enabled extension — turning an extension off changes what Shape flags.
- `/cleanup` at close still finds cross-file structural work, and no longer reports things Shape already fixed.
- Running a plan end-to-end with Shape on produces fewer cleanup findings at close than the same shape of plan did without it.

## Depends On

- Nothing. This is deliberately the independent slice — it needs no new boundary hook, no model-agnostic work, and no parser change.

## Blocks

- **Challenge / Tier-2 judgment checker** — shares the "checker at the phase boundary that emits findings" mechanism this plan establishes.
- **Shape in the thin lane** — ports this once dogfooded.
- The remaining rebalance (docs capture/compose, `verify` wiring) is independent but sequenced after, per the reasoning above.

## Open Questions for Review

1. **How does Shape decide "this phase's files"?** `/work` commits per item on a plan branch, but no phase-start SHA is recorded. Options: diff against the phase's first commit, diff against the working tree, or record a marker at phase start. The last is most precise and the most new machinery.
2. **Does Shape use a model call or heuristics?** Heuristics (file length, function length, repeated blocks) are cheap and deterministic but catch only the crude cases. A model call reads the extensions' rules and judges — much better recall, real cost per phase, and it's the same capability Challenge will need.
3. **What stops Shape from becoming a nag?** The cleanup skill's own warning is that over-extraction is a failure mode. If Shape fires on every phase, its items become noise to tick through. Worth deciding upfront what "nothing to do" looks like and how often it should be the answer.
