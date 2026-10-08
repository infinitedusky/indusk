# A CLAUDE.md or docs rule saying "X also needs editing in Y" names an extraction candidate, not a reminder to follow

When a project's own convention doc has to say "if you add X, also update list Y" (e.g., two places register the same set of things, two functions parse the same format), that's a sign the duplication itself is the defect — not that the rule needs better compliance.

Why: dusk's `init.ts` and `update.ts` each kept their own list of registered hooks. Adding the stash guard meant editing both lists by hand, and the project's own `hooks/CLAUDE.md` had a rule telling future authors to remember to do so. The small-fixes plan's cleanup phase (2026-10-08) replaced both lists with one `HOOK_REGISTRATIONS` table that both files read, which made the "also update Y" rule structural instead of a thing to remember — the rule itself could then be deleted from CLAUDE.md.

How to apply: during a cleanup/consolidation pass, grep the project's own CLAUDE.md and lesson files for phrasing like "also needs X in Y", "don't forget to update Z", or "keep N and M in sync" — each one is a pointer at an existing duplication that a shared table, module, or single source of truth can likely absorb. Removing the rule from the docs (because it's now enforced by structure) is the signal the extraction actually worked.
