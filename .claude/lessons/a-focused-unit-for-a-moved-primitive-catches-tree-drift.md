# When a test that passed minutes ago fails with "X is not a function", check `git stash list` before debugging the code

During writing-skill's cleanup, A31 (the unit for `snapshotPaths` / `restorePaths`, just moved into `lib/git.ts`) went from green to "snapshotPaths is not a function" between two commands with no edit in between. `git stash list` showed a "WIP on plan/writing-skill" entry taken seconds after the previous commit and never popped: something running on `git commit` in the worktree had stashed the working tree, reverting the move. The next commit had already landed the reverted, mixed state.

Why: a stash by another process is indistinguishable from your own edit failing, except that the failure is a missing symbol on a file you did not change. The focused unit for the moved primitive is the only signal that fires; the wider suites were still green because they exercise the behaviour through the old copy.

How to apply: on an unexplained regression of that shape, run `git stash list` and `git reflog -5` first. Recover additively: `git stash apply <sha>` (never pop), verify, commit the real work as its own commit, then drop the entry. Commit the impl's checkoffs with each item so they are not exposed. And when a rail runs on commit, nothing in it may stash the working agent's tree.
