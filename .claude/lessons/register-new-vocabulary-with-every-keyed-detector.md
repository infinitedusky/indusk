# A new status or kind word must be registered with every detector keyed on that vocabulary, in the commit that introduces it

writing-skill introduced `published` as a paper status in Build Phase 1 and never added it to `archive-dead`'s `BLOCKING_STATUSES`. Six build phases and every gate passed; a plan carrying a published paper would have been swept as a dead draft after thirty days, moving the source the hotfix path publishes from. Falsification found it by reading the set, not by running anything.

Why: gates check the thing you built, not the detectors that read the vocabulary you extended. A status-keyed detector fails open — an unknown word is simply not blocking, not active, not protected — so the omission is silent until the detector runs against real age.

How to apply: when a plan adds a word to a fixed vocabulary (a status, a kind, a stage), grep for every `Set([` / `includes(` / switch over that vocabulary before closing the phase that adds it, and register the word in the same commit. In dusk the status-keyed detectors are `lib/planning/archive-dead.ts` (blocking set) and `tools/plan-tools.ts` (active set). Put the list in the ADR's Decision section so the checklist item exists before the phase does.
