# Main Suite Green — Lessons

From the plan that made `pnpm test` pass from the root of a clean main again (2026-10-15). Retrospective: `.indusk/planning/archive/main-suite-green/retrospective.md`.

## A first test that imports its subject pays the cold load inside its timeout

Admin route tests called `await import(route)` inside each `it`. On its own the first test took about 200 ms. In a root run, with every package's suite on the machine at once, loading the package's module graph alone crossed vitest's 5 s timeout, and a different test failed each run. Import the subject at the top of the file. `vi.mock` is hoisted above it, so the mocks still apply, and the cold load falls in the file's import, which has no per-test timeout.

## A failing package hides every package behind it

Turbo stops at the first failing task, so while the admin's timeouts were red, the mcp package's root-run result had never been seen. It had its own timeouts. When the root run is red, diagnose it with `turbo run test --continue`, so the first run shows every package's failures.

## An exemption keyed to the latest record forgets what earlier records established

The component check was changed to skip mockups whose plan had not landed, judged by the plan in each mockup's latest approval. Falsification found that a re-approval by an in-flight plan exempted the whole mockup, including components that had landed long before. Five core plan-page mockups had silently left the check. The cold audit then found the same hole for approvals that record no components. The rule that holds keeps the exemption per component and grants it only on evidence of what landed:

- **Only an in-flight plan has ever approved the mockup:** it is exempt, because it is new.
- **A landed approval recorded its components:** those components are held.
- **A landed approval recorded none:** the mockup is held in full.

## `^build` does not build the package under test

`"test": { "dependsOn": ["^build"] }` builds a package's dependencies, never its own `dist/`. Tests that need the built CLI were behind `describe.skipIf(!existsSync(CLI_BIN))`, so on a clean checkout they skipped and the suite stayed green, including the only test for a promise. A skip keyed to a missing build is silent by construction. Make the package's own test task depend on its own build (`"<pkg>#test": { "dependsOn": ["^build", "build"] }`).

## The suite's promise depends on the machine

The root run ends with a guard that fails on any telemetry daemon left running from a temporary home. During this plan it failed on daemons that two other sessions had started from their scratchpads days earlier. The code was green and the run was red. A promise like "the suite passes on main" holds only as far as the machine running it is clean. A red root run's last lines say which kind of failure it is.
