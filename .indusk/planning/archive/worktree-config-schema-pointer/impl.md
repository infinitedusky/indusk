---
title: "Worktree config schema pointer — Implementation"
date: 2026-09-14
status: completed
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
| A5 | On a workbench whose worktree extension is already enabled and whose configs folder has no schema (a project enabled before this fix), `indusk update` leaves `.indusk/worktree-configs/config.schema.json` on disk — the changelog's "or `indusk update`" promise | Phase 0 | Phase 2 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |
| A6 | In a versioned workbench (root is a git repo), after enable `git status --porcelain` does not list `.indusk/worktree-configs/config.schema.json` — a package-owned, per-machine file is never offered to `workbench sync` — and `workbench status`/`missingIgnoreRules` names the rule as missing on an ignore file that predates it | Phase 0 | Phase 2 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-versioned.test.ts |
| A7 | A workbench restored from a clone (`workbench restore` against a bare remote, no schema in the clone because it is ignored) has the schema after the documented next step, `indusk update` | Phase 0 | Phase 2 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-pointer.test.ts |

| A8 | On a workbench that declares every repo's `worktrees` location, an InDusk-managed ignore file written before this change gains the schema rule and does NOT gain the flat layout's root deny rule | Phase 0 | Phase 4 | passing | apps/indusk-mcp/src/__tests__/worktree-config-schema-versioned.test.ts |
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
- [x] U1 manual smoke: open a materialized `demo.json` from a fixture in VS Code, type a new key, see completion from the schema — record the VS Code version in this checkoff — 2026-09-14, Sandy, VS Code 1.137.0, as a controlled contrast rather than a single observation: with `"trunk_branch": 5` held constant, pointer `./config.schema.json` (the shipped file, string-only) underlines the `5` with `Incorrect type. Expected "string".` plus the schema's own description; pointer `./config.schema.allow5.json` (a copy beside it edited to allow an integer) shows no underline; a pointer to a name that does not exist underlines `$schema` as unloadable and applies no schema. The diagnostic tracks which file the pointer names, so the pointer selects the schema and the file it names is what is applied. **Corrected record, twice**: a first pass credited grey ghost text `"preflight": []` as schema completion — that was Copilot's inline suggestion, present identically with the pointer broken; a second pass took a single type error as proof, which shows *a* schema loaded but not *which*. Two cache traps on the way: VS Code remembers a failed lookup for a name until `JSON: Clear Schema Cache`, so create the file before typing the pointer; and it may hold a schema's old contents after an edit. Fixture materialized with the fixed CLI at the scratchpad `u1-smoke/demo-workbench`
- [x] Rows A1–A4 set to `passing`
- [x] Shape (Build Phase 1): `prepareShapeReview` returned skipped — "Phase 1's verification is not green" — because the U1 manual smoke above is unchecked. Recorded, not silent; the review runs once U1 is checked. (The phase's code is a `cp` + `echo` in bash and one JSON string; the module map is `src/lib/shape/shape.ts`, there is no `shape/index.ts` — the work skill's example import path is wrong)
- [x] Shape (Build Phase 1, after U1) — reviewed the four files the phase changed (`on_enable.sh`, the template, CLAUDE.md, `worktree-setup.md`) against the typescript and testing craft rules; nothing to change. The hook gained one numbered step with one job, a comment that says why it is unconditional, and the per-repo guard untouched; the template is data; the two prose files are not code. All rule sets readable.

#### Build Phase 1 Context
- [x] (the worktree-extension gotcha, the `indusk setup` line) Update the Workbench topology Conventions entry's pointer sentence, or the worktree-extension gotcha, with one clause: the worktree config schema lives at `.indusk/worktree-configs/config.schema.json`, refreshed on every enable

#### Build Phase 1 Document
- [x] `apps/docs/src/guide/worktree-setup.md`: in the "what init creates" list (around the starter-config line), add the schema file and that editors resolve `$schema` from it

### Phase 2: Falsification — the update path that never re-runs the hook, and a package file in a shared repo

**Goal**: verify whether the attested state holds against three failure modes found by reading the code around the fix rather than the fix itself. (1) The changelog promises existing projects get the schema "on the next enable or `indusk update`"; `update` runs `autoEnableExtensions`, which skips every already-enabled extension, and `extensionsUpdate`, which is third-party only — so no enabled extension's `on_enable` is ever re-run and the promise is false, despite `on_enable.sh`'s own docblock claiming "safe to re-run via `indusk update`". (2) Both generated ignore files for a versioned workbench un-ignore all of `.indusk/` except a machine-local list; the schema is package-owned and per-machine, so `workbench sync` would now commit it into the shared context repo, and two teammates on different package versions would rewrite it at each other on every enable. (3) A restored clone gets the shared configs but, once the schema is ignored, no schema; the documented next step after `restore` is `indusk update`, which is exactly the path (1) says is dead. Each trajectory row captures one hypothesis; each checklist item captures the fix if it confirms. Discarded after investigation: a missing `config.schema.json` in the package aborting the hook under `set -e` before configs materialize (a broken package failing loud is the house style, not a defect), and rewriting an existing config's stale `../../` pointer (the brief scoped it out and A3 asserts the config is untouched).

- [x] `src/bin/commands/extensions.ts`: export the hook runner as `runExtensionHook(projectRoot, name, hook)` (today the private `runHook`) so `update` can call it without duplicating the `INDUSK_BIN` substitution
- [x] (**reshaped by this phase's Shape review**: step 7d was written, then replaced — the worktree manifest declares `on_update` and update.ts's existing on_update firing routes through the one hook runner, so core hardcodes no extension name and the `INDUSK_BIN` substitution applies) `src/bin/commands/update.ts`: a step 7d after `autoEnableExtensions` — for the `worktree` extension, when enabled, re-run `on_enable` (its docblock declares the re-run idempotent: scripts re-copied, package.json scripts merged not duplicated, configs left alone, schema refreshed); print what it refreshed
- [x] `src/lib/worktree/shareable.ts`: one named constant `WORKTREE_SCHEMA_RULE = ".indusk/worktree-configs/config.schema.json"`, emitted in the machine-local section of both `GITIGNORE_HEADER` and `GITIGNORE_DECLARED_HEADER` and in `FLAT_WORKBENCH_RULES`; `missingIgnoreRules` derives a third required entry from it ("the worktree config schema is package-owned and would be committed"); `topUpManagedIgnore` appends the rule on a managed file that lacks it instead of returning early on `ROOT_DENY_RULE` alone (per-rule top-up, marker-guarded as today)
- [x] `workbench.ts` `sync`/`status` path already calls `topUpManagedIgnore` → `missingIgnoreRules` → `untrackNowIgnored`; confirm the new rule flows through it so a workbench that already committed the schema drops it from the index on the next sync, and name that in the changelog

- [x] Shape (`src/bin/commands/update.ts`) — step 7d hardcodes `"worktree"` and re-implements a mechanism this file already has: an `on_update` hook is fired for every enabled built-in extension a hundred lines above it. Which extensions refresh on update is tool knowledge the extension owns (CLAUDE.md: "Extensions own tool knowledge — don't hardcode tool facts in indusk-mcp core"). Rule: the manifest declares `on_update`; core fires what is declared. Delete 7d, declare the hook in `extensions/worktree/manifest.json`
- [x] Shape (`src/bin/commands/update.ts`) — the existing `on_update` firing runs `execSync(updateHook)` directly, so it does NOT apply the `INDUSK_BIN` substitution `runHook` does, which CLAUDE.md marks test-critical; a declared hook fired through that path resolves the bare `indusk` to whatever is installed globally. Rule: one hook runner, not two. Route it through the exported runner
- [x] Shape (`src/bin/commands/extensions.ts`) — `runExtensionHook` is a one-line wrapper delegating to `runHook`, an indirection that carries no behaviour. Rule: typescript — a name worth exporting is worth exporting directly. `export { runHook as runExtensionHook }` gives the same call-site name with no extra function

#### Phase 2 Verification
- [x] A5: fresh fixture, `init --workbench`, delete the sibling schema, run `indusk update` — the schema is back: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-pointer.test.ts` — red today (update never re-runs the hook), green after the update step
- [x] A6: `makeVersionedWorkbench` fixture (root `git init`ed, one declared repo), enable, `git status --porcelain` at the root has no line for the schema; an ignore file carrying the managed marker but not the rule reports it via `missingIgnoreRules` and gains it via `topUpManagedIgnore`: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-versioned.test.ts` — red today, green after the ignore rule
- [x] A7: sibling-layout fixture with a local bare remote (as in `workbench-restore-declared-path.test.ts`), `workbench restore` into a fresh clone, then `indusk update` — the schema exists in the clone — red today, green with A5's fix. **Two corrections while executing**: a first version simulated the clone by copying directories, which is weaker than the row's claim, so it was rewritten against a real `workbench restore` with a bare remote; that version stayed red because the fixture had no `.indusk/extensions/worktree/manifest.json`, so `update` saw no enabled extension and correctly did nothing — a real clone receives the manifest (the ignore rules deny only `.env*` there), and the fixture now models that
- [x] The whole plan's suite plus the ignore-rule and update suites stay green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-pointer.test.ts src/__tests__/worktree-config-schema-versioned.test.ts src/__tests__/init-workbench.test.ts src/__tests__/workbench-restore-declared-path.test.ts $(grep -rl "missingIgnoreRules\|topUpManagedIgnore\|autoEnableExtensions" src --include='*.test.ts')` — expected: all pass

#### Phase 2 Context
- [x] (reshaped by Shape: the rule is now "the manifest declares `on_update`; core fires what is declared, through one runner") Add to Known Gotchas: "`indusk update` re-runs an enabled extension's `on_enable` only when the extension declares the re-run idempotent — today only `worktree` — because `autoEnableExtensions` skips everything already enabled and `extensionsUpdate` is third-party only. A materialized file that must track the package (the worktree config schema) needs an update-time refresh, not just an enable-time copy. Package-owned per-machine files under `.indusk/` are ignored by name in the workbench ignore rules (`WORKTREE_SCHEMA_RULE`), never shared."

#### Phase 2 Document
- [x] `apps/docs/src/changelog.md` 1.44.1 entry: replace "the schema appears on the next enable or `indusk update`" with what is now true — `indusk update` refreshes it, a workbench that already committed the schema drops it from the index on its next `workbench sync`, and the ignore rule is topped up on managed ignore files
- [x] `apps/docs/src/reference/cli/workbench.md` ignore-rules section: the schema is machine-local, listed with `.indusk/eval/` and the lock file, with the reason

### Phase 3: Cleanup — two more private CLI runners, beside a helper that already exists

**Goal**: fold this plan's test files onto `src/__tests__/helpers/cli.ts`, which already owns exactly what they re-derived. This is not a new extraction — the home is settled, and its own docblock records the consolidation (ten byte-identical `runCli` copies, deferred there from a Shape review because the rule of three is cleanup's question). Twenty-one suites import it; this plan wrote the eighteenth and nineteenth private copies instead. Each item below is one migration or a reasoned leave-as-is. The migration is structure-preserving, so no new trajectory row: A1–A7 are the behaviour coverage, and they must stay green through it.

- [x] (also replaced the fixture's three raw `spawnSync` git calls with the throwing `git` helper already imported — removing the private runner took `spawnSync` with it, and a fixture that cannot establish its precondition should fail loudly rather than silently) `src/__tests__/worktree-config-schema-pointer.test.ts`: delete the private `REPO_ROOT`, `CLI_BIN`, `SHOULD_SKIP` and `runCli`; import all four from `./helpers/cli.js`. The private `runCli` differs only in passing `INDUSK_BIN` and a 60s timeout — `INDUSK_BIN` moves to the helper's `env` parameter (`runCli(cwd, args, { INDUSK_BIN: \`node ${CLI_BIN}\` })`), and the timeout goes: the helper deliberately has none, and a spawn that hangs should hang visibly rather than return a fabricated `code: -1` that reads as a CLI failure. Basis: the rule of three, already met and already homed
- [x] `src/__tests__/worktree-config-schema-versioned.test.ts`: same four, plus rewrite `enableWorktree` as a one-line wrapper over the shared `runCli` — the name is worth keeping (it says which CLI call this is, and every test in the file makes it), the second spawn body is not. Basis: rule of three
- [x] Re-derived `REPO_ROOT` is the specific hazard here, not just duplication: the helper's docblock records that computing it wrongly does not fail — it makes `CLI_BIN` point at nothing, `SHOULD_SKIP` go true, and the suite report green by not running, which cost ten silently-skipped files. Two files computing it by hand is two more chances at that. After the migration, `grep -c 'resolve(__dirname' ` over both files is 0
- [x] (reviewed `src/bin/commands/extensions.ts` at 1020 lines and `src/bin/commands/update.ts` at 939 — left as-is: this plan added an export alias and a docblock to one and reshaped ~30 lines in the other; both are pre-existing monoliths whose decomposition is the cleanup-ritual plan's standing "first customer" follow-up, named there and not this plan's output)
- [x] (reviewed `src/lib/worktree/shareable.ts` — left as-is: the new `WORKTREE_SCHEMA_RULE` sits with `ROOT_DENY_RULE` and `SECRETS_RULE` under the docblock that exists to keep the generator and its checker reading one constant. Moving it out would recreate the drift that comment records)
- [x] (reviewed the schema path crossing the TS/bash boundary — `WORKTREE_SCHEMA_RULE` in `shareable.ts`, `$CONFIG_DIR/config.schema.json` in `on_enable.sh`, `./config.schema.json` in the template — left as-is, and recorded as covered: bash and TS cannot share a constant, so the deliberate-port rule applies (`_hook-paths.js` / `workbench-helpers.sh`), and A6 is the pin that makes a drift fail. It runs the real hook and then asserts git does not offer the file, so the write path and the ignore rule must name the same thing or the test goes red)
- [x] (reviewed `apps/docs/src/changelog.md` at 646 lines and `reference/cli/workbench.md` at 403 — left as-is: prose, and the changelog is append-only by construction)
- [x] (Build Phase 1's files — `extensions/worktree/hooks/on_enable.sh` at 106 lines and the config template — are NOT in this scan: they merged to main before this phase branched, so `main...HEAD` cannot see them. Reviewed by reading: a `mkdir`/`cp`/`echo` inside the hook's existing numbered-step structure, and one JSON string. Nothing to decompose)

#### Phase 3 Verification
- [x] (no tests flip at this phase — reason: refactor)
- [x] A1–A7 stay green through the migration, and the count that proves the suites actually ran: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-pointer.test.ts src/__tests__/worktree-config-schema-versioned.test.ts` — expected: 2 files, 8 passed, **0 skipped** (a wrong `REPO_ROOT` shows up as skipped, not failed)
- [x] The suites that already import the shared helper are unaffected: `cd apps/indusk-mcp && pnpm exec vitest run $(grep -rl 'from \"./helpers/cli.js\"' src/__tests__ | tr '\n' ' ')` — expected: all pass

#### Phase 3 Context
- [x] (none — internal test decomposition onto an existing helper; the helper and its rationale are already recorded in CLAUDE.md's single-definition gotcha, and this plan adds no new rule)

#### Phase 3 Document
- [x] (none — no public surface changes; `helpers/cli.ts` is test-only)

### Phase 4: The declared layout never reached the top-up

**Goal**: close the hole the retrospective's docs audit found in Phase 2's own fix. `refuseIfIgnoreCannotHold` returns early when `allLocationsDeclared(repos)` — correctly, since a declared layout needs no deny-by-default rule — and `topUpManagedIgnore` sits *after* that return. So a declared-layout workbench whose ignore file predates this plan never gains the schema rule and keeps offering `config.schema.json` to its shared repo: A6's claim ("the schema is machine-local, never shared") holds only for flat workbenches, and A6's own fixture declares no `worktrees`, so it could not see this. Verified by running the two functions against a declared fixture, not by reading. The naive fix is wrong too — the top-up block carries the root deny rule, and appending that to a declared workbench inverts an ignore file this code refuses to rewrite on purpose.

- [x] `src/lib/worktree/shareable.ts`: split the machine-local rules out of `FLAT_WORKBENCH_RULES` into `MACHINE_LOCAL_RULES` (`WORKTREE_SCHEMA_RULE`, `.indusk/current.md.lock`) — rules every workbench needs whatever its layout. `topUpManagedIgnore(root, { layoutDeclared })` tops up machine-local always and the flat block only when the layout is not declared
- [x] `src/bin/commands/workbench.ts` `refuseIfIgnoreCannotHold`: compute `allLocationsDeclared` once, run the top-up *before* the declared-layout early return, and pass the flag. The refusal itself stays flat-only — a declared layout has nothing to refuse

#### Phase 4 Verification
- [x] (authored first as a unit test naming the new signature — it failed to LOAD, which is an absent test, not a red one; rewritten to drive `workbench sync` over the CLI boundary, where it was red on its own assertion) A8: declared fixture (`repos: [{ name: "alpha", worktrees: "wts" }]`) with a managed ignore file carrying the marker and no schema rule — after the top-up the file contains `WORKTREE_SCHEMA_RULE` and still does not contain `/*/`: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-versioned.test.ts` — red today (the declared branch never tops up), green after
- [x] A6 and the flat top-up keep their behaviour, and the ignore-rule consumers stay green: `cd apps/indusk-mcp && pnpm exec vitest run src/__tests__/worktree-config-schema-versioned.test.ts src/__tests__/worktree-config-schema-pointer.test.ts $(grep -rl "topUpManagedIgnore\|missingIgnoreRules\|ensureShareableScaffolding" src --include='*.test.ts' | tr '\n' ' ')` — expected: all pass

#### Phase 4 Context
- [x] Extend the gotcha this plan wrote: the machine-local rules reach every layout, the deny-by-default rules only a flat one — and a guard that returns early for one layout must not carry unrelated work behind it

#### Phase 4 Document
- [x] `apps/docs/src/changelog.md`: the 1.44.1 ignore-rule entry currently says a managed file "gains it" without qualification, which was true only for flat workbenches — say what actually happens for both layouts

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
