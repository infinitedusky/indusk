# When root `pnpm test` is red, diagnose with `turbo run test --continue` — turbo stops at the first failing package and hides every later package's failures

In main-suite-green the admin's timeouts failed first, so indusk-mcp's own root-run timeouts (git/CLI-spawning tests crossing 5 s under contention) and a template-test page reload were never seen until the admin went green. A plan promising a green root run should expect several rounds unless the first diagnosis runs every package.

Why: the plan's scope named only two admin tests; the real cause was cross-package contention exposing latent faults one package at a time. Fixes were a measured package-wide testTimeout (15 s) in apps/indusk-mcp/vitest.config.ts and a pre-bundle entry in vitest.templates.config.ts. See apps/docs/src/lessons/main-suite-green.md.
