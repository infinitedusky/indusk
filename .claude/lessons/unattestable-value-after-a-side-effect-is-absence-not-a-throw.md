# A value that can't be computed after a side effect has already landed must be recorded as absent, never thrown

**Pattern:** code performs a mutating side effect (a commit, a write, a state transition), then tries to compute a value that describes what just happened (e.g. "the SHA of the commit I just made"). If that computation can fail — an edge case the side effect's author didn't anticipate — throwing after the side effect has already landed is wrong: the failure propagates out through a code path that looks like "nothing happened," when in fact the mutation already happened and is now unrecorded.

**Where it bit (dawn-workbench-execution, 2026-09-16):** the `Code-Commit:` trailer computation threw on an unborn code branch (no commits yet, so no HEAD SHA exists) — and it threw *after* the edit that created the situation had already applied. The exception propagated out through the tool call, past the point where the caller could distinguish "the edit failed" from "the edit succeeded but the follow-up bookkeeping choked."

**The rule:** if a value normally describes the outcome of a side effect that already happened, and that value cannot always be computed, the "cannot compute" case must be recorded as an explicit absence (or reported as a run-report failure) — never allowed to throw. Same shape as "commit-cadence failure is bookkeeping, never a gate": once the primary action is done, everything downstream of it must degrade to a report, not an exception.

**How to apply:** whenever writing code that describes a side effect after performing it (a commit SHA, a written-file digest, a post-action summary), ask "can this description ever be uncomputable, and if so, does my code currently throw there?" If yes, change it to record absence/failure explicitly instead.
