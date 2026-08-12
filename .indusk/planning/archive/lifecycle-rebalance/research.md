---
title: "Lifecycle Rebalance — moving rituals to the boundary that can answer them"
date: 2026-08-07
status: complete
---

# Lifecycle Rebalance — Research

## Question

InDusk's lifecycle currently runs four gates per phase (implementation, verification, context, document) and three rituals at plan close (falsify, cleanup, retrospective). Two complaints motivated this plan:

1. **Documentation is written per phase against a moving target** and rewritten every phase.
2. **Craft feedback arrives at plan close** — "you should have extracted that function" is told to the agent four phases after it wrote the code inline.

The question: **which checks belong at the phase boundary, which belong at plan close, and what decides?**

## Findings

### 1. The deciding principle: what does the question need in order to be answerable?

Investigating the `dawn-verify` plan's own history produced a clean criterion. A check belongs at the phase boundary when it can be answered from **the phase's delta**, and at close when it needs **the finished whole**.

Applying it splits four things that currently sit on the wrong side or don't exist:

| Check | Answerable from | Correct home |
|---|---|---|
| Are the claims true? | The phase's diff + tests | **phase** |
| Did this break something / ignore the instruction? | The phase's diff | **phase** |
| Is what was just written the right *shape*? | The code just written | **phase** |
| What's broken that nobody tested? | The whole attested system | **close** |
| What should the output decompose into? | The settled shape | **close** |
| What does a reader need to know? | Capture per phase, compose at close | **both, split** |

### 2. Evidence: documentation churn is measurable

`apps/docs/src/reference/cli/verify.md` was rewritten across **6 commits** during `dawn-verify` — phases 1, 2, 4, 6, 7, and the retrospective. Each per-phase Document gate documented a system that the next phase changed.

Sharper: the retrospective's docs audit found `--full-suite` **shipped and undocumented** — after five per-phase Document gates had passed. The per-phase gate did not achieve accuracy; the end-of-plan audit did.

**Confidence: high.** Measured from git, not recalled.

### 3. Evidence: falsification genuinely needs the whole system

`dawn-verify`'s falsification produced 7 confirmed defects. At least two were **structurally impossible to find earlier**:

- **A20** ("the verify ledger disables phantom detection") requires the ledger (Phase 1), phantom detection (Phase 4), and the chaining to all exist. At Phase 2 the hypothesis is unthinkable.
- **A22** ("an unreachable *ledger* baseline is suspicious, unlike a bootstrap baseline") requires the ledger chain to have a second link.

A per-phase falsification ritual would have run 7 times and found the shallow subset each time — which is the "candidate generation, not bounty hunting" anti-pattern the falsify skill explicitly warns against.

### 4. But the cleanup argument does NOT transfer — and that reshaped the split

The same reasoning was initially applied to cleanup and it was **wrong**, because "cleanup" covers two different activities:

- **Structural decomposition** — "what should this plan's whole output decompose into?" `dawn-verify`'s cleanup found `resolveImplPath` duplicated across `run` and `verify` — a duplication that *did not exist* until Phase 2 built the second copy. Rule of three. Genuinely terminal.
- **Local craft** — "you just wrote 80 lines inline that should be a named function; you extended a component that should have been a new one." Wrong **at the moment of writing**. No third occurrence to wait for.

**Evidence from the same plan, for the second category:** in Phase 2 the report rendering was written as inline `console.error` calls. That was a local craft miss. The cost surfaced in Phase 7, where `formatFinding` had to be extracted into `report.ts` *before the fix could be tested at all* — and until then nothing asserted the report's shape. A craft check at Phase 2 costs seconds; the same miss cost an extraction five phases later.

Counter-evidence for the *structural* category, from the same plan: `git.ts` was created as discovered work in Phase 1 precisely because the shape was already clear. Good local calls at the right moment are possible; what isn't possible early is judging the *finished* decomposition.

**Confidence: high.** Both examples are from one plan's own git history.

### 5. The gate vocabulary is closed in four places, and unknown headings fail SILENTLY

This is the blast-radius finding, and it constrains implementation more than anything else.

The four gate types are defined independently in:

| Location | Form |
|---|---|
| `src/lib/impl-parser.ts:5` | `type GateType = "implementation" \| "verification" \| "context" \| "document"` |
| `src/lib/impl-parser.ts:31` | `GATE_SUFFIXES` map |
| `hooks/check-gates.js:185` | regex `(Verification\|OTel\|Context\|Document)` + `WORKFLOW_GATES_BASE` |
| `hooks/validate-impl-structure.js` | four separate regexes (lines 191, 198, 205, 212, 543) |

**An unrecognized `#### Phase N Shape` heading does not error.** In `check-gates.js`, the gate regex simply fails to match, `currentGateType` retains its previous value, and every item beneath the heading is classified as whatever gate preceded it — usually `implementation`. Same fall-through in `impl-parser.ts`.

So adding a gate type without updating all four sites produces **silent misclassification**, not a loud failure. This is the same defect class as the repo's existing "hooks discovery is globSync on BOTH sides" and "change TS + every JS port together" gotchas.

There are **51 impl.md files** on disk (active + archived).

### 6. The existing extension mechanism is "author a phase," not "add a gate type"

Neither `/falsify` nor `/cleanup` added vocabulary. Both append a **phase** using the existing four gates (`### Phase N: Falsification — …`), detected by title prefix. That is how rituals extend the lifecycle today, and it required zero parser changes.

This matters because it suggests a third option for the per-phase checks: **they may not need to be plan structure at all.** `atdawn verify` is precedent — nobody writes "run verify" into a plan; the executor performs it at the boundary and reports. A check that runs at execution time and *emits findings* needs no gate heading, no validator rule, and no backward-compatibility story for 51 existing impls.

### 7. What exists to build on

- **A phase-boundary hook already exists** in both lanes: `runLoop`'s phase-close path (`probePhaseClose` at `loop.ts:272`) and `/work`'s per-phase completion order.
- **`atdawn verify` is built and unwired** — one caller (the CLI). Wiring it into `runLoop` is the agreed prerequisite.
- **The Tier-2 judgment checker is already roadmapped** — the Dawn master's horizon lists it as "a checker at the phase boundary reviewing the diff for judgment-invariants (broke something / ignored the instruction / real bug). The natural upgrade to component 6."
- **Domain extensions already own craft knowledge** — the cleanup skill delegates "what counts as a cohesive unit" to enabled extensions (`nextjs`: minimize `"use client"` boundaries; `react`: one component per file). A per-phase craft check would read the same source rather than inventing rules.

## Open Questions

- **Do the per-phase checks need gate headings at all**, or are they execution-time behaviors that emit findings (the `verify` model)? §6 suggests the latter; it decides whether this plan touches four parser sites and 51 files or none.
- **What does a Challenge/Shape finding *do*?** Block the phase (like a red gate), append items to the current phase (like falsify does at close), or report-only? Blocking is strongest but risks a judgment-model false positive halting an unattended run.
- **Does the per-phase craft check run on every phase, or only phases that wrote code?** A docs-only or schema-only phase has no craft surface.
- **Where does the Document capture live** so the close-out ceremony can compose from it — the impl's Document gate reworded, a per-phase note file, or the existing Forward Intelligence section?
- **Backward compatibility**: what happens to the 51 existing impls, and to plans mid-flight when this ships?

## Sources

- `git log` over `apps/docs/src/reference/cli/verify.md` — the 6-commit churn measurement
- `.indusk/planning/archive/dawn-verify/` — retrospective, matrix.md, and the A20/A22/renderer evidence
- `apps/indusk-mcp/src/lib/impl-parser.ts`, `hooks/check-gates.js`, `hooks/validate-impl-structure.js` — gate vocabulary sites
- `apps/indusk-mcp/src/lib/run/loop.ts` — the existing phase-boundary hook
- `.indusk/planning/indusk-v2-dawn/master.md` — Tier-2 judgment checker (horizon), enforcement ladder
- `apps/indusk-mcp/skills/cleanup.md` — extension-owned craft knowledge precedent
