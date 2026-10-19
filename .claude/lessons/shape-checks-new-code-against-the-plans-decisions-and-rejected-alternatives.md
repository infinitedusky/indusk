# The Shape step re-reads the plan's own Decisions and rejected alternatives against the code the phase added — code drifts from them during a build and nobody re-reads them

In a-run-can-be-trusted, code added during the build quietly took alternatives the impl's own Decisions had rejected: a refusal that reported its own `upheld` verdict (Decisions 8 and 17 rejected a check that gives itself its own verdict, promises.ts:230), a hook-side regex reader of brief.md (Decision 9 rejected a second reader in the hook, validate-impl-structure.js:164), and signal attributions hard-coded to this plan's phases (promises.ts:241, land-recorder-signal.ts:23). The Shape step reviewed intra-unit craft and did not look at these (audit.md, highlight h-20261019-035).

Rule: at the Shape step, list the plan's Decisions that reject something and check each phase's new code against that list; a drift is either removed or justified in the phase's Forward Intelligence as a changed decision. Also search new package code for literals naming the current plan, phase or promise.

See .indusk/planning/a-run-can-be-trusted/audit.md.
