# `indusk workbench`

Workbench topology. A workbench wraps **N ≥ 1 repos**: it holds the shared
`.indusk/` context, and the repos it wraps live beside it as siblings, reached
through trunk symlinks.

## `indusk workbench restore`

Materialize a workbench that has only been cloned.

```bash
git clone <workbench-remote> my-workbench
cd my-workbench
indusk workbench restore
```

A cloned workbench carries `.indusk/`, `.claude/` and its docs — but **not** the
repos it wraps. Those are separate repos with their own remotes, so a fresh
clone leaves you with planning history and dangling trunk symlinks. `restore`
closes that gap:

1. Reads `worktree.repos[]` from `.indusk/config.json` (the legacy
   `worktree.wrapped_repo` reduces to a one-element list).
2. Clones each declared repo that is missing, as a sibling of the workbench.
3. Creates or repairs each trunk symlink, with a **relative** target so the
   workbench stays portable.
4. Prints the out-of-band set it cannot supply.

### Flags

| Flag | Effect |
|---|---|
| `--worktrees` | Reserved. No worktree manifest is read yet, and the command says so rather than silently doing nothing. |

### It is idempotent

Re-running reports each repo as already present and writes nothing. Safe to run
whenever you are unsure whether a workbench is complete.

### It fails loud, and partially

One unreachable remote does not abort the others. Every repo is attempted, and
the command exits **non-zero** naming everything it could not resolve:

```
  ✓ alpha — cloned into /Users/you/code/proj and linked
  ✗ beta — clone failed from git@github:org/beta.git — Repository not found

Restore incomplete — 1 of 2 repo(s) unresolved:
  - beta: clone failed from git@github:org/beta.git — Repository not found
Fix the above and re-run `indusk workbench restore` — it is idempotent.
```

This is deliberate. A restore that clones half a workbench and exits `0` is
indistinguishable from a complete one to anything downstream, and "could not do
it" reported as "did it" is the failure mode InDusk builds detectors to avoid.

A repo declared **without** a `remote` is reported by name rather than skipped —
but only counts as a failure when it is also absent from disk, since a
locally-created repo that is already there needs no remote.

### What it will never do

`restore` cannot supply secrets, and does not pretend otherwise. Every run
prints the out-of-band set:

- `env/*.env` and per-app `.env.<profile>` pulls
- `.indusk/extensions/doppler/.env` (the service token)
- repo-local config (a database `config.sh`, for example)
- SSH host aliases your remotes depend on (e.g. `github-<org>` in `~/.ssh/config`)

Branches must be **pushed** to be recreatable, and uncommitted work never
travels.

### `sibling_parent` across machines

`worktree.sibling_parent` names the directory the wrapped repos live in. It is
an absolute path stored in a *shared* config, so it frequently names the
machine that wrote it. When the declared path does not exist, `restore` says so
and falls back to the workbench's **parent** directory:

```
Note: worktree.sibling_parent points at /Users/someone-else/code/x, which does
      not exist here — it is an absolute path from whichever machine wrote it.
      Using this workbench's parent instead: /Users/you/code
```

That fallback is the topology `indusk setup` actually builds — `<parent>/<repo>`
beside `<parent>/<repo>-workbench` — not a guess.

## The sharing rules it scaffolds

`restore` writes two files when they are absent, and never rewrites them — a
hand-tuned ignore file is a decision somebody made, not drift.

**`.gitignore` is a root whitelist, not a blacklist.** Everything at the root is
denied, then specific entries are opted back in:

```gitignore
/*
!/.indusk/
!/.claude/
!/env/
!/scripts/
!/docs/
!/package.json
...
```

Two reasons it is inverted:

- **Worktree directories get names invented at runtime.** `indusk worktree
  create <slug>` can produce any name, so a deny-list is always one command
  behind — and the thing it misses is a whole checkout of another repo
  committed into your context remote.
- **The rule is `/*`, not `/*/`.** Git stores a trunk symlink as a *blob*, not
  a directory, so a directory-only rule leaves every trunk link tracked.

**`.gitattributes`** sets `merge=union` on the append-shaped coordination files
(`current.md`, `highlights.jsonl`) — two machines appending different lines both
mean it, and a conflict marker there blocks every agent on both sides. It is
deliberately *not* applied to plan documents, where a blind union interleaves
prose.

### Ignoring is not untracking

Adding an ignore rule does nothing to a file that is already tracked. A
workbench git-initialized before these rules keeps publishing its symlinks and
secrets to the shared remote while `git status` looks perfectly clean. `restore`
therefore also drops now-ignored paths from the **index** (`--cached` — the
files stay on disk):

```
Untracked 3 now-ignored path(s) (index only, files kept)
```

## Declaring where things live

A repo entry can say where its checkout and its worktrees are:

```jsonc
{ "name": "service-api", "path": "service-api", "worktrees": "service-api-worktrees" }
```

| Field | Absent means |
|---|---|
| `path` | the repo's `name` |
| `worktrees` | the workbench root — today's flat layout |

**Absence means flat**, so an existing workbench declares nothing and behaves
exactly as it does now. The nested layout is opt-in per repo.

Two things follow from declaring rather than inferring:

- **A directory can be renamed.** Update `path` and everything keeps working —
  `name` is an identifier, not a location. Nothing derives a path from a name,
  the same rule the listing follows when it asks git who owns a worktree instead
  of guessing from a slug prefix.
- **The ignore rule becomes precise.** Worktree names are invented at runtime and
  cannot be listed in advance, but the directory containing them can be named
  exactly — one generated line instead of denying the whole root by default.

Both values are joined into filesystem paths, so both are **boundary values**:
each must be a single clean path segment. A declared value containing `/` or
`..` is dropped and the default applies — degrade to structure-loss, never a
traversal.

## `indusk workbench migrate-layout`

Move a flat workbench's worktrees under a declared per-repo location.

```bash
indusk workbench migrate-layout            # dry run — shows the plan
indusk workbench migrate-layout --apply    # performs it
```

**Dry-run by default**, because a command that relocates directories should
show its plan before doing anything:

```
Dry run — would move:

  feat-a   ->  alpha-worktrees/feat-a
  feat-b   ->  beta-worktrees/feat-b

Nothing changed. Re-run with --apply to perform the migration.
```

It uses `git worktree move` rather than renaming directories. A worktree is two
cross-references — its own `.git` file, and the repo's
`.git/worktrees/<name>/gitdir` pointing back — and moving the directory without
repairing both leaves something that *looks* right and is broken.

**It refuses loudly and partially.** A worktree that cannot move (locked, dirty,
destination occupied) is named, the rest still move, and the command exits
non-zero:

```
  ✓ movable
  ✗ locked-one — cannot move a locked working tree

Migration incomplete — 1 worktree(s) could not be moved:
  - locked-one: cannot move a locked working tree
Fix those and re-run — the command is safe to repeat.
```

A directory that resolves to no declared repo is left alone and reported, never
guessed at. Wrapped repos are never committed to — this moves worktrees, not
product code. Re-running once everything is declared is a no-op.

## Why not `init` or `update`?

`indusk init` is written to *refuse* an already-initialized workbench; a cloned
workbench is precisely that case. `indusk update` runs constantly and must stay
fast and offline-tolerant, so a network clone does not belong there. `update`
instead detects unmaterialized repos and points you here.

## See also

- [Worktree extension](../../guide/index.md) — trunks, worktrees, and per-repo config
- `/decisions/versioned-workbench` — the ADR, including why the repo set lives in
  `config.json` rather than a separate manifest
