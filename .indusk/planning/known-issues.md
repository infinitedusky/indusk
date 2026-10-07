# Known issues

Things found in use that no plan owns yet. When a plan takes one, the entry
moves into that plan's brief and is deleted from here. That keeps the standing
rule in `master.md`: a follow-on lives in the brief of the step that owns it.
This list is where an issue waits until some step does.

Each entry says what happens, where it was seen, and what we know so far.

## Agents and sessions

- **A build or review session starts without the project's state.** New plan's
  agent now prepares first (workbench-plan-authoring, ADR D11); the other
  sessions the admin starts still begin with their skill alone.

- **A session's agent runs `git stash` in a worktree.** The stash list is
  shared by every worktree of a repo, so one session's stash can be popped
  by another. Seen 2026-10-06, live check (harmless there: the copy is its
  own clone).

## Admin

- **No Update button.** Updating a project's InDusk needs `indusk update` in a
  terminal. Seen 2026-10-05, updating seatbox.
- **No way to delete a plan.** Abandoning a started plan means removing its
  folder, worktree and branch by hand, and stopping its session first. Seen
  2026-10-06, live check.
- **No Create project.** A project can only be registered from the CLI. Seen
  2026-10-05, trying the admin on a fresh workbench.

## Contracts and workbenches

- **A shadow contract has no adopt command.** A workbench holds a repo's
  contract until the repo adopts it; nothing moves it into the repo yet.
  From the workbench-plan-authoring design.
- **`init` drops a workbench's `worktree` config.** Seen during
  workbench-plan-authoring.

## Planning rules

- **Approve and the planner disagree about the root `CLAUDE.md`.** The planner
  adds a Key Decisions line when the ADR is accepted; approve refuses a branch
  that changed anything outside `.indusk/` before the build. Seen approving
  workbench-plan-authoring; worked around by moving the line to the build.

## Package

- **The version notice compares versions as strings.** `hasNewerVersion`
  should use `isNewerVersion`.
- **The package `CLAUDE.md` is 2 bytes under its budget.** The next rule
  added there will be refused; one entry needs to move down a tier first.
