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

## Why not `init` or `update`?

`indusk init` is written to *refuse* an already-initialized workbench; a cloned
workbench is precisely that case. `indusk update` runs constantly and must stay
fast and offline-tolerant, so a network clone does not belong there. `update`
instead detects unmaterialized repos and points you here.

## See also

- [Worktree extension](../../guide/index.md) — trunks, worktrees, and per-repo config
- `/decisions/versioned-workbench` — the ADR, including why the repo set lives in
  `config.json` rather than a separate manifest
