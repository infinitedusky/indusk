# Source Control: Git

InDusk uses [git](https://git-scm.com/) as the only source control system as of 1.31.0. Earlier versions (1.28.x–1.30.x) supported [Jujutsu](https://github.com/jj-vcs/jj) (jj) as an alternate substrate; that support was removed in the [`git-only-substrate`](/decisions/git-only-substrate) plan. If your project still has `scm: "jj"` in its `.indusk/config.json`, the field is now a no-op and `indusk update` nudges you to remove it.

## The git workflow

InDusk's commit cadence follows trunk-based development:

- **Short-lived feature branches.** Cut a branch off `main` for each plan or feature; merge fast; delete when done.
- **One commit per checklist item.** Each impl checklist item gets its own commit. The eval hook fires on every `git commit` and scores the work against the rubric. Per-item commits keep history granular and the eval scorecards specific.
- **Frequent integration with `main`.** Pull (rebase) at least once a day. Don't let a feature branch drift more than a workday behind trunk.
- **`--force-with-lease` after rebase.** Push after `git rebase origin/main` with `--force-with-lease`, never bare `--force`.
- **Merge and delete fast.** Once the plan or feature is done, merge to `main`, delete the feature branch locally and on the remote. No stale branches.

The full convention lives in the [`git.md`](https://github.com/infinitedusky/indusk/blob/main/apps/indusk-mcp/skills/git.md) skill.

## During /work

When executing an implementation plan, integrate git into the per-item workflow:

```
Once at phase start:
  git checkout main
  git pull --rebase
  git checkout -b plan/{plan-name}-phase-{n}

For each checklist item:
  1. [do the implementation work]
  2. [check off the item(s) in impl.md]
  3. git add -p                                  # stage hunks selectively
  4. git commit -m "context: what + why"         # short, intent-named
  5. → repeat from step 1 for the next item

Periodically (at least once a day, or before merging):
  git fetch origin
  git rebase origin/main                         # stay current with trunk

At phase or plan completion:
  git push -u origin plan/{plan-name}-phase-{n}
  # → open PR, get review, merge via GitHub button
  git branch -d plan/{plan-name}-phase-{n}       # delete local
  git push origin --delete plan/{plan-name}-phase-{n}  # delete remote
```

## Commit messages

The eval hook reads commit messages — descriptive messages get descriptive scorecards. Follow the monorepo convention:

```
{context}: {what changed}, {why if not obvious}

{optional body with details}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

Context prefixes name the app or area (`indusk-mcp:`, `indusk-docs:`, `root:`, `infra:`). Keep the first line under 72 characters.

## Historical note

Prior to 1.31.0 InDusk shipped with dual-SCM support — projects could pick `scm: "jj"` or `scm: "git"` in their config, and InDusk would branch on the field at runtime (eval prompts, baseline CLI, semantic graph sync, even per-phase commit cadence). The strategic shift to single-SCM is recorded in the [`git-only-substrate`](/decisions/git-only-substrate) decision; the historical dual-SCM design is preserved in the superseded [`git-or-jj-substrate`](https://github.com/infinitedusky/indusk/tree/main/.indusk/planning/git-or-jj-substrate) planning folder.

If you had `scm: "jj"` in a project's config, `indusk update` will nudge you to remove the field — InDusk silently ignores it. Removing the field is the user's call; nothing breaks if you leave it.

## See also

- The [`git.md`](https://github.com/infinitedusky/indusk/blob/main/apps/indusk-mcp/skills/git.md) skill — the full convention reference.
- The [`work.md`](https://github.com/infinitedusky/indusk/blob/main/apps/indusk-mcp/skills/work.md) skill — per-item commit cadence + gate execution order.
- The [Eval hook](/guide/eval) guide — what the hook scores and how to read scorecards.
