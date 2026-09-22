# Derive a promise mark's project id from the shared git directory, never basename(cwd)

A plan worktree's folder is named after the plan (e.g. `day-monitor/`), not the project. Any identity value derived from `basename(cwd)` — such as the project id embedded in a promise mark — silently diverges between the trunk checkout and a plan worktree of the same project, because the worktree folder name is the plan name, not the project name.

Symptom (day-monitor, falsification A28): the trunk's `indusk promises status` dropped every evaluation done from inside a plan worktree, because the mark's project id didn't match what the trunk expected.

Fix: derive project identity from the shared git directory (`gitCommonDirOf` — the `.git` dir all worktrees of one repo share), never from the cwd's basename. Any code that stamps a project/repo identity onto an artifact that's later read from a different worktree of the same repo needs this.

See `.indusk/planning/archive/day-monitor/` retrospective.
