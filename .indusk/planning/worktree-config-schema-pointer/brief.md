---
title: "Worktree config schema pointer"
date: 2026-09-14
status: accepted
workflow: bugfix
---

# Worktree config schema pointer — Brief

## Bug

When the worktree extension is enabled in a workbench, it writes a starter
config for each declared repo at `.indusk/worktree-configs/<repo>.json`. The
first line of that file tells the editor where its JSON schema lives, so the
editor can offer completion and flag mistakes: which keys exist, that only
`trunk_branch` is required, what shape `preflight` entries take. That pointer
has never resolved, in any project, since the template was written. It says
`../../config.schema.json`, which from the config's folder means a file at the
project root that nothing puts there.

Nothing else notices. The command-line validator loads the schema from inside
the package and never reads the pointer, so every config validates correctly
while every editor shows it as an unknown document. Found by Sandy in a
consumer workbench on 2026-09-14, reading the file.

The relative path could not be fixed by adjusting the dots. Enabling an
extension copies only its manifest into the project, so the schema file never
leaves the package and there is no relative path that reaches it.

<details>
<summary>Technical</summary>

`apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json`
line 2: `"$schema": "../../config.schema.json"`. Materialized by
`extensions/worktree/hooks/on_enable.sh` step 3 (`sed` substitution of
`WRAPPED_REPO_NAME` into `$WORKBENCH_ROOT/.indusk/worktree-configs/<repo>.json`).
The schema is `extensions/worktree/config.schema.json`; the validator
(`src/lib/worktree/validate-config.ts`) resolves it from the package directory
and ignores `$schema`. A project's `.indusk/extensions/<name>/` holds only
`manifest.json` (checked against dusk's own `otel` copy). No test exercises the
template or the materialization step.

</details>

## Fix

Ship the schema next to the configs and point at it. `on_enable.sh` copies
`config.schema.json` into `.indusk/worktree-configs/` alongside the starter
config, refreshing it on every enable so a package upgrade updates it, and the
template's pointer becomes `./config.schema.json`. A config that already
exists is left alone, as today, but its sibling schema is still refreshed.

Two lines of change and one copy. The first test is the bug: a materialized
config's `$schema`, resolved relative to the config file, names a file that
exists.

## Scope

### In Scope
- The template pointer and the schema copy in `on_enable.sh`
- A test that materializes a config through the real hook and resolves the
  pointer
- A note in the worktree reference page that the schema lives beside the
  configs

### Out of Scope
- Changing what the schema says or how the validator loads it
- Migrating existing consumer configs whose pointer is already wrong (a
  re-enable refreshes the schema; the stale pointer in an existing config is
  a one-line hand edit, named in the changelog entry)

## Success Criteria

- Enabling the extension on a fresh workbench fixture leaves
  `.indusk/worktree-configs/config.schema.json` on disk and a starter config
  whose `$schema` resolves to it, proven by a test that runs the real
  `on_enable.sh`.
- Re-enabling on a workbench with an existing config leaves the config
  untouched and the schema refreshed.
- A grep of the template for `../../config.schema.json` finds nothing.
- Opening a materialized config in VS Code shows key completion (manual
  smoke, once).
