# Turbo's `test.dependsOn: ["^build"]` builds a package's dependencies, never its own dist — a test skipped for a missing build is silent, so give the package its own `<pkg>#test` task depending on `build`

On a clean checkout every `describe.skipIf(SHOULD_SKIP)` CLI test in apps/indusk-mcp skipped silently while the suite stayed green, including the only row (A1) for the promise a-large-impl-gets-the-same-contract-answer. Fixed in turbo.json with `@infinitedusky/indusk-mcp#test` dependsOn ["^build","build"], guarded by A13 (contract-stdin.test.ts reads `turbo run test --dry=json`). Found by the cold audit (audit.md), not by any test.

Why: a skip keyed to a missing build is silent by construction; a promise's sole row must not be able to skip. See apps/docs/src/lessons/main-suite-green.md and apps/indusk-mcp/CLAUDE.md (Tests).
