# Subagents working in a plan worktree must not run `indusk update` — the installed binary copies its own package's skills, edits unrelated files and registers the worktree as a project in ~/.indusk/projects.json

`indusk update` run from a worktree uses the installed binary's own package, not the worktree's: it overwrites installed skills with that package's copies, touches files outside the task, and adds the worktree path to ~/.indusk/projects.json as if it were a project. To sync skills or hooks in a worktree, copy from the worktree's own apps/indusk-mcp sources (or run its built CLI), and say so in the subagent's brief.

Source: retro-hindsight highlight h-20261015-003.
