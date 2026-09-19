# A fresh plan worktree fails 9 `indusk ui`/pack tests with no hint why — the bundled admin artifact doesn't exist there yet

`apps/indusk-mcp/admin/` is a gitignored production bundle produced by `scripts/bundle-admin.js`. It exists on the trunk checkout only by historical accident (someone ran the bundle script there once) — a genuinely fresh plan worktree never has it. `pnpm test` in that worktree then fails 9 `indusk ui` / tarball-packing tests, and the failures give no hint that a missing gitignored artifact is the cause — they read like real regressions.

This is a sibling problem to [[worktree-test-env-parity-gitignored-artifacts]] (which teaches diagnosing this class of failure by baseline-comparing against trunk) but is the specific, still-open instance: day-monitor's retrospective queued this as a follow-on rather than fixing it, because the fix belongs in worktree setup (auto-run the bundle script) or as a clear test-side refusal (skip/explain rather than fail opaquely) — neither exists yet.

Before debugging opaque `indusk ui`/pack test failures in a fresh worktree, check for this first: does `apps/indusk-mcp/admin/` exist? If not, that's very likely the whole story.
