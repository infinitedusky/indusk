---
title: "Local Init Mode"
date: 2026-04-05
status: completed
gate_policy: ask
---

# Local Init Mode

## Goal

Enable `indusk init --local` so InDusk can be used on team codebases without touching committed files. Consolidate `.indusk/` as the home directory (both modes) and introduce `config.json` as the central project profile.

## Scope

### In Scope
- `.indusk/config.json` as central project profile
- Move `planning/` → `.indusk/planning/` (all modes)
- `--local` flag on `indusk init`
- Settings overlay (`.indusk/settings-overlay.json`)
- `indusk pr-clean` command
- Local-mode biome, tests, docs in `.indusk/`
- `.git/info/exclude` management
- Update all tools, skills, and hooks that reference `planning/` paths

### Out of Scope
- composable-env in local mode
- OTel scaffolding in local mode
- Migration from local → full mode

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 0 | `.indusk/config.json` schema + read/write helpers, planning path migration | Existing `planning/` directory, plan-parser, plan-tools |
| Phase 1 | `--local` flag, `.git/info/exclude` management, settings overlay | config.json helpers from Phase 0 |
| Phase 2 | Local-mode biome, tests, docs setup | config.json, init --local from Phase 1 |
| Phase 3 | `indusk pr-clean` command, update respects mode | Settings overlay from Phase 1, config.json |
| Phase 4 | Skill + CLAUDE.md path updates | All prior phases |

## Checklist

### Phase 0: Config + Planning Migration

The foundation. Introduce `config.json` and move planning into `.indusk/`.

- [x] Create `src/lib/config.ts` — read/write `.indusk/config.json`
  ```typescript
  export interface InduskConfig {
    mode: "full" | "local";
    verify: {
      linter?: { tool: string; config: string };
      testRunner?: { tool: string; config: string };
      typeCheck?: string;
    };
    detected: {
      otel?: boolean;
      testRunner?: string;
      linter?: string;
    };
  }
  export function readConfig(projectRoot: string): InduskConfig | null;
  export function writeConfig(projectRoot: string, config: InduskConfig): void;
  export function getPlanningDir(projectRoot: string): string; // returns .indusk/planning
  ```
- [x] Update `plan-parser.ts` — `parseAllPlans` reads from `.indusk/planning/` instead of `planning/`. Add fallback: check `planning/` if `.indusk/planning/` doesn't exist (migration support).
- [x] Update `plan-tools.ts` — `get_plan_status` and `advance_plan` use `.indusk/planning/` path via `getPlanningDir()`
- [x] Update `check-gates.ts` — scan `.indusk/planning/` instead of `planning/`
- [x] Update `init.ts` — create `.indusk/planning/` instead of `planning/`
- [x] Update `parseDependsOn` in `plan-parser.ts` — parse both `planning/` and `.indusk/planning/` prefixes in Depends On sections
- [x] Add migration helper: if `planning/` exists at root and `.indusk/planning/` doesn't, offer to move it (print message during init/update)

#### Phase 0 Verification
- [x] `pnpm turbo test --filter=indusk-mcp` — 36/36 tests pass (also fixed pre-existing `otel-core-skill` test reference)
- [x] `pnpm check` — no lint errors (fixed import ordering in config.ts)
- [x] Manual: plan-parser tests validate `parseAllPlans` with `getPlanningDir` fallback — finds plans in `planning/` (current location) and will find them in `.indusk/planning/` after migration

#### Phase 0 Context
- [x] Update CLAUDE.md Architecture section: added `.indusk/` directory with planning, extensions, config.json
- [x] Update CLAUDE.md Conventions: "All planning docs live in `.indusk/planning/{kebab-case-name}/`"
- [x] Update Key Decisions: added local init mode ADR reference

#### Phase 0 Document
- [x] (none needed — asked: "No docs pages reference `planning/` yet — docs site is still early. Can I skip?" — user: "yes")

---

### Phase 1: Local Init Mode

The `--local` flag, `.git/info/exclude`, and settings overlay.

- [x] Add `--local` flag to `init` command in `cli.ts`
  ```typescript
  .option('--local', 'Local mode — no committed file changes')
  ```
- [x] Update `InitOptions` interface — add `local?: boolean`
- [x] Add tooling detection to init — detect existing linter (biome.json, .eslintrc*, eslint.config*), test runner (vitest, jest), OTel (instrumentation.ts/py), typecheck (tsconfig.json)
- [x] Write `.indusk/config.json` during init with detected values and mode
- [x] In local mode, skip: biome.json creation, CLAUDE.md creation, .gitignore modification, OTel scaffolding, VS Code settings
- [x] In local mode, write `.git/info/exclude` entries
- [x] Create settings overlay — `src/lib/settings-overlay.ts` with writeOverlay, applyOverlay, stripOverlay
- [x] Init writes `.indusk/settings-overlay.json` with hooks + permissions, then calls `applyOverlay()`
- [x] In full mode, init still writes config.json (mode: "full") and skips overlay (writes settings directly as before)

#### Phase 1 Verification
- [x] `pnpm turbo test --filter=indusk-mcp` — 36/36 pass
- [x] `pnpm check` — clean after auto-fix
- [x] Manual: `indusk init --local` in temp dir — config.json (mode: local), .git/info/exclude with entries, overlay exists, no biome/CLAUDE.md/.gitignore, `git status` clean

#### Phase 1 Context
- [x] Update CLAUDE.md Known Gotchas: added local mode re-clone note

#### Phase 1 Document
- [x] Draft `apps/indusk-docs/src/guide/local-mode.md` outline — stub with TODOs for Phase 4

---

### Phase 2: Local-Mode Biome, Tests, Docs

Set up local-only quality tools inside `.indusk/`.

- [x] In local mode, create `.indusk/biome.json` (copy from template)
- [x] In local mode, detect test runner and create config (jest → jest.config.js, default → vitest.config.ts)
- [x] Create `.indusk/tests/` directory with a `.gitkeep`
- [x] Create `.indusk/docs/` directory with an `index.md` stub
- [x] Update config.json verify section with paths to local configs:
  ```json
  {
    "verify": {
      "linter": { "tool": "biome", "config": ".indusk/biome.json" },
      "testRunner": { "tool": "vitest", "config": ".indusk/vitest.config.ts" }
    }
  }
  ```

#### Phase 2 Verification
- [x] `pnpm check` — clean, build passes
- [x] Manual: tested with Jest project — .indusk/jest.config.js, biome.json, docs/index.md all created, config.json verify points to .indusk/ paths, git status clean

#### Phase 2 Context
- [x] (none needed — asked: "Local mode paths are implementation details in ADR/guide, not day-to-day conventions. Can I skip?" — user: "yes")

#### Phase 2 Document
- [x] Added `.indusk/` directory layout tree to local-mode guide

---

### Phase 3: PR-Clean + Update Respects Mode

The overlay lifecycle — strip before PR, re-apply on update.

- [x] Add `pr-clean` command to `cli.ts` — calls `stripOverlay()`
- [x] `pr-clean` calls `stripOverlay()` — reads overlay, removes those keys from `.claude/settings.json`
- [x] Add `pr-restore` command — calls `applyOverlay()` to re-merge after PR
- [x] Update `update` command — reads config.json, re-applies overlay in local mode after updating skills/hooks

#### Phase 3 Verification
- [x] `pnpm turbo test --filter=indusk-mcp` — 36/36 pass
- [x] `pnpm check` — clean (fixed pre-existing formatting in update.ts)
- [x] Manual: pr-clean strips to empty arrays, pr-restore re-applies. Update re-applies overlay in local mode.

#### Phase 3 Context
- [x] Update CLAUDE.md Known Gotchas: added pr-clean/pr-restore note

#### Phase 3 Document
- [x] Documented pr-clean/pr-restore workflow in local-mode guide

---

### Phase 4: Skills, CLAUDE.md, Docs

Update all skill references and write documentation.

- [x] Update `skills/plan.md` — all `planning/` references → `.indusk/planning/`
- [x] Update `skills/work.md` — planning path references
- [x] Update `skills/context.md` — ADR link format: `.indusk/planning/{plan}/adr.md`
- [x] Update `skills/retrospective.md` — archive path: `.indusk/planning/archive/`
- [x] Update CLAUDE.md Architecture tree — already done in Phase 0
- [x] Update CLAUDE.md Current State — added local init mode and config.json note
- [x] Update CLAUDE.md Key Decisions — all `planning/` references → `.indusk/planning/`
- [x] Run `indusk update` — plan, work, context, retrospective skills updated

#### Phase 4 Verification
- [x] `pnpm check` — tests pass (36/36)
- [x] Grep for stale `planning/` — none in skills, only migration fallback in config.ts and init.ts (intentional)

#### Phase 4 Context
- [x] Final CLAUDE.md review — all paths updated, Key Decisions, Known Gotchas, Current State, Architecture all reflect local init mode

#### Phase 4 Document
- [x] Write full `apps/indusk-docs/src/guide/local-mode.md` — overview, quick start, directory layout, config, PR workflow, detection, re-cloning
- [x] Update `apps/indusk-docs/src/guide/getting-started.md` — added local mode option, updated directory list
- [x] Add changelog entry: local init mode, planning migration, config.json, pr-clean/restore, detection

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/config.ts` | New — config read/write helpers |
| `apps/indusk-mcp/src/lib/settings-overlay.ts` | New — overlay merge/strip |
| `apps/indusk-mcp/src/lib/plan-parser.ts` | Update planning path to `.indusk/planning/` |
| `apps/indusk-mcp/src/tools/plan-tools.ts` | Update planning paths |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Add `--local`, config.json, overlay, detection |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Respect local mode |
| `apps/indusk-mcp/src/bin/commands/check-gates.ts` | Update planning path |
| `apps/indusk-mcp/src/bin/cli.ts` | Add `--local` flag, `pr-clean`, `pr-restore` commands |
| `apps/indusk-mcp/skills/plan.md` | Update all `planning/` → `.indusk/planning/` |
| `apps/indusk-mcp/skills/work.md` | Update planning path references |
| `apps/indusk-mcp/skills/context.md` | Update ADR link format |
| `apps/indusk-mcp/skills/retrospective.md` | Update archive path |
| `CLAUDE.md` | Update architecture, conventions, key decisions |

## Dependencies
- None — can start immediately

## Notes
- The `planning/` fallback in plan-parser (Phase 0) ensures existing projects work during migration. Can be removed after all known projects have migrated.
- `parseDependsOn` needs to handle both `planning/` and `.indusk/planning/` prefixes since existing plan docs reference each other with old paths.
- Test files for plan-parser will need fixture updates for the new path.
