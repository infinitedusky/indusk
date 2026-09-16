# Dawn Workbench Execution — Lessons

**Plan:** `.indusk/planning/archive/dawn-workbench-execution/` · **Decision:** [Dawn Workbench Execution](../decisions/dawn-workbench-execution.md) · 2026-09-16

The plan taught `indusk run` and `indusk verify` the plan-root/code-root split
of a one-repo workbench. The design held on the first try; almost everything
below was learned from the fixtures, the falsification pass and the cleanup.

## A fixture that hand-sets what production must derive blinds every test to whether derivation runs

Every fixture in the plan set `verify.testCommand` by hand. Fifteen trajectory
rows went green. Runner detection had never once run in a workbench — `init`
detected against the project root, which in a workbench is the wrapper and holds
no `vitest.config.ts` — so no real workbench had a `verify.testRunner`, and a
split verify without one reports **every row unverified under a clean verdict**.

The failure mode is clean-by-silence, and the fixture's hand-set value is
exactly what makes the suite unable to notice. Ask of each fixture knob: *is
this something the code under test is supposed to figure out?* If yes, one test
must not supply it. And in any plan whose verdict can be clean by silence, make
"no row reads unverified" a Test Phase 1 assertion rather than something added
after a red row for the wrong reason.

## A correct primitive filed under a domain folder is already the duplication

`verify/git.ts` had a small, correct `headSha`. When `run/` needed HEAD it did
not import it — the commit cadence spelled `rev-parse HEAD` inline, then the
loop grew its own nullable `headOf` for the `Code-Commit:` trailer. Three
spellings of one question, none wrong, each written because the existing one
lived somewhere that read as another domain's.

The repository's rule — *a git primitive belongs in `lib/git.ts`* — is about
where the **first** copy sits, not the third. `headSha` / `headShaOrNull` now
live there, pinned by a source-tree scan asserting one definition and every
consumer importing (the sixth such pin; see
[Dawn Verify — Lessons](./dawn-verify.md)).

## Absence is a rule, not a migration

A verify ledger record without `codeSha` and a queued eval without `repo` are
both records written before the split existed. Neither is migrated. Each has a
stated rule — *no `codeSha`, no code baseline: bootstrap the code repo from its
root commit*; *no `repo`: attribute the commit to the repository whose HEAD is
newer* — that is testable on day one and changes nothing that already exists.
When a new field's absence has a meaning, write the meaning down as a rule and
let the old records keep their shape.

## Nothing to attest is a fact, not an exception

The `Code-Commit:` trailer threw on a greenfield code repo with no commit yet —
out through the tool call, after the edit had already applied. A value that
cannot be computed *after* a side effect landed must be recorded as absent, or
as a failure on the run report; it must never propagate as an exception through
the surface that already did its work. This is the same shape as the commit
cadence's "failure is bookkeeping, never a gate", and it will recur anywhere a
post-hoc annotation is computed from live state.

## Two roots means asking every detector which root's question it answers

Goalpost drift and "which items became checked" are plan-repo questions. Red
tests and "what else changed" are code-repo questions. Phantom work reads both.
The test *command* is configured where the plan lives and *runs* where the code
lives. Every fix in the plan was a detector that had been asked the wrong root's
question — including the first red, where red-test detection read
`.indusk/config.json` from the code root, where a workbench has none. Writing
that one sentence per detector was the design.

## Build and prove the fixture before authoring rows against it

Three of the first five reds belonged to the fixture: a "flat legacy" layout
built to an imagined shape (a clone at `<root>/<name>` with no sibling parent
and no trunk symlink — a shape no real workbench has), a phase pre-checked in
the fixture impl, and the eval queue's on-demand directory leaving the fixture
workbench dirty. Each cost a re-authoring pass under the trajectory's goalpost
rules. A `LAYOUTS` sweep asserting only the fixture's own shape would have been
a cheap Test Phase 1 row.

## See also

- [Dawn Verify — Lessons](./dawn-verify.md) — the single-definition rule and its instances
- [`indusk verify` reference](../reference/cli/verify.md), "Across the split"
- [`indusk run` reference](../reference/cli/run.md) — two roots, two cadences
