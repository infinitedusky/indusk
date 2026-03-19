---
title: "Verify Skill"
date: 2026-03-19
status: accepted
---

# Verify Skill

## Y-Statement

In the context of **an AI-assisted dev system where the work skill checks off impl items without proof they work**,
facing **testing configuration that routinely takes longer than writing tests, and the need to work on both our own and others' codebases**,
we decided for **a Claude Code skill with two roles (shape impls with progressive per-phase verification, gate work execution with automated checks) using Vitest as the test runner and an adaptive first-connect setup**
and against **Jest (config-heavy, poor ESM support), end-of-plan test blocks, and an opinionated-only setup that ignores existing tooling**,
to achieve **zero-config testing from day one, progressive verification that catches bugs per-phase not per-plan, and portability across codebases**,
accepting **the overhead of detection logic in first-connect and Vitest being newer with a smaller ecosystem than Jest**,
because **Vitest's native ESM/TypeScript support, workspace configuration, and Vite-powered speed eliminate the configuration pain that prevents tests from being written, and the adaptive setup makes the skill useful beyond our own projects**.

## Context

The work skill currently does write→checkbox with no proof the code works. The verify brief defines two roles: shaping how impls are written (progressive per-phase verification) and gating work execution (automated checks before checkbox). The brief also identifies testing configuration as the core pain point — more time is spent debugging test config than writing tests.

See `planning/verify-skill/brief.md` for the full problem statement.

## Decision

### Vitest as the test runner

Vitest is the committed test runner for our projects. The ADR makes this choice explicit and permanent.

**Why Vitest over Jest:**
- Native ESM support — no `--experimental-vm-modules`, no transform config
- Native TypeScript support via Vite's transform pipeline — no `ts-jest`, no `babel-jest`
- Workspace/project configuration via `projects` array — maps directly to Turborepo monorepo structure
- `extends: true` in project configs — root config is inherited automatically, no copy-paste
- Compatible with Jest's API (`describe`, `it`, `expect`) — migration path exists
- Fast — uses Vite's dev server for module resolution, no cold compilation step

**The root config pattern:**

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
  },
})
```

Each app can extend with its own `vitest.config.ts` using `extends: true` to inherit root settings. This means a new app added to the monorepo gets testing for free — no config work.

### The skill is a markdown file, not code

Like context, the verify skill lives at `.claude/skills/verify/SKILL.md`. It instructs the agent on:
- What checks to run and in what order (type check → lint → test → build)
- How to determine which checks a change needs (skip type check for CSS, skip lint for test files, etc.)
- How to write per-phase verification sections in impl documents
- How to handle verification failures (feed error back, fix, re-verify)

The MCP server will later expose verify tools, but the skill defines the behavior.

### Progressive per-phase verification

The verify skill shapes impl documents so that each phase has its own verification section. This is already established by the context skill — verify extends the same pattern:

```markdown
### Phase N: {Name}
- [ ] {implementation items}

#### Phase N Verification
- [ ] {prove this phase works — specific commands, expected output}

#### Phase N Context
- [ ] {CLAUDE.md updates}
```

The verify skill's addition is guidance on what verification items should contain:
- Specific commands to run (`pnpm turbo test --filter=brand-site`)
- Expected output or behavior ("server starts on port 3000, returns 200 on /api/health")
- Type check and lint commands when relevant
- Not vague assertions ("verify it works") — runnable proof

### Adaptive first-connect setup

When the MCP server first connects to a codebase, verify runs a detection phase:

1. **Scan for existing tooling:**
   - Test runner: look for `vitest.config.*`, `jest.config.*`, `*.test.*` files
   - Linter: look for `biome.json`, `.eslintrc.*`, `biome.jsonc`
   - Type checker: look for `tsconfig.json`
   - Monorepo: look for `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`

2. **Decision matrix:**
   | Existing tooling | Action |
   |---|---|
   | Nothing | Install full stack: Vitest + Biome + root configs |
   | Has Jest, no Vitest | Use Jest as-is, wire up Turborepo filter if missing |
   | Has Vitest | Validate config, fill gaps |
   | Has ESLint, no Biome | Use ESLint as-is (don't force Biome on others' codebases) |
   | Has Biome | Use Biome as-is |
   | Has tsconfig | Use existing TypeScript config |

3. **Smoke test:** Run a minimal check (`tsc --noEmit`, `biome check`, `vitest run --reporter=verbose`) to confirm the setup works before any real tests exist.

### Check order and skip logic

Checks run fastest-first:

1. **Type check** (`tsc --noEmit`) — skip for: CSS/style changes, markdown changes, image changes
2. **Lint** (`biome check` or detected linter) — skip for: test file changes, markdown changes, generated files
3. **Affected tests** (`vitest run --reporter=verbose` with Turborepo filter) — skip for: markdown changes, config-only changes with no test files
4. **Build** (`turbo build --filter={changed}`) — only for: shared package changes, build config changes

The skill instructs the agent to evaluate which checks apply before running them. A verification report summarizes: what ran, what passed, what failed, what was skipped and why.

### Verification failure loop

When a check fails during work execution:

```
verify fails
  → agent reads the error output
  → agent attempts to fix
  → verify re-runs the failing check (not all checks)
  → if pass: continue
  → if fail again: agent flags as blocker to the user
  → max 3 retry attempts before escalating
```

The agent should not silently retry indefinitely. Three attempts, then human involvement.

## Alternatives Considered

### Jest
The incumbent. Rejected because: ESM support requires experimental flags, TypeScript needs `ts-jest` or `babel-jest` transform config, workspace setup is manual and fragile. Jest's ecosystem is larger but the configuration overhead is exactly the problem we're solving.

### No committed test runner (leave flexible)
Rejected because: the brief explicitly identifies test config as the core pain point. Deferring the choice perpetuates the problem. Committing to Vitest means we solve config once.

### Skill as MCP-only (no markdown skill)
Rejected for v1 — same reasoning as context. Start with instructions, add MCP tools once behavior is proven.

## Consequences

### Positive
- Test configuration solved once at the root, inherited by all apps
- Progressive verification catches bugs per-phase, not at the end
- Adaptive setup makes the skill portable to any codebase
- Vitest's API is Jest-compatible, so existing knowledge transfers

### Negative
- Vitest is newer — some edge cases in monorepo setups may need workarounds
- Adaptive first-connect adds detection complexity
- Skip logic requires the agent to make judgment calls about which checks apply

### Risks
- **Vitest monorepo edge cases** — Mitigate by testing the workspace config pattern on this repo first, document any gotchas
- **Skip logic too aggressive** — Mitigate by defaulting to running checks when unsure (false negatives are worse than slow verification)
- **First-connect detection misses tooling** — Mitigate by having the agent ask the user when detection is ambiguous

## References
- `planning/verify-skill/brief.md`
- `planning/code-quality-system/brief.md` (owns Biome config that verify runs)
- `planning/context-skill/adr.md` (established the per-phase pattern that verify extends)
- Vitest workspace docs: projects configuration with `extends: true`
