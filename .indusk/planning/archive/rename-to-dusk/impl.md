---
title: "Rename to Dusk"
date: 2026-04-13
status: completed
gate_policy: auto
---

# Rename to Dusk

## Goal
Remove the portfolio app and rename the repo from infinitedusky to dusk. Clean up all active references.

## Scope
### In Scope
- Delete portfolio app and its env config
- Rename root package to dusk
- Update active config/code references
### Out of Scope
- Renaming indusk-mcp (dusk-v2)
- Archived planning docs
- GitHub remote/directory rename

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Clean repo without portfolio | apps/indusk-portfolio, env configs |
| Phase 2 | Renamed references | Root package.json, CLAUDE.md, config files, docs, code |

## Checklist

### Phase 1: Remove Portfolio
- [x] Delete `apps/indusk-portfolio/` directory
- [x] Delete `env/components/indusk-portfolio.env`
- [x] Delete `env/contracts/indusk-portfolio.contract.json`
- [x] Remove portfolio scripts from root `package.json` (`dev:indusk-portfolio`, `build:indusk-portfolio`, `start:indusk-portfolio`)
- [x] Remove portfolio entries from `.ce-managed.json`
- [x] Remove or update `docker/Dockerfile.nextdev` if portfolio-specific

#### Phase 1 Verification
- [x] `pnpm install` completes without errors
- [x] `pnpm check` — pre-existing biome config error in otel-test apps (nested root configs), not related to this change
- [x] No references to `indusk-portfolio` in active config: `grep -r "indusk-portfolio" --include="*.json" --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=archive --exclude-dir=.indusk/planning | grep -v pnpm-lock`

#### Phase 1 Context
- (none needed)

#### Phase 1 Document
- (none needed)

### Phase 2: Rename to Dusk
- [x] Rename root `package.json` name from `infinitedusky` to `dusk`
- [x] Update `CLAUDE.md` — repo name, architecture section, current state references
- [x] Update `.indusk/config.json` — added explicit `graphiti.groupId: "dusk"` (currently defaults to dirname)
- [x] Update graph namespace references in source code (`cgc-infinitedusky` → `cgc-dusk`, `semantic-infinitedusky` → `semantic-dusk`) — search `apps/indusk-mcp/src/` for hardcoded project names
- [x] Update docs site references: `apps/indusk-docs/src/` files that mention `infinitedusky` as the project/repo name
- [x] Update eval hooks and test files that reference `infinitedusky`
- [x] Update `.claude/settings.json` — graph namespaces and paths updated
- [x] Update memory files — user_profile.md updated with repo rename note
- [x] Update skill files and source templates that reference `infinitedusky` as project name

#### Phase 2 Verification
- [x] `pnpm check` — pre-existing biome config error in otel-test apps (not related)
- [x] `pnpm turbo build --filter=@infinitedusky/indusk-mcp` succeeds
- [x] `pnpm turbo build --filter=indusk-docs` — pre-existing VitePress build error in infrastructure.md (not related)
- [x] Remaining `infinitedusky` references are all npm package names (`@infinitedusky/indusk-mcp`), container registry URLs, or GitHub URLs — all out of scope per brief

#### Phase 2 Context
- [x] Update CLAUDE.md: repo name infinitedusky → dusk throughout active sections (Architecture, Conventions, Known Gotchas, Current State)

#### Phase 2 Document
- [x] Update changelog entry: "Renamed repo from infinitedusky to dusk; removed indusk-portfolio"

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-portfolio/` | Delete |
| `env/components/indusk-portfolio.env` | Delete |
| `env/contracts/indusk-portfolio.contract.json` | Delete |
| `package.json` | Remove portfolio scripts, rename to dusk |
| `.ce-managed.json` | Remove portfolio entries |
| `docker/Dockerfile.nextdev` | Remove if portfolio-only |
| `CLAUDE.md` | Rename references |
| `.indusk/config.json` | Add graphiti.groupId if needed |
| `apps/indusk-mcp/src/**` | Update hardcoded project names |
| `apps/indusk-docs/src/**` | Update repo name references |
| `.claude/hooks/eval-trigger.js` | Update project references |
| `.claude/skills/**` | Update project references |

## Dependencies
- None

## Notes
- The npm package `@infinitedusky/indusk-mcp` keeps its current scope — renaming is dusk-v2 scope
- Graph namespaces in FalkorDB will need manual cleanup (drop old graphs) after the code rename
- The directory on disk and GitHub remote are user's choice to rename separately
