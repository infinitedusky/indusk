# Known issues

Things found in use that no plan owns yet. When a plan takes one, the entry
moves into that plan's brief and is deleted from here. That keeps the standing
rule in `master.md`: a follow-on lives in the brief of the step that owns it.
This list is where an issue waits until some step does.

Each entry says what happens, where it was seen, and what we know so far.

## Plans

- **Renaming a plan strands its session.** Seen 2026-10-06 in the
  workbench-plan-authoring live check: the planner renamed a plan by hand
  with git, and the running session stayed filed under the old name, whose
  page no longer existed. Designed there, then moved out so that plan could
  ship. The design: `indusk plans rename <old> <new>` moves what InDusk looks
  the plan up by (its folder, the branch `plan/<old>`, `code.json` or the
  plan-worktree record, its promises' `owner`, its phase-boundary lines);
  leaves the worktree's directory where it is (a session may be running in
  it, and moving a process's directory silently breaks its hooks); asks the
  running admin to move the session's record, which tells the panel to go
  to the new page; refuses, changing nothing, when the new name is taken or
  invalid, the plan is not open, or a build is running. The planner renames
  only through it. Rejected: fixing a plan's name once it starts (a name
  gets better once the idea is clear), and detecting a hand rename
  afterwards (a guess is the wrong way to find a plan). Its promise was
  `a-renamed-plan-is-found-by-its-new-name`.
- **A planning session builds.** In the live check the planning agent went
  on past the written plan, set the impl `in-progress` itself and made the
  code change, so Approve (the brief and promise checks) never ran. A
  planning session should stop at the written plan; only `plans approve`
  should mark a plan approved.
- **The planner's worktree kickoff item is the normal-mode command.** In a
  workbench New plan has already made the worktree; `indusk worktree assign`
  errors there, and the agent improvised.
- **No way to delete a plan.** Abandoning a started plan means removing its
  folder, worktree and branch by hand, and stopping its session first. Seen
  2026-10-06, live check.

## Agents and sessions

- **A build or review session starts without the project's state.** New plan's
  agent now prepares first (workbench-plan-authoring, ADR D11); the other
  sessions the admin starts still begin with their skill alone.

- **A session's agent runs `git stash` in a worktree.** The stash list is
  shared by every worktree of a repo, so one session's stash can be popped
  by another. Seen 2026-10-06, live check (harmless there: the copy is its
  own clone).

## Admin

- **No Update button, and nothing says a project is behind.** Updating a
  project's InDusk needs `indusk update` in a terminal (seen 2026-10-05,
  updating seatbox). The admin plans with whatever skills and hooks a
  project has installed. numero runs
  InDusk 1.56.0, whose planner writes no promises, so its plans came out
  without them and nothing said why. Seen 2026-10-06, live check.
- **"Ended: success" on a failed turn.** The panel prints Claude Code's
  `subtype` (`success`) beside an API error, and "Ended" when only the turn
  ended. Seen 2026-10-06, live check.
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
