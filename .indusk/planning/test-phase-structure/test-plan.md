---
title: "Test phases as structure — Test Plan"
date: 2026-08-11
status: accepted
---

# Test phases as structure — Test Plan

## Purpose

This document lists the behavioral assertions that, taken together, mean test phases are working. Each names the mechanism that will verify it.

Two things shape this plan's assertions more than usual:

- **Every assertion is about what happens to a person writing or executing a plan.** The "user" here is the developer or agent authoring an impl and running it. Observable behavior means: the write is refused with a message, the phase won't close, the plan runs to completion.
- **Parity is a first-class requirement, not a footnote.** The gate scripts are shared between `/work` and `atdawn run` (`run/gate.ts:142`), so a structural change lands in both lanes automatically — which makes it *assumable*, and therefore worth asserting. Where a row applies to both lanes, the mechanism says so.

## Behavioral Assertions

| ID | Assertion (user-visible behavior) | Mechanism |
|----|-----------------------------------|-----------|
| A1 | Writing a new impl that has no test phase is refused, and the message names what is missing. | vitest integration (validator over a fixture impl) |
| A2 | Writing an impl whose second test phase has no justification recorded in the first is refused, and the message names the unjustified phase. | vitest integration |
| A3 | Writing an impl whose every additional test phase is justified in the first is accepted. | vitest integration |
| A4 | **Every impl already in this repository still writes and validates with no edits.** | vitest integration over all 52 `impl.md` files on disk |
| A5 | A plan written the old way (`### Phase 1`) and one written the new way (`### Build Phase 1`) behave identically — same phases found, same gates enforced. | vitest unit (parser, both spellings) |
| A6 | Checking off build work while a test phase still has unauthored tests is refused, and the message names the unauthored test. | vitest integration (real-git fixture through the gate script) |
| A7 | A test that was supposed to be authored earlier and still isn't is caught when any later phase closes — not only at the phase it was due. | vitest integration |
| A8 | A test that passes the moment it is authored is accepted only when declared a regression guard; an undeclared one is refused, naming it. | vitest integration |
| A9 | A test phase cannot close while any test it authors has not been written. | vitest integration |
| A10 | **A plan containing test phases runs to completion under `atdawn run`**, closing each phase in order. | vitest integration (thin-lane loop over a fixture plan) |
| A11 | **The same violation is refused identically in both lanes** — a build item checked off with unauthored tests fails under `/work`'s hooks and under `atdawn run`, with the same message. | vitest integration, both lanes over one fixture |
| A12 | A plan created by `/planner` contains a test phase as its first phase. | vitest integration (template/skill assertion) |
| A13 | The phase heading has exactly one definition in the source — a second copy fails the build. | vitest structural (single-definition scan) |
| A14 | Deferral reasons written in the first test phase are the only place they are required; an impl carrying no separate rationale section still validates. | vitest integration |
| A15 | A test file whose import cannot be resolved fails to load **even when every test in it is skipped** — so skipping is not a way to defer a test whose subject does not exist. | vitest integration (fixture file + real runner, exit code only) |
| A16 | A deferral entry that carries the deferred test's body is accepted, and the body is not mistaken for a checklist item or a gate. | vitest integration (parser over a fixture impl) |

## Untestable Assertions

| ID | Assertion | Reason untestable | Compensating control |
|----|-----------|-------------------|----------------------|
| U1 | An authored test fails **on its own assertion** rather than on a missing import or a syntax error. | Distinguishing the two requires reading and interpreting the test runner's output. This project refuses runner-output parsing on principle — it is what kept tool knowledge out of `atdawn verify`, which reads exit codes only. A generic "why did this fail" classifier is a different capability, not this plan's. | **Test Phase 1 cannot close until its deferred test bodies have been reviewed** — each one read against two questions: will it compile at the phase it names, and does it assert the behavior it claims? The evidence is the code block in the impl, which persists and can be re-read, rather than terminal output that is gone the moment the run ends. This is a **human-judgment checkpoint before any build phase opens**, and a pause point under autopilot. A8 covers the mechanically-detectable half (green on arrival); `verify`'s red-test detection independently catches a row claiming `passing` that isn't. |
| U2 | The new structure makes plans easier to read and follow. | The complaint that motivated this plan — "I look at an impl and see sections to phases, sort of followed, sort of not" — is a judgment about legibility, and there is no oracle for it. One plan is an anecdote. | Recorded as a **metric, not a claim**: the next three plans authored under this structure note in their retrospective whether any discipline was skipped silently. Trigger: if a discipline is skipped without the document showing it, the structure has not solved the problem it was built for. |

## Notes

- **A4 is the plan's stop condition.** If existing impls cannot be made to validate unchanged, the optional-prefix approach has failed and the plan should reconsider rather than start migrating 52 files. It is deliberately an assertion over the real repository rather than a fixture — a fixture would test the trick, not the corpus.
- **A8 encodes a lesson from `lifecycle-rebalance`.** Two of its rows (A3, A9) asserted pre-existing behavior and passed the moment they were written; the impl claimed they were "authored RED," which was false. A test green on arrival is legitimate — it is a regression guard — but it must say so, because otherwise the plan's record of its own test-first discipline is wrong.
- **A11 is the parity row that matters.** A10 only shows the thin lane doesn't crash. A11 shows both lanes refuse the same thing the same way, which is the property component 2 established and this plan must not break.
- A13 is structural rather than behavioral by design: no behavioral test can catch a divergence between two copies that agree today. It is the same instrument as `shared-resolution.test.ts`.
- **A15 is load-bearing and currently only reasoned, not proven.** The design says a deferred test's body belongs commented in Test Phase 1 rather than `.skip()`ped in a file, because module resolution precedes test collection. That reasoning is the basis for correcting `/work`'s existing advice, so it gets an assertion against the real runner rather than an assumption. If it turns out `.skip()` *does* survive an unresolvable import, the guidance correction is wrong and the deferral shape should be reconsidered.
- **A15 needs no output parsing.** It asserts the file fails to load, which is an exit code — consistent with the runner-agnostic rule, and deliberately not an assertion about *why*.
