# Adding a field to a shared type breaks fixtures and corpus tests in packages no phase runs — run the everyday suite once before falsification, not first at close

plans-are-promises added `RowPurpose.clauses`. The admin's type check (two test fixtures lacking the field) and the impl corpus test (two impl task lines carrying code) failed, and neither is in any phase's test command. They surfaced only when `pnpm test` ran at the retrospective.

Why: phase Verification runs the plan's own files and `vitest related` on changed sources. A shared type's other consumers, and corpus-wide rules over every impl, sit outside both.

How to apply: after changing a shared type or a rule read over all impls, run `pnpm test` (type checks included) once before the falsification phase, while the phase that made the change is still open. Related lesson: a Test-Phase red commit must fail only on its new assertion. Pointer: plans-are-promises retrospective ("Getting to Done").
