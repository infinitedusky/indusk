# A test imports its subject at the top of the file, never `await import` inside an `it` — the cold module-graph load is charged to the test's 5 s timeout and crosses it under a root `pnpm test`

Admin route tests did `await import(route)` inside each `it`. Alone the first test took ~200 ms; in a root run (every package's suite at once) the cold load of the package's module graph alone crossed vitest's 5 s timeout, a different test each run. Import at the top of the file: `vi.mock` is hoisted above it so mocks still apply, and the load falls in the file's import, which has no per-test timeout. Never fix by raising the timeout or retrying.

Why: found in main-suite-green (A7, new-project-accept/-route/-routes/-parent tests). Rule is also in apps/indusk-admin/CLAUDE.md; page at apps/docs/src/lessons/main-suite-green.md. Plan: .indusk/planning/archive/main-suite-green/ (or the plan folder until archived).
