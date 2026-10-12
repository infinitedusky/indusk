# A promise clause like "exact and pattern entries treat it the same way" is a conjunction over every input class (path, port, case, query, trailing slash) — falsify the sentence's own wording before writing the test plan and give each class its own row

In browser-template-claims one sentence ("an exact entry and a pattern entry treat both the same way") hid four separate defects — path, default port, case, query — which surfaced one at a time across Build Phase 2 falsification and Build Phase 3 after the cold audit instead of as rows in the original test plan. A parity or "every X" clause is only proven when each input class it spans has its own row; one row per clause proves the clause for one class.

How to apply: when writing the test plan, split every "the same way / every / any" clause into the input classes the matcher or compiler handles, and write a row per class for each side of the parity. Do it before Test Phase 1, not in falsify.

See: .indusk/planning/archive/browser-template-claims/retrospective.md. Related: write-a-promise-sentence-from-what-its-rows-can-prove.
