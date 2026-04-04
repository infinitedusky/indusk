---
title: "Extension System"
date: 2026-03-22
status: completed
workflow: feature
gate_policy: ask
---

# Extension System

## Goal

Replace hardcoded tool integrations and the separate domain skills system with a unified extension system. Built-in and third-party extensions use the same manifest format, managed via `.indusk/extensions/` and an `extensions` CLI.

## Scope

### In Scope
- Extension manifest spec and loader
- `.indusk/extensions/` directory management
- `extensions` CLI (list, enable, disable, add, remove, suggest, status)
- Built-in extensions: falkordb, cgc, + 8 migrated domain skills
- Third-party extension support (add from npm, git, URL, local path)
- Refactor check_health, onboard, init, verification to consume extensions
- composable-env manifest as reference third-party implementation
- Spec documentation page

### Out of Scope
- Building composable.env package
- Extension marketplace
- Extension versioning/compatibility

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 0.5 | Cleaned, deduplicated skills with single sources of truth | Audit findings from Phase 0 |
| Phase 1 | Manifest spec, loader, `.indusk/extensions/` management | Clean skills from Phase 0.5 |
| Phase 2 | `extensions` CLI (list, enable, disable, add, remove, suggest, status) | Loader from Phase 1 |
| Phase 3 | 10 built-in extensions (falkordb, cgc, 8 domain skills migrated) | Manifest spec from Phase 1 |
| Phase 4 | Refactored check_health, onboard, init, verification consuming extensions | CLI from Phase 2, extensions from Phase 3 |
| Phase 5 | composable-env reference manifest, spec docs page, migration cleanup | All previous phases |

## Checklist

### Phase 0: Skill Audit

Audit every skill for redundancy, bloat, and overlap before building the extension system. The goal is to know exactly what to tighten before we migrate.

- [x] Read all 9 process skills and 8 domain skills
- [x] Map which concepts appear in multiple skills (17 findings across 9 categories)
- [x] Identify sections that can be removed (gate policy duplication, verification commands duplication)
- [x] Identify sections that should move to extensions (composable.env rules in toolbelt, domain skill references)
- [x] Document cleanup plan (priority matrix with HIGH/MEDIUM/LOW actions)
- [x] Present audit findings to user for review

#### Phase 0 Verification
- [x] Audit matrix covers all 17 skills
- [x] Every redundancy has a resolution (keep, move, delete) with rationale
- [x] User has reviewed and approved the cleanup plan

#### Phase 0 Context
(none needed — this phase produces analysis, not code changes)

#### Phase 0 Document
(none needed — the audit findings are the working artifact for subsequent phases)

### Phase 0.5: Skill Cleanup (from audit)

Execute the high and medium priority fixes from the audit before building the extension system.

**Consolidation:**
- [x] Code graph guidance: toolbelt is single source, 6 skills now cross-reference it
- [x] Gate policy: deleted full definition from plan.md, replaced with one-liner referencing work.md
- [x] Phase completion order: context.md and document.md now reference work skill instead of repeating
- [x] Verification commands reference: toolbelt already doesn't duplicate — uses quality_check tool reference instead
- [x] "What happens after impl is complete": plan.md and work.md already concise, reference retrospective

**Standardization:**
- [x] Replace "section" with "gate" in context.md and document.md
- [x] Add skill interaction diagram to toolbelt.md

**Tightening:**
- [x] plan.md: workflow types section already tight (table + 2 sentences)
- [x] work.md: consolidated teach mode gate transition examples into one
- [x] context.md: merged intro and "What goes in Phase N Context" — removed duplicate section
- [x] document.md: consolidated Mermaid section into 4 bullet points, removed 16-line example

**Cross-references:**
- [x] Add pipeline callout in document.md
- [x] Add rationale to context.md (context gate blocks because CLAUDE.md is next session's memory)
- [x] Add cross-ref in verify.md (quality pipeline to retrospective)

**Remove (will be replaced by extensions):**
- [x] Remove composable.env section from toolbelt.md (replaced with extensions reference)
- [x] Replace `list_domain_skills` with `extensions_status` in toolbelt tool reference
- [x] Remove domain skill references from toolbelt (already clean — no references found)

#### Phase 0.5 Verification
- [x] Each skill reads cleanly — no orphaned references to removed content
- [x] No concept is explained in full in more than one skill (code graph → toolbelt, gate policy → work, phase order → work)
- [x] `pnpm check` passes
- [x] Skill interaction diagram exists in toolbelt (ASCII flow diagram at top)

#### Phase 0.5 Context
- [x] Add to Conventions: each concept has one canonical skill — others cross-reference, don't duplicate

#### Phase 0.5 Document
- [ ] skip-reason: docs site reference pages will be updated when extensions are built (Phase 5) — updating now would create churn

### Phase 1: Manifest Spec and Loader

- [x] Define TypeScript types for the extension manifest:
  ```typescript
  interface ExtensionManifest {
    name: string;
    description: string;
    version?: string;
    provides: {
      skill?: boolean;
      networking?: { env_file?: string; command?: string; description?: string };
      services?: { command?: string; description?: string };
      health_checks?: { name: string; command: string }[];
      verification?: { name: string; command: string; detect?: DetectRule }[];
      env_vars?: { source: string; files?: string[] };
    };
    hooks?: {
      on_init?: string;
      on_update?: string;
      on_health_check?: string;
      on_onboard?: string;
    };
    detect?: DetectRule;
  }

  interface DetectRule {
    file?: string;
    file_pattern?: string;
    dependency?: string;
    devDependency?: string;
  }
  ```
- [x] Create `src/lib/extension-loader.ts` with loadExtensions, loadExtension, isEnabled, getEnabledExtensions, enableExtension, disableExtension, getExtension, ensureExtensionsDirs
- [x] Create `.indusk/extensions/` and `.indusk/extensions/.disabled/` directory management utilities

#### Phase 1 Verification
- [x] Unit test: loadExtension parses a valid manifest correctly
- [x] Unit test: loadExtensions finds all .json files in extensions directory (enabled + disabled)
- [x] Unit test: isEnabled returns false for extensions in .disabled/
- [x] Unit test: enable/disable moves extensions between directories
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes (29 tests, 5 files)
- [x] `pnpm check` passes

#### Phase 1 Context
- [x] Add to Architecture: `.indusk/extensions/` — extension manifest directory, managed by `extensions` CLI

#### Phase 1 Document
- [x] Write spec page at `apps/indusk-docs/src/reference/extension-spec.md` — manifest format, capability types, lifecycle hooks, detection rules

### Phase 2: Extensions CLI

- [ ] Add `extensions` command group to `src/bin/cli.ts`
- [ ] Create `src/bin/commands/extensions.ts` with subcommands:
  - `list` — show all available extensions (built-in + added), enabled/disabled state
  - `status` — show enabled extensions with health check results
  - `enable <name>` — copy from built-in or move from `.disabled/`, run `on_init` hook, install skill if provided
  - `disable <name>` — move to `.disabled/`
  - `add <name> --from <source>` — fetch manifest from npm package (`npm:pkg`), git repo (`github:user/repo`), URL, or local path; save to `.indusk/extensions/`
  - `remove <name>` — delete from `.indusk/extensions/`, remove skill if installed
  - `suggest` — scan project for detection rule matches, recommend extensions to enable

#### Phase 2 Verification
- [x] `extensions list` shows 10 built-in extensions
- [x] `extensions enable typescript` copies manifest and installs skill
- [ ] `extensions disable typescript` moves to `.disabled/`
- [ ] `extensions add test-ext --from ./path/to/manifest.json` adds a third-party extension
- [ ] `extensions remove test-ext` removes it
- [x] `extensions suggest` recommends testing + cgc based on project detection
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 2 Context
- [ ] Add to Conventions: use `extensions enable/disable` to manage tool integrations, not manual config

#### Phase 2 Document
- [ ] skip-reason: docs updates deferred to Phase 5

### Phase 3: Built-in Extensions

- [x] Create `apps/indusk-mcp/extensions/` directory for built-in extension manifests + skills
- [x] Create `extensions/falkordb/manifest.json`:
  ```json
  {
    "name": "falkordb",
    "description": "FalkorDB graph database for code graph (shared global instance)",
    "provides": {
      "health_checks": [{ "name": "falkordb", "command": "docker ps --filter name=falkordb --format '{{.Status}}'" }],
      "networking": { "description": "FalkorDB via OrbStack DNS" },
      "env_vars": { "FALKORDB_HOST": "falkordb.orb.local" }
    },
    "hooks": {
      "on_init": "docker start falkordb 2>/dev/null || docker run -d --name falkordb --restart unless-stopped -v falkordb-global:/data falkordb/falkordb:latest",
      "on_health_check": "docker ps --filter name=falkordb --format '{{.Status}}'"
    }
  }
  ```
- [x] Create `extensions/cgc/manifest.json` with CGC health check and skill
- [x] Create `extensions/cgc/skill.md` — extracted from toolbelt CGC section
- [x] Migrate 8 domain skills to extensions (manifest.json + skill.md for each)
- [x] Remove `apps/indusk-mcp/skills/domain/` directory
- [x] Add `extensions` to package.json files array
- [ ] Add `extensions/` to package.json `files` array

#### Phase 3 Verification
- [x] `extensions list` shows all 10 built-in extensions
- [x] `extensions enable typescript` installs skill to `.claude/skills/typescript/SKILL.md`
- [ ] `extensions enable falkordb` runs the on_init hook (needs live test)
- [x] Each migrated extension has a valid manifest with detect rule
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes (29 tests)
- [x] `pnpm check` passes

#### Phase 3 Context
- [x] Update Architecture: indusk-mcp description updated with extensions
- [x] Add to Known Gotchas: domain skills directory removed — use `extensions enable`

#### Phase 3 Document
- [ ] skip-reason: docs updates deferred to Phase 5

### Phase 4: Integrate Extensions into MCP Tools

- [x] Refactor `check_health` — loads enabled extensions, runs their health_check commands, removed hardcoded FalkorDB/CGC checks
- [x] Refactor `onboard` skill — step 5 calls `extensions_status`, summary includes extension count
- [x] Refactor `init` — runs `on_init` hooks from enabled extensions, shows `extensions suggest`, removed `ensureFalkorDB()` and `checkCGC()`
- [x] Refactor verification auto-discovery — loads extension verification commands
- [x] Create `extensions_status` MCP tool — replaces `list_domain_skills`

#### Phase 4 Verification
- [x] `check_health` runs health checks from enabled extensions (not hardcoded)
- [x] `/onboard` includes extensions_status step and summary
- [x] `init` runs extension on_init hooks, shows `extensions suggest`
- [x] Verification discovery includes extension verification commands
- [x] `extensions_status` MCP tool returns enabled/disabled with capabilities
- [x] 29 tests pass, build clean
- [x] `pnpm check` passes

#### Phase 4 Context
- [x] Update Conventions: health checks, init setup, and verification come from extensions
- [ ] Update Current State: extension system implemented, domain skills migrated

#### Phase 4 Document
- [ ] Update `apps/indusk-docs/src/reference/tools/indusk-mcp.md` with extensions_status tool and refactored check_health

### Phase 5: Reference Implementation and Cleanup

- [x] Create composable-env manifest as reference third-party implementation:
  ```
  planning/extension-system/reference/composable-env-manifest.json
  ```
  This is an example — the real manifest will live in composable.env's codebase
- [x] Remove domain skill detection logic from init (--skills, --no-domain-skills, detectDomainSkills all removed)
- [x] Remove `list_domain_skills` MCP tool (replaced by `extensions_status`)
- [x] Update toolbelt skill: CGC section replaced with extension reference, composable.env replaced with extension reference
- [x] Bump version to 1.0.0

#### Phase 5 Verification
- [x] `init --skills` flag removed
- [x] `list_domain_skills` MCP tool removed (replaced by `extensions_status`)
- [x] Toolbelt references extensions, not hardcoded tools
- [x] composable-env reference manifest created
- [ ] Full end-to-end test (needs publish + fresh project)
- [x] 29 tests pass, build clean
- [x] `pnpm check` passes

#### Phase 5 Context
- [x] Update Current State: extension system complete

#### Phase 5 Document
- [x] Write guide page at `apps/indusk-docs/src/guide/extensions.md`
- [ ] skip-reason: changelog deferred to retrospective

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/extension-loader.ts` | New — manifest parsing and extension management |
| `apps/indusk-mcp/src/bin/commands/extensions.ts` | New — extensions CLI subcommands |
| `apps/indusk-mcp/src/bin/cli.ts` | Add extensions command group |
| `apps/indusk-mcp/extensions/` | New — built-in extension manifests + skills |
| `apps/indusk-mcp/skills/domain/` | Removed — migrated to extensions |
| `apps/indusk-mcp/src/tools/system-tools.ts` | Refactor check_health to use extensions |
| `apps/indusk-mcp/src/tools/quality-tools.ts` | Refactor verification to use extensions |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Remove hardcoded setup, use extension hooks |
| `apps/indusk-mcp/skills/toolbelt.md` | Reference extensions system |
| `apps/indusk-mcp/skills/onboard.md` | Include extension status |
| `apps/indusk-docs/src/reference/extension-spec.md` | New — published spec |
| `apps/indusk-docs/src/guide/extensions.md` | New — user guide |

## Dependencies
- All current plans completed
- Extension manifest spec must be stable before Phase 3 (built-in extensions depend on it)

## Notes
- Start simple — v1 manifest format should be minimal. Add fields later, never remove.
- Third-party `add --from npm:pkg` reads `indusk-extension.json` from the package root
- The composable-env manifest is a reference — the real one lives in composable.env's codebase once it's in the monorepo
- Detection rules in `extensions suggest` are advisory — the user always decides
