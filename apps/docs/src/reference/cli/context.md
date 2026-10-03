# `indusk context`

The context files are `CLAUDE.md` at the project root and every nested
`CLAUDE.md` beneath it — an area's rules, loaded only when a file in that area
is read. Under the budget regime an entry is a rule plus a pointer, so a dead
pointer is a lost rule body. These commands keep the pointers honest. See the
[context-budget guide](/guide/context-budget) for the budget and the
[context-tiers guide](/guide/context-tiers) for where a rule belongs.

## `indusk context check-pointers`

Walks **every** context file git knows about — the root and each nested
`CLAUDE.md` — and verifies that each pointer resolves:

- a **path** (`apps/…`, `.indusk/…`, `docker/…`, `packages/…`, `.claude/…`)
  exists on disk, resolved against the project root wherever the file lives;
  globs and `{placeholder}` paths are documentation, not pointers, and are
  skipped;
- a **lesson token** (`lesson: <name>`, in backticks or after a comment opener)
  names a file `.claude/lessons/<name>.md`;
- a `**Version**:` line carries no literal version — a hand-copied number is a
  copy nothing in the release flow updates, so the check refuses it and asks
  for a pointer to `package.json` or the changelog instead.

```
$ indusk context check-pointers
64 pointer(s) scanned across 4 context file(s): CLAUDE.md, .indusk/planning/CLAUDE.md, apps/indusk-admin/CLAUDE.md, apps/indusk-mcp/CLAUDE.md
PASS — all pointers resolve
```

A failure names the file and each pointer, and exits 1 so the check composes
into a verification pipeline:

```
FAIL — 2 dead pointer(s) in apps/indusk-admin/CLAUDE.md:
  - apps/indusk-admin/src/components/Gone.tsx
  - lesson: no-such-lesson
```

In a workbench the walk covers the workbench root **and each declared repo**:
the workbench's own git ignores the code repos, so their context files are
listed from each repo's git, and their pointers resolve against that repo. The
report names the repo before the file:

```
FAIL — 1 dead pointer(s) in alpha: CLAUDE.md:
  - apps/gone/thing.ts
```

Outside a git repository only the root file is walked. The retrospective runs
this at every plan close, after the merge, because pointers written on a plan
branch are only now on trunk.
