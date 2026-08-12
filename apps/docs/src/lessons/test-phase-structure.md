# Lessons — Test phases as structure

What this plan taught that outlives it. The decision itself is in [decisions/test-phase-structure](/decisions/test-phase-structure).

## A test that asserts a refusal catches a disabled validator. One that asserts acceptance cannot.

This is the sharpest thing the plan produced, and it was demonstrated rather than reasoned.

Mid-plan, a reordering moved the gate-completeness loop *after* the hook's terminal `process.exit(0)`. The loop became unreachable. Gate completeness stopped running entirely — **exit 0, no message, indistinguishable from "everything passed."** It surfaced only because one test case demands a *no*: an impl with an open Verification gate must be refused. An acceptance-only suite would have gone green against a dead validator, and stayed green.

**Rule: every new rule needs at least one test that fails when the rule stops running.** A suite of acceptances measures nothing about whether the enforcement exists.

The same logic applies to a parity suite. A TS↔JS parity test fed only refusal fixtures passes just as happily against two implementations that refuse everything; the fixtures must be paired.

## A green for the wrong reason retires the question

One assertion looked for a row ID in a refusal message. It passed — but the message came from a *different* rule that happened to quote a checklist item containing that ID. The rule under test never fired.

A red is loud and gets investigated. A false green is silent and closes the file. Pin the assertion to something only the intended mechanism can produce — a distinctive phrase from that rule's own message, not an identifier that could appear anywhere.

## Duplicated definitions diverge silently, and in more than one way at once

Two hand-ported copies of a trajectory parser existed for a structural reason (hooks are plain JS and cannot import a `.ts` module). Over time they diverged **twice**:

1. One kept a local phase-reference regex. When a new phase spelling became legal, it parsed every row as `NaN` and the gate keyed on those rows matched nothing. No error.
2. One never produced a `state` field at all — invisible until the copies were merged, at which point every row read as non-terminal and the gate blocked everything.

Neither announced itself. A duplicated parser that falls behind does not fail; **it stops enforcing, and everything downstream reports success.**

Two consequences:
- **Pin a deliberate duplicate with a count, not a behaviour test.** No behavioural test catches a divergence that has not happened yet. Assert that exactly one definition exists.
- **A shared module's shape must be the union of what its callers need.** Merging copies that differ in *fields* fails exactly as silently as merging copies that differ in logic.

## Authoring the tests first finds contradictions a design document cannot

Two assertions in the same test plan were mutually exclusive, and nothing in the research, brief or ADR surfaced it: *"an impl with no test phase is refused"* and *"every existing impl still validates"* cannot both hold when every existing impl has no test phase.

It became visible within minutes of executing them. The resolution — a frontmatter opt-in, so the rule fires only when a document asks for it — turned out to be the hinge the entire zero-migration story hung on.

Related: a regression guard's premise was simply false. "All 52 files pass today" was wrong; nine already failed. Rewriting it as a **differential** guard — pinning the known failures by name and asserting the set never grows — was both honest and stricter, because a new failure cannot hide inside an existing one. It then caught three real regressions, including two malformed files nobody knew about.

## Put backward compatibility inside a function, not in a claim about one

When ordering had to change from "compare numbers" to "compare document positions", the compatibility property was written into the ordering function itself: *a document with none of the new construct reduces to the old behaviour exactly.*

That one property is why a dozen call sites did not have to change, and why the guarantee is verified by every existing test rather than asserted in a comment. Compatibility expressed as a code path holds; compatibility expressed as a promise drifts.

## Ask what each rule does when its subject is absent

Three of five falsification findings were the same shape:

- a rule demanding an entry in a section the document does not contain
- a probe assuming a phase sits at a position it does not occupy
- a mask assuming a fence that is opened is also closed

*"What if the thing I am keyed on isn't there?"* would have caught all three at authoring time. The absent case is where rules either become unsatisfiable instructions or silently stop applying.

## Linters cannot see runtime order

A hook that runs its work at module scope threw `ReferenceError: Cannot access 'X' before initialization` — a `const` declared below a function that read it, where the function was *called* at the top level above.

Biome's `noInvalidUseBeforeDeclaration` is enabled and catches the direct form; verified during this plan's retrospective that it does **not** catch the indirect one. No lint rule closes this. For any module that executes work at import time, declaration order is a runtime property — put shared constants above the code that runs.

And the failure is worse than it looks: a validator that crashes exits non-zero with a stack trace rather than the specific code meaning "blocked". **A validator that crashes enforces nothing.**

## Process

- **A ritual never sees the phase it authored.** `/falsify` and `/cleanup` each write a phase; each needs a `/work` pass afterward. Budget for both.
- **Some editing tools lie about success in this environment.** A round of work was silently reverted — including tool-based edits — and discovered ~20 minutes later only because a hook crashed. Verify writes landed (`git status`) after each batch rather than trusting the report.
