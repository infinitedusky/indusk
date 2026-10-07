# Workbench Plan Authoring

The admin's plan flow (New plan, approve, build, review, accept, land) now works in a workbench, the shape most InDusk projects take: a root that holds the agents' work, wrapping one or more code repos. Full ADR: `.indusk/planning/archive/workbench-plan-authoring/adr.md`.

## What was decided

- **A workbench plan is documents at the root and code in a repo.** Its documents live on the workbench root's main branch, where sync already commits them. Only its code has a plan branch, `plan/<name>`, in the repo the plan names. The plan records that choice in `.indusk/planning/<plan>/code.json` (`repo`, `branch`, `worktree`), and every step reads it.
- **Approving merges nothing.** Approve runs the brief check and marks the plan approved; there is no documents branch to merge.
- **One contract per repo, through one resolver.** A repo's promises live in its own `.indusk/promises/` once it holds one; until then, in the workbench's shadow contract. `contractDir(root, plan?)` is the only place that decides which, and every reader goes through it. A promise is never read from both.
- **Sessions start at the root.** A planning or build session runs at the workbench root, so the workbench's own hooks judge every checkoff, and adds the code worktree with `--add-dir`. A build may write in both places and nowhere else.
- **Landing merges in the repo and archives at the root,** onto the repo's declared base branch (`base_branch`, else `trunk_branch`, in its worktree config).
- **From the live check:** a new plan's agent prepares, then asks for a description instead of planning from its name; and a project Claude Code does not trust offers **Trust in Claude Code**, where the click is the person's consent.

## Tradeoffs accepted

- **No plan branch at the workbench root.** Sync commits and pushes whatever branch is checked out, so a documents branch would be pushed on every edit.
- **The shadow contract is a stopgap.** Nothing yet moves it into the repo; that is its own plan.
- **Renaming a plan is not supported yet.** A rename by hand strands the running session; the design waits in the known-issues list.
- **The live check stopped after build**, by the person's call; review, accept and land rest on their unit tests.
