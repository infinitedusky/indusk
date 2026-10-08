# Worktrees share one stash stack — never stash or pop unnamed; set work aside with a temporary commit or a tagged stash applied by its sha

The stash stack lives in the repository's shared git directory, so every worktree of a repository pushes onto and pops from the same list. A bare `git stash pop` in one worktree takes whatever is on top — which may be another session's work, set aside in another worktree a minute earlier — and a bare `git stash` pushes an entry no one can tell from their own. On watcher-heartbeat an evaluator's `git stash` took a working agent's uncommitted edits without a word.

**How to apply:** where a repository has more than one worktree,
- prefer a temporary commit (`git commit -m 'wip: <what>'`, undone later with `git reset --soft HEAD~1`);
- if you must stash: `git stash push -u -m "<unique-tag>"`, note its sha with `git stash list --format='%H %gs'`, restore with `git stash apply <sha>` (never `pop`), and drop it by re-finding its current `stash@{n}` by tag first;
- never `git stash clear`.

Enforced by `hooks/stash-guard.js` (small-fixes, promise `a-stash-never-crosses-worktrees`), which refuses the unnamed spellings only when the repository has more than one worktree. `INDUSK_STASH_GUARD=off` overrides it for one call.
