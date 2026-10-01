# Before calling a trajectory row "unwritten" or flagging a test-first violation, check the test file exists and run it against the pre-fix source — the State column can just be stale bookkeeping

During release-ritual, two separate sessions inherited a false T8/T9 "test-first violation" — the trajectory table's State column still said `planned` for rows whose test files actually existed and had already been authored RED. The table was never updated after the tests were written; nobody had actually skipped test-first.

Why it matters: a trajectory State column is bookkeeping, not ground truth. Treating "the table says planned" as "the row is unwritten" produces a false violation report, and a false violation is expensive — it costs a session (or, as here, two sessions on different machines) chasing a problem that doesn't exist.

What to do instead: before concluding a row is unwritten or a phase violated test-first, verify directly:
1. Does the test file named in the row actually exist?
2. Check it out against the pre-fix commit (`git checkout <fix-commit>^ -- <test-file>`) and run it — does it fail the way a RED test-first row should?

If both check out, the row was written correctly and the State column is simply stale — fix the bookkeeping, don't report a violation. Only when the file is genuinely absent or doesn't fail pre-fix is there a real test-first gap.

See `.indusk/planning/release-ritual/` retrospective.
