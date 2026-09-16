# A `pnpm build` that returns 0 without rebuilding leaves CLI-boundary tests red against stale dist/ output — grep dist/ for a symbol from your branch before trusting the result

`pnpm --filter @infinitedusky/indusk-mcp build` returned successfully (exit 0, no error) in a fresh worktree without actually rebuilding `dist/` — the timestamp was unchanged. Any test that exercises the CLI boundary (spawning the built `dist/bin/cli.js` rather than importing TS source) then ran against stale output for a full work cycle, and both the build's exit code and the test's red/green result were consistent with "nothing was rebuilt" — nothing surfaced the staleness on its own.

`pnpm exec tsc` run directly inside the package did rebuild correctly.

**Why:** discovered during dawn-workbench-execution's Test Phase 1 (2026-09-15), carried forward as a checklist step in that plan's Test Phase 1 kickoff item.

**How to apply:** before trusting any CLI-boundary test result (red or green), grep the built file in `dist/` for a symbol unique to your current branch's change. If it's not there, the build silently no-op'd — rebuild with `pnpm exec tsc` in the package directly rather than the turbo-filtered `pnpm build`, then re-run the test. This is a general build-tooling caution, not specific to this repo's turbo setup, so treat it as reusable across projects with a similar filtered-build step.
