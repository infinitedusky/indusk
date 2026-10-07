# One contract per repo

A repo's promises are its **contract**: what the application commits to, each
promise proven by tests and watched in use. A repo has one contract, however
many people or agent setups work on it.

## Where the contract lives

- **In the repo**, once it holds one: `.indusk/promises/`, one markdown file
  per promise, reviewed in pull requests like the code it describes.
- **In the workbench**, until then. A workbench works on a repo from outside
  it, often a client's repo that doesn't hold InDusk's files. Its own
  `.indusk/promises/` is the repo's **shadow contract**. It is versioned with
  the workbench and watched like any other contract.

Every reader finds the contract the same way. The registry check, `promises
status` and `watch`, the plan commands, the MCP tools and the admin all go
through one resolver, `contractDir`:
- normal mode: the project's own folder;
- a workbench: the repo's folder when the repo holds one, otherwise the
  workbench's.

A promise is never read from both.

## Why it lives with the code

The code already names its promises. Tests and code carry `promise: <name>`
tokens, and the running application sends marks under those names. If the
contract lived only in a workbench, two workbenches on one repo could define
the same name two ways, and one application's telemetry would be read against
two contracts. Kept with the code, the contract, the tests that prove it and
the telemetry that watches it share one history.

## How a repo adopts its contract

1. You work on the repo from a workbench, under the shadow contract. The
   tokens you add are plain comments, and the marks are plain OpenTelemetry
   spans.
2. A broken promise caught, or a review's evidence, makes the case.
3. A pull request moves the contract into the repo: the folder, a CI check,
   and a paragraph of explanation.
4. From then on the workbench reads the repo's contract, and so does every
   other workbench on that repo.

Moving the contract in is a command of its own, planned after
workbench-plan-authoring. Until then, step 3 is done by hand: copy the folder,
then commit it in the repo.

See [the promises reference](/reference/cli/promises) and [workbench
sharing](/guide/workbench-sharing).
