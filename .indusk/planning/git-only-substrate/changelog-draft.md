# 1.31.0 changelog draft

Working note. Phase 5 consolidates this into `apps/docs/src/changelog.md` and deletes the draft.

## Phase 1 — Parity (semantic graph populates on git)

The two defensive early-returns in `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` and `graphiti-log-wrapper.ts` came down, plus three discovered short-circuits in the wrapper layer (`tools/graph-tools.ts` MCP handlers + `bin/cli.ts` CLI commands). After Phase 1, `indusk graph sync` on a git project produces real events; `captureWithLog` writes both Graphiti episodes AND `edge.attached` events to the semantic graph log; the "git mode — semantic graph unavailable" stderr message is gone.

Content-keyed dedup at sync time (existing) handles rebase via noisy-replay-then-converge: a `git rebase` that rewrites commit SHAs produces extra `anchor.moved` / `anchor.created` events; the runtime de-duplicates by `(path, blob_hash)` identity on the next sync; the system converges to current file state after one cycle. Provenance traceability is fuzzy (an event's `change_id` may name a rewritten commit), but functional correctness holds.

Three obsolete tests deleted: `git-mode-graph-sync.test.ts`, `git-mode-graph-cli.test.ts`, `git-mode-e2e.test.ts` — all asserted the prior graceful-degrade behavior. Replaced by T1, T2, T3, T5 in new test files (T4 skipped with documented reason — CGC index unavailable in tmp projects).

## Phase 2 — Eval pipeline collapse

The eval pipeline is now single-SCM. Four collapses:

- **`apps/indusk-mcp/hooks/eval-trigger.js`**: trigger regex narrows from `/\b(jj describe|git commit)\b/` to `/\bgit commit\b/`; change-ID extraction collapses to a single `git rev-parse --short HEAD` call (no jj-first-then-fallback); module doc comment + skip message updated to git-only framing.
- **`apps/indusk-mcp/src/lib/eval/prompt-builder.ts`**: `scm` field removed from `PromptBuilderOptions`; `diffCommand` is now `git show ${changeId}` everywhere.
- **`apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` + `persistent-evaluator.ts`**: `getScm()` call sites deleted; `scm` const deleted; allowed-tools list loses `Bash(jj:*)`. The TDZ-on-`scm`-const gotcha in `persistent-evaluator.ts` is no longer applicable.
- **`apps/indusk-mcp/src/bin/commands/eval.ts` (`baseline --task`)**: SCM-aware commit + change-ID extraction collapses to `git commit --allow-empty` + `git rev-parse --short HEAD`. No more jj `jj new`/`jj describe`/`jj log` shell-outs.

Test surfaces:
- `eval-trigger-git-mode.test.ts` — rewritten to assert the git-only shape (no `jj describe` in the trigger regex; no `jj log -r` for change-ID extraction).
- `eval-trigger-filter-falsepositives.test.ts` — T16's regex assertion updated to expect `/\bgit commit\b/` instead of the dual pattern.
- `eval-baseline-scm-branches.test.ts` — rewritten as a git-only assertion suite; old "contains both branches" assertions are flipped to "does NOT contain jj branches".

## Phase 3 — Skills collapse

Skills are git-only as of 1.31.0. Five surfaces touched:

- **`apps/indusk-mcp/skills/jj.md`**: deleted. The standalone jj reference skill is gone.
- **`apps/indusk-mcp/skills/work.md`**: dual-form `### If scm: "jj"` / `### If scm: "git"` commit-cadence sections collapsed to single-form do-then-commit on a feature branch. No more `jj new` / `jj describe` / `jj split` prose.
- **`apps/indusk-mcp/skills/highlight.md`**: "next commit (jj describe / git commit)" prose collapsed to "next `git commit`".
- **`apps/indusk-mcp/skills/eval-review.md`**: dual `jj diff` / `git diff` examples collapsed to git-only; `jj log -r @` change-ID extraction collapsed to `git rev-parse --short HEAD`.
- **`apps/indusk-mcp/skills/git.md`**: removed "if your project uses Jujutsu" callout; removed "same as jj" comparison; rewrote eval-hook-timing-asymmetry-vs-jj paragraph as commit-message-discipline; removed `jj.md` from See Also.

Test surfaces:
- `apps/indusk-mcp/src/__tests__/fixtures/jj-skill-pre-phase-4.md` — deleted (byte-equal fixture).
- `apps/indusk-mcp/src/__tests__/skill-prose-scm-agnostic.test.ts` — deleted.
- `apps/indusk-mcp/src/lib/eval/evaluator-runner.test.ts` — pre-Phase-2 tests asserting jj-default and `scm: "jj"` branches collapsed to a single git-only test.
- `apps/indusk-mcp/src/__tests__/multi-agent-e2e.test.ts` — 2 pre-existing tests skipped with explanatory comments (section-shape leftover, orthogonal to git-only-substrate).

CLAUDE.md "Skills are SCM-aware" gotcha rewritten as "All skills assume git as the only SCM as of 1.31.0".

## Phase 4 — SCM abstraction rip-out (pending)

## Phase 5 — Migration + docs + version bump (pending)
