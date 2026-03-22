---
title: "Extension System"
date: 2026-03-22
status: in-progress
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

- [ ] Define TypeScript types for the extension manifest:
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
- [ ] Create `src/lib/extension-loader.ts`:
  - `loadExtensions(projectRoot)` — scan `.indusk/extensions/`, parse all `.json` manifests, return enabled extensions
  - `loadExtension(path)` — parse a single manifest, validate schema
  - `isEnabled(name)` — check if extension is in `.indusk/extensions/` (not in `.disabled/`)
  - `getEnabledExtensions(projectRoot)` — return all enabled extension manifests
- [ ] Create `.indusk/extensions/` and `.indusk/extensions/.disabled/` directory management utilities

#### Phase 1 Verification
- [ ] Unit test: loadExtension parses a valid manifest correctly
- [ ] Unit test: loadExtensions finds all .json files in extensions directory
- [ ] Unit test: isEnabled returns false for extensions in .disabled/
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 1 Context
- [ ] Add to Architecture: `.indusk/extensions/` — extension manifest directory, managed by `extensions` CLI

#### Phase 1 Document
- [ ] Write spec page at `apps/indusk-docs/src/reference/extension-spec.md` — manifest format, capability types, lifecycle hooks, detection rules

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
- [ ] `extensions list` shows built-in extensions
- [ ] `extensions enable typescript` copies manifest and installs skill
- [ ] `extensions disable typescript` moves to `.disabled/`
- [ ] `extensions add test-ext --from ./path/to/manifest.json` adds a third-party extension
- [ ] `extensions remove test-ext` removes it
- [ ] `extensions suggest` in this repo recommends typescript, testing, vitepress, docker
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 2 Context
- [ ] Add to Conventions: use `extensions enable/disable` to manage tool integrations, not manual config

#### Phase 2 Document
- [ ] Update `apps/indusk-docs/src/reference/tools/indusk-mcp.md` with extensions CLI commands

### Phase 3: Built-in Extensions

- [ ] Create `apps/indusk-mcp/extensions/` directory for built-in extension manifests + skills
- [ ] Create `extensions/falkordb/manifest.json`:
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
- [ ] Create `extensions/cgc/manifest.json` with CGC health check and skill
- [ ] Create `extensions/cgc/skill.md` — extracted from current toolbelt CGC section
- [ ] Migrate 8 domain skills to extensions:
  - For each (nextjs, tailwind, react, solidity, typescript, testing, docker, vitepress):
    - Create `extensions/{name}/manifest.json` with detect rule and `"skill": true`
    - Move `skills/domain/{name}.md` to `extensions/{name}/skill.md`
- [ ] Remove `apps/indusk-mcp/skills/domain/` directory (replaced by extensions)
- [ ] Add `extensions/` to package.json `files` array

#### Phase 3 Verification
- [ ] `extensions list` shows all 10 built-in extensions
- [ ] `extensions enable nextjs` installs the nextjs skill to `.claude/skills/nextjs/SKILL.md`
- [ ] `extensions enable falkordb` runs the on_init hook (starts/creates container)
- [ ] Each migrated extension has a valid manifest with detect rule
- [ ] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 3 Context
- [ ] Update Architecture: domain skills replaced by extensions in `.indusk/extensions/`
- [ ] Add to Known Gotchas: domain skills directory removed — use `extensions enable` instead of `init --skills`

#### Phase 3 Document
- [ ] Update `apps/indusk-docs/src/reference/index.md` — replace domain skills section with extensions section

### Phase 4: Integrate Extensions into MCP Tools

- [ ] Refactor `check_health` in system-tools.ts:
  - Load enabled extensions
  - For each with `health_checks`: run the commands, include in results
  - Remove hardcoded FalkorDB/CGC checks (now come from their extensions)
- [ ] Refactor `onboard` skill:
  - After reading lessons and context, call `extensions status` equivalent
  - Report enabled extensions and their health in the summary
- [ ] Refactor `init`:
  - Run `on_init` hooks from enabled extensions instead of hardcoding FalkorDB/CGC setup
  - `extensions suggest` output shown during init — "detected: typescript, testing. Enable with `extensions enable typescript testing`"
  - Remove hardcoded `ensureFalkorDB()` and `checkCGC()` functions
- [ ] Refactor verification auto-discovery:
  - Load enabled extensions with `verification` capability
  - Add extension verification commands to discovered checks
- [ ] Create `extensions_status` MCP tool — returns enabled extensions, health, provides

#### Phase 4 Verification
- [ ] `check_health` includes falkordb extension health check (not hardcoded)
- [ ] `check_health` includes cgc extension health check (not hardcoded)
- [ ] `/onboard` shows enabled extensions in summary
- [ ] `init` runs extension on_init hooks instead of hardcoded setup
- [ ] `quality_check --discover` includes extension verification commands
- [ ] `extensions_status` MCP tool returns correct data
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 4 Context
- [ ] Update Conventions: health checks, init setup, and verification come from extensions — don't hardcode tool knowledge
- [ ] Update Current State: extension system implemented, domain skills migrated

#### Phase 4 Document
- [ ] Update `apps/indusk-docs/src/reference/tools/indusk-mcp.md` with extensions_status tool and refactored check_health

### Phase 5: Reference Implementation and Cleanup

- [ ] Create composable-env manifest as reference third-party implementation:
  ```
  planning/extension-system/reference/composable-env-manifest.json
  ```
  This is an example — the real manifest will live in composable.env's codebase
- [ ] Remove domain skill detection logic from init (--skills flag, --no-domain-skills flag, detectDomainSkills function)
- [ ] Remove `list_domain_skills` MCP tool (replaced by `extensions_status`)
- [ ] Update toolbelt skill: reference extensions system, remove hardcoded CGC/FalkorDB sections
- [ ] Update work skill: remove domain skill references
- [ ] Bump version, build, publish

#### Phase 5 Verification
- [ ] `init --skills` flag removed (replaced by `extensions enable`)
- [ ] `list_domain_skills` MCP tool removed
- [ ] Toolbelt references extensions, not hardcoded tools
- [ ] composable-env reference manifest validates against the spec
- [ ] Full end-to-end: fresh project → `init` → `extensions suggest` → `extensions enable typescript` → `check_health` → `/onboard` shows extension status
- [ ] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [ ] `pnpm check` passes

#### Phase 5 Context
- [ ] Update Current State: extension system complete, domain skills removed, composable-env reference manifest created

#### Phase 5 Document
- [ ] Write guide page at `apps/indusk-docs/src/guide/extensions.md` — how to enable built-in extensions, how to add third-party, how to write your own manifest
- [ ] Add changelog entry for the extension system

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
