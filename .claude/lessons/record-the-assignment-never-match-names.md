# When one thing must be tied to another (a worktree to a plan), record the tie at the command that creates it and re-check it against the source of truth on every read — never infer it from matching names

admin-plan-worktrees first proposed "the worktree on branch `plan/<name>` holds plan `<name>`". Reading the code showed two conventions already in use (`indusk worktree create` named branches after the bare slug; every plan worktree had been made by hand as `plan/<name>`), and a name that does not match falls back silently — the plan shows its trunk copy and nothing says a live copy exists. Sandy called it "a bug waiting to happen".

What shipped instead: a record written by the one command that creates the worktree (`create`, `assign`, `release`), stored where every checkout can read it (the shared git directory), and checked against git's own worktree list on every read. Every mismatch then has a name the reader can show: gone, doubled, missing, malformed.

How to apply: before proposing a naming convention as the link between two things, read the code that creates them and count the conventions already in use. If the link matters to a reader, write it down at creation and verify it at read; a convention only tells you what someone intended.
