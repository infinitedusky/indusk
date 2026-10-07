# Known issues

Things found in use that no plan owns yet. When a plan takes one, the entry
moves into that plan's brief and is deleted from here. That keeps the standing
rule in `master.md`: a follow-on lives in the brief of the step that owns it.
This list is where an issue waits until some step does.

Each entry says what happens, where it was seen, and what we know so far.

## Agents and sessions

- **A new agent starts without the project's state.** New plan opens a session
  whose only message is `/planner <type> <name>`. It gets `CLAUDE.md` and the
  master, but not what catchup reads: `current.md` (what is in flight or
  blocked), promise health, or git state. A plan could be written without
  knowing about an unrecorded promise violation, which the project's own rule
  ranks above the roadmap. Open question: what context to give a new agent,
  and how (full catchup is slow; a short version is `current.md` plus one
  promise-health line). Seen 2026-10-06, workbench-plan-authoring live check.

## Admin

- **No Update button.** Updating a project's InDusk needs `indusk update` in a
  terminal. Seen 2026-10-05, updating seatbox.
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
