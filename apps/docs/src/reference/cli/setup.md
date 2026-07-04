# `indusk setup` — one-shot workbench creation

`indusk setup <cloned-repo-path>` turns an already-cloned git repo into an InDusk **workbench** in a single command. It collapses the four-step manual [Flow A](/guide/worktree-setup#flow-a-fresh-setup-on-a-new-machine) — `mkdir`, hand-write `package.json`, place/symlink the repo, `init --workbench --wrapped-repo X --sibling-parent Y` — into one verb, and removes the `--sibling-parent` footgun.

## Synopsis

```bash
indusk setup <cloned-repo-path>
```

```bash
# clone, then setup
git clone git@github.com:acme/widgets.git ~/code/widgets
indusk setup ~/code/widgets
# → creates ~/code/widgets-workbench/ wrapping ~/code/widgets
```

## What it does

Given the path to an existing git clone, `setup`:

1. **Validates** the path exists and contains `.git/`. A non-git or missing path fails with a clear error and creates nothing.
2. **Derives** the workbench location from the path — no flags, no `--sibling-parent`:
   - `wrapped_repo` = the repo's directory name (`widgets`)
   - `sibling_parent` = the repo's parent directory (`~/code`)
   - workbench dir = `<parent>/<repo>-workbench` (`~/code/widgets-workbench`)
3. **Guards** against collision: if `<repo>-workbench` already exists, `setup` refuses (exit 1) and points you at `indusk update`. It never clobbers an existing workbench.
4. **Scaffolds** the workbench dir + a minimal `package.json`.
5. **Creates the trunk symlink in place**: `<repo>-workbench/<repo> -> ../<repo>`. Your clone is **not moved** — a dirty working tree is fine.
6. **Delegates to `init --workbench`**, which writes the `worktree` config block and enables the worktree extension. The workbench is then a full InDusk project.

All guards run **before** any directory is created, so a failed `setup` leaves nothing behind.

## Verify

```bash
cd <repo>-workbench
indusk worktree list
# Workbench:    .../widgets-workbench
# Wrapped repo: widgets
# Trunk:        widgets → ../widgets (resolves)
# Config:       .../worktree-configs/widgets.json (config valid)
```

## Errors

| Situation | Exit | Message |
|-----------|------|---------|
| Path doesn't exist | 1 | `Error: no such path: <path>` |
| Path is not a git repo | 1 | `Error: <path> is not a git repository (no .git/ there).` |
| `<repo>-workbench` already exists | 1 | `Error: a workbench already exists at <dir>.` → run `indusk update` there, or remove the dir |

## Notes

- **The workbench root is intentionally not a git repo.** `setup` (via `init`) prints a benign `not a git repository` warning at the end — expected, not an error. Git lives in the trunk + worktrees; the workbench is per-developer local-only scaffolding.
- **Topology is symlink-in-place by default.** numero's real-clone-inside-the-workbench layout is an artifact of how it was set up — functionally identical for daily work. There is no `--move` flag in v1.
- **Zero flags in v1.** Override knobs (`--name`, `--into`) and resume-as-update on collision are possible later refinements; the v1 surface is just the path.
- `setup` does **not** clone for you — it wraps an *already-cloned* repo, matching the "clone, then setup" mental model.

## See also

- [Worktree setup workflows](/guide/worktree-setup) — Flow A (fresh) vs Flow B (migration)
- [`indusk worktree`](/reference/extensions/worktree) — `create` / `refresh` / `list` / `preflight`
- [`indusk init --workbench`](/guide/worktree-setup#manual-equivalent-what-indusk-setup-does-under-the-hood) — the lower-level command `setup` wraps
