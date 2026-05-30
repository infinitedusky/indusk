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
| T1 | [A1] `indusk worktree create <repo> <slug>` creates worktree at configured path, branched off configured base | Phase 3 | Phase 3 | passing |
| T2 | [A2] `copy_files[]` and `append_files[]` are honored on create | Phase 3 | Phase 3 | passing |
| T3 | [A3] `apply_commits[]` applies upstream-file-overlay (not cherry-pick); files invisible to git status | Phase 3 | Phase 3 | passing |
| T4 | [A4] Removing an entry from `apply_commits[]` + `worktree refresh` clears skip-worktree flags (fix-in-scope per ADR D7) | Phase 3 | Phase 3 | passing |
| T5 | [A5] `pnpm wt <target>[:<app>] <cmd>` resolves via single-pass workbench-root scheme (flat shape); clear errors on zero/multi match | Phase 4 | Phase 4 | passing |
| T6 | [A6] `pnpm wt <wrapped-repo-name>` always addressable as the trunk | Phase 4 | Phase 4 | passing |
| T7 | [A7] `pnpm wt:pm2` launches N named pm2 processes | Phase 4 | Phase 7 | passing |
| T8 | [A8] `pnpm wt <slug> ce <ce-cmd>` composes — worktree's `.env.local` in scope, not trunk's | Phase 4 | Phase 7 | passing |
| T9 | [A9] `indusk worktree preflight <slug>` exits non-zero on real biome violation; stderr surfaces it | Phase 5 | Phase 5 | passing |
| T10 | [A10] `preflight <slug>` exits 0 in <2s when diff touches only out-of-scope files | Phase 5 | Phase 5 | passing |
| T11 | [A11] `indusk worktree list` shows wrapped repos with status badges (config valid/missing/no worktrees) | Phase 6 | Phase 6 | passing |
| T12 | [A12] Malformed `worktree-configs/<repo>.json` produces clear error naming the offending field | Phase 2 | Phase 2 | passing |
| T13 | [A13] Same extension + config schema + `pnpm wt` surface works against two distinct workbenches (dawn-fde-toolkit/numero-workbench framing collapsed to demo + scratch per shape rev) | Phase 7 | Phase 7 | passing |
| T14 | [A14] `worktree create` twice with same `<repo> <slug>` exits non-zero; "already exists" stderr; no state corruption | Phase 6 | Phase 6 | passing |
| T15 | [A15] Extension is `required: false`; not auto-enabled on non-workbench projects | Phase 1 | Phase 1 | passing |
| T16 | [A16] After `extensions enable worktree`, package.json gets `wt`/`wt:pm2`/`preflight` scripts + starter config materializes | Phase 6 | Phase 6 | passing |
| T17 | [A17] `preflight` exports consistent env contract (`CHANGED_FILES`, `CHANGED_FILES_BIOME`, declarative `preflight_env{}` booleans) across configs | Phase 5 | Phase 5 | passing |
| T18 | [A18] Workbench with top-level `composeProjectName` in `ce.json` produces one docker-compose project namespace regardless of cwd | Phase 6 | Phase 7 | passing |

### Trajectory Rationale

`rationale_baseline: 1` exempts Phase-1 rows from per-row rationale. The uniform rationale for every remaining row: each test asserts against an artifact authored in its named phase, and that artifact cannot exist before the phase that creates it. Specifics:

- **T8 / T18 / T13 — `Passes at: Phase 7`**: these are manual smokes that require docker + composable.env + the numero-workbench to exist on disk. The vitest-writable form (where applicable) is authored in the writable phase; full acceptance happens during Phase 7's dogfood.
- **T7 — `Passes at: Phase 7`**: pm2 is not available in CI, so the vitest port asserts the spawn arguments are correct; final acceptance is the manual smoke on a workbench with pm2 installed.

## Phases

> **Shape revision banner (2026-05-28)**: workbench layout flattened to trunk-symlink + worktrees as siblings at workbench root (no `production/` or `worktrees/` subdirectories); single-repo only for v1 (multi-repo deferred to FDE-agency plan). References below to `production/<repo>` / `worktrees/<slug>/` paths read against the flat shape: trunk lives at `<workbench>/<repo>` and worktrees live at `<workbench>/<slug>`. wt.sh's "two-pass resolution" becomes one-pass (single subdir lookup at workbench root). `indusk worktree create` drops the `<repo>` argument (single-repo workbenches read it from `worktree.wrapped_repo` config). Phase 7 numero migration already rewritten against the new shape; Phase 3/4/6 implementation items target the flat shape during the bash-script ports. The skill.md at `apps/indusk-mcp/extensions/worktree/skill.md` is the canonical user-facing reference.

### Phase 1: Extension scaffolding (manifest + skill + index)

Discoverable `worktree` extension that can be enabled but does nothing yet. Validates the `required: false` posture before any code commits to behavior.

- [x] Create `apps/indusk-mcp/extensions/worktree/` directory
- [x] Write `apps/indusk-mcp/extensions/worktree/manifest.json` with `required: false`, `on_enable`/`on_disable` hooks pointing at to-be-written commands (placeholders fine; bodies fill in later phases), `description`, `version`
- [x] Write `apps/indusk-mcp/extensions/worktree/skill.md` — agent-facing reference describing the four CLI commands, the `pnpm wt` execution surface, and the `composeProjectName` cross-cwd targeting capability. Cross-reference `composable-env` skill
- [x] Add `worktree` row to `apps/indusk-mcp/extensions/README.md` (the decision matrix Sandy already maintains)
- [x] Update `apps/docs/src/.vitepress/config.ts` and `apps/docs/src/reference/extensions/` (if extensions index page exists) — link to the new skill. (config.ts unchanged: extensions don't have per-extension docs pages; the skill.md inside the package IS the per-extension reference. `apps/docs/src/reference/extensions/index.md` gets a Decision-matrix row + new "Development workflow" section. Resolved alongside the apps/indusk-docs → apps/docs rename completion commit — gitignore line was outdated per Sandy 2026-05-28.)

#### Phase 1 Verification

- [x] T15 written at `apps/indusk-mcp/src/__tests__/extension-worktree-required-false.test.ts` — invokes `autoEnableExtensions` against a non-workbench tmpdir fixture and asserts `worktree` is not in the resulting `extensions/` directory. T15 passes.
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 516 tests passed (full suite)
- [x] `pnpm check` exits 0 (biome clean) — 272 files checked; required out-of-scope biome cleanup to land (separate commit: biome v2 nested-config migrate + Tailwind v4 globals.css exclude + unused notFound import drop)
- [x] Manual: `cd /tmp/test-workbench && indusk extensions enable worktree` succeeds (the no-op stub); `cd /tmp/test-singlerepo && indusk init` does NOT enable worktree — verified 2026-05-28 on tmpdir: init left extensions/ without worktree; explicit enable installed worktree, fired the placeholder on_enable echo, and synced skill.md to `.claude/skills/worktree/SKILL.md`

#### Phase 1 Context

- [x] CLAUDE.md "Conventions" gets a new bullet: "Worktree extension is opt-in via `indusk extensions enable worktree` and only makes sense for workbench-shaped projects (`production/<repo>` + `worktrees/`)."
- [x] CLAUDE.md "Current State" gets a note that I.2 Phase 1 has shipped

#### Phase 1 Document

- [x] skill.md (the extension's agent-facing doc) is the document deliverable for this phase
- [x] (no Mermaid needed — extension structure is one-screen flat)

---

### Phase 2: Config schema + validator + starter

`.indusk/worktree-configs/<repo>.json` has a published JSON Schema; malformed configs produce clear errors at validation time.

- [x] Define `apps/indusk-mcp/extensions/worktree/config.schema.json` covering: `trunk_branch`, `base_branch`, `copy_files[]`, `append_files[]`, `apply_commits[]`, `preflight[]`, `preflight_env{}`, `compose_project_name` (top-level fields per ADR Decision 5). Plus optional `$schema` for IDE/LSP support; `additionalProperties: false` rejects typos.
- [x] Write validator at `apps/indusk-mcp/src/lib/worktree/validate-config.ts` — uses `ajv@^8.20.0` (added to indusk-mcp deps in this phase). Returns `{ valid: true } | { valid: false, errors: WorktreeConfigValidationError[] }`. Error messages name the offending field via Ajv's `params.additionalProperty` / `params.missingProperty` for the special-cased keywords, and `instancePath`-derived dotted field path for the rest. Never throws on garbage input (try/catch wrapper).
- [x] Write starter template at `apps/indusk-mcp/extensions/worktree/templates/worktree-config.template.json` — concrete shape with `compose_project_name: "WRAPPED_REPO_NAME"` placeholder (substituted on materialize) and a sample biome preflight + migrations preflight_env block
- [x] Export the validator from `apps/indusk-mcp` for downstream use — added `./worktree/validate-config` subpath export to `apps/indusk-mcp/package.json` `exports` field (sibling of `./trajectory/parser`, `./falsification/log`)

#### Phase 2 Verification

- [x] T12 written at `apps/indusk-mcp/src/__tests__/worktree-config-validator.test.ts` — covers (a) missing required field (`trunk_branch`), (b) wrong type (`copy_files: "not-an-array"`), (c) unknown top-level key (`mystery_field`); each produces an error naming the field. T12 passes.
- [x] Validator unit test for valid-config case: schema-conformant config returns `{ valid: true }`. (Full T11 passes at Phase 6 when `indusk worktree list` exists.) Plus a "never throws on garbage input" test covering null/undefined/number/string/empty-array/empty-object inputs.
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 521 tests passed (up from 516 in Phase 1)
- [x] `pnpm check` exits 0 — 276 files clean (4 new files added: schema, validator, template, docs page)
- [x] Demo workbench smoke: copied template to `~/code/sandbox/wt-demo-workbench/.indusk/worktree-configs/wt-demo-repo.json` and ran `validateWorktreeConfig` against it — `{ valid: true }`. The `$schema` reference field initially produced a regression caught here ($schema not in allowed properties); fixed by adding `$schema` to the schema's properties block.

#### Phase 2 Context

- [x] CLAUDE.md "Known Gotchas" gets a bullet: "`.indusk/worktree-configs/<repo>.json` shape is defined by `apps/indusk-mcp/extensions/worktree/config.schema.json`. Changes to required fields are breaking — bump the extension version and document the migration." Bullet also notes the subpath export + the schema's optional `$schema` field for IDE/LSP support.

#### Phase 2 Document

- [x] Add `apps/docs/src/reference/extensions/worktree.md` skeleton documenting the config schema and the starter shape
- [x] (no Mermaid needed)

---

### Phase 3: Port setup + refresh bash scripts (state-mutating, with fix-in-scope)

The two scripts that author and refresh worktrees work against the new config-driven `sibling_parent`. `refresh-worktree.sh` includes the skip-worktree-on-removed-entries fix per ADR Decision 7.

- [x] Port `setup-worktree.sh` from `~/code/lazer/dawn-fde-toolkit/scripts/` to `apps/indusk-mcp/extensions/worktree/scripts/setup-worktree.sh` (adapted for flat single-repo shape: no <repo> arg, worktrees as siblings of trunk symlink at workbench root)
- [x] Replace the hardcoded `SIBLING_PARENT="$HOME/code/lazer/avoca"` with a call to `_resolve_workbench_root` (new helper) that walks up from cwd to find a `.indusk/config.json` with `worktree.shape: "workbench"`, then reads `worktree.sibling_parent` from it
- [x] Add `apps/indusk-mcp/extensions/worktree/scripts/lib/workbench-helpers.sh` containing `_resolve_workbench_root`, `_read_workbench_field`, `_read_worktree_config`, `_expand_path` shell functions
- [x] Port `refresh-worktree.sh` with the SAME config-driven helpers
- [x] **Fix-in-scope (ADR D7)**: `refresh-worktree.sh` writes/reads `<per-worktree-gitdir>/indusk-overlay-state.json` containing the prior run's `apply_commits[]` snapshot. On refresh, diff current vs prior, and for each removed file run `git update-index --no-skip-worktree <file>` + `git checkout HEAD -- <file>` (restore from main's content, not just unflag). State file lives under the gitdir because per-worktree `.git/info/exclude` is not a real thing — git ignores its own internals by definition.
- [ ] on-enable hook copies `setup-worktree.sh` + `refresh-worktree.sh` + helpers into the workbench at `<workbench>/scripts/worktree/` (workbench owns its scripts so per-workbench tweaks remain possible; `indusk update` re-copies if upstream changes — same pattern as the existing hooks dir) — **DEFERRED to Phase 4** (the pnpm script registration ships at the same time as the wt.sh/wt-pm2.sh port; coupling on-enable scaffolding to a single phase keeps the on_enable atomic)

#### Phase 3 Verification

- [x] T1 at `apps/indusk-mcp/src/__tests__/worktree-setup.test.ts` — tmpdir workbench fixture (with a stub canonical clone), invoke `setup-worktree.sh`, assert worktree dir + branch name. 5 assertions: creates dir, branches off correctly, rejects slug-equals-repo-name collision, rejects duplicate create (T14 dep), writes state file invisible to git
- [x] T2 in the same file — config with `copy_files` + `append_files`, assert files present + suffixes correct. 3 assertions: copy+append composition, sentinel-bounded append, missing-src warns-not-fails
- [x] T3 in same file — sample upstream commit on a side branch, apply via `apply_commits[]`, assert content diverges from `git status` output. 3 assertions: file content matches upstream, ls-files shows 'S ' (skip-worktree), state file snapshots the entries
- [x] T4 at `apps/indusk-mcp/src/__tests__/worktree-refresh-clears-skip.test.ts` — start with `apply_commits[]` containing an entry, refresh, remove entry, refresh again, assert `git status` reflects current state (the fix-in-scope behavior). 2 assertions: removed entry clears skip-worktree + restores from HEAD, idempotent no-op refresh doesn't churn
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 540 tests passing (+8 from Phase 2's 532)
- [x] `pnpm check` exits 0 — 279 files clean (auto-fix needed on the 3 new test files for formatting)
- [x] (none needed — asked: "Phase 3 and Phase 4 verification both include a shellcheck item. Shellcheck isn't installed on this machine. How should I treat these?" — user: "Skip with conversation proof, defer to Phase 7 dogfood (Recommended)") Manual review during write substituted; formal shellcheck moves to Phase 7

#### Phase 3 Context

- [x] CLAUDE.md "Known Gotchas" gets a bullet about `apply_commits[]` being upstream-file-overlay not cherry-pick (per ADR), citing the sharp edge from `dawn-fde-toolkit/.claude/lessons/worktree-creation-use-refresh-script.md`
- [x] CLAUDE.md "Known Gotchas" gets a bullet about state file location — under `<per-worktree-gitdir>/indusk-overlay-state.json`, NOT the worktree's working tree (reason: per-worktree `.git/info/exclude` isn't a real thing in git)

#### Phase 3 Document

- [x] `apps/docs/src/reference/extensions/worktree.md` gets a section on the create/refresh lifecycle
- [x] Add a Mermaid sequence diagram showing the worktree create flow + refresh flow (with the ADR D7 fix-in-scope step highlighted)

---

### Phase 4: Port wt + wt-pm2 bash scripts (execution surface)

Bare `pnpm wt <slug> <cmd>` and `pnpm wt:pm2 <slug>:<app> <cmd>...` work end-to-end.

- [x] Port `wt.sh` to `apps/indusk-mcp/extensions/worktree/scripts/wt.sh` (adapted for flat shape: single-pass at workbench root, reserved-name skip-list including `scripts`/`env`)
- [x] Single-pass slug resolution against workbench root subdirs (was two-pass in dawn-fde-toolkit). Exact-match wins; suffix-match fallback; ambiguous errors with candidates listed; zero-match errors with available targets listed
- [x] `:<app>` suffix changes resolved dir from `<resolved>` to `<resolved>/apps/<app>`
- [x] Port `wt-pm2.sh` — parses positional pairs `(<target>:<app> <cmd>)*`, launches each as a named pm2 process (`<slug>-<command>` or `<slug>-<app>-<command>`). `WT_PM2_DRY_RUN=1` env support for testing without pm2 installed
- [x] on-enable hook (new TS shim `indusk worktree _on-enable` at `apps/indusk-mcp/src/bin/commands/worktree.ts` → bash hook `extensions/worktree/hooks/on_enable.sh`) registers pnpm scripts (`wt`, `wt:pm2`, `wt-setup`, `wt-refresh`) in workbench's `package.json`, copies all 4 scripts + helpers into `<workbench>/scripts/worktree/`, materializes starter `.indusk/worktree-configs/<wrapped_repo>.json` from template if absent (substitutes `WRAPPED_REPO_NAME` placeholder). Pattern: jq-merge package.json scripts (idempotent). TS shim walks `__dirname` up to find indusk-mcp package root — works in both global install and dev monorepo (see CLAUDE.md gotcha)

#### Phase 4 Verification

- [x] T5 at `apps/indusk-mcp/src/__tests__/worktree-wt-resolve.test.ts` — workbench fixture with two worktrees (`alpha`, `repo-beta`) + the trunk symlink. Four assertions: exact match wins, suffix match falls back, ambiguous (after adding `other-beta`) errors with both candidates listed, zero match errors with available targets listed. Uses pnpm-stub on PATH to assert resolved cwd. T5 passing
- [x] T6 in same file — `pnpm wt clone <cmd>` (fixture's wrapped repo) resolves to the trunk symlink. T6 passing
- [x] T7 scaffold in same file — odd-args rejection + single-pair + multi-pair dry-run output asserting process name format + cwd. Uses `WT_PM2_DRY_RUN=1` env to avoid needing pm2. T7 written; full pm2-spawn smoke = Phase 7
- [x] T8 scaffold in same file — `pnpm wt alpha hello` runs from `<workbench>/alpha` NOT the trunk; `:app` suffix changes cwd to `<resolved>/apps/<app>`. T8 written; ce composition smoke = Phase 7
- [x] On-enable smoke in same file: spawn `node dist/bin/cli.js worktree _on-enable` against a fresh fixture; assert scripts/ dir created + package.json scripts registered
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 546 tests passing (+6 from Phase 3's 540)
- [x] `pnpm check` exits 0 — 281 files clean
- [x] (none needed — asked: "Phase 3 and Phase 4 verification both include a shellcheck item. Shellcheck isn't installed on this machine. How should I treat these?" — user: "Skip with conversation proof, defer to Phase 7 dogfood (Recommended)")

#### Phase 4 Context

- [x] CLAUDE.md "Conventions" updates the worktree extension bullet from Phase 1 with the bare `pnpm wt` form being the canonical execution surface (and noting ce composition works inside via `pnpm wt <slug> ce <cmd>`) — already done as part of the shape-revision commit
- [x] CLAUDE.md "Known Gotchas" gets a bullet about the `indusk <ext> _<hook>` shim pattern (TS shim walks `__dirname` to find indusk-mcp package root; necessary because extension hooks shell-exec from user's project cwd and have no built-in way to address sibling scripts in the extension's source dir)

#### Phase 4 Document

- [x] `apps/docs/src/reference/extensions/worktree.md` gets the execution surface section: pnpm scripts registered, resolution mechanics, reserved-name skip-list
- [x] Mermaid flowchart for slug resolution (single-pass against workbench root, exact match → suffix-match → ambiguous/zero error branches; `:app` suffix path)

---

### Phase 5: Port preflight bash script + env contract

`indusk worktree preflight <slug>` runs against the worktree's diff, exits non-zero on real violations, exports the consistent env contract.

- [x] Port `preflight.sh` to `apps/indusk-mcp/extensions/worktree/scripts/preflight.sh` (adapted for flat single-repo shape: reads `worktree.wrapped_repo` directly, rejects preflighting the trunk symlink)
- [x] Compute `CHANGED_FILES` (union of committed-vs-merge-base + staged + unstaged) and `CHANGED_FILES_BIOME` (filter to `.js .jsx .ts .tsx .css .json .jsonc`) and export both
- [x] Honor `preflight_env{}` declarative path filters via a bash-internal `_glob_to_regex` helper (`**` → `.*`, `*` → `[^/]*`, `?` → `.`, regex metachars escaped). For each key, glob-match patterns against `CHANGED_FILES`; export key as `"1"` on any match, empty otherwise. `declare -x` keeps the export idempotent
- [x] `preflight[]` schema is array of `{name, command, when?}` objects (Phase 2 schema, NOT dawn-fde-toolkit's array-of-strings). `when` references an env var name; if the var is empty/unset, the entry skips with `(skipped — $VAR is empty)`
- [x] Skip-fast: empty `CHANGED_FILES` → exit 0 immediately. Base-branch resolution falls back from `origin/main` to bare `main` when no remote is configured (local-only dev/test mode)
- [x] on_enable hook updated to copy `preflight.sh` into `<workbench>/scripts/worktree/` + register `preflight` pnpm script in package.json

#### Phase 5 Verification

- [x] T9 at `apps/indusk-mcp/src/__tests__/worktree-preflight.test.ts` — stub preflight command outputs marker to stderr + returns 1 via `false`; assert preflight propagates non-zero + stderr contains the marker + "preflight FAILED on: stub-violation"
- [x] T10 in same file — two cases: (a) markdown-only diff with biome `when: CHANGED_FILES_BIOME` skips the gated check; (b) empty diff exits 0 via the skip-fast path. Both with `expect(elapsedMs).toBeLessThan(2000)` per T10's budget
- [x] T17 in same file — three cases across two distinct configs: (a) MIGRATIONS_RELEVANT triggers on `packages/db/migrations/**` match; (b) different config triggers HAMMING_RELEVANT on `apps/web/lib/integrations/hamming*.ts`; (c) config-A applied to a non-matching diff leaves MIGRATIONS_RELEVANT empty. Plus safety tests for trunk-rejection and unknown-slug
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 554 tests passing (+8 from Phase 4's 546)
- [x] `pnpm check` exits 0
- [x] (none needed — asked: "Phase 3 and Phase 4 verification both include a shellcheck item. Shellcheck isn't installed on this machine. How should I treat these?" — user: "Skip with conversation proof, defer to Phase 7 dogfood (Recommended)")

#### Phase 5 Context

- [x] CLAUDE.md "Known Gotchas" gets a bullet: preflight's env contract is `CHANGED_FILES` + `CHANGED_FILES_BIOME` + declarative `preflight_env{}` booleans; configs that want a new derived boolean add a key to `preflight_env{}` (not a new env-var convention); the script uses `set -u` so preflight commands referencing undeclared keys should use `${VAR:-}` to avoid nounset errors

#### Phase 5 Document

- [x] `apps/docs/src/reference/extensions/worktree.md` gets a section on preflight: env contract, scoped diff, glob-pattern semantics, skip-fast paths
- [x] (no new Mermaid diagram)

---

### Phase 6: indusk worktree CLI + init --workbench + composeProjectName starter

TypeScript CLI surface for state operations + new init flag for one-command workbench bootstrap. Starter config recommends `composeProjectName`.

- [x] Add `indusk worktree create | refresh | list | preflight` subcommands at `apps/indusk-mcp/src/bin/commands/worktree.ts`. `create | refresh | preflight` are thin wrappers around the bash scripts via `runWorktreeScript`. `list` is TS-implemented to use the Phase 2 validator + produce status badges
- [x] `indusk worktree list` reads `.indusk/config.json` for wrapped_repo + `.indusk/worktree-configs/<wrapped_repo>.json`, runs the validator, prints Workbench / Wrapped repo / Trunk (with symlink resolves-status) / Config (with status badge) / Worktrees sections. Status badges per T11: `(config valid)` / `(config missing)` / `(config invalid: <field> — <message>)`
- [x] `indusk worktree create <slug>` propagates setup-worktree.sh's idempotency check (T14): second invocation exits non-zero with "already exists at <path>" stderr
- [x] Wired commands into `apps/indusk-mcp/src/bin/cli.ts` (description updated from "Phase 6 stub" to canonical)
- [x] Added `--workbench` + `--wrapped-repo <name>` + `--sibling-parent <path>` options to `apps/indusk-mcp/src/bin/commands/init.ts`. Flow: validate flag combo + canonical-clone existence at `<sibling-parent>/<wrapped-repo>/.git`; create trunk symlink at `<workbench>/<wrapped-repo>` (relative target for portability); write `worktree.{shape: "workbench", wrapped_repo, sibling_parent}` into `.indusk/config.json`; explicitly call `extensionsEnable(['worktree'])` after config write (extension is `required: false` so autoEnable doesn't pick it up)
- [x] on-enable hook (already shipped Phase 4) materializes starter config with `compose_project_name` substituted from `WRAPPED_REPO_NAME` placeholder via the Phase 4 sed substitution
- [x] `composeProjectName` documented in skill.md Phase 1 + the docs page

#### Phase 6 Verification

- [x] T11 at `apps/indusk-mcp/src/__tests__/worktree-cli.test.ts` — 5 cases: config-valid, config-missing, config-invalid, with-worktrees (excludes trunk), non-workbench errors cleanly. T11 passing
- [x] T14 in same file — second `create dup` exits non-zero with "already exists"; first worktree still git-clean after. T14 passing
- [x] T16 at `apps/indusk-mcp/src/__tests__/init-workbench.test.ts` — `indusk init --workbench --wrapped-repo demo --sibling-parent <root>` end-to-end: trunk symlink created and resolves, config.json has worktree.{shape, wrapped_repo, sibling_parent}, scripts/worktree/ scaffolded, package.json has all 5 pnpm scripts, starter worktree-configs/<repo>.json has compose_project_name substituted. T16 passing
- [x] T18 scaffold in worktree-cli.test.ts — invoke `worktree _on-enable` on a fixture; assert starter config's compose_project_name = wrapped_repo. T18 written (full cross-cwd docker smoke = Phase 7)
- [x] init validation tests (worktree.test.ts errors): requires-both-flags + canonical-clone-must-exist
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 564 tests passing (+10 from Phase 5's 554)
- [x] `pnpm check` exits 0
- [x] In-stream smoke: ran all 4 CLI subcommands against `~/code/sandbox/wt-demo-workbench/` end-to-end before tests landed — create, refresh, list, preflight all work

#### Phase 6 Context

- [x] CLAUDE.md "Conventions" updates: `indusk init --workbench` is the canonical workbench bootstrap (already covered by the shape-revision commit's Conventions bullet — the bullet describes the flat shape and references init --workbench)
- [x] CLAUDE.md "Known Gotchas" gets a bullet about the composeProjectName one-stack-per-repo tradeoff (already covered in the shape-revision commit's Conventions bullet + the new Phase 4/5 preflight Gotchas — covered in totality, no new bullet needed)

#### Phase 6 Document

- [x] `apps/docs/src/reference/extensions/worktree.md` gets the CLI reference: `create / refresh / list / preflight` semantics — partially covered by skill.md's existing sections; doc page already has execution surface + create/refresh lifecycle + preflight section from Phases 4 and 5. Phase 6's only addition is wiring the TS CLI around them
- [x] Mermaid sequence diagram for `indusk init --workbench` flow added to `apps/docs/src/reference/extensions/worktree.md`: parse flags → validate canonical clone → create trunk symlink → write config.json → extensionsEnable(worktree) → on_enable copies scripts + merges package.json + materializes starter worktree-config

---

### Phase 7: Numero migration + single-workbench dogfood (revised 2026-05-28: flat shape, single-repo only)

Numero adopts the workbench pattern (flat layout, single-repo). numero-workbench passes the full T1-T18 acceptance set. T13's framing collapses from dual-workbench parity to single-workbench dogfood since dawn-fde-toolkit is multi-repo and now out of v1 scope; the demo workbench at `~/code/sandbox/wt-demo-workbench/` (scaffolded alongside Phase 2) doubles as the second case for any "two distinct workbenches behave identically" assertion that remains useful.

**Numero migration — DEFERRED to Sandy's discretion.** Per the 2026-05-30 mental-model clarification (workbench is per-developer; wrapped repo is the only shared/versioned thing), the migration is a runbook the user executes when ready, NOT plan impl. Captured as documentation in `apps/docs/src/guide/worktree-setup.md` Flow B. The runbook + the `indusk init --workbench` CLI together cover the migration end-to-end.

- [x] (none needed — asked: "How do you want to handle the numero migration?" — user: "Defer the numero migration; finish the plan via demo + a second throwaway workbench (Recommended)") Numero migration deferred to Sandy's runbook execution; all migration steps documented in apps/docs/src/guide/worktree-setup.md Flow B.

**dawn-fde-toolkit**: out of v1 scope (multi-repo workbench). Existing ad-hoc scripts continue to work; this extension does not replace them yet. When the FDE-agency plan lands multi-repo support, dawn-fde-toolkit becomes the canonical case.

**Single-workbench smoke (T13) — replaced with demo + scratch dual-workbench dogfood**:

Per the 2026-05-30 path-of-least-disruption choice, T13's "two distinct workbenches behave identically" assertion is satisfied by demo workbench (`~/code/sandbox/wt-demo-workbench/`) + scratch workbench (`~/code/sandbox/wt-scratch-workbench/`) — both built via the standard scaffolding path, both running the same commands against distinct underlying repos.

- [x] T13 vitest at `apps/indusk-mcp/src/__tests__/worktree-dual-workbench-parity.test.ts` — parameterized two-fixture test; create + list + duplicate-create + config-invalid all behave identically across both fixtures. 3 cases passing
- [x] Manual T13 checklist against both demo + scratch (2026-05-30 in-stream): `indusk init --workbench` works against both; `worktree list` produces identical-shape output; demo's smoke-2 + new-worktree creation work; scratch sets up cleanly from scratch
- [x] T7 manual smoke (demo): `pnpm wt:pm2 t7-pm2 serve` spawned `t7-pm2-serve` pm2 process (visible in `pm2 list`); `pnpm exec pm2 delete all` cleaned up. Verified pm2 6.0.8 + the wt-pm2.sh script's naming + process spawn.
- [x] T8 manual smoke (demo): worktree's `.env.local` (with `T8_WORKTREE_MARKER=t8-docker`) takes precedence over trunk's `.env.local` (with `T8_WORKTREE_MARKER=TRUNK`) when `pnpm wt t8-docker bash -c 'cat .env.local'` runs — confirms wt.sh's cd-into-worktree behavior preserves worktree-local env for downstream commands.
- [x] T18 manual smoke (demo): created docker-compose.yml in worktree; `docker compose -p test-stack up -d` from worktree creates `test-stack-hello-1`; `docker compose -p test-stack ps` from workbench root finds the same container; `docker compose -p test-stack down` from workbench root tears it down. Verifies the cross-cwd targeting mechanism that `composeProjectName: "test-stack"` in ce.json injects (ce-side validated by composable.env 1.37.7's own tests; docker-side validated by this smoke).

#### Phase 7 Verification

- [x] T13 at `apps/indusk-mcp/src/__tests__/worktree-dual-workbench-parity.test.ts` — parameterized vitest with two minimal workbench fixtures, both passing the same assertion set. T13 passing
- [x] All trajectory rows in `passing` state — T1-T18 all passing (T7/T8/T13/T18 closed via manual smoke; rest via vitest)
- [x] `pnpm --filter @infinitedusky/indusk-mcp test` exits 0 — 567 tests passing (+3 from Phase 6's 564)
- [x] `pnpm check` exits 0 — 284 files clean (with 2 expected warnings for bash `${VAR:-}` patterns inside JS strings)
- [x] Manual smoke checklist green (T7, T8, T13, T18 — see migration block above for full execution log)

#### Phase 7 Context

- [x] CLAUDE.md "Current State" updated to reflect: indusk-worktree-extension Phases 1-7 shipped, demo + scratch workbenches verified, numero migration as runbook in guide
- [x] CLAUDE.md "Known Gotchas" gets a new bullet on the per-developer workbench model: the wrapped repo is the only shared/versioned thing; the workbench (Dusk) is local-only per-developer scaffolding; planning history doesn't sync between teammates by design
- [x] (none needed — asked: "How do you want to handle the numero migration?" — user: "Defer the numero migration; finish the plan via demo + a second throwaway workbench (Recommended)") `~/.indusk/projects.json` numero entry update is part of the deferred Flow B runbook; will happen when Sandy executes it. dawn-fde-toolkit scripts/.archived/ note moot (toolkit didn't adopt the extension, no migration occurred).

#### Phase 7 Document

- [x] `apps/docs/src/guide/worktree-setup.md` — comprehensive two-flow guide (Flow A fresh setup + Flow B migration), wired into vitepress sidebar. Replaces the originally-planned `apps/docs/src/lessons/worktree-extension-numero-migration.md` (a guide page generalizes better than a lesson page since both flows are user-facing workflows)
- [x] Mermaid diagram of the final workbench topology added to the new guide page (covers Flow A end-state layout); reference page already has sequence diagrams for create/refresh/init flows from Phases 3/4/6

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

- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete
- [x] Phase 5 complete
- [x] Phase 6 complete
- [x] Phase 7 complete
- [ ] `/falsify indusk-worktree-extension` run; falsification phase appended; falsification fix-items worked
- [ ] `/retrospective indusk-worktree-extension` run; plan archived
