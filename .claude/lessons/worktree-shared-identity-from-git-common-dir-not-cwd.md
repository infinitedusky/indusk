# An identity that must agree between a trunk and its plan worktrees comes from the shared git directory, never basename(cwd)

In day-monitor, the promise mark's project id was derived from basename(cwd). A plan worktree's folder is named after the plan (not the repo), so the trunk's `indusk promises status` silently dropped every span the worktree emitted during plan work — the ids never matched, and nothing errored.

Why it matters: worktree-per-plan (the project default) guarantees the working directory's basename diverges from the trunk's on every plan. Any identity that must be shared across a trunk and its worktrees — project id, promise marks, anything joined later by name — breaks silently if derived from cwd instead of a value both checkouts share.

What to do instead: derive shared identity from `git rev-parse --git-common-dir` (or equivalent — the one directory every worktree of a repo shares), not from the working directory's path or basename. Fixed here via `markProjectId` using `gitCommonDirOf`. Found by day-monitor's falsification pass (row A28), so treat "does this identity survive a worktree" as a standing falsification question for anything keyed by project.

See `.indusk/planning/day-monitor/` (impl/retrospective) for the fix site.
