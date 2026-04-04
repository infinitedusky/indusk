---
title: "Verify Skill"
date: 2026-03-19
status: completed
---

# Verify Skill

## Goal

Create a Claude Code skill that gates work execution with automated verification and shapes impl documents to include progressive per-phase testing. Install Vitest as the committed test runner with a root workspace config that all apps inherit. The skill is a markdown instruction file for v1 — MCP tools come later.

## Scope

### In Scope
- The verify skill file (`.claude/skills/verify/SKILL.md`)
- Vitest installation and root workspace configuration
- Per-app Vitest config pattern with `extends: true`
- Smoke test to validate the setup works
- Update plan and work skills to reference verify behavior
- Turborepo `test` pipeline wiring

### Out of Scope
- MCP tools (deferred to MCP server plan)
- First-connect detection logic (deferred to MCP — for now we set up our own stack)
- CI/CD pipeline integration
- Biome installation (deferred to code-quality-system plan)

## Checklist

### Phase 1: Install and configure Vitest

- [x] Install Vitest as a workspace dev dependency: `pnpm add -Dw vitest`
- [x] Create root `vitest.config.ts`
- [x] Create `apps/brand-site/vitest.config.ts` with `extends: true`
- [x] Create `apps/mcp/vitest.config.ts` with `extends: true`
- [x] Add `"test": "turbo test"` script to root `package.json`
- [x] Add `"test": "vitest run"` script to `apps/brand-site/package.json` and `apps/mcp/package.json`
- [x] Add `test` pipeline to `turbo.json` so `turbo test` and `turbo test --filter={app}` work

#### Phase 1 Verification
- [x] `pnpm test` runs from root without errors (0 tests, exits 0)
- [x] `pnpm turbo test --filter=brand-site` scopes to brand-site only
- [x] `pnpm turbo test --filter=mcp` scopes to mcp only

#### Phase 1 Context
- [x] Add to Architecture in CLAUDE.md: Vitest configured at root with workspace projects, each app extends with `extends: true`
- [x] Add to Conventions: `pnpm test` runs all tests, `pnpm turbo test --filter={app}` for scoped runs

### Phase 2: Write a smoke test

- [x] Create `apps/mcp/src/__tests__/smoke.test.ts`
- [x] Run `pnpm turbo test --filter=mcp` and confirm the smoke test passes
- [ ] Confirm the test runs inside Docker — skipped for now, mcp isn't containerized yet

#### Phase 2 Verification
- [x] Smoke test passes: `pnpm turbo test --filter=mcp` shows 1 test passing
- [x] No module resolution errors, no ESM/CJS issues, no TypeScript transform errors

#### Phase 2 Context
- [x] `passWithNoTests: true` needed in each app's vitest config, not just root — added to Known Gotchas

### Phase 3: Write the verify skill

- [x] Create `.claude/skills/verify/SKILL.md` with:
  - Frontmatter: name, description
  - Role 1: Shaping impl documents
    - Every impl phase must have a `#### Phase N Verification` section
    - Verification items must be specific runnable commands with expected output, not vague assertions
    - Guide for what checks a phase needs based on what changed (type check, lint, test, build)
    - Progressive: each phase proves itself before the next begins
  - Role 2: Gating work execution
    - Check order: type check → lint → affected tests → build
    - Skip logic: what to skip based on file types changed
    - Failure loop: read error → fix → re-verify → max 3 retries → escalate
    - Verification report format: what ran, passed, failed, skipped
  - Commands reference:
    - Type check: `tsc --noEmit` (or `pnpm turbo typecheck --filter={app}` if wired)
    - Lint: `biome check` (deferred to code-quality-system — note as pending)
    - Test: `pnpm turbo test --filter={app}`
    - Build: `pnpm turbo build --filter={app}`

#### Phase 3 Verification
- [x] Skill file exists at `.claude/skills/verify/SKILL.md` with valid frontmatter
- [x] Skill is visible in Claude Code's skill list (confirmed in system reminder)

#### Phase 3 Context
- [x] Update Skill Inventory in CLAUDE.md: verify status from `planned` to `stable`
- [x] Update Current State: verify-skill impl completing

### Phase 4: Wire verify into plan and work skills

- [x] Update `.claude/skills/plan/SKILL.md`:
  - In the impl template guidance, reinforce that `#### Phase N Verification` items must be specific commands with expected output
  - Add note: "If the verification section says 'verify it works' without a command, the impl isn't ready"
- [x] Update `.claude/skills/work/SKILL.md`:
  - In verification items section, add: "Run checks in order: type check → lint → affected tests → build. Skip checks that don't apply to the change."
  - Add failure loop: "If verification fails, read the error, fix it, re-run the failing check. Max 3 attempts before flagging as blocker."
  - Reinforce: verification items are blocking — cannot advance phase until they pass

#### Phase 4 Verification
- [x] Plan skill emphasizes specific runnable verification items, not vague assertions
- [x] Work skill has check order, skip logic, and failure loop documented
- [x] Cross-read plan, work, verify, and context skills — no contradictions, clear division of responsibility

#### Phase 4 Context
- [x] Add to Conventions in CLAUDE.md: "Verification items in impl docs must be specific runnable commands with expected output — not 'verify it works'"

## Files Affected

| File | Change |
|------|--------|
| `vitest.config.ts` | Create — root workspace config |
| `apps/brand-site/vitest.config.ts` | Create — extends root |
| `apps/mcp/vitest.config.ts` | Create — extends root |
| `apps/mcp/src/__tests__/smoke.test.ts` | Create — smoke test |
| `package.json` | Add test script |
| `apps/brand-site/package.json` | Add test script |
| `apps/mcp/package.json` | Add test script |
| `turbo.json` | Add test pipeline |
| `.claude/skills/verify/SKILL.md` | Create — the skill itself |
| `.claude/skills/plan/SKILL.md` | Reinforce verification item quality |
| `.claude/skills/work/SKILL.md` | Add check order, skip logic, failure loop |
| `CLAUDE.md` | Context updates per phase |

## Dependencies
- Vitest available on npm (it is)
- Plan and work skills exist (they do)
- Context skill exists and is wired (it is — just built)
- Verify ADR accepted (it is)

## Notes
- Biome/lint checks are referenced in the skill but the actual Biome setup is deferred to the code-quality-system plan. Verify will note lint as "pending setup" until then.
- First-connect adaptive detection is deferred to the MCP server plan. This impl sets up our own stack directly.
- The smoke test is intentionally trivial. Its purpose is to prove the config works, not to test anything real. Real tests come when real code gets built.
