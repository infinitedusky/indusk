---
name: verify
description: Gate work execution with automated checks (type check, lint, test, build). Shape impl documents to include progressive per-phase verification with specific runnable commands.
---

You know how to verify that code changes actually work.

## What Verify Does

Verify has two roles:

1. **Shape how impls are written** — every impl phase must have a Verification section with specific, runnable commands that prove the phase works. Not "verify it works" — actual commands with expected output.
2. **Gate work execution** — when the work skill executes an impl item, verify defines what checks run and in what order before the checkbox gets checked.

## Role 1: Shaping Impl Documents

When writing an impl (via the plan skill), every phase should have a `#### Phase N Verification` section. The verification items must be:

- **Specific commands** — `pnpm turbo test --filter=mcp`, not "run the tests"
- **Expected output** — "1 test passing", "server returns 200 on /health", "tsc exits with 0"
- **Progressive** — each phase proves itself before the next begins. Phase 2's verification should confirm Phase 1 still works too (regression)

If a verification section says "verify it works" or "confirm everything is good" without a command, **the impl isn't ready**. Push back and ask: "what command proves this works?"

### What checks does a phase need?

Evaluate based on what changed:

| Change type | Type check | Lint | Test | Build |
|---|---|---|---|---|
| TypeScript source | Yes | Yes | Yes (affected) | Only if shared package |
| CSS/styles | No | No | No | No |
| Test files | No | Yes | Yes (the test itself) | No |
| Config files | Depends | No | Yes (smoke) | Yes |
| Markdown/docs | No | No | No | No |
| Package.json / deps | Yes | No | Yes (smoke) | Yes |
| Build config | Yes | No | Yes (smoke) | Yes |

When unsure, run the check. False negatives (missing a real error) are worse than slow verification.

## Role 2: Gating Work Execution

When the work skill is executing an impl and reaches verification items, run checks in this order (fastest first):

### Check Order

1. **Type check** — `tsc --noEmit` or `pnpm turbo typecheck --filter={app}` if wired
   - Skip for: CSS changes, markdown changes, image changes
   - Catches: structural errors, type mismatches, missing imports

2. **Lint** — `biome check` (when code-quality-system is set up) or detected linter
   - Skip for: test file changes, markdown changes, generated files
   - Catches: style violations, common bug patterns, unused imports

3. **Affected tests** — `pnpm turbo test --filter={app}`
   - Skip for: markdown changes, config-only changes with no test files
   - Catches: behavioral regressions, broken logic
   - Run affected app's tests, not the full suite
   - **Use the code graph to find affected tests** — query `analyze_code_relationships` for the changed file to discover which test files import or depend on it. Run those tests specifically rather than guessing.

4. **Build** — `pnpm turbo build --filter={app}`
   - Only for: shared package changes, build config changes
   - Skip for: most application-level changes (dev server catches these)
   - Catches: production build issues, missing exports

### Verification Report

After running checks, summarize what happened:

```
Verification Report:
  Type check: passed (tsc --noEmit, 0 errors)
  Lint: skipped (no linter configured yet)
  Tests: passed (1 test in mcp)
  Build: skipped (no shared package change)
  Result: ALL PASSED — safe to check off
```

Or on failure:

```
Verification Report:
  Type check: FAILED
    src/index.ts:42 — Property 'foo' does not exist on type 'Bar'
  Lint: passed
  Tests: not run (type check failed first)
  Build: not run
  Result: BLOCKED — fix type error before proceeding
```

### Failure Loop

When a check fails during work execution:

```
verify fails
  → read the error output carefully
  → fix the issue
  → re-run ONLY the failing check (not all checks)
  → if pass: continue to next check or check off the item
  → if fail again: try a different fix
  → max 3 attempts before flagging as blocker to the user
```

Do not silently retry indefinitely. Three attempts, then escalate. When escalating, include:
- The error output from each attempt
- What you tried to fix it
- Why you think it's not a simple fix

### Skip Logic

Not every change needs every check. Before running verification, evaluate what files changed and skip checks that can't possibly fail:

- **Only markdown changed** → skip everything
- **Only CSS/styles changed** → skip type check and tests
- **Only test files changed** → skip type check, run the tests
- **TypeScript source changed** → run type check + tests, skip build unless shared package

When skipping, note it in the verification report with the reason.

## Commands Reference

| Check | Command | When to use |
|---|---|---|
| Type check | `tsc --noEmit` | Any TypeScript change |
| Lint | `pnpm check` | Any source file change |
| Test (scoped) | `pnpm turbo test --filter={app}` | Any logic change |
| Test (all) | `pnpm test` | Cross-package changes |
| Build (scoped) | `pnpm turbo build --filter={app}` | Shared package or build config changes |

## Important

- **Watch file length and encapsulation.** If a file grows past ~200 lines, consider extracting functions or splitting into modules. Use `find_code` to check for duplicate logic before adding new functions. Code should be DRY — reuse existing utilities rather than reimplementing.
- Verification items in impls must be specific runnable commands, not vague assertions
- Progressive: each phase proves itself. Phase 2 shouldn't break Phase 1
- Run checks fastest-first. Stop on first failure — no point linting if types don't compile
- Three retries max on failure, then escalate to the user
- When in doubt, run the check. Slow verification beats missed bugs.
