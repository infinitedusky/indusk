# When one refusal blocks a whole batch, test the rule composed with itself across siblings — a promise resting on a sibling of the same plan could never close

In plans-are-promises, closing a promise that rests on another looked only at what was already enforced. A plan making two promises, one resting on the other, deadlocked: the dependent was refused, and since one refusal blocks the whole confirm, neither was ever enforced. Falsification found it; the build phases and their tests did not.

Why: each rule was tested alone against a pre-existing base. The failure needed the rule to meet itself inside one batch.

How to apply: for any check that refuses a whole close or batch on one failure, write a row where the checked items depend on each other (sibling, cycle) and see whether the batch can ever pass. Fix by judging siblings under a chain and refusing cycles by name. Pointer: plans-are-promises retrospective, Build Phase 4 (A17).
