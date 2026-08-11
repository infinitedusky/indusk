# A detector must never report "could not check" as either a pass or a failure — audit every tool on what it returns when it cannot do its job

When a checking tool cannot perform its check, it must say so explicitly. Returning the shape of *success* is the obvious bug; returning the shape of *failure* is the same bug pointed the other way, and it is much easier to ship because red feels "safe".

**The failure mode.** `atdawn verify` ran each referenced test file through the project's test command and treated a non-zero exit as "the test failed". A missing file also exits non-zero. Pointed at its own plan in a monorepo — where the paths were package-relative and the command ran from the repo root — it produced **16 false `red-test` findings while every test actually passed**. Nothing was observed; a failure was asserted anyway.

The same codebase had already gotten the other direction right in three places (an unreferenced row reports `unverified` not `passing`; a corrupt ledger refuses instead of degrading into bootstrap mode; a non-git root throws instead of reporting `[]`). The principle was understood and applied inconsistently, which is the normal way this bug appears — not as ignorance, but as an unaudited surface.

**The audit question**, worth asking of any detector, linter, health check, or verifier: *when this cannot do its job, does it say so, or does it return the shape of an answer?* Enumerate the ways it can be unable to check — missing file, unparseable input, unreachable history, absent config, unsupported runner — and confirm each produces a distinct "unverified/unknown" outcome rather than being folded into pass or fail.

**Concrete shapes this takes:**
- Stat a file before executing it; a missing path is unverified, not failing.
- Distinguish "the input does not parse" from "the input parses and violates the rule" — a value that parses to `NaN` silently satisfies neither `=== x` nor `<= x`, so it drops out of every filter while still looking normal to a human.
- Make silence-on-inability *loud* when a prior run proves the thing existed. Same input, opposite meanings: an unreachable baseline is benign when bootstrapping and suspicious when a previous run demonstrably read it.
- Report the count of unchecked items in the output every time, so the gap is visible rather than implied by absence.

**Related:** the corresponding failure for *tools that report nothing* — a library returning `[]` on a non-git root made a whole ritual vacuous there. Same class, quieter symptom.
