# 1.31.0 changelog draft

Working note. Phase 5 consolidates this into `apps/docs/src/changelog.md` and deletes the draft.

## Phase 1 — Parity (semantic graph populates on git)

The two defensive early-returns in `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` and `graphiti-log-wrapper.ts` came down, plus three discovered short-circuits in the wrapper layer (`tools/graph-tools.ts` MCP handlers + `bin/cli.ts` CLI commands). After Phase 1, `indusk graph sync` on a git project produces real events; `captureWithLog` writes both Graphiti episodes AND `edge.attached` events to the semantic graph log; the "git mode — semantic graph unavailable" stderr message is gone.

Content-keyed dedup at sync time (existing) handles rebase via noisy-replay-then-converge: a `git rebase` that rewrites commit SHAs produces extra `anchor.moved` / `anchor.created` events; the runtime de-duplicates by `(path, blob_hash)` identity on the next sync; the system converges to current file state after one cycle. Provenance traceability is fuzzy (an event's `change_id` may name a rewritten commit), but functional correctness holds.

Three obsolete tests deleted: `git-mode-graph-sync.test.ts`, `git-mode-graph-cli.test.ts`, `git-mode-e2e.test.ts` — all asserted the prior graceful-degrade behavior. Replaced by T1, T2, T3, T5 in new test files (T4 skipped with documented reason — CGC index unavailable in tmp projects).

## Phase 2 — Eval pipeline collapse (pending)

## Phase 3 — Skills collapse (pending)

## Phase 4 — SCM abstraction rip-out (pending)

## Phase 5 — Migration + docs + version bump (pending)
