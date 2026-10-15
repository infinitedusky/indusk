# The decision page published at plan close says what was built and marks decided-but-unbuilt parts as planned — and the audit is read before the retrospective is written

**The rule.** A decision page copied from the ADR at close describes the shipped system. A part of the ADR that was decided and not built (a run at landing, a watcher pass, route derivation, a mitigation) is marked 'planned, not built' on the page, with what happens until it is, and the brief's expectation that depended on it is amended or carried to a named follow-up. The retrospective is written after reading `audit.md`, not before.

**Why.** ui-promises published a decision page that said the look check runs at landing and on the admin's watcher pass and that undeclared routes are reported. None was built; only 'on demand' existed. The builder's falsify, cleanup and shape rituals did not catch it; the audit's cold reader did, and the page was corrected afterwards (`apps/docs/src/decisions/ui-promises.md`, commit 6d96bb99). The brief's 'a drift is caught without a person looking' stayed on the plan's promise list until the retrospective carried it as a follow-on.

**How to apply.** When copying an ADR to the docs site, diff each decision against the code (grep for the caller of the thing it says runs). Anything with no caller is written 'decided, not wired'. Where an unbuilt decision carried an expectation or a promise, name the follow-up plan in the same edit so the close states what is and is not held.

See `.indusk/planning/archive/ui-promises/retrospective.md` ('Insights Worth Carrying Forward').
