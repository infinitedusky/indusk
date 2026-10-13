# Ask "what does this gate do in workbench mode?" of every new gate at ADR time — each gate in brief-as-the-contract had an untested early return for workbench plans

In this repo a plan can live in a workbench (documents at the root, code in a repo on `plan/<name>`), and a gate written for a normal plan tends to `return` early for the workbench path without anyone noticing.

Why: the cold audit of brief-as-the-contract found that approve, reapprove and accept all returned before the looks checks for a workbench plan, so a look still proposed or an interface change with no look listed went through there; three promises silently did not hold in that mode, and no test row ran a workbench layout (`audit.md`, 'What else would have to change'). Build Phase 8 closed it (`LooksWhere`).

How to apply: when the ADR names a gate, add the question and an answer (the same check, a stated exemption, or refused by name); give it a row that runs over the package's workbench fixture (`helpers/versioned-workbench.ts`, `LAYOUTS` with `describe.each`), not only the normal-mode fixture.
