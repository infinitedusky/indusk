# Dawn Workbench Execution — two roots, one resolver

**Status:** accepted (2026-09-15) · Dawn component 6.5
**Full ADR:** `.indusk/planning/archive/dawn-workbench-execution/adr.md` · **Lessons:** [Dawn Workbench Execution — Lessons](../lessons/dawn-workbench-execution.md)

## What was decided

`indusk run` and `indusk verify` work at the root of a workbench that declares **one** repo: the plan is read from the workbench, the code is executed, committed and judged in the declared repo, and every artifact the two commands write says which repository it is about. Two declared repos still refuse, by name.

Five decisions, each answering "which repository?" for one artifact:

| Artifact | Repository | Decision |
|---|---|---|
| "Where is the plan, where is the code" | both | one `resolveExecutionRoots` (`lib/worktree/roots.ts`) behind `run`, `verify` and the cleanup scan — a one-repo workbench resolves to a split; zero or several declared repos refuse, naming them |
| verify's baselines | plan repo `sha`, code repo `codeSha` | one ledger at the plan root; each clean verdict records both HEADs; **a record without `codeSha` is never a code baseline** — bootstrap the code repo and say `merge-base` |
| verify's detections | code: red tests, "what else changed"; plan: goalposts, "what got checked" | phantom reads both; the test command is configured at the plan root and runs in the code repo, so `Test` paths are code-repo-relative when split |
| run's writes | code root, or the plan's own folder | `resolveInRoots` is the one confinement rule; the bash escape scan uses the same two roots; gates resolve from and run against the plan root |
| run's commits | one cadence per repository | the code cadence commits the item's code; the plan cadence commits only the checkoff with `Code-Commit: <code HEAD>`; a cadence with nothing staged makes no commit; the checkoff commit is not queued for eval |
| queued evals | the repo the commit landed in | `repo` on the record, `--git-root` through the drain to the hook, which in CLI mode outranks the walk-up's newer-HEAD attribution |

## Why

Every real project on this machine is a workbench, and both commands refused there — correctly, since workbench-trust-fixes, because each took one root as its whole world and a wrong verdict looks exactly like a right one. So Dawn's floor (component 6, five planted classes caught, no false positive) existed only where nobody worked. This plan is the lift: not a repair of something that broke, but the first time the floor stood under the standard shape.

## What was rejected

- **Leaving the checkoff commit to `workbench sync`.** The debounced sync hook fires only in Claude Code sessions; under `atdawn run` the checkoff would never be committed and goalpost detection would read stale plan documents.
- **A second ledger in the code repo.** Two chains to keep consistent, and InDusk machine state inside the repository a workbench exists to keep clean of it.
- **A `--code-root` flag.** The declaration already says where the code is; a flag can name the wrong place, and a verdict against the wrong repository is indistinguishable from a correct one.
- **Lifting the multi-repo refusal.** Needs the plan to declare which repo holds its code — a follow-on with its own frontmatter decision.
- **Running from inside the code repo and inferring the plan root upward.** The walk-up finds the workbench, a git repo with its own history — the accidental attribution trust-fixes removed.

## What it cost

Two commits per item in a workbench, and a plan-repo history interleaving every plan's checkoffs (the trailer is the join). One optional field on two records where absence carries a meaning, with the rule written beside each reader. A run's write surface is two roots rather than one, so confinement has two allow-lists to keep correct.

## Acceptance

The dawn-verify matrix re-run inside a workbench — an uncontrolled headless agent's honest phase, then five planted violation classes — is recorded in `.indusk/planning/archive/dawn-workbench-execution/matrix.md`.

## See also

- [`indusk run`](/reference/cli/run) — the two roots, what flows to each
- [`indusk verify`](/reference/cli/verify) — "Across the split"
- [Rail check](/guide/rail-check) — which repository gets scored
- [Dawn Verify](/decisions/dawn-verify) — the refusal this lifts for one repo
