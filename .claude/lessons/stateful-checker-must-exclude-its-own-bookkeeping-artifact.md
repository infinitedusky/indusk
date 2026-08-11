# A stateful checker's own success artifact can silently disable it — exclude self-written bookkeeping from "what changed" comparisons

`.indusk/verify/ledger.jsonl` is tracked and gets committed by `atdawn verify` on a clean run. From the first clean verification onward, the ledger file itself appears in every later phase's diff — which permanently broke phantom-work detection's "nothing but impl.md changed" check. Verify was switching off its own phantom detector after its first success, and the symptom is indistinguishable from "everything is fine" (no error, no warning — just a detector that silently stops firing).

**The generalization:** any detection keyed on "what else changed since the baseline" must exclude its own bookkeeping output from that comparison, the same way commit-cadence logic already excludes `.indusk/eval` from staging. A stateful checker writing its own state is not passive — that write becomes an input to its own next decision unless deliberately excluded.

**The audit question for any stateful checker:** does the artifact I write become an input to my own next decision? If yes, and the check cares about "what changed," the checker's own output path needs an explicit exclusion — otherwise the checker's first success plants a landmine that only detonates on the *second* run, which is exactly the kind of gap a single-run test suite won't catch.

Related but distinct from [[detectors-must-distinguish-could-not-check-from-checked-and-failed]] (that's about misreporting an inability to check; this is about a detector going permanently blind to a specific class of change because of its own prior output).
