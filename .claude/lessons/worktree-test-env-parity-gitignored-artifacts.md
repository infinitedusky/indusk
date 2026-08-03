# A fresh worktree is not a trunk-equivalent test environment — baseline-compare on unmodified main before diagnosing worktree test failures as regressions

During dawn-ui-plan-grouping, the mcp suite in a fresh worktree showed 12 failures (daemon lifecycle, tarball packing) that looked like regressions from the branch's changes. The real cause: the gitignored admin production bundle (`apps/indusk-mcp/admin/.next`) exists on trunk only as an accident of history — someone once ran the bundle script there — and a fresh worktree starts without it.

**Why it matters:** gitignored build artifacts silently diverge between trunk and worktrees. Tests that depend on them (daemon serving a bundled app, tarball content assertions) fail in ways that pattern-match to code regressions, burning debug cycles on the wrong hypothesis.

**What to do instead:**
1. Before diagnosing a worktree-only test failure as a regression, run the same test files on unmodified `main` (the trunk checkout). Identical failures → pre-existing; trunk-green-worktree-red → suspect environment drift before code.
2. Ask "what gitignored state does this test depend on?" (build outputs, bundles, generated fixtures) and reproduce it in the worktree (`pnpm build` + the relevant bundling script) rather than chasing the diff.

