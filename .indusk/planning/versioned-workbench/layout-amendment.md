---
title: "Workbench Declared Layout — Amendment to Versioned Workbench"
date: 2026-08-26
status: accepted
---

# Workbench Declared Layout — Amendment

*Design note for Build Phases 8-11 of `versioned-workbench`. Folded into this plan rather than deferred: the layout removes the cause of the ignore-rule fragility instead of patching it, and patching it separately would be work thrown away.*

## Problem

At a workbench root, **workbench-level directories and worktrees are indistinguishable**. `.indusk/`, `.claude/`, `docs/`, `env/`, `scripts/` sit as siblings of every worktree ever created. `numero-workbench` has 86 root entries, 44 of them git working trees. Nothing structural tells them apart.

Everything downstream inherits that ambiguity:

- **The ignore rules cannot be precise.** Worktree names are invented at runtime (`indusk worktree create <anything>`), so nothing can name them in advance. `versioned-workbench` was forced into deny-by-default (`/*` then `/*/` plus an allow-list) — a rule that inverts the semantics of a `.gitignore` somebody else wrote. Pointing the tool at `numero-workbench` found the consequence: because that workbench already has its own `.gitignore`, the whitelist was never applied and `workbench sync` committed worktree contents. On the real thing that is 44 checkouts of a client repo entering a shared context repo.
- **Attribution needs git.** `worktree list` shells out for `--git-common-dir` to decide which repo a worktree belongs to, because a flat root offers no structural signal and a name-prefix heuristic would attribute `alpha-feature` to `alpha` by luck.
- **A collision invariant exists only to prop up the layout** — worktree slugs must not collide with a declared repo's name.
- **It does not read.** With three repos flat, no one can tell by looking which worktree belongs to which.

**Flat was the right call for one repo and is the wrong one for N.** `indusk-worktree-extension`'s ADR records the decision — *"the workbench layout consolidates from `production/<repo>` + `worktrees/<slug>/` into a flat workbench root"* — in the same sentence that narrows v1 to single-repo and defers multi-repo. Grouping by repo is meaningless with one repo. `versioned-workbench` made N real; the premise that decision rested on is gone.

## Proposed Direction

**Declare the paths in config; let naming be convention rather than logic.**

```jsonc
{
  "worktree": {
    "shape": "workbench",
    "repos": [
      { "name": "numero", "path": "numero", "worktrees": "numero-worktrees", "remote": "…" }
    ]
  }
}
```

Two properties do the work:

1. **The product stops having a layout opinion.** Flat, `<repo>/` + `<repo>-worktrees/` siblings, and `<container>/{repo,worktrees}` are all just values. A folder can be renamed by editing config, because nothing infers meaning from a name — the same rule already applied one level down, where ownership is asked of git rather than guessed from a slug prefix.
2. **Absence means today's behavior**, so there is nothing to migrate. A repo with no `worktrees` declared is flat, exactly as now. The new layout is opt-in per repo — the same reduction shape that made `wrapped_repo` → `repos[]` free.

The ignore rule then becomes one precise generated line per declared worktrees directory (`/numero-worktrees/`), appendable to anyone's existing file without inverting its meaning. The bug found on `numero-workbench` cannot exist in that shape.

**Disk stays the inventory.** Config declares where new worktrees are *created*; `worktree list` still discovers what is on disk, and anything outside a declared location renders as **unattributed** rather than vanishing. This repo's standing rule is that declarations add structure and can never subtract — a renamed folder must not make worktrees disappear.

## Context

Emerged 2026-08-26, from pointing `versioned-workbench` at a real pre-existing workbench (Phase 7). That single run produced the layout argument: the deny-by-default ignore rule is not a design choice but a *consequence* of being unable to name worktrees in advance, and grouping removes the cause rather than patching the symptom.

Supersedes part of `indusk-worktree-extension`'s layout decision — deliberately, and for a reason that did not exist when it was made.

## Scope

### In Scope

- `path` and `worktrees` as optional per-repo declarations in `worktree.repos[]`
- Absence ⇒ flat, so existing workbenches are untouched
- Worktree creation honours the declared location
- `worktree list` groups by repo, discovers from disk, and renders unattributed entries as such
- Ignore rules generated per declared worktrees directory, replacing deny-by-default for declared workbenches
- Attribution preferring structure, falling back to `--git-common-dir` for anything outside a declared location
- A migration path for an existing flat workbench that opts in

### Out of Scope

- Forcing any existing workbench to move
- Removing flat support — it stays the default and the zero-config shape
- Changing what `.indusk/` holds or how the sync loop works

## Open Questions

1. **One level or two.** `numero/` + `numero-worktrees/` as siblings, versus a container holding both. Config-declared paths make this a per-workbench choice rather than a product decision — but the *scaffold* still needs a default to write.
2. **Segment or relative path.** A single segment is covered by the existing `isCleanSegment` guard. Allowing `apps/numero` needs a traversal guard instead. These are boundary values joined into filesystem paths.
3. **What a flat workbench gets.** Deny-by-default is the only correct rule when worktrees cannot be named. Does flat keep it, or does `restore` refuse and point at opting in?

## Success Criteria

- A workbench declaring `worktrees` for each repo needs no deny-by-default rule, and its generated ignore lines are appendable to a hand-written `.gitignore` without changing that file's meaning
- Renaming a worktrees directory and updating config is sufficient — nothing infers layout from a name
- A worktree found outside every declared location is listed as unattributed, never dropped
- An existing flat workbench with no new keys behaves exactly as it does today
- `worktree list` over three repos is readable without asking git which repo a worktree belongs to

## Executed As

- Build Phase 8 — declared paths, honoured at creation
- Build Phase 9 — listing groups by repo, discovers from disk
- Build Phase 10 — ignore rules generated per declared location; flat workbenches refused
- Build Phase 11 — migration for an existing flat workbench

## Blocks

- (none yet)
