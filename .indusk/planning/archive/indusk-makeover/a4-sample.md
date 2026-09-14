# A4 Sample Gate — 15 pre-compression entries vs compressed CLAUDE.md

Seeded random sample (`random.seed(20260723)`) over top-level bullets of the
pre-compression Conventions / Known Gotchas / Key Decisions sections
(pre-compression copy = `git show <P6-parent>:CLAUDE.md`, 144,127 B).
Verdicts: does the compressed file still STATE the operative rule?

| # | Entry (abbrev) | Verdict |
|---|----------------|---------|
| S1 | `extensionsDisable` fires on_disable BEFORE rename | **intact** (Gotchas: "order is load-bearing") |
| S2 | OTel core + role-aware gate | **intact** (Key Decisions + gates convention) |
| S3 | Multi-agent coordination primitives | **intact** (Key Decisions + current.md convention) |
| S4 | `eval.model` fresh-call only | **intact** (eval agent convention) |
| S5 | getScm deleted / git-only | **intact** (Architecture + git-only decision) |
| S6 | worktree decision.ts + opt-out values | **intact** (worktree-per-plan convention) |
| S7 | admin-ui react-markdown swap-point | **restored during this gate** — was dropped; rule re-added to the admin-UI gotcha line |
| S8 | plan lifecycle order | **intact** |
| S9 | passWithNoTests per-app | **intact** |
| S10 | cleanup config block semantics | **intact (compressed)** — attention-focus-not-cap + config location stated; per-scope field detail lives in `/decisions/cleanup-ritual` |
| S11 | pnpm check/fix/format | **intact** |
| S12 | setup collision guard + atomicity | **intact** |
| S13 | Jaeger self-metrics none | **intact** |
| S14 | falsification log single-line | **intact** |
| S15 | composable.env usage rules (pnpm ce, env:build first) | **superseded** — the layer itself is deprecated (doppler is the default; deprecation stated in Architecture); legacy ce rules remain in `.claude/lessons` + the composable-env skill |

**Result: 14 intact (1 restored during the gate), 1 superseded-with-statement, 0 lost.**
The gate did its job — S7 was a real drop the sample caught before merge.
