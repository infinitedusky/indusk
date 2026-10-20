# The retrospective's readiness check counts rows and rituals, not `promises confirm`'s own rules — run confirm before treating a plan as ready to close

In a-run-can-be-trusted, `checkRetrospectiveReadiness` passed (falsification, cleanup, audit, rows, promises all satisfied) while `indusk promises confirm` refused 26 things: 24 test files and 2 state-promise sites without the literal `promise: <name>` token, and then 12 clause signals with no real-run report. The gate and confirm disagree, and confirm is the one that decides the close (retrospective.md, Step 8a; highlight h-20261019-036).

Rule: before the retrospective is started or called ready, run `indusk promises confirm <plan>` (it writes nothing when it refuses) and fix the token gaps while the build is still open. Do not read a green readiness check as a green close.

Related: a-clause-rows-test-carries-both-the-clause-token-and-the-bare-promise-token-or-confirm-refuses; promise-token-one-name-per-line-and-a-state-promise-needs-a-code-site.
