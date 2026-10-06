# Diagnose mass test failures by checking for a concurrent process before re-running

The eval agent grades a branch's commits by running that branch's tests in the same worktree the working agent is still using. Its `next dev` held the admin's `.next/` lock and produced 38-39 false admin HTTP failures in a person's concurrent `pnpm test` run (343/343 passed when run alone).

Why: a sudden wall of failures in one package, especially lock-file or port-bind errors, is the signature of a second process sharing the same worktree — not a real regression. Re-running blind either reproduces the same false failure or masks a real one if the concurrent process has since exited.

How to apply: when a test run produces a suspiciously large, clustered failure count, check for another process in the same worktree (`.next/` lock, a bound port, a running daemon) before re-running or trusting the result. This needs a structural fix beyond "remember to check" — evaluate against a snapshot/worktree copy, or make concurrent runs visible — tracked as open work, not yet built.

Related: when authoring a test plan, "the system must report X" should explicitly carry "even when the operation fails" — a Build Phase that only wired the happy path left the failure-reporting path untested until falsification caught it. State the failure-path requirement in the assertion itself, not as an implied extension of the happy path.
