# `indusk worktree`

Every plan is worked in its own git worktree, on its own branch. So a
project has many copies of each plan, one per checkout, and only one of them
is the plan's live copy. `indusk worktree` creates a plan's worktree and
records which plan it holds, so the admin and the MCP plan tools read that
plan from its worktree while it is worked, from any checkout of the project.

The record is written, never inferred. Nothing reads a folder or branch name
to decide which plan a worktree holds.

## `indusk worktree create <plan>`

In a normal-mode project (one that is not a workbench):

```bash
indusk worktree create admin-plan-worktrees
```

1. Refuses unless `.indusk/planning/<plan>/` exists on the trunk. A plan is
   planned on the trunk first; its worktree opens at the first phase.
2. Runs `git worktree add <parent>/<project>-worktrees/<plan> -b plan/<plan>`
   off the trunk's current branch. For a project at `~/code/dusk` that is
   `~/code/dusk-worktrees/<plan>`.
3. Records the assignment, then prints the path. Install the project's
   dependencies there before working in it.

It refuses when the target folder already exists, naming it and the `assign`
command that would adopt it.

In a workbench, `create [repo] <slug> [base-branch]` is unchanged: it runs the
worktree extension's setup script (see the
[worktree setup guide](/guide/worktree-setup)). Plan documents in a workbench
live at the workbench root, never in a code worktree, so assignments do not
apply there and every plan reads from the plan root.

## `indusk worktree assign <plan> <path>`

Assigns a worktree made any other way (by hand with `git worktree add`, or
before this command existed):

```bash
indusk worktree assign admin-plan-worktrees ../dusk-worktrees/admin-plan-worktrees
```

The path resolves against the current directory. Assigning the same plan to
the same worktree again does nothing. Refusals, each naming what it refused,
with nothing written:

| Refused | Why |
|---|---|
| A path that is not a linked worktree of this repository | Only git's own worktree list counts |
| A plan with no folder on the trunk | The plan is planned first |
| A plan already assigned to another live worktree | Names both; release the first |
| A worktree already assigned to another plan | Names that plan |
| A record that cannot be read | Names the file; fix or remove it first |

## `indusk worktree release <plan>`

Ends the assignment. The plan reads from the trunk again, which after the
merge holds the finished work. The retrospective's landing step runs it
between the merge and the worktree's removal:

```bash
git -C <trunk> merge --no-ff plan/<plan>
indusk worktree release <plan>
git worktree remove <path>
git branch -d plan/<plan>
```

Releasing a plan with no assignment is refused, so a skipped step is loud.

## The record

`indusk-plan-worktrees.json` in the repository's shared git directory
(`git rev-parse --git-common-dir`, usually `<project>/.git/`):

```json
{
  "version": 1,
  "assignments": [
    {
      "plan": "admin-plan-worktrees",
      "path": "/Users/you/code/dusk-worktrees/admin-plan-worktrees",
      "branch": "plan/admin-plan-worktrees",
      "at": "2026-09-18T18:34:41.043Z"
    }
  ]
}
```

It lives there for two reasons. The trunk and every worktree of a clone share
that directory, so every checkout reads the same record. And it is never part
of any working tree, so it is never committed: the paths in it are true on
one machine only, like the worktrees they name.

## What a reader sees

Every read checks the record against `git worktree list`. Nothing is guessed:

| Case | The plan reads from | And the reader says |
|---|---|---|
| No assignment | The trunk | Nothing, as before |
| One live assignment | The worktree | The worktree's name and branch |
| Assigned worktree removed without release | The trunk | "assigned worktree `<path>` no longer exists" |
| Two live assignments (a hand-edited record) | The trunk | Both worktrees, by path |
| A worktree nobody assigned | — | Listed as unassigned |
| A record that cannot be read | Nothing | An error naming the file |

Assignments apply when the project is the repository — its folder is the top
of a git checkout, as dusk's is. A project nested inside a larger repository
reads the folder it was asked about, as it did before.

The MCP plan tools and the admin read the same way, through one resolver in
`lib/worktree/plan-worktrees.ts` (the `@infinitedusky/indusk-mcp/worktree/plan-worktrees`
subpath).
