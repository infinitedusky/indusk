---
name: git
description: Git version control — trunk-based development, short-lived feature branches, frequent commits + pulls, merge-and-delete branch hygiene
---

# Git

This project uses git for version control. Use the conventional GitHub Flow / trunk-based-development workflow that big orgs lean on: short-lived feature branches, lots of small commits, frequent integration with main, merge-and-delete when done.

## Core Rhythm: Commit a Lot, Pull a Lot, Branch a Lot

Five disciplines. None are optional.

1. **Always work on a feature branch.** Never commit directly to `main`. The branch is your scratchpad; main is the published record.
2. **Commit per checklist item.** One logical unit per commit. Each commit triggers the eval hook.
3. **Pull main frequently.** Rebase your feature branch on `origin/main` at least once a day. Don't let your branch drift more than a workday behind trunk.
4. **Push your branch often.** Pushing backs up your work and surfaces it to others. There's no penalty for pushing in-progress branches.
5. **Merge fast, delete branches.** When the plan or feature is done, merge to `main` and delete the feature branch (locally and on the remote). No stale branches.

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
  git push -u origin plan/{plan-name}-phase-{n}  # push for review/merge
  # → open PR, get review, merge via GitHub button
  git checkout main
  git pull --rebase
  git branch -d plan/{plan-name}-phase-{n}       # delete local
  git push origin --delete plan/{plan-name}-phase-{n}  # delete remote
```

**Granularity:** One `git commit` per logical unit of work. Usually one checklist item, but closely related items (e.g., "add type" + "add factory for that type") can share a commit. The gate items (otel, verify, context, document) within a phase can be one commit each or grouped — use judgment.

**Commit message discipline:** the eval hook fires on commit and scores the diff + transcript. Write descriptive commit messages that name the *why*, not just the *what* — the agent has the diff regardless; the message provides intent.

## Branch Naming

| Pattern | Use for |
|---------|---------|
| `plan/{plan-name}-phase-{n}` | Plan-driven impl work |
| `fix/{slug}` | Bugfixes outside a plan |
| `spike/{slug}` | Exploratory spikes |
| `chore/{slug}` | Tooling, deps, lint config |

Lowercase, kebab-case. The prefix tells reviewers what kind of work this is.

## Monorepo Commit Siloing

This is a monorepo. Commits should be siloed between different contexts (what would be separate repos). When a change touches multiple apps:

```bash
# Stage hunks per context, then commit per context
git add -p apps/indusk-mcp/...
git commit -m "indusk-mcp: implement detectScm()"

git add -p apps/indusk-docs/...
git commit -m "indusk-docs: document SCM-aware eval prompts"
```

Don't lump multi-context changes into one commit. `git add -A` is a smell — it makes commit boundaries imprecise. Prefer `git add -p` (interactive hunk staging) or `git add {specific path}`.

## Staying Current with Main

Rebase, don't merge, when bringing main into your feature branch. This keeps history linear and readable.

```bash
git fetch origin
git rebase origin/main         # rebase your branch onto latest main
# resolve any conflicts, then:
git rebase --continue
git push --force-with-lease    # safe force-push after rebase
```

`--force-with-lease` refuses to overwrite if someone else pushed to your branch in the meantime. **Always use `--force-with-lease` instead of `--force` on shared branches** — it prevents you from clobbering teammates' work.

If conflicts during rebase get hairy, abort and try a smaller rebase:

```bash
git rebase --abort           # undo the in-progress rebase
git rebase origin/main~5     # rebase onto an older commit, in stages
```

## Merging Back to Main

For a solo project or after PR approval:

```bash
# Standard merge with merge commit (preserves branch topology)
git checkout main
git pull --rebase
git merge --no-ff plan/foo-phase-1
git push origin main

# OR squash-merge for single-commit-equivalent branches (simpler history)
git checkout main
git pull --rebase
git merge --squash plan/foo-phase-1
git commit -m "plan/foo-phase-1: ship feature X"
git push origin main
```

**Then delete the branch — both locally and remotely:**

```bash
git branch -d plan/foo-phase-1                 # local
git push origin --delete plan/foo-phase-1      # remote
```

`-d` (lowercase) refuses to delete if the branch isn't merged. Don't use `-D` (uppercase) unless you're certain you're discarding intentionally.

## Essential Commands

### Daily workflow

```bash
git status                            # what's changed in the working copy
git log --oneline --graph --all -20   # recent history, all branches
git diff                              # unstaged changes
git diff --cached                     # staged changes
git add -p                            # stage hunks selectively
git commit -m "context: what + why"   # commit staged hunks
git checkout -b plan/foo-phase-1      # create + switch to new branch
git switch main                       # modern alternative to checkout
```

### Staying current

```bash
git fetch origin                      # fetch all remote refs
git pull --rebase                     # update current branch (rebase, not merge)
git rebase origin/main                # rebase feature branch onto latest main
git rebase --continue                 # after resolving conflicts
git rebase --abort                    # bail out of an in-progress rebase
```

### Pushing and pulling

```bash
git push -u origin <branch>           # first push (sets upstream)
git push                              # subsequent pushes
git push --force-with-lease           # safe force-push (after rebase)
git pull --rebase                     # pull + rebase (NOT merge)
```

### Branches

```bash
git branch                            # list local branches
git branch -a                         # list local + remote branches
git branch -d <branch>                # delete merged local branch
git push origin --delete <branch>     # delete remote branch
git checkout <branch>                 # switch branches
git checkout -b <new-branch>          # create + switch
```

### Inspecting

```bash
git show <ref>                        # show a commit's diff + message
git log --follow <file>               # history of a single file
git blame <file>                      # who last changed each line
git diff <ref1>..<ref2>               # diff between two refs
```

## What NOT to Do

- ❌ **Commit directly to `main`** — always use a feature branch
- ❌ **`git push --force` on shared branches** — use `--force-with-lease` instead
- ❌ **Long-lived feature branches (>1 week)** — split into smaller PRs or rebase frequently
- ❌ **`git add -A` without thinking** — prefer `git add -p` for selective staging
- ❌ **Amend a commit you've already pushed** — creates rewrites others have to clean up
- ❌ **Skip pre-commit hooks with `--no-verify`** — they exist for a reason; if a hook fails, fix the underlying issue
- ❌ **Rebase the public `main` branch** — only rebase your own feature branches
- ❌ **`git reset --hard` without first checking what you'd lose** — preview with `git status` and `git stash` if uncertain
- ❌ **Stale branches lying around after merge** — delete them; they accumulate cruft

## Commit Message Style

Follow the monorepo conventions:

```
{context}: {what changed}, {why if not obvious}

{optional body with details}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Context prefixes: the app or area name (`indusk-mcp:`, `indusk-docs:`, `root:`, `infra:`, etc.). Keep the first line under 72 characters. Use the body for details when the change is complex.

The eval agent reads commit messages — descriptive messages get descriptive scorecards.

## Pull Requests (when working with reviewers)

For team / org-shared repos, push your branch and open a PR rather than merging directly. The PR description should:

- Summarize the change in 1–3 bullets
- Reference the plan if applicable: `Implements .indusk/planning/{plan-name}/`
- Include a test plan / what was verified
- Flag anything reviewers should pay particular attention to

Wait for at least one approving review before merging (org policy applies). CI must be green.

After merge, delete the branch (both local and remote — see "Merging Back to Main" above).

## When Things Go Wrong

| Situation | Fix |
|-----------|-----|
| Committed to wrong branch | `git reset HEAD~ --soft` to uncommit, then switch branch + recommit |
| Need to undo last commit (keep changes) | `git reset HEAD~ --soft` |
| Need to undo last commit (discard changes) | `git reset HEAD~ --hard` (destructive — confirm with `git status` first) |
| Pushed something you shouldn't have | `git revert <commit>` (creates an undo commit; doesn't rewrite history) |
| Branch is hopelessly conflicted | `git rebase --abort`, then start a fresh branch off main and cherry-pick the salvageable commits |
| Lost work after a bad operation | `git reflog` shows every HEAD movement; `git checkout <reflog-ref>` to recover |

`git reflog` is your safety net. Most "I lost my work" situations are recoverable by walking the reflog. Don't panic; `reflog` first.

## See Also

- `work.md` — per-item commit cadence
- `apps/indusk-docs/src/guide/eval.md` — eval hook timing details
