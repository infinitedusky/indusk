---
title: "Project list shows workbenches only"
date: 2026-09-10
status: draft
---

# Project list shows workbenches only — Brief

## The story

The admin UI's home page lists every project ever registered with InDusk.
Today that registry holds 1,588 entries. Ten of them point at directories
that still exist. The other 1,577 are temporary directories that no longer
exist, with names like `ma-init-a3f9c2`, `cjs-consumer-…`, `detect-…`,
`ignore-…`. This is observed, not a scenario: the counts above come from
reading the registry file on 2026-09-10.

Those entries are test fixtures. Four test files run `indusk init` or
`indusk update` against a temp directory, and both commands register the
project they touch. The registry honors `INDUSK_HOME` precisely so tests
can redirect it, but nothing forces a test to set it, and these four do
not. Each full test run adds a few dozen entries to the real registry on
the developer's machine. By decision the registry is never pruned
automatically (damaged files are quarantined, never overwritten), so the
junk accumulates forever and the home page renders all of it.

Underneath the noise, the ten real entries are seven workbenches, this
repository (dusk, which runs in normal mode on purpose), one stale
experiment with a `.indusk/` in it, and one directory with no `.indusk/`
at all.

The shape of an InDusk project is a workbench. The project list should say
so.

## Proposed Direction

Three parts, in order: stop the bleeding, clean up once, then show the
right thing.

### 1. Tests cannot touch the real registry

Every test in the indusk-mcp package runs with `INDUSK_HOME` pointed at a
per-run temp directory, set once in the test configuration rather than in
each test. After this, a full test run adds zero entries to
`~/.indusk/projects.json`, and that is the assertion.

<details>
<summary>Technical</summary>

`src/lib/admin/registry.ts` resolves `INDUSK_HOME ?? ~/.indusk`. The four
offenders: `hooks-load-in-cjs-consumer.test.ts`,
`detect-tooling-honesty.test.ts`, `workbench-blindness.test.ts`,
`multi-agent-init.test.ts`. Fix at the vitest project level (`test.env` or
a global setup that creates a temp home), not per test. A guard test reads
the real registry's entry count before and after the suite.

</details>

### 2. One explicit prune, with a backup

A new `indusk ui prune` removes registry entries whose path no longer
exists on disk. It prints what it would remove with `--dry-run`, and when
run for real it writes the previous file beside the new one as a dated
backup before touching anything. This is operator-invoked, so it respects
the standing decision that the registry is never pruned *automatically*.

<details>
<summary>Technical</summary>

Same quarantine naming as the corrupt-file path
(`projects.json.pruned.{ISO}.bak`). Criterion is `existsSync(path)` only;
a directory that exists but has lost its `.indusk/` is not pruned by this
command (it is surfaced by part 3 instead).

</details>

### 3. The list shows workbenches; other `.indusk` dirs are surfaced, not hidden

The home page's main grid shows registered projects whose `.indusk/config.json`
declares a workbench shape. Registered directories that exist and have a
`.indusk/` but are not workbenches appear in a collapsed section below,
labeled as such, with the two ways to resolve each: convert it
(`indusk setup`) or remove its `.indusk/`. Entries whose path is gone are
not shown at all; part 2 is how they leave.

<details>
<summary>Technical</summary>

Filter in the admin app's registry client using the package's `isWorkbench`
/ `readWorkbenchRepos` via a subpath export — never a second copy of the
shape rule. `ProjectGrid` gains a secondary section; a browser test covers
each of the three categories.

</details>

### The rule going forward

Anything with a `.indusk/` is a workbench, or it stops having a `.indusk/`.
Two current exceptions need a decision, recorded here rather than made by
this plan:

- **dusk itself** runs in normal mode by design (its `worktree.shape` is
  unset so the workbench sync hook stays inert). Converting the dev repo to
  a workbench is a separate question with its own consequences.
- **dawn-fde-toolkit** is stale; the likely answer is remove its `.indusk/`
  and deregister it.

## Scope

### In Scope
- Test isolation of `INDUSK_HOME` for the whole indusk-mcp test project
- `indusk ui prune [--dry-run]` with backup
- Home page: workbenches in the grid, other `.indusk` dirs in a collapsed
  section, missing paths hidden

### Out of Scope
- Converting dusk to a workbench (decision, not this plan)
- Automatic pruning (stays refused by decision)
- Any change to `indusk init` / `update` registration itself

## Success Criteria

- Running the full indusk-mcp test suite leaves `~/.indusk/projects.json`
  with the same entry count it had before.
- `indusk ui prune --dry-run` lists the 1,577 dead entries; `indusk ui prune`
  removes them, leaves a dated backup, and a second run is a no-op.
- The home page shows the seven workbenches in the grid and the
  non-workbench `.indusk` directories in a collapsed section, each with
  its resolution options; nothing for paths that no longer exist.

## Depends On
- Nothing.

## Blocks
- Nothing. Small queue.
