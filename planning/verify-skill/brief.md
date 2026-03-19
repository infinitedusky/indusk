---
title: "Verify Skill"
date: 2026-03-19
status: accepted
---

# Verify Skill — Brief

## Problem

The work skill checks off impl items based on the agent completing the code change. There is no automated proof that the change actually works. Correctness depends entirely on planning quality and the agent not making mistakes — which it does, regularly.

The tightest AI coding loops right now are write→test→fix→test. Our system currently does write→checkbox. This means bugs accumulate silently until a human catches them during review or, worse, in production.

### The Testing Configuration Problem

Testing in JavaScript/TypeScript monorepos is disproportionately painful. The time spent making test configuration work — module resolution, path aliases, ESM/CJS interop, mocking setup, Turborepo filter integration — routinely exceeds the time spent writing actual tests. Every new project starts this fight from scratch. Configuration that works for one app breaks for another. The result is that tests don't get written because the setup is too fragile.

Verify must solve this at the infrastructure level. The testing setup should be bulletproof and zero-config from the developer's perspective — decided once, locked in, and never thought about again. The test runner choice, its configuration, and its integration with the monorepo tooling are all part of verify's scope, not deferred decisions.

## Proposed Direction

Verify has two roles:

### Role 1: Shape how plans are written

Verify influences the plan skill's impl output. When an agent writes an impl, verify's instructions tell it to build progressive verification into every phase — not a single test block at the end. Each phase must prove itself before the next begins:

```
Phase 1: build components → verify phase 1 (tests pass, types check) → confirmed working
Phase 2: build on phase 1 → verify phase 2 (new tests + phase 1 still passes) → confirmed working
...
Final: integration verification across all phases
```

This means the impl template's Verification section is per-phase, not per-plan. The agent writing the impl must answer: "what tests prove this phase works, and what commands confirm it?" If the answer is vague, the impl isn't ready.

### Role 2: Gate the work skill's execution loop

When work executes an impl item, verify runs the appropriate checks before allowing the checkbox. When verify fails, it feeds the error back to the agent for immediate correction.

```
work reads impl item
  → agent writes the code change
  → verify runs checks against the change
  → if pass: work checks off the item
  → if fail: agent reads the error, fixes, verify runs again
  → loop until pass or agent flags a blocker
```

### First-Connect Setup

When a codebase first connects to the MCP server, verify handles a one-time setup phase. The setup is adaptive — it works with what exists rather than imposing a stack:

1. **Detect what exists** — test runner, linter, config files, monorepo structure, package manager
2. **If nothing exists** — propose and install the full opinionated stack (test runner, Biome, Turborepo wiring)
3. **If partial** — fill gaps without touching what works (e.g., existing Jest config stays, but Turborepo filter gets wired up)
4. **If complete** — skip setup entirely, validate it works with a smoke test
5. **Validate** — run a smoke test to prove the config works before any real tests exist

This matters because the MCP may be used on someone else's codebase. Verify should adapt to their tooling, not demand they adopt ours. On our own projects, we get the full opinionated setup.

After setup, verify just runs checks — no configuration decisions, no debugging module resolution.

## What Verify Checks

Ordered by speed (fast checks first, slow checks last):

1. **Type checking** — `tsc --noEmit` or equivalent. Catches most structural errors in < 5 seconds.
2. **Lint** — Biome on changed files only (`biome check`). Config owned by `planning/code-quality-system/` — verify is the runner, not the rule owner.
3. **Affected tests** — Only tests related to changed files. Test runner and config owned by verify. Uses Turborepo `--filter` for monorepo scoping. NOT the full test suite.
4. **Build** — Only if the impl item involves a shared package or build config change. `turbo build --filter={changed}`.

The skill should be smart about what to run. A CSS change doesn't need type checking. A test file change doesn't need lint. A README change needs nothing.

## What Verify Does NOT Do

- Run the full test suite (too slow for per-item verification)
- Block on warnings (only errors block)
- Run in CI (this is a local development skill — CI is a separate concern)
- Make you think about test configuration after initial setup
- Overwrite existing tooling on codebases that already have a working setup

## Scope

### In Scope
- Shaping impl documents: progressive per-phase verification, not end-of-plan test blocks
- First-connect setup: detect existing tooling, install/configure where needed, smoke test
- Type checking, linting, affected tests, targeted builds
- Integration with the work skill's checkbox loop
- Error feedback to the agent for self-correction
- Verification report (what passed, failed, skipped)
- Bulletproof test config that survives monorepo workspace boundaries, ESM, path aliases

### Out of Scope
- Full test suite runs
- CI/CD pipeline integration
- Performance testing
- Visual regression testing
- Test runner choice research (deferred to verify ADR — but the ADR must commit to one)

## Success Criteria
- Impl documents have per-phase verification sections with runnable commands
- Work skill refuses to check off an item when verify fails
- Agent self-corrects on verify failure without human intervention at least 80% of the time
- Verify adds < 30 seconds to each impl item on average
- Zero false positives (verify should never block on something that actually works)
- A new app added to the monorepo can run tests without any test config work
- Test configuration is never a topic of debugging conversation
- First-connect setup on an existing codebase adapts to its tooling without breaking anything

## Depends On
- work skill (verify plugs into work's execution loop)
- plan skill (verify shapes how impl documents are written)

## Related Plans
- `planning/code-quality-system/` — owns the Biome config that verify runs. Verify executes `biome check`; code-quality decides what rules are in it.
- `planning/context-skill/` — captures soft lessons in CLAUDE.md; verify enforces the hard rules via tooling.

## Blocks
- deploy skill (deploy's pre-deploy checklist will call verify)
- code-quality-system (verify is the runner that code-quality depends on)
