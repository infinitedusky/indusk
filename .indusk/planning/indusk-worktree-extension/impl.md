---
title: "InDusk Worktree Extension — Impl"
date: 2026-05-27
status: in-progress
trajectory: required
rationale_baseline: 1
inputs:
  - adr.md
  - test-plan.md (revision 4)
  - research.md
---

# Worktree Extension — Impl

Trajectory IDs `T1`–`T18` map 1:1 to the test-plan's behavioral assertions `A1`–`A18`. The mapping is preserved in the Asserts column ("[A1] ...") so falsification/retrospective can cross-reference back to the test-plan.

## Boundary Map

| Surface | Touched | Why |
|---|---|---|
| `apps/indusk-mcp/extensions/worktree/` (new dir) | yes | The extension itself: manifest, skill, schema, bash scripts |
| `apps/indusk-mcp/src/bin/commands/init.ts` | yes | New `--workbench` flag per ADR Decision 8 |
| `apps/indusk-mcp/src/bin/commands/extensions.ts` | no | The extension system already handles enable/disable generically (per `local-telemetry` precedent); no new code |
| `apps/indusk-mcp/src/bin/cli.ts` | yes | New top-level `indusk worktree` command (create/refresh/list/preflight) |
| `apps/indusk-mcp/src/lib/scm/` | no | Per ADR Decision 2, bash scripts use `git` directly; jj-backed wrapped repos out of scope for v1 |
| Existing project: `~/code/sandbox/numero/` | move .indusk/ out | Migration step in Phase 7; clone keeps `.git/` + code, loses `.indusk/` |
| New workbench: `~/code/sandbox/numero-workbench/` | create from scratch | Per ADR Decision 3 |
| `~/.indusk/projects.json` (admin UI registry) | deregister numero + register numero-workbench | Phase 7 migration |
| `~/.indusk/telemetry/projects.json` | deregister numero + register numero-workbench (if local-telemetry was enabled) | Phase 7 migration |
| `dawn-fde-toolkit` repo | swap its `scripts/` for the extension's wrappers | Phase 7 dogfood; existing scripts archived to `scripts/.archived/` for one cycle |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | [A1] `indusk worktree create <repo> <slug>` creates worktree at configured path, branched off configured base | Phase 3 | Phase 3 | planned |
| T2 | [A2] `copy_files[]` and `append_files[]` are honored on create | Phase 3 | Phase 3 | planned |
| T3 | [A3] `apply_commits[]` applies upstream-file-overlay (not cherry-pick); files invisible to git status | Phase 3 | Phase 3 | planned |
| T4 | [A4] Removing an entry from `apply_commits[]` + `worktree refresh` clears skip-worktree flags (fix-in-scope per ADR D7) | Phase 3 | Phase 3 | planned |
| T5 | [A5] `pnpm wt <target>[:<app>] <cmd>` resolves via two-pass slug scheme; clear errors on zero/multi match | Phase 4 | Phase 4 | planned |
| T6 | [A6] `pnpm wt trunk` and `pnpm wt <wrapped-repo-name>` always addressable | Phase 4 | Phase 4 | planned |
| T7 | [A7] `pnpm wt:pm2` launches N named pm2 processes | Phase 4 | Phase 7 | planned (manual smoke, pm2 absent in CI) |
| T8 | [A8] `pnpm wt <slug> ce <ce-cmd>` composes — worktree's `.env.local` in scope, not trunk's | Phase 4 | Phase 7 | planned (manual smoke, requires docker) |
| T9 | [A9] `indusk worktree preflight <slug>` exits non-zero on real biome violation; stderr surfaces it | Phase 5 | Phase 5 | planned |
| T10 | [A10] `preflight <slug>` exits 0 in <2s when diff touches only out-of-scope files | Phase 5 | Phase 5 | planned |
| T11 | [A11] `indusk worktree list` shows wrapped repos with status badges (config valid/missing/no worktrees) | Phase 6 | Phase 6 | planned |
| T12 | [A12] Malformed `worktree-configs/<repo>.json` produces clear error naming the offending field | Phase 2 | Phase 2 | planned |
| T13 | [A13] Same extension + config schema + `pnpm wt` surface works against dawn-fde-toolkit AND numero-workbench | Phase 7 | Phase 7 | planned (manual smoke + parameterized vitest) |
| T14 | [A14] `worktree create` twice with same `<repo> <slug>` exits non-zero; "already exists" stderr; no state corruption | Phase 6 | Phase 6 | planned |
| T15 | [A15] Extension is `required: false`; not auto-enabled on non-workbench projects | Phase 1 | Phase 1 | written |
| T16 | [A16] After `extensions enable worktree`, package.json gets `wt`/`wt:pm2`/`preflight` scripts + starter config materializes | Phase 6 | Phase 6 | planned |
| T17 | [A17] `preflight` exports consistent env contract (`CHANGED_FILES`, `CHANGED_FILES_BIOME`, declarative `preflight_env{}` booleans) across configs | Phase 5 | Phase 5 | planned |
| T18 | [A18] Workbench with top-level `composeProjectName` in `ce.json` produces one docker-compose project namespace regardless of cwd | Phase 6 | Phase 7 | planned (manual smoke, requires docker + composable.env ≥ 1.37.7) |

### Trajectory Rationale

`rationale_baseline: 1` exempts Phase-1 rows from per-row rationale. The uniform rationale for every remaining row: each test asserts against an artifact authored in its named phase, and that artifact cannot exist before the phase that creates it. Specifics:

- **T8 / T18 / T13 — `Passes at: Phase 7`**: these are manual smokes that require docker + composable.env + the numero-workbench to exist on disk. The vitest-writable form (where applicable) is authored in the writable phase; full acceptance happens during Phase 7's dogfood.
- **T7 — `Passes at: Phase 7`**: pm2 is not available in CI, so the vitest port asserts the spawn arguments are correct; final acceptance is the manual smoke on a workbench with pm2 installed.

## Phases

### Phase 1: Extension scaffolding (manifest + skill + index)

Discoverable `worktree` extension that can be enabled but does nothing yet. Validates the `required: false` posture before any code commits to behavior.

- [x] Create `apps/indusk-mcp/extensions/worktree/` directory
- [x] Write `apps/indusk-mcp/extensions/worktree/manifest.json` with `required: false`, `on_enable`/`on_disable` hooks pointing at to-be-written commands (placeholders fine; bodies fill in later phases), `description`, `version`
- [ ] Write `apps/indusk-mcp/extensions/worktree/skill.md` — agent-facing reference describing the four CLI commands, the `pnpm wt` execution surface, and the `composeProjectName` cross-cwd targeting capability. Cross-reference `composable-env` skill
- [ ] Add `worktree` row to `apps/indusk-mcp/extensions/README.md` (the decision matrix Sandy already maintains)
- [ ] Update `apps/docs/src/.vitepress/config.ts` and `apps/docs/src/reference/extensions/` (if extensions index page exists) — link to the new skill

#### Phase 1 Verification

- [ ] T15 written at `apps/indusk-mcp/src/__tests__/extension-worktree-required-false.test.ts` — invokes `autoEnableExtensions` against a non-workbench tmpdir fixture and asserts `worktree` is not in the resulting `extensions/` directory. T15 passes.
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0
- [ ] `pnpm check` exits 0 (biome clean)
- [ ] Manual: `cd /tmp/test-workbench && indusk extensions enable worktree` succeeds (the no-op stub); `cd /tmp/test-singlerepo && indusk init` does NOT enable worktree

#### Phase 1 Context

- [ ] CLAUDE.md "Conventions" gets a new bullet: "Worktree extension is opt-in via `indusk extensions enable worktree` and only makes sense for workbench-shaped projects (`production/<repo>` + `worktrees/`)."
- [ ] CLAUDE.md "Current State" gets a note that I.2 Phase 1 has shipped

#### Phase 1 Document

- [ ] skill.md (the extension's agent-facing doc) is the document deliverable for this phase
- [ ] (no Mermaid needed — extension structure is one-screen flat)

---

### Phase 2: Config schema + validator + starter

`.indusk/worktree-configs/<repo>.json` has a published JSON Schema; malformed configs produce clear errors at validation time.

- [ ] Define `apps/indusk-mcp/extensions/worktree/config.schema.json` covering: `trunk_branch`, `base_branch`, `copy_files[]`, `append_files[]`, `apply_commits[]`, `preflight[]`, `preflight_env{}`, `compose_project_name` (top-level fields per ADR Decision 5)
- [ ] Write validator at `apps/indusk-mcp/src/lib/worktree/validate-config.ts` — uses `ajv` (already a dep, or add it) to validate against the schema. Returns `{ valid: true } | { valid: false, errors: Array<{ field, expected, got }> }`. Error messages name the offending field, not stack traces (per T12)
- [ ] Write starter template at `apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json` — the concrete shape from ADR Decision 5, with `compose_project_name: "<repo>"` placeholder
- [ ] Export the validator from `apps/indusk-mcp` for downstream use (subpath export pattern, see how `trajectory/parser` is exported)

#### Phase 2 Verification

- [ ] T12 written at `apps/indusk-mcp/src/__tests__/worktree-config-validator.test.ts` — covers (a) missing required field, (b) wrong type, (c) unknown top-level key; each produces an error message naming the field. T12 passes.
- [ ] Validator unit test for valid-config case: schema-conformant config returns `{ valid: true }`. (Full T11 passes at Phase 6 when `indusk worktree list` exists.)
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0
- [ ] `pnpm check` exits 0

#### Phase 2 Context

- [ ] CLAUDE.md "Known Gotchas" gets a bullet: "`.indusk/worktree-configs/<repo>.json` shape is defined by `apps/indusk-mcp/extensions/worktree/config.schema.json`. Changes to required fields are breaking — bump the extension version and document the migration."

#### Phase 2 Document

- [ ] Add `apps/docs/src/reference/extensions/worktree.md` skeleton documenting the config schema and the starter shape
- [ ] (no Mermaid needed)

---

### Phase 3: Port setup + refresh bash scripts (state-mutating, with fix-in-scope)

The two scripts that author and refresh worktrees work against the new config-driven `sibling_parent`. `refresh-worktree.sh` includes the skip-worktree-on-removed-entries fix per ADR Decision 7.

- [ ] Port `setup-worktree.sh` from `~/code/lazer/dawn-fde-toolkit/scripts/` to `apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh`
- [ ] Replace the hardcoded `SIBLING_PARENT="$HOME/code/lazer/avoca"` with a call to `_resolve_workbench_root` (new helper) that walks up from cwd to find a `.indusk/config.json` with `worktree.shape: "workbench"`, then reads `worktree.sibling_parent` from it
- [ ] Add `apps/indusk-mcp/extensions/worktree/scripts/lib/workbench-helpers.sh` containing `_resolve_workbench_root`, `_read_workbench_config`, `_read_worktree_config` shell functions (~30 LOC)
- [ ] Port `refresh-worktree.sh` with the SAME config-driven helpers
- [ ] **Fix-in-scope (ADR D7)**: `refresh-worktree.sh` writes/reads `worktrees/<slug>/.indusk-overlay-state.json` containing the prior run's `apply_commits[]` snapshot. On refresh, diff current vs prior, and for each removed entry run `git update-index --no-skip-worktree <file...>`. Make the state file gitignored automatically (template a `.gitignore` entry or write to `.git/info/exclude`)
- [ ] on-enable hook copies `setup-worktree.sh` + `refresh-worktree.sh` + helpers into the workbench at `<workbench>/scripts/worktree/` (workbench owns its scripts so per-workbench tweaks remain possible; `indusk update` re-copies if upstream changes — same pattern as the existing hooks dir)

#### Phase 3 Verification

- [ ] T1 at `apps/indusk-mcp/src/__tests__/worktree-setup.test.ts` — tmpdir workbench fixture (with a stub canonical clone), invoke `setup-worktree.sh`, assert worktree dir + branch name
- [ ] T2 in the same file — config with `copy_files` + `append_files`, assert files present + suffixes correct
- [ ] T3 in same file — sample upstream commit on a side branch, apply via `apply_commits[]`, assert content diverges from `git status` output
- [ ] T4 at `apps/indusk-mcp/src/__tests__/worktree-refresh-clears-skip.test.ts` — start with `apply_commits[]` containing an entry, refresh, remove entry, refresh again, assert `git status` reflects current state (the fix-in-scope behavior)
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0; T1–T4 passing
- [ ] `pnpm check` exits 0
- [ ] Shellcheck: `shellcheck apps/indusk-mcp/extensions/worktree/scripts/*.sh` exits 0 (add to dev-deps if not present)

#### Phase 3 Context

- [ ] CLAUDE.md "Known Gotchas" gets a bullet about `apply_commits[]` being upstream-file-overlay not cherry-pick (per ADR), citing the lesson from `dawn-fde-toolkit/.claude/lessons/worktree-creation-use-refresh-script.md`
- [ ] CLAUDE.md "Known Gotchas" gets a bullet about `.indusk-overlay-state.json` being the workbench-internal state file that makes T4's behavior possible

#### Phase 3 Document

- [ ] `apps/docs/src/reference/extensions/worktree.md` gets a section on the create/refresh lifecycle
- [ ] Add a Mermaid sequence diagram showing the worktree create flow: read config → resolve sibling_parent → `git worktree add` → apply copy_files → apply apply_commits + skip-worktree

---

### Phase 4: Port wt + wt-pm2 bash scripts (execution surface)

Bare `pnpm wt <slug> <cmd>` and `pnpm wt:pm2 <slug>:<app> <cmd>...` work end-to-end.

- [ ] Port `wt.sh` from `~/code/lazer/dawn-fde-toolkit/scripts/` to `apps/indusk-mcp/extensions/worktree/scripts/wt.sh`
- [ ] Two-pass slug resolution: `worktrees/<slug>` first, then `production/<slug>`. Suffix-match fallback. Exact-match wins; ambiguous match errors with the candidates listed; zero match errors with the search paths
- [ ] `:<app>` suffix changes resolved dir from `<resolved>` to `<resolved>/apps/<app>`
- [ ] Port `wt-pm2.sh` — parses positional pairs `(<target>:<app> <cmd>)*`, launches each as a named pm2 process (name format: `wt-<slug>-<app>`)
- [ ] on-enable hook registers pnpm scripts in workbench's `package.json`:
  ```json
  {
    "scripts": {
      "wt": "bash scripts/worktree/wt.sh",
      "wt:pm2": "bash scripts/worktree/wt-pm2.sh"
    }
  }
  ```
  Pattern: read package.json, merge scripts, write back. Idempotent — re-running enable doesn't duplicate

#### Phase 4 Verification

- [ ] T5 at `apps/indusk-mcp/src/__tests__/worktree-wt-resolve.test.ts` — workbench fixture with multiple worktrees + a trunk; exercise exact match, suffix match, ambiguous match (asserts the error format), zero match, trunk addressing. Assert each case's exit code + stderr
- [ ] T6 in same file — assert `pnpm wt trunk` and `pnpm wt numero` both resolve to the trunk
- [ ] T7 scaffold (not full pass) — assert wt-pm2.sh parses pairs correctly and would invoke pm2 with the right args (mock pm2 via PATH override; do not require pm2 in CI). Full pass at Phase 7 manual smoke
- [ ] T8 scaffold (not full pass) — assert wt.sh's resolved-dir is the worktree dir (not the trunk) when invoked with a worktree slug. Full ce composition is the Phase 7 manual smoke
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0; T5/T6 passing; T7/T8 written
- [ ] `pnpm check` exits 0
- [ ] Shellcheck passes

#### Phase 4 Context

- [ ] CLAUDE.md "Conventions" updates the worktree extension bullet from Phase 1 with the bare `pnpm wt` form being the canonical execution surface (and noting ce composition works inside via `pnpm wt <slug> ce <cmd>`)

#### Phase 4 Document

- [ ] `apps/docs/src/reference/extensions/worktree.md` gets a section on the execution surface and the two-pass slug resolution
- [ ] Mermaid flowchart for slug resolution: input slug → check `worktrees/<slug>` → check `production/<slug>` → suffix match fallback → exact/ambiguous/zero branches

---

### Phase 5: Port preflight bash script + env contract

`indusk worktree preflight <slug>` runs against the worktree's diff, exits non-zero on real violations, exports the consistent env contract.

- [ ] Port `preflight.sh` from `~/code/lazer/dawn-fde-toolkit/scripts/` to `apps/indusk-mcp/extensions/worktree/scripts/preflight.sh`
- [ ] Compute `CHANGED_FILES` (full diff vs base) and `CHANGED_FILES_BIOME` (filter to biome-relevant extensions) and export both before invoking the config's `preflight[]` commands
- [ ] Honor `preflight_env{}` declarative path filters — for each key, glob-match its patterns against `CHANGED_FILES`; export a boolean env var (e.g., `MIGRATIONS_RELEVANT=true`) when any pattern matches
- [ ] Skip-fast: if `CHANGED_FILES` is empty after diff vs base, exit 0 immediately (~ms scale, never spends multiple seconds for T10's <2s assertion)

#### Phase 5 Verification

- [ ] T9 at `apps/indusk-mcp/src/__tests__/worktree-preflight-violation.test.ts` — commit a known biome violation file to a feature branch; run preflight; assert exit code non-zero + stderr substring contains the violation
- [ ] T10 in same file — touch only out-of-scope files; assert exit code 0 in <2s (vitest timeout/perf assertion)
- [ ] T17 at `apps/indusk-mcp/src/__tests__/worktree-preflight-env-contract.test.ts` — two configs with different `preflight_env{}` declarations; run against synthetic diffs; assert env vars match per-config declaration
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0; T9, T10, T17 passing
- [ ] `pnpm check` exits 0
- [ ] Shellcheck passes

#### Phase 5 Context

- [ ] CLAUDE.md "Known Gotchas" gets a bullet: "Preflight's env contract is `CHANGED_FILES` + `CHANGED_FILES_BIOME` + declarative `preflight_env{}` booleans. Configs that want a new derived boolean add a new key to `preflight_env{}`, not a new env-var convention."

#### Phase 5 Document

- [ ] `apps/docs/src/reference/extensions/worktree.md` gets a section on preflight (env contract, scoped diff)
- [ ] (no new Mermaid diagram)

---

### Phase 6: indusk worktree CLI + init --workbench + composeProjectName starter

TypeScript CLI surface for state operations + new init flag for one-command workbench bootstrap. Starter config recommends `composeProjectName`.

- [ ] Add `indusk worktree create | refresh | list | preflight` subcommands at `apps/indusk-mcp/src/bin/commands/worktree.ts`. Each is a thin wrapper that resolves the workbench root, validates inputs, and shells out to the corresponding bash script (~150 LOC total)
- [ ] `indusk worktree list` reads `.indusk/worktree-configs/*.json`, runs the validator, prints a table: `repo | trunk | worktree-count | status (valid/missing/no worktrees)`. Status badges per T11
- [ ] `indusk worktree create <repo> <slug>` checks idempotency: if `worktrees/<slug>` already exists for this `<repo>`, exit non-zero with the "already exists" message (T14)
- [ ] Wire commands into `apps/indusk-mcp/src/bin/cli.ts`
- [ ] Add `--workbench` flag + `--sibling-parent <path>` option to `apps/indusk-mcp/src/bin/commands/init.ts`. When set: create `production/` + `worktrees/`, mark `worktree.shape: "workbench"` + `worktree.sibling_parent` in `.indusk/config.json`, auto-enable the `worktree` extension
- [ ] on-enable hook (revisit) materializes starter `.indusk/worktree-configs/<repo>.json` for each subdir of `production/` if absent, copying from the template with `<repo>` substitution + `compose_project_name: "<repo>"` populated
- [ ] Document the `composeProjectName` ce.json field recommendation in skill.md (the extension's, not composable-env's — cross-link)

#### Phase 6 Verification

- [ ] T11 at `apps/indusk-mcp/src/__tests__/worktree-list.test.ts` — three configs in three states (valid / missing / no worktrees); assert table output rows
- [ ] T14 at `apps/indusk-mcp/src/__tests__/worktree-create-idempotent.test.ts` — second invocation; assert exit code + stderr substring
- [ ] T16 at `apps/indusk-mcp/src/__tests__/worktree-extension-enable.test.ts` — enable extension against a fresh workbench fixture; assert package.json scripts registered, scripts/ files on disk, starter config materialized at `.indusk/worktree-configs/<repo>.json` with `compose_project_name`. Smoke invocation: `pnpm wt trunk pwd` returns the trunk dir
- [ ] Test for `indusk init --workbench` at `apps/indusk-mcp/src/__tests__/init-workbench.test.ts` — invoke flag; assert directory structure + config shape + extension auto-enabled
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0; T11/T14/T16 passing; T18 written (full pass at Phase 7 manual smoke)
- [ ] `pnpm check` exits 0
- [ ] Smoke: `indusk init --workbench --sibling-parent ~/code/sandbox /tmp/smoke-workbench` followed by `cd /tmp/smoke-workbench && indusk extensions enable worktree && pnpm wt trunk pwd` exits 0

#### Phase 6 Context

- [ ] CLAUDE.md "Conventions" updates: `indusk init --workbench` is the canonical way to bootstrap a workbench (NOT manual mkdir + edit config)
- [ ] CLAUDE.md "Known Gotchas" gets a bullet: "Workbenches set `composeProjectName` in their `ce.json` (top-level) to enable cross-cwd docker-compose targeting. Tradeoff: only one stack per repo runs at a time."

#### Phase 6 Document

- [ ] `apps/docs/src/reference/extensions/worktree.md` gets the CLI reference (`create / refresh / list / preflight`) and the init flag
- [ ] Mermaid sequence diagram for `indusk init --workbench` flow: parse flags → mkdir production/worktrees → write config.json → autoEnableExtensions(worktree) → on_enable runs → register pnpm scripts → seed worktree-configs/

---

### Phase 7: Numero migration + dual-workbench dogfood

Numero adopts the workbench pattern; both dawn-fde-toolkit and numero-workbench pass the full T1-T18 acceptance set. T13 (parity assertion) is the load-bearing close.

**Numero migration (7 steps from ADR)**:

- [ ] `mkdir -p ~/code/sandbox/numero-workbench/{production,worktrees}`
- [ ] `ln -s ../numero ~/code/sandbox/numero-workbench/production/numero`
- [ ] `cd ~/code/sandbox/numero-workbench && indusk init --workbench --sibling-parent ~/code/sandbox`
- [ ] **Migration move**: `mv ~/code/sandbox/numero/.indusk ~/code/sandbox/numero-workbench/.indusk-imported` then merge into workbench's freshly-created `.indusk/` (config.json takes the workbench shape; planning/, eval/, highlights/* are moved over; `worktree-configs/` gets a numero.json entry derived from numero's current shape)
- [ ] `indusk extensions enable worktree` from `~/code/sandbox/numero-workbench/`
- [ ] Re-register: `indusk telemetry deregister ~/code/sandbox/numero` then `indusk telemetry register ~/code/sandbox/numero-workbench` (if local-telemetry was enabled). Admin UI registry: hand-edit `~/.indusk/projects.json` to update the `numero` entry's `path` from `~/code/sandbox/numero` to `~/code/sandbox/numero-workbench`
- [ ] Recreate any existing numero git-worktrees inside the workbench: for each existing entry in numero's `.git/worktrees/`, run `indusk worktree create numero <slug>` in the workbench; then `git worktree remove` the original

**dawn-fde-toolkit adoption**:

- [ ] Archive existing scripts: `mv ~/code/lazer/dawn-fde-toolkit/scripts/{wt,wt-pm2,setup-worktree,refresh-worktree,preflight}.sh scripts/.archived/`
- [ ] Update `~/code/lazer/dawn-fde-toolkit/.indusk/config.json` to add `worktree.shape: "workbench"` and `worktree.sibling_parent: "~/code/lazer/avoca"`
- [ ] `indusk extensions enable worktree` (will install the new scripts from the extension)
- [ ] `pnpm wt cancel-polish lint` should work identically to before

**Dual-workbench smoke (T13)**:

- [ ] Run the manual T13 checklist on both workbenches: create a new worktree, refresh, run a `pnpm wt <slug> dev` command, run `indusk worktree list`, run `indusk worktree preflight <slug>`. Each command's outcome must be functionally identical (same exit codes, same stderr shape, same artifact creation)
- [ ] T8 manual smoke (one workbench, requires docker): `cd ~/code/sandbox/numero-workbench && pnpm wt cancel-polish ce dc:up local` — assert docker-compose comes up with the worktree's env
- [ ] T18 manual smoke (one workbench, requires docker + ce ≥ 1.37.7): with `composeProjectName: "numero"` in the workbench's ce.json, run `pnpm wt cancel-polish ce dc:up local` from the worktree, then `pnpm ce dc:logs` from the workbench root — assert the logs come from the same stack
- [ ] T7 manual smoke (one workbench, requires pm2): `pnpm wt:pm2 cancel-polish:web dev cancel-polish:api dev` — `pm2 list` shows both processes

#### Phase 7 Verification

- [ ] T13 at `apps/indusk-mcp/src/__tests__/worktree-dual-workbench-parity.test.ts` — parameterized vitest with two minimal workbench fixtures, both passing the same assertion set. (Automatable portion; manual smoke above is the full acceptance.)
- [ ] All trajectory rows in `passing` or `skipped` state (T1-T6 passing, T7/T8/T13/T18 passing via manual smoke, T9-T12 passing, T14/T15/T16/T17 passing)
- [ ] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 (full suite)
- [ ] `pnpm check` exits 0
- [ ] Manual smoke checklist (above) all green on both workbenches

#### Phase 7 Context

- [ ] CLAUDE.md "Current State" updated to reflect: I.2 shipped, numero-workbench is the new numero project location, dawn-fde-toolkit has swapped its scripts for the extension
- [ ] CLAUDE.md "Known Gotchas" gets a bullet about the dawn-fde-toolkit archived scripts dir (`scripts/.archived/`) being intentional — one upgrade cycle of safety; can be deleted after a week of clean operation
- [ ] Update `~/.indusk/projects.json` numero entry to new path (already done in impl steps above)

#### Phase 7 Document

- [ ] `apps/docs/src/lessons/worktree-extension-numero-migration.md` — captures the migration as a reusable pattern for any future plain-indusk-project → workbench conversion
- [ ] Add a Mermaid diagram of the final workbench topology (dawn-fde-toolkit and numero-workbench side-by-side, showing where .indusk/ lives, the production/ symlinks, the worktrees/, and the ce.json)

### Deferred Verification

(none — all T-rows have a concrete passing state planned; manual smokes are full passes, not deferrals)

## Phased rollout summary

| Phase | What | Effort | Test rows that pass at close |
|---|---|---|---|
| 1 | Extension scaffolding | ~2h | T15 |
| 2 | Config schema + validator + starter | ~3h | T12 |
| 3 | setup + refresh bash scripts (with fix-in-scope) | ~6h | T1, T2, T3, T4 |
| 4 | wt + wt-pm2 bash scripts | ~4h | T5, T6 (T7/T8 written) |
| 5 | preflight bash script + env contract | ~3h | T9, T10, T17 |
| 6 | TS CLI + `init --workbench` + composeProjectName starter | ~5h | T11, T14, T16 (T18 written) |
| 7 | Numero migration + dual-workbench dogfood | ~4h | T7, T8, T13, T18 (manual smoke pass) |

**Total**: ~27h, fits within the brief's 2-3 days estimate.

## Checklist

- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete
- [ ] Phase 5 complete
- [ ] Phase 6 complete
- [ ] Phase 7 complete
- [ ] `/falsify indusk-worktree-extension` run; falsification phase appended; falsification fix-items worked
- [ ] `/retrospective indusk-worktree-extension` run; plan archived
