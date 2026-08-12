# Test phases as structure

**Status**: accepted (2026-08-11), shipped 2026-08-12
**Full ADR**: [`.indusk/planning/archive/test-phase-structure/adr.md`](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/archive/test-phase-structure/adr.md)

## What was decided

Test authoring becomes a **phase**. An impl now has two independently-numbered sequences — `### Test Phase N` and `### Build Phase N` — ordered by their position in the document. Test Phase 1 is mandatory, first, and doubles as the **register** where every testing decision the plan made is recorded.

## Why — the measurement

This was not a taste argument. Across 52 impls, **260 of 444 trajectory rows are `Writable at: Phase 0`**, and Gate A compared `row.writableAt === advancingPhase` where the advancing phase is never 0. **The default path of the project's central discipline could not fire.**

The shape underneath it: every other discipline — verification, context, documentation, falsification, cleanup — is a section with checkboxes. "Write the tests first" was a column value on a table row. The *deviation* had machinery (Deferred Verification, rationale entries); the *rule* had none.

## The register

Test Phase 1 authors every test that can honestly be authored and records every one that cannot:

| Subsection | Records | Enforcement |
|---|---|---|
| `#### Deferred to Test Phase N` | why a later test phase exists | required for every test phase after the first |
| `#### Deferred to Build Phase N` | why one test is authored late | reviewed at the phase's close |
| `#### Regression Guards` | rows that pass the moment they are written | required, or the row is refused by name |

A deferral **may carry the deferred test's body** as a fenced code block, which turns a promise into something a reader can check. That made fenced blocks structural, with consequences (see below).

## Key tradeoffs accepted

**Zero migration, via an optional prefix.** `### Phase N` still means build phase N, so all 52 existing impls validate untouched — asserted over the real corpus, not a fixture. New impls opt in with `test_phases: required`; its absence is what exempts everything written before.

**Backward compatibility lives inside a function.** `phaseOrdinal` reduces to the raw phase number when a document has no test phase. That single property is why twelve files reading `writableAt`/`passesAt` did not change, and why `Phase 0` still sorts before `Phase 1` by arithmetic with no special case.

**The U1 control is a review, not a check.** A red that is really a load failure cannot be detected mechanically — the exit code is identical, and distinguishing them means parsing runner output, which this project refuses on principle (it is what kept tool knowledge out of `atdawn verify`). The compensating control is human judgement: Test Phase 1 cannot close until its deferred bodies have been reviewed. Falsification then found that a test phase could omit its Verification gate entirely — which would have deleted that review — so the gate is now **required**, making the control structurally enforced rather than merely described.

**A second phase vocabulary** in a system already carrying a lot of structure. Accepted because the alternative — widening Gate A's comparison and leaving the document unchanged — closes the enforcement hole for one line of code and leaves an impl exactly as illegible.

## Gate A, corrected

`===` became `<=` on the document timeline. The old form asked about a row at exactly one moment; miss it and no later phase asks again. A row left unwritten now blocks every subsequent checkoff, a test phase's own Verification gate also advances the obligation, and `Phase 0` counts as a phase that exists — which is what finally makes those 260 rows enforceable. A row naming a phase the document does not contain is a forward reference, not a missed obligation, and is skipped.

**Measured before shipping**: exactly two active plans became blocked, both legitimately — those tests were never authored.

## What consolidation actually cost

The ADR's central argument was that the phase-heading pattern existed in **seven** places and had to be consolidated first. It was right about the danger and wrong about the count: there were **nine**. An eighth copy (a phase-*reference* regex) and a ninth (an entire second trajectory-row parser) both lived in `check-gates.js`, and both were found the same way — not by reading, but by something silently ceasing to work. Trajectory-row parsing now has one definition under `hooks/`, pinned by a structural count.

## Rejected

- **Reuse `Phase 0` for test authoring** — seven impls already use it for late-discovered prerequisite build work; overloading it makes the two indistinguishable to readers and parsers alike.
- **Widen Gate A only** (`===` → `<=`) — adopted as part of the fix, rejected as the whole of it.
- **Migrate all 52 impls to `### Build Phase N`** — the optional prefix reaches the same end state at zero cost, and archived impls are history.
- **Give the test phase all four gates** — Context and Document would be filled with `(none needed)`, which is the noise that erodes gates into ceremony.
- **Detect fake reds by classifying runner output** — puts runner-specific knowledge in core. The right home is an extension, and a different plan.

## See also

- [Test Trajectory guide](/guide/test-trajectory) — authoring a test phase, the register, real red vs fake red
- [Trajectory parser reference](/reference/trajectory/parser) — module layout and the TS↔JS port correspondence
- [Lessons](/lessons/test-phase-structure) — what this plan taught that outlives it
