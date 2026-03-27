---
title: "GSD-Inspired Improvements"
date: 2026-03-21
status: completed
---

# GSD-Inspired Improvements

## Goal

Adopt 7 patterns from GSD-2 into the InDusk dev system: lessons registry, verification auto-discovery, forward intelligence, blocker protocol, workflow templates, boundary maps, and domain skills registry. All implemented as skill updates + MCP tool enhancements + CLI changes.

## Scope

### In Scope
- Community + personal lessons in `.claude/lessons/`
- Verification auto-discovery in verify skill + quality_check tool
- Forward intelligence in context skill
- Blocker protocol in work skill + advance_plan tool
- Workflow templates in plan skill
- Boundary maps in impl template
- Domain skills with auto-detection in init
- 8 initial domain skills

### Out of Scope
- Skill router pattern (subdirectories)
- Autonomous execution
- SQLite state

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | Community lessons files, init/update lesson handling | Package `lessons/` directory |
| Phase 2 | Updated verify skill, enhanced quality_check tool | package.json scripts, tool config files |
| Phase 3 | Updated context skill, updated work skill, updated impl-parser | Existing skill files |
| Phase 4 | Updated plan skill with workflow templates | Template files in `templates/workflows/` |
| Phase 5 | 8 domain skill files, detection logic in init | package.json dependencies, file patterns |
| Phase 6 | Updated toolbelt, published package, dogfood verification | All previous phases |

## Checklist

### Phase 1: Lessons Registry

- [x] Create `apps/indusk-mcp/lessons/community/` directory with 8 starter lessons:
  - `community-no-fallback-values.md` — never use fallback values where a value is expected
  - `community-check-existing-packages.md` — search for official packages before building custom
  - `community-explicit-errors.md` — let errors propagate visibly, no silent catches
  - `community-no-mock-databases.md` — use real databases in integration tests
  - `community-index-after-setup.md` — auto-index during init, not as a separate step
  - `community-verify-before-commit.md` — always run checks before committing
  - `community-read-before-edit.md` — read the file before modifying it
  - `community-one-concern-per-change.md` — each change should address one thing
- [x] Update `init` to copy community lessons to `.claude/lessons/`
- [x] Update `update` to sync community lessons (files with `community-` prefix only), install new ones, never touch files without the prefix
- [x] Add `list_lessons` MCP tool — returns all lessons from `.claude/lessons/`
- [x] Add `add_lesson` MCP tool — creates a new personal lesson file from a description
- [x] Update retrospective skill to prompt "any lessons worth capturing?" and call `add_lesson`

#### Phase 1 Verification
- [x] `npx @infinitedusky/indusk-mcp init` in a temp dir creates `.claude/lessons/` with 8 community files
- [x] Create a personal lesson manually, run `update` — personal lesson untouched, community lessons synced
- [x] `list_lessons` returns all lessons (community + personal)
- [x] `add_lesson` creates a properly formatted lesson file
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 1 Context
- [x] Add to Architecture: `.claude/lessons/` — community (package-owned) + personal (user-owned) lessons
- [x] Add to Conventions: community lessons use `community-` prefix, personal lessons don't

### Phase 2: Verification Auto-Discovery

- [x] Create `src/lib/verification-discovery.ts`:
  - Read `package.json` scripts, match known patterns: `typecheck`, `type-check`, `tsc`, `lint`, `test`, `build`, `check`
  - Detect tool configs: `biome.json` → `npx biome check`, `tsconfig.json` → `npx tsc --noEmit`, `vitest.config.*` → `npx vitest run`, `jest.config.*` → `npx jest`
  - Return array of `{ name: string, command: string, source: "package.json" | "config-file" }`
- [x] Update `quality_check` MCP tool: add `discover` mode that returns detected commands without running them
- [x] Update `quality_check` default behavior: if no command specified, run all discovered checks
- [x] Update verify skill: reference auto-discovery, note that impl doc commands are optional overrides

#### Phase 2 Verification
- [x] Run `quality_check` with discover mode on this repo — returns biome check, tsc, vitest
- [x] Run `quality_check` with no args — runs all discovered checks
- [x] Run `quality_check` with explicit command — uses the explicit command instead
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 2 Context
- [x] Add to Conventions: verification commands in impl docs are optional — auto-discovery is the default

### Phase 3: Forward Intelligence + Blocker Protocol

- [x] Update context skill: add `## Forward Intelligence` section template to per-phase context updates:
  ```markdown
  #### Phase N Forward Intelligence
  - **Fragile**: {file/module that was tricky, why}
  - **Watch out**: {downstream risk for next phase}
  - **Assumption**: {thing that's true now but might not be later}
  ```
- [x] Update work skill: read forward intelligence from previous phase before starting next phase
- [x] Update impl-parser to detect `blocker:` lines in phases
- [x] Update work skill: check for `blocker:` before starting a phase, halt and present to user if found
- [x] Update `advance_plan` MCP tool: check for unresolved blockers, include in missing items if found
- [x] Add teach mode to work skill — when `/work teach` or `/work --teach` is used:
  - Before each edit: explain what you're about to change and why, then stop and wait for "continue"
  - After each edit: explain what changed, what to notice, and how it connects to the broader goal, then stop and wait
  - Between checklist items: summarize what was accomplished and preview the next item
  - Use clear headings to separate the teaching from the doing (e.g., "**Why this change:**", "**What changed:**", "**What to notice:**")
  - Normal `/work` remains unchanged — fast execution without pauses

#### Phase 3 Verification
- [x] Create a test impl with forward intelligence sections — verify work skill reads them
- [x] Create a test impl with `blocker:` line — verify work skill halts
- [x] Call `advance_plan` on a plan with a blocker — verify it reports the blocker
- [x] Run `/work teach` on a test item — verify it explains before editing, waits, explains after, waits
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 3 Context
- [x] Add to Conventions: write forward intelligence at end of each phase, read it at start of next

### Phase 4: Workflow Templates + Boundary Maps

- [x] Create `apps/indusk-mcp/templates/workflows/`:
  - `bugfix.md` — brief + impl only, streamlined
  - `refactor.md` — brief + impl with boundary map required
  - `spike.md` — research only
  - `feature.md` — full lifecycle (current default)
- [x] Update plan skill to accept workflow type as second argument:
  - `/plan bugfix auth-token-expiry` → scaffolds from bugfix template
  - `/plan refactor extract-middleware` → scaffolds from refactor template
  - `/plan spike redis-options` → scaffolds research.md only
  - `/plan feature payment-flow` or `/plan payment-flow` → full lifecycle (default)
- [x] Add `## Boundary Map` section to impl template (feature and refactor workflows)
- [x] Update plan skill documentation to describe workflow types and when to use each

#### Phase 4 Verification
- [x] `/plan bugfix test-fix` creates only `brief.md` + `impl.md` in `planning/test-fix/`
- [x] `/plan spike test-spike` creates only `research.md` in `planning/test-spike/`
- [x] `/plan refactor test-refactor` creates `brief.md` + `impl.md` with boundary map section
- [x] `/plan feature test-feature` creates full lifecycle (same as current behavior)
- [x] Clean up test plan directories after verification
- [x] `pnpm check` passes

#### Phase 4 Context
- [x] Add to Conventions: use `/plan bugfix` for fixes, `/plan spike` for exploration, `/plan refactor` for restructuring

### Phase 5: Domain Skills Registry

- [x] Create `apps/indusk-mcp/skills/domain/` directory with 8 domain skills:
  - `nextjs.md` — Next.js 13+ patterns, App Router, server components, caching
  - `tailwind.md` — Tailwind CSS patterns, avoid arbitrary values, utility-first
  - `react.md` — React patterns, hooks rules, component composition, state management
  - `solidity.md` — Solidity patterns, security (reentrancy, overflow), gas optimization
  - `typescript.md` — TypeScript patterns, strict mode, generics, discriminated unions
  - `testing.md` — Testing patterns, arrange-act-assert, test isolation, what to mock
  - `docker.md` — Dockerfile patterns, multi-stage builds, layer caching, security
  - `vitepress.md` — VitePress patterns, frontmatter, Mermaid diagrams, sidebar config
- [x] Add detection logic to `init`:
  ```typescript
  interface DomainDetection {
    skill: string;
    signal: "dependency" | "devDependency" | "file-pattern";
    match: string;
  }
  ```
  Detection map:
  | Signal | Match | Skill |
  |--------|-------|-------|
  | dependency | `next` | nextjs |
  | dependency | `tailwindcss` | tailwind |
  | dependency | `react` | react |
  | devDependency | `typescript` | typescript |
  | devDependency | `vitest` or `jest` | testing |
  | dependency | `vitepress` | vitepress |
  | file-pattern | `*.sol` | solidity |
  | file-pattern | `Dockerfile*` | docker |
- [x] Update `init` to run detection after copying process skills, install matching domain skills
- [x] Add `--skills nextjs,tailwind` flag to `init` for manual override
- [x] Add `--no-domain-skills` flag to skip detection entirely
- [x] Update `update` to sync domain skills same as process skills (by content hash)
- [x] Add `list_domain_skills` MCP tool — returns available domain skills and which are installed

#### Phase 5 Verification
- [x] Run `init` on this repo — detects and installs: typescript, testing, vitepress, docker (from Dockerfiles)
- [x] Run `init --skills solidity,react` — installs only those two domain skills
- [x] Run `init --no-domain-skills` — installs no domain skills
- [x] Run `update` — domain skills synced like process skills
- [x] `list_domain_skills` returns correct installed/available status
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 5 Context
- [x] Add to Architecture: domain skills in `.claude/skills/` alongside process skills, auto-detected by init
- [x] Add to Conventions: `init --skills x,y` for manual domain skill selection

### Phase 6: Integration, Dogfood, and Publish

- [x] Update toolbelt skill: add lessons reading at session start, domain skill awareness
- [x] Bump package version
- [x] Build and publish to npm
- [x] Run `update` on this repo — verify all new skills and lessons installed
- [x] Run `update` on numero — verify domain skill detection works on a different project
- [x] Test full workflow: start a session, verify lessons are read, domain skills loaded, verification auto-discovers

#### Phase 6 Verification
- [x] `npx @infinitedusky/indusk-mcp update` on this repo installs lessons + updated skills
- [x] New Claude Code session reads lessons and has domain skills available
- [x] `quality_check` auto-discovers verification commands
- [x] `/plan bugfix test` scaffolds correctly
- [x] `pnpm turbo test --filter=@infinitedusky/indusk-mcp` passes
- [x] `pnpm check` passes

#### Phase 6 Context
- [x] Update Current State: GSD-inspired improvements implemented and published

#### Phase 6 Document
- [x] Update reference page at `apps/indusk-docs/src/reference/tools/indusk-mcp.md` with new tools (list_lessons, add_lesson, list_domain_skills)
- [x] Write guide page at `apps/indusk-docs/src/guide/lessons.md` explaining community vs personal lessons
- [x] Write guide page at `apps/indusk-docs/src/guide/domain-skills.md` explaining detection and manual override

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/lessons/community/` | New — 8 community lesson files |
| `apps/indusk-mcp/skills/domain/` | New — 8 domain skill files |
| `apps/indusk-mcp/templates/workflows/` | New — 4 workflow templates |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Lessons copying, domain skill detection, --skills/--no-domain-skills flags |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Lessons sync (community- prefix), domain skill sync |
| `apps/indusk-mcp/src/lib/verification-discovery.ts` | New — detect checks from package.json and config files |
| `apps/indusk-mcp/src/lib/impl-parser.ts` | Blocker detection |
| `apps/indusk-mcp/src/tools/quality-tools.ts` | Auto-discovery in quality_check |
| `apps/indusk-mcp/src/tools/system-tools.ts` | list_lessons, add_lesson, list_domain_skills tools |
| `apps/indusk-mcp/skills/plan.md` | Workflow type argument, boundary maps |
| `apps/indusk-mcp/skills/work.md` | Forward intelligence reading, blocker checking, teach mode |
| `apps/indusk-mcp/skills/verify.md` | Auto-discovery reference |
| `apps/indusk-mcp/skills/context.md` | Forward intelligence section |
| `apps/indusk-mcp/skills/retrospective.md` | Lesson capture prompt |
| `apps/indusk-mcp/skills/toolbelt.md` | Lessons, domain skills, new tools |

## Dependencies
- `@infinitedusky/indusk-mcp` v0.4.1 published (completed)
- All existing skills and MCP tools working (completed)

## Notes
- Domain skills are opinionated — they encode best practices, not just docs references
- Community lessons should be universal truths, not project-specific
- Start with 8 domain skills, grow based on usage across projects
- Workflow templates reduce ceremony but don't skip quality — bugfix still requires verification
