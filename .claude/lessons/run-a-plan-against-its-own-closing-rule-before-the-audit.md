# A plan that ships a closing rule must pass that rule itself — run its own contract check and a dry confirm at the end of the phase that finishes the rule, not after the audit

plans-are-promises shipped a closing rule it did not satisfy: its live-check row named a shell command where a test file belongs, its own promise had no clauses in the registry, and a clause was proved by a file naming only the promise. Only the cold audit, by a reader that did not build it, noticed, and Build Phase 6 existed only to repair that.

Why: the builder reads the plan as what was meant, not what the rule reads, so the gap is invisible until something else applies the rule.

How to apply: when the phase that finishes a closing or contract rule closes, run `indusk promises contract <plan>` and a dry `indusk promises confirm` (in a clone) on the plan itself. Fix what it names before falsify, cleanup and audit. Pointer: plans-are-promises retrospective ("What We'd Do Differently").
