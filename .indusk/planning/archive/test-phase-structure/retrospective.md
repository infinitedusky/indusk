---
title: "Test phases as structure — Retrospective"
date: 2026-08-12
status: complete
---

# Test phases as structure — Retrospective

## What We Set Out to Do

**Reading an impl, you should be able to see that the tests came first — and the system should enforce it.**

The plan started from a measurement, not a preference. Across 52 impls, **260 of 444 trajectory rows are `Writable at: Phase 0`**, and the gate that enforces test-first authoring compared `row.writableAt === advancingPhase`, where the advancing phase is never 0. The default path of the project's central discipline could not fire. Ever.

Underneath that was a shape problem. Every other discipline — verification, context, documentation, falsification, cleanup — is a section with checkboxes. "Write the tests first" lived as a column value on a table row. So the *deviation* had machinery behind it (Deferred Verification, rationale entries) and the *rule* had none.

The fix: a second kind of phase. `### Test Phase N` and `### Build Phase N` as two independent sequences, with Test Phase 1 mandatory, first, and serving as the register where every testing decision the plan made is recorded.

## What Actually Happened

Seven phases, 24 trajectory rows, 11 commits, 46 files, +4,630 / −763.

The plan shipped what it set out to ship, and the ordering held: one heading definition (Phase 1) → both phase kinds (Phase 2) → the register rules (Phase 3) → Gate A (Phase 4) → the skills and guide (Phase 5) → falsification (Phase 6) → cleanup (Phase 7).

What the plan did *not* anticipate is how much of the work would be finding things that were already broken.

**Three genuinely malformed files surfaced, none of them this plan's doing:**

| File | Defect | Handled |
|---|---|---|
| `react-native-support` | `## Phase N` (h2) — invisible to the parser, passing vacuously | Repaired (active plan) — which exposed a real Context-gate violation underneath |
| `archive/graphiti-infrastructure` | Same h2 defect | Recorded in A4's baseline (archived history) |
| `archive/handoff-multi-agent-section-shape` | Closes a fence with trailing text; CommonMark treats the rest of the file as code | Recorded in A4's baseline |

**And nine copies of a pattern, where the ADR counted seven.** The ADR's central argument was that the phase-heading regex existed in seven places and had to be consolidated before a second heading kind could be added safely. It was right about the danger and wrong about the count: an **eighth** copy lived inside `check-gates.js` as a local phase-*reference* regex, and a **ninth** — a whole second trajectory-row parser — sat beside it. Both were found the same way: not by reading, but by something silently ceasing to work.

## Getting to Done

### The plan's own thesis, landing on the plan

Three times, the failure mode this plan exists to prevent happened *inside* this plan.

1. **Build Phase 4 — Gate A silently stopped firing.** `check-gates.js` had its own `/^\s*Phase\s+(\d+)\s*$/i` for trajectory cells. When `Test Phase 1` became legal, every row parsed as `NaN` and Gate A matched nothing. No error. The gate just stopped enforcing.
2. **Build Phase 4 — gate completeness became dead code.** Moving the trajectory gates ahead of the completeness loop stranded that loop *after* the terminal `process.exit(0)`. Exit 0, no message — indistinguishable from "everything passed." It was caught by A16's case that asserts a **refusal**; an acceptance-only test would have gone green against a dead validator.
3. **Build Phase 7 — the two hook parsers had diverged twice.** Unifying them surfaced that besides the phase-reference regex, one of them never produced a `state` field at all. The moment they merged, every row read as non-terminal and Gate A blocked everything.

A duplicated parser does not announce itself when it falls behind. It just stops enforcing, and everything downstream reports success.

### Mistakes worth naming

- **I wrote a fake red and caught it.** A companion to A13 imported `lib/impl-headings.js`, which Phase 1 creates — so it failed to *load*, and the assertion never ran. Exactly what the plan forbids, in the plan that forbids it. Withdrawn from Phase 0 authoring, deferred into the register, written in Phase 1 with the module. The register's first real entry was authored against my own mistake.
- **A6 was a fake green.** Its assertion looked for the row ID in the refusal message — and the *gate-completeness* message happened to quote an unchecked Verification item containing that ID. It passed without Gate A ever firing. Tightened to require the phrase `test-first`.
- **`python3` heredoc writes silently reverted an entire round of Phase 2 work** — every file, including Edit-tool changes. Only caught ~20 minutes later when a hook threw `ReferenceError`. The whole phase was redone with Write/Edit and a `git status` check after each batch.
- **A temporal-dead-zone `ReferenceError` cost a debugging cycle.** The register constants sat below the hook's top-level validation call, so the hook exited 1 rather than the exit 2 that means "blocked" — a validator that crashes enforces nothing.

## What We Learned

**A test that asserts a refusal catches a disabled validator. One that asserts acceptance cannot.** This is the sharpest thing the plan taught, and it was demonstrated rather than theorised: gate completeness was dead code for a whole phase, and the only reason it surfaced is that A16 has a case demanding a *no*. Every new rule needs at least one test that fails when the rule stops running.

**A green for the wrong reason is worse than a red, because it retires the question.** A6 looked satisfied and wasn't. The fix was to pin the assertion to something only the intended mechanism produces.

**Authoring the tests first found a contradiction the ADR could not.** A1 ("an impl with no test phase is refused") and A4 ("every existing impl still validates") cannot both hold, because every existing impl has no test phase. Nothing in the research, brief or ADR surfaced it; it was visible within minutes of executing the assertions. The resolution — `test_phases: required` as a frontmatter opt-in — is the mechanism `trajectory: required` already used, and it is the hinge the entire zero-migration story hangs on.

**A4's premise was false, and that made it stronger.** "All 52 impls validate today" turned out to be wrong — nine already failed. Rewriting it as a *differential* guard pinning those nine by name is both honest and stricter: a new failure cannot hide inside an existing one. It then caught three separate regressions across the plan, including two malformed files nobody knew about.

**Backward compatibility belongs inside a function, not in a claim about one.** `phaseOrdinal` reduces to the raw phase number when a document has no test phase. That single property is why twelve files reading `writableAt`/`passesAt` did not have to change, and why `Phase 0` still orders before `Phase 1` by arithmetic with no special case.

**Linters cannot see runtime order.** Biome's `noInvalidUseBeforeDeclaration` is enabled and does catch the direct shape — but not a function that reads a `const` and is *called* at top level before it. Verified both ways during this retrospective. No ratchet change is available here; it is a hazard specific to hooks that run their work at module scope.

## What We'd Do Differently

**Count the copies with a script, not with a reading.** The ADR said seven; there were nine. The two it missed were the *phase-reference* pattern and a whole second parser — different enough in shape to slip a manual survey, identical in consequence. A grep for structural siblings would have found them before the plan started, and the fan-out estimate is what the plan's sequencing was built on.

**Never use `python3` heredocs to edit files in this environment.** They reported success and silently reverted. The cost was a full re-do of Phase 2. Write/Edit only, with `git status` verification after each batch.

**Put the "what does this rule do when its subject is absent?" question in the rule template.** Three of the five falsification findings were the same shape: a rule firing on a phase the document does not contain (A22), a probe assuming a phase's position (A20), a mask assuming a fence is closed (A18). "What if the thing I'm keyed on isn't there?" would have caught all three at authoring time.

## Insights Worth Carrying Forward

- Every new rule needs a test that asserts a **refusal** — it is the only kind that fails when the rule stops running.
- When a duplicated definition exists for structural reasons (a port, a mirror), pin it with a **count**, not a behaviour test. No behavioural test catches a divergence that has not happened yet.
- A shared module's shape must be the **union** of what its callers need. Merging two copies that differ in *fields* fails as silently as two that differ in logic.
- Prefer the boundary when authoring tests early: a test reaching its subject over HTTP, a CLI, a query or the filesystem is genuinely red on day one; one that `import`s its subject cannot be.
- A ritual never sees the phase it authored — falsification and cleanup each require a `/work` pass after them.

## Deferred Verification at Close

- **U1** (a fake red cannot be detected mechanically) — classified `scheduled-review`, no warning. Its mitigation was *strengthened during the plan*: falsification found that a test phase could omit its Verification gate entirely, which would have deleted the review this row depends on. A21 now requires that gate, so the compensating control is structurally enforced rather than merely described.
- **U2** (the structure makes plans easier to read) — no warning. The classifier reads it as `telemetry-alert`, which is a misfire: there is no metric and none is claimed. The mitigation is an honest manual observation — the next three plans record in their retrospectives whether any discipline was skipped without the document showing it. Left as-is rather than wiring up a metric that would exist only to satisfy a classifier.
- **Blocked rows: none.**
