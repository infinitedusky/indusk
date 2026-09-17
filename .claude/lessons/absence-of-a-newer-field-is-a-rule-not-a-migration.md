# When a schema gains a field, absence of the field in old records is a rule to state, not a migration to run

**Pattern:** a data format gains a new field (a ledger record, a queued job) because a new capability needs it. The instinct is to write a migration that backfills the field on every existing record. The alternative — cheaper and often more correct — is to treat absence itself as meaningful: "this record predates the feature" is already the fact the field's presence would encode, so state that as an explicit rule instead of manufacturing a value nothing observed.

**Where it used it correctly (dawn-workbench-execution, 2026-09-16):** the verify ledger gained `codeSha` (workbench code-repo HEAD) and queued evals gained `repo` (which repository received the commit). Both are read as "written before the split existed" and handled by a stated rule — bootstrap the code repo from its root commit; attribute the commit by the newer HEAD — rather than a data migration. Nothing existing changed, and the rule was testable on day one because it never depended on migrating historical data correctly.

**Why it generalizes:** a migration can be wrong in ways that are hard to verify (what *was* the code HEAD for a pre-split commit? there's no ground truth). A stated rule for the absent case only has to be internally consistent, and it's testable immediately by constructing a record that lacks the field — no historical data needed.

**How to apply:** when a schema gains a field, before reaching for a backfill migration, ask "can I state what absence means and derive correct behavior from that, instead of computing a retroactive value?" If yes, write the rule and a test that constructs an absent-field record; skip the migration.
