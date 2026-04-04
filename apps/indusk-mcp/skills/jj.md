---
name: jj
description: Jujutsu (jj) version control — describe-then-do workflow, splitting, and commit hygiene for monorepo development
---

# Jujutsu (jj)

This project uses [Jujutsu](https://github.com/jj-vcs/jj) for version control, not raw git. All VCS operations go through `jj`.

## Core Concept: Describe-Then-Do

Jujutsu has no staging area. Everything in the working copy is automatically part of the current change. This enables a **describe-then-do** workflow:

1. **Describe your intent** — `jj describe "what I'm about to do"`
2. **Do the work** — edit files, run commands, build the thing
3. **Start the next change** — `jj new` creates a fresh empty change on top
4. **Repeat** — describe → work → new → describe → work → new

This produces a clean history where every commit has a meaningful description written *before* the code, not after.

## During /work

When executing an implementation plan, integrate jj into the per-item workflow:

```
For each checklist item (or logical group of items):
  1. jj new                              # fresh change
  2. jj describe "Phase 2: add Redis connection pool"  # declare intent
  3. [do the implementation work]
  4. [check off the item(s) in impl.md]
  5. → repeat from step 1 for the next item
```

**Granularity:** One `jj new` per logical unit of work. This is usually one checklist item, but closely related items (e.g., "add type" + "add factory for that type") can share a change. The gate items (otel, verify, context, document) within a phase can be one change each or grouped — use judgment.

**Phase transitions** are natural commit boundaries. Always `jj new` when starting a new phase.

## Monorepo Commit Siloing

This is a monorepo. Commits should be siloed between different contexts (what would be separate repos). When a phase touches multiple apps:

```bash
# After doing work that spans indusk-mcp + root config:
jj split 'glob:"apps/indusk-mcp/**"'        # first commit: indusk-mcp changes
jj describe @- "indusk-mcp: add Redis pool"  # describe the split-off commit
jj describe "Root: sync Redis config"         # describe the remainder
```

Use `jj split <filesets>` to separate changes by context. The matching files go into the first (parent) commit; the rest stays in the current (child) commit.

## Essential Commands

### Daily workflow
```bash
jj status                    # what's changed in the working copy
jj log                       # view recent history (graph format)
jj diff                      # see working copy changes
jj describe "message"        # set/update description of current change
jj new                       # create new empty change on top of current
jj new -m "message"          # create + describe in one step
```

### Splitting and reorganizing
```bash
jj split 'glob:"apps/foo/**"'      # split by file pattern
jj split file1.ts file2.ts          # split by specific files
jj squash                            # fold current change into parent
jj squash --from <rev>               # fold a specific change into its parent
```

### Navigating history
```bash
jj log --limit 10                    # recent commits
jj show <rev>                        # show a specific change
jj describe <rev> -m "new message"   # update any change's description
```

### Bookmarks (jj's equivalent of branches)
```bash
jj bookmark create <name>           # create bookmark at current change
jj bookmark set <name>              # move bookmark to current change
jj bookmark list                    # list all bookmarks
jj git push --bookmark <name>       # push a bookmark to remote
```

### Working with remote
```bash
jj git fetch                         # fetch from remote
jj git push                          # push current bookmark
jj rebase -d main                    # rebase onto main
```

## Important: jj, Not git

- **Never use raw `git` commands** — jj manages the git repo underneath. Running `git commit`, `git add`, etc. will conflict with jj's state.
- **No staging area** — there's no `git add`. All working copy changes are part of the current change.
- **Changes are mutable** — you can always `jj describe` to update a message, `jj squash` to combine, or `jj split` to separate. History rewriting is the normal workflow, not a special operation.
- **`@` means current change** — in commands, `@` refers to the working copy change. `@-` is the parent.
- **Editor issues** — in non-interactive environments (like Claude Code), use inline messages (`-m`) or `EDITOR="true"` to skip the editor for split operations.

## Description Style

Follow the monorepo commit message conventions:

```
{context}: {what changed}, {why if not obvious}

{optional body with details}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Context prefixes: the app or area name (`indusk-mcp:`, `indusk-docs:`, `Root:`, `Infrastructure:`, etc.)

Keep the first line under 72 characters. Use the body for details when the change is complex.
