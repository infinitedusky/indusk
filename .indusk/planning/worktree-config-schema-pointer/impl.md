---
title: "Worktree config schema pointer — Implementation"
date: 2026-09-14
status: in-progress
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# Worktree config schema pointer — Implementation

## Goal

A materialized worktree config's `$schema` names a file that exists, on every
enable, without touching a config the user already has. Brief:
[brief.md](brief.md). Assertions: [test-plan.md](test-plan.md).

## Scope

### In Scope
- `on_enable.sh` ships `config.schema.json` beside the configs, refreshed on
  every enable
- The template's pointer becomes `./config.schema.json`
- One integration test file that runs the real hook on a workbench fixture
- Reference note and changelog entry

### Out of Scope
- The schema's contents or the validator's loading
- Rewriting the pointer inside already-materialized consumer configs

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | `src/__tests__/worktree-config-schema-pointer.test.ts`, RED | `init-workbench.test.ts`'s fixture shape (canonical clone + workbench dir + `runCli`) |
| Build Phase 1 | the hook copy step, the template pointer, docs | the test file |

## Test Trajectory

Test paths are repo-root-relative.

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | After `init --workbench` on a fresh fixture, the starter config's `$schema`, resolved relative to the config file, names a file that exists | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |
| A2 | `.indusk/worktree-configs/config.schema.json` is byte-identical to `extensions/worktree/config.schema.json`; enabling again after the package copy is modified (via a temp `EXT_DIR` copy) refreshes it | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |
| A3 | A pre-seeded `<repo>.json` is byte-untouched after enable while its sibling `config.schema.json` is written | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |
| A4 | The shipped template's `$schema` contains no `../` segment | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |

### Deferred Verification

- **Editor completion in a materialized config (U1)**
  - reason: whether VS Code resolves a relative `$schema` and offers completion is editor behavior with no headless check
  - would require: an editor harness, which this bugfix does not justify
  - mitigation: one manual smoke at Build Phase 1 close, recorded in the Verification checkoff text with the VS Code version used

## Checklist

### Test Phase 1: Author every assertion, RED

**Goal**: author A1–A4 against the current hook and template, each red on its own assertion.

- [x] Confirm this plan's worktree: `dusk-worktrees/worktree-config-schema-pointer` on `plan/worktree-config-schema-pointer` (worktree-per-plan default) — created 2026-09-14 from main, `pnpm install` + `pnpm --filter indusk-mcp build` run so the CLI-spawning tests do not skip
- [x] (`extensions enable` short-circuits on "already enabled", so the later-enable helper runs `worktree _on-enable` directly, the same command the manifest's hook runs) Write `src/__tests__/worktree-config-schema-pointer.test.ts` with a fixture copied from `init-workbench.test.ts` (canonical clone `demo` with a commit, a workbench dir with `package.json`, `runCli` with `INDUSK_BIN`), plus a helper `enableWorktree(workbenchDir)` that runs `init --workbench --wrapped-repo demo --sibling-parent <root> --no-index` once and `extensions enable worktree` on later calls
- [x] Author A1: read `.indusk/worktree-configs/demo.json`, resolve its `$schema` against the config's directory, `existsSync` — RED today (resolves to `<workbench>/config.schema.json`, absent) — observed: `$schema "../../config.schema.json" resolves to …/demo-workbench/config.schema.json: expected false to be true`
- [x] Author A2: compare the sibling schema to the package's; then point `EXT_DIR` at a temp copy of the extension whose `config.schema.json` has one extra `"description"` and enable again, expect the sibling to match the temp copy — RED today (no sibling schema). **Mechanism changed while authoring**: the CLI resolves `on_enable.sh` from the package root, so a temp `EXT_DIR` cannot be injected; the refresh half instead overwrites the materialized sibling with `{"stale": true}` and expects the next `_on-enable` to restore the package's copy. Same claim (refreshed on every enable), no package file touched. Observed red: `no schema beside the configs after enable`
- [x] Author A3: pre-seed `demo.json` with `{"trunk_branch":"keep-me"}` before enabling, expect it byte-equal after and the sibling schema present — RED today on the schema half — observed: config byte-equal, `schema not written beside a pre-existing config`
- [x] Author A4: read the template, expect `JSON.parse(...).$schema` not to match `/\.\.\//` — RED today (`../../config.schema.json`) — observed: `expected '../../config.schema.json' not to match /\.\.\//`

#### Test Phase 1 Verification
- [x] All four red on their own assertion, none on a load error: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-pointer.test.ts` — expected: 4 failed, each failure message naming the assertion (`existsSync` false / schema missing / template pointer) — 2026-09-14: 4 failed, messages quoted on each authoring item above; no load error
- [x] Rows A1–A4 set to `written`
- [x] Shape (Test Phase 1, recorded by hand — the Shape library addresses phases by number and cannot see a test phase): reviewed `worktree-config-schema-pointer.test.ts` against the typescript and testing craft prose — one fixture with one job, two named helpers whose names say what they are for (`initWorkbench`, `reEnable`), every assertion reached over the process boundary. Nothing to change. All rule sets readable.

#### Test Phase 1 Context
- [x] Add to Known Gotchas: "Enabling an extension copies only its `manifest.json` into `.indusk/extensions/<name>/`; any file an extension's output must point at (a schema, a template) has to be shipped by its `on_enable` hook explicitly — the worktree config's `$schema` pointed at a file that never left the package."

#### Test Phase 1 Document
- [x] `apps/docs/src/changelog.md` Unreleased, Fixed: "The worktree starter config's `$schema` pointer resolves. It named `../../config.schema.json`, a file no project has; `on_enable` now ships the schema beside the configs and the pointer is `./config.schema.json`. Existing configs: edit the pointer by hand, the schema is refreshed on the next enable."

### Build Phase 1: Ship the schema beside the configs

- [x] `extensions/worktree/hooks/on_enable.sh` step 3: before the per-repo loop, `mkdir -p "$CONFIG_DIR"` and `cp "$EXT_DIR/config.schema.json" "$CONFIG_DIR/config.schema.json"` unconditionally, with an `echo "  schema: $CONFIG_DIR/config.schema.json"` line; the per-repo `if [[ ! -f "$CONFIG_FILE" ]]` guard is unchanged
- [x] `extensions/worktree/templates/worktree-config.template.json`: `"$schema": "./config.schema.json"`
- [x] Update the docblock at the top of `on_enable.sh` (step 4's description) to name the schema copy

#### Build Phase 1 Verification
- [x] A1–A4 green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-pointer.test.ts` — expected: 4 passed (2026-09-14: 4 passed)
- [x] The existing enable path still passes: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/init-workbench.test.ts src/__tests__/worktree-cli.test.ts` — expected: all pass (2026-09-14: 3 files, 16 passed in the combined run)
- [ ] U1 manual smoke: open a materialized `demo.json` from a fixture in VS Code, type a new key, see completion from the schema — record the VS Code version in this checkoff
- [x] Rows A1–A4 set to `passing`
- [x] Shape (Build Phase 1): `prepareShapeReview` returned skipped — "Phase 1's verification is not green" — because the U1 manual smoke above is unchecked. Recorded, not silent; the review runs once U1 is checked. (The phase's code is a `cp` + `echo` in bash and one JSON string; the module map is `src/lib/shape/shape.ts`, there is no `shape/index.ts` — the work skill's example import path is wrong)

#### Build Phase 1 Context
- [x] (the worktree-extension gotcha, the `indusk setup` line) Update the Workbench topology Conventions entry's pointer sentence, or the worktree-extension gotcha, with one clause: the worktree config schema lives at `.indusk/worktree-configs/config.schema.json`, refreshed on every enable

#### Build Phase 1 Document
- [x] `apps/docs/src/guide/worktree-setup.md`: in the "what init creates" list (around the starter-config line), add the schema file and that editors resolve `$schema` from it

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/extensions/worktree/hooks/on_enable.sh` | copy the schema beside the configs on every enable |
| `apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json` | `$schema` → `./config.schema.json` |
| `apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts` | new |
| `apps/docs/src/guide/worktree-setup.md`, `apps/docs/src/changelog.md` | note + entry |
| `CLAUDE.md` | gotcha + pointer clause |

## Dependencies

- None.

## Notes

- A2's "modified package copy" is done by pointing the hook at a temp copy of
  the whole extension directory (`EXT_DIR` is derived from the script's own
  path, so copy the directory and run the copy's hook), never by editing the
  real package file.
- `extensions enable worktree` on an already-enabled extension: confirm during
  Test Phase 1 whether it re-runs `on_enable`; if it short-circuits, A2 and
  A3's second enable use `extensions disable` then `enable`.
