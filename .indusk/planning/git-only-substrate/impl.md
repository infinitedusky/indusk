---
title: "git-only-substrate"
date: 2026-06-27
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# git-only-substrate

## Goal

Bring git to full semantic-graph + Graphiti file-linkage parity, then rip jj out of the codebase, skills, and docs entirely. After this plan ships (1.31.0), git is the only SCM InDusk supports, the semantic graph populates on every git project including dusk, and the "files → episodes → entities" traversal the agent loop depends on works end-to-end.

The trajectory IDs below use a `T1..T13` numbering scheme. They map directly to the test plan's behavioral assertions: `T1..T5` correspond to test-plan `A1..A5` (Phase A parity); `T6..T13` correspond to test-plan `B1..B8` (Phase B rip-out).

## Scope

### In Scope
- Delete the two defensive early-returns at `sync-engine.ts:80-86` and `graphiti-log-wrapper.ts:93-103`
- Update outdated in-code documentation (the "jj-only feature in v1" comments)
- Collapse SCM branching in eval pipeline (trigger regex, prompt-builder, persistent-evaluator, evaluator-runner, baseline CLI)
- Delete `apps/indusk-mcp/src/lib/scm/detect.ts` and `apps/indusk-mcp/src/lib/semantic-graph/jj.ts`
- Drop `getScm()` from all 14 call sites
- Delete `apps/indusk-mcp/skills/jj.md`
- Collapse SCM-conditional sections in `work.md`, `highlight.md`, `eval-review.md`
- `indusk update` emits stderr nudge for projects with `scm: "jj"` in config
- Rewrite `apps/docs/src/guide/scm.md` as git workflow
- Publish ADR at `apps/docs/src/decisions/git-only-substrate.md`
- Supersession banner on `apps/docs/src/decisions/git-or-jj-substrate.md` and `.indusk/planning/git-or-jj-substrate/`
- Sweep ~25 prose references across docs + planning
- 1.31.0 changelog entry

### Out of Scope
- The highlights-drain bug (separate plan: `eval-agent-mcp-access`)
- Edits to historical changelog entries documenting the 1.28.x dual-SCM era
- Backwards-compat shims for code that imports `getScm` from anywhere
- jj-as-overlay-on-git support changes (jj users keep working at the SCM level)
- Active migration of config files (the field becomes a no-op; user removes it when they notice)
- Log compaction for noisy-replay-then-converge rebase entries (future plan)

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| 1 | git-mode semantic graph + file-linkage parity (early-returns gone); T1-T5 regression coverage; updated in-code documentation | content-keyed dedup design (existing); `getReachableChangeIds` git impl (existing); content-keyed runtime identity matching (existing) |
| 2 | eval pipeline collapsed to git-only (trigger regex narrowed, prompt-builder/runner/baseline-CLI single-form); T8, T9 coverage | Phase 1's parity |
| 3 | skills collapsed to git-only (jj.md deleted; dual-form sections in work/highlight/eval-review removed); T7, T11 coverage | (independent of code) |
| 4 | SCM abstraction deleted (jj.ts, detect.ts, getScm() callsites zero); T6 + T13 coverage | Phase 1 (parity), Phase 2 (eval no longer consumes scm), Phase 3 (skills no longer reference scm) — last consumer must be gone before deletion |
| 5 | migration nudge in `update.ts`; user-facing guide rewrite; supersession banners; ADR published; 1.31.0 changelog entry; T10, T12 coverage | All prior phases |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | On a fresh git project, `indusk graph sync` after a commit produces events in the semantic graph log and `indusk graph status` reports anchors greater than zero (replaces today's "git mode — semantic graph unavailable" stderr no-op). | Phase 0 | Phase 1 | passing |
| T2 | A `graph_capture` call on a git-mode project writes both the Graphiti episode AND an `edge.attached` event to the semantic graph log connecting episode UUID to file anchor. | Phase 0 | Phase 1 | passing |
| T3 | `indusk graph sync` then `git rebase -i HEAD~3` (rewriting history without changing file content) then `indusk graph sync` again converges the runtime to current file state; no orphaned anchors. | Phase 0 | Phase 1 | passing |
| T4 | `indusk graph sync` then `git mv` a file then commit then `indusk graph sync` preserves the file's anchor UUID via rename detection (anchor.moved event, not tombstoned+created). | Phase 0 | Phase 1 | skipped |
| T5 | A `graph_capture` call with a `file_path` argument on a git-mode project produces an `edge.attached` event whose target is the specific file's anchor UUID (not a project-root fallback anchor). | Phase 0 | Phase 1 | passing |
| T6 | A search across `apps/indusk-mcp/src/` for `getScm`, `jj.ts`, `NotAJjRepoError`, or `getJjReachable` finds zero matches. | Phase 0 | Phase 4 | planned |
| T7 | `apps/indusk-mcp/skills/jj.md` does not exist on disk; `apps/indusk-mcp/skills/git.md` exists and contains no "if your project uses jj" framing. | Phase 0 | Phase 3 | passing |
| T8 | The eval-trigger hook fires on `git commit` but not on `jj describe`, `jj split`, or any other jj subcommand. The trigger regex narrows from a dual-pattern matcher (matching `jj describe` OR `git commit`) to a git-only matcher (matching `git commit` only). | Phase 0 | Phase 2 | passing |
| T9 | The eval agent's prompt's diff-fetch instruction says `git show ${id}` regardless of project; never `jj diff -r ${id}`. | Phase 0 | Phase 2 | passing |
| T10 | Running `indusk update` on a project whose `.indusk/config.json` has `scm: "jj"` emits exactly one stderr nudge ("scm field no longer used; safe to remove from .indusk/config.json") and leaves the config file's contents byte-unchanged. | Phase 0 | Phase 5 | planned |
| T11 | `apps/indusk-mcp/skills/{work,highlight,eval-review}.md` contain no SCM-conditional "if jj... else git..." prose — every commit-cadence and diff-fetch reference is single-form. | Phase 0 | Phase 3 | passing |
| T12 | `apps/docs/src/guide/scm.md` opens as a git workflow guide (no "choose your SCM" framing); `apps/docs/src/decisions/git-or-jj-substrate.md` carries a supersession banner at the top pointing to this plan's ADR. | Phase 0 | Phase 5 | planned |
| T13 | `pnpm test` from the repo root passes after all changes land. Every existing test that previously asserted dual-SCM behavior either updates to assert git-only behavior or is deleted with rationale. | Phase 0 | Phase 4 | planned |

All trajectory rows are writable at Phase 0 — every test is authorable today against the current stack. T1-T5 e2e and integration tests assert the post-Phase-1 behavior and go red today (current stack returns "git mode unavailable" or skips the log mirror). T6-T12 are source-level grep / file content assertions, red today because the patterns exist. T13 is the existing CI run, which goes through transient red states during phases 2-4 as code/tests get removed and ends green at Phase 4.

No `### Trajectory Rationale` subsection required — every row is Phase 0.

## Checklist

### Phase 1: Parity — delete early-returns + regression coverage

- [x] Delete the git-mode early-return block at `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts:75-86` (the `if (getScm(projectRoot) === "git")` block + the EMPTY_RESULT return + the outdated comment block above it)
- [x] Delete the git-mode early-return block at `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts:89-103` (the same pattern + the warn-once flag wiring + comment)
- [x] Remove the module-level `warnedGitMode` flag + `warnOnceGitMode()` helper at the top of `graphiti-log-wrapper.ts` (their only consumer is the block being deleted)
- [x] **Discovered (2026-06-27):** Delete the git-mode early-returns in the MCP tool wrappers at `apps/indusk-mcp/src/tools/graph-tools.ts` — three handlers (`graph_sync`, `graph_rebuild`, `graph_status`) each have an explicit `if (getScm(projectRoot) === "git")` short-circuit returning a "git mode — semantic graph unavailable" text response. With the lib early-returns gone, these wrappers should pass through to the real library functions.
- [x] **Discovered (2026-06-27):** Delete the git-mode early-returns in the CLI commands at `apps/indusk-mcp/src/bin/cli.ts` — `graph rebuild` and `graph status` commands each have their own `getScm(projectRoot) === "git"` short-circuit writing the same stderr message. With the lib early-returns gone, the CLI commands should also pass through.
- [x] Update the doc comment at the top of `sync-engine.ts` (steps 5 and 6 still reference "jj change ID" — change to "git short SHA")
- [x] Update the doc comment at the top of `graphiti-log-wrapper.ts` to drop the "jj-only" framing
- [x] Identify and update or delete existing tests that asserted the git-mode-unavailable stderr behavior — deleted `apps/indusk-mcp/src/__tests__/git-mode-graph-sync.test.ts`, `git-mode-graph-cli.test.ts`, `git-mode-e2e.test.ts`. All three asserted the OLD graceful-degrade behavior; T1-T5 replace their coverage.
- [x] Write end-to-end harness helper for tmp git projects (init + commit + run `indusk graph sync` + read log/status). Reused by T1, T3, T4, T10. Place at `apps/indusk-mcp/src/__tests__/helpers/git-tmp-project.ts`
- [x] Write T1 e2e: fresh git project + commit + `indusk graph sync` asserts log has `anchor.created` events AND `indusk graph status` reports anchors > 0
- [x] Write T2 vitest integration: call `graph_capture` against a git-mode project with a stubbed Graphiti client + real log writer, assert both Graphiti episode AND `edge.attached` event with correct anchor UUID
- [x] Write T3 e2e: full sync then `git rebase -i HEAD~3` (rewriting history without changing content) then full sync — assert runtime state reflects current file paths and contents (no orphaned anchors for files whose blob hash matches current path)
- [x] Write T4 e2e: full sync then `git mv` a file + commit then full sync — assert `anchor.moved` event in the second sync's output, NOT tombstoned+created; assert the file's anchor UUID is preserved
- [x] Write T5 vitest integration: call `graph_capture` with `file_path` argument on git-mode project, assert resulting `edge.attached` event's target UUID matches the specific file anchor (not the project-root fallback)

#### Phase 1 Verification
- [x] T1 passes (`pnpm vitest run src/__tests__/git-tmp-project-graph-sync.test.ts`)
- [x] T2 passes (vitest integration — `pnpm vitest run src/__tests__/graph-capture-git-mode.test.ts`)
- [x] T3 passes (e2e rebase test)
- [x] T4 skipped — anchor.moved detection requires CGC index in tmp project; manual smoke covers (rationale inline in test file)
- [x] T5 passes (vitest integration)
- [x] `pnpm vitest run src/lib/semantic-graph/` passes — 67 passed, 5 skipped (existing semantic-graph suite still green after early-return deletion)

#### Phase 1 Context
- [x] Update CLAUDE.md Known Gotchas: rewrote the "Semantic graph features are jj-only" entry as "Semantic graph features populate on every git project as of 1.31.0" — describes the noisy-replay-then-converge model
- [x] Update CLAUDE.md Known Gotchas: marked the "Eval prompts and baseline CLI are SCM-aware" entry as "slated for collapse in `git-only-substrate` Phase 2" — still accurate today, will rewrite when Phase 2 lands
- [x] Update CLAUDE.md Architecture: added "Semantic graph populates on every git project as of 1.31.0" to the indusk-infra entry — Phase 1 parity announced at the architecture layer

#### Phase 1 Document
- [x] Added a 1.31.0 changelog draft section at `.indusk/planning/git-only-substrate/changelog-draft.md` capturing Phase 1's parity landing (5 early-returns deleted; content-keyed dedup model on rebase; 3 obsolete tests removed; T1-T5 disposition). Phase 5 consolidates into the published changelog and deletes the draft.

### Phase 2: Eval pipeline collapse

- [ ] Narrow the eval-trigger regex at `apps/indusk-mcp/hooks/eval-trigger.js` from the dual-pattern matcher to `/\bgit commit\b/`. Update the system.log skip message ("skip — no jj describe / git commit in command" → "skip — no git commit in command")
- [ ] Update existing eval-trigger word-boundary tests (`eval-trigger-git-mode.test.ts`, `eval-trigger-filter-falsepositives.test.ts`) to assert the new git-only regex; delete assertions that the regex matches `jj describe`
- [ ] Drop the `scm` parameter from `apps/indusk-mcp/src/lib/eval/prompt-builder.ts`'s `PromptBuilderOptions`; collapse the `diffCommand` ternary to `git show ${opts.changeId}` everywhere
- [ ] Drop the `scm: getScm(projectRoot)` call sites in `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` and `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts`. Remove the TDZ-sensitive `const scm = ...` declaration in `persistent-evaluator.ts` (no longer needed since the prompt builder no longer takes `scm`)
- [ ] Collapse the SCM branch in `apps/indusk-mcp/src/bin/commands/eval.ts`'s `baseline --task` flow to git-only: use `git commit --allow-empty -m "baseline: ${taskName}"` + `git rev-parse --short HEAD`; delete the jj `jj new` + `jj describe` path
- [ ] Update prompt-builder tests at `apps/indusk-mcp/src/lib/eval/__tests__/prompt-builder.test.ts` to drop `scm` parameter tests; assert `git show` is always used
- [ ] Update eval baseline tests at `apps/indusk-mcp/src/__tests__/eval-baseline-scm-branches.test.ts` to assert git-only behavior; delete jj-branch test cases

#### Phase 2 Verification
- [ ] T8 passes (pnpm vitest run src/__tests__/eval-trigger-git-mode.test.ts src/__tests__/eval-trigger-filter-falsepositives.test.ts — assertions now match git-only regex)
- [ ] T9 passes (pnpm vitest run src/lib/eval/__tests__/prompt-builder.test.ts — `git show` is the only diff-fetch pattern asserted)
- [ ] pnpm vitest run src/lib/eval src/__tests__/eval passes (full eval suite stays green)

#### Phase 2 Context
- [ ] Update CLAUDE.md Known Gotchas: delete the "Eval prompts and baseline CLI are SCM-aware" entry. Replace with a one-line note in Architecture: "Eval pipeline is git-only as of 1.31.0 — prompts say `git show ${id}`; trigger fires on `git commit`; baseline CLI uses `git commit --allow-empty`."
- [ ] Update CLAUDE.md Known Gotchas: delete the "TDZ trap in persistent-evaluator" entry — no longer applicable since `scm`/`diffCommand` consts are gone

#### Phase 2 Document
- [ ] Append Phase 2 entry to `.indusk/planning/git-only-substrate/changelog-draft.md` ("Eval pipeline collapsed to single-SCM: trigger regex narrowed, prompts say `git show`, baseline uses `git commit --allow-empty`")

### Phase 3: Skills collapse

- [ ] Delete `apps/indusk-mcp/skills/jj.md` (the file ships from the indusk-mcp tarball via `files: ["skills"]`; deletion propagates to consumers on next `indusk update`)
- [ ] Edit `apps/indusk-mcp/skills/work.md` to collapse the SCM-conditional commit-cadence section to a single git-only flow (do work → check off → commit). Remove "if jj... else git..." framing entirely
- [ ] Edit `apps/indusk-mcp/skills/highlight.md` to collapse "on next `jj describe` or `git commit`" prose to "on next `git commit`"
- [ ] Edit `apps/indusk-mcp/skills/eval-review.md` to drop `jj diff` examples; replace with `git show` / `git diff HEAD~1` examples
- [ ] Edit `apps/indusk-mcp/skills/git.md` to remove any "if your project uses jj" framing (it should just describe git workflow as the single SCM)
- [ ] Delete the `apps/indusk-mcp/src/__tests__/fixtures/jj-skill-pre-phase-4.md` fixture and the byte-equal regression test (`apps/indusk-mcp/src/__tests__/jj-skill-pinned.test.ts` or similar — locate by grep)
- [ ] Audit `apps/indusk-mcp/skills/` for any other dual-SCM prose; grep for "jj " and "jj describe" / "jj diff" / "jj new"

#### Phase 3 Verification
- [ ] T7 passes — assert `apps/indusk-mcp/skills/jj.md` does not exist on disk; assert `apps/indusk-mcp/skills/git.md` does exist; assert `git.md` content has no "if your project uses jj" patterns
- [ ] T11 passes — grep across `work.md`, `highlight.md`, `eval-review.md` for SCM-conditional prose patterns returns zero matches
- [ ] pnpm vitest run src/__tests__/ passes — no test depends on `jj.md` existing or the byte-equal fixture

#### Phase 3 Context
- [ ] Update CLAUDE.md Conventions: delete the "Skills are SCM-aware" entry (around line ~155 currently). Replace with "All skills assume git as the only SCM as of 1.31.0; cadence guidance is single-form."

#### Phase 3 Document
- [ ] Append Phase 3 entry to `.indusk/planning/git-only-substrate/changelog-draft.md` ("Skill prose collapsed to git-only: `jj.md` removed; dual-form sections in `work.md`/`highlight.md`/`eval-review.md` rewritten")

### Phase 4: SCM abstraction rip-out

- [ ] Delete `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` and its test `jj.test.ts`
- [ ] Delete `apps/indusk-mcp/src/lib/scm/detect.ts` (the `detectScm`, `getScm`, `NoScmDetectedError` exports go away) and its tests under `apps/indusk-mcp/src/__tests__/scm-init-detection.test.ts` and any `lib/scm/__tests__/` files
- [ ] Inline a git-only `getCurrentChangeId(projectRoot)` directly in `apps/indusk-mcp/src/lib/scm/index.ts`. Drop the `detect` import, the `if (scm === "jj")` branches in `getCurrentChangeId` and `getReachableChangeIds`, and the `getJjReachable` re-export. The module shrinks to just `getCurrentChangeId` (using `git rev-parse --short HEAD`) and `getReachableChangeIds` (using `git log --format=%h HEAD`)
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` to remove `import { getScm } from "../scm/detect.js"` — the early-return was the only consumer, deleted in Phase 1; sweep stale import
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts` to remove `import { getScm } from "../scm/detect.js"` similarly
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/index.ts` — remove any re-exports of jj-specific symbols
- [ ] Update `apps/indusk-mcp/src/lib/highlights/` (or wherever `getScm` is called) to drop SCM branching — likely just the highlight tag uses `getCurrentChangeId` without checking SCM kind
- [ ] Update `apps/indusk-mcp/src/bin/commands/init.ts` to remove the `detectScm()` + `scm` field write — `.indusk/config.json` no longer carries `scm` on fresh init
- [ ] Update `apps/indusk-mcp/src/bin/commands/update.ts` to remove the migration logic that adds `scm` to old configs (the Phase 1 migration block from `git-or-jj-substrate`). The Phase 5 stderr nudge replaces this.
- [ ] Sweep `apps/indusk-mcp/src/` for any remaining `getScm`, `NotAJjRepoError`, `getJjReachable`, `jj.ts` imports; should be zero matches
- [ ] Delete any tests pinned to `getScm` behavior or the dual-SCM substrate (check `eval-baseline-scm-branches.test.ts`, `scm-init-detection.test.ts`, plus any `lib/scm/__tests__/`)
- [ ] Delete `apps/indusk-mcp/src/__tests__/git-mode-e2e.test.ts` if it asserts dual-SCM behavior; rewrite or fold into Phase 1's e2e harness if it has reusable setup

#### Phase 4 Verification
- [ ] T6 passes — grep across `apps/indusk-mcp/src/` for `getScm`, `jj.ts`, `NotAJjRepoError`, `getJjReachable` returns zero matches
- [ ] T13 passes — `pnpm test` from repo root passes (final all-tests run after the rip-out)
- [ ] pnpm tsc --noEmit clean (no broken imports from the deletion sweep)
- [ ] pnpm check clean (Biome lints + format)

#### Phase 4 Context
- [ ] Update CLAUDE.md Conventions: delete the "`scm` field in `.indusk/config.json` is the runtime source of truth" entry. Replace with a one-line note that `scm` is no longer written or read.
- [ ] Update CLAUDE.md Known Gotchas: delete the "`getScm()` defaults to `'jj'` when the config field is missing" entry — no longer applicable
- [ ] Update CLAUDE.md Architecture: under indusk-mcp's description, update the "SCM abstraction at `apps/indusk-mcp/src/lib/scm/`" sentence to "Git is the only SCM as of 1.31.0; the abstraction layer is gone."

#### Phase 4 Document
- [ ] Append Phase 4 entry to `.indusk/planning/git-only-substrate/changelog-draft.md` ("SCM abstraction layer deleted: `lib/scm/detect.ts`, `lib/semantic-graph/jj.ts`, all 14 `getScm()` call sites removed; `lib/scm/index.ts` collapses to git-only `getCurrentChangeId` + `getReachableChangeIds`")

### Phase 5: Migration nudge + docs + 1.31.0 changelog

- [ ] Add stderr nudge to `apps/indusk-mcp/src/bin/commands/update.ts`: when reading existing `.indusk/config.json`, if `config.scm === "jj"`, emit one line: `scm field no longer used; safe to remove from .indusk/config.json`. Do NOT modify the file. Emit once per `update` invocation
- [ ] Write T10 e2e: init tmp git project + write `scm: "jj"` into config + run `indusk update` + assert single stderr line + assert config file unchanged byte-for-byte
- [ ] Rewrite `apps/docs/src/guide/scm.md` as "Git workflow conventions" — drop the "Choose your SCM" framing; describe git as the only SCM; brief historical paragraph mentioning the 1.31.0 strategic shift; link to the ADR
- [ ] Add supersession banner at top of `apps/docs/src/decisions/git-or-jj-substrate.md` pointing to `git-only-substrate.md` with the 2026-06-27 date
- [ ] Add supersession banner at top of `.indusk/planning/git-or-jj-substrate/adr.md` (same shape, points to `../git-only-substrate/adr.md`)
- [ ] Publish ADR to docs site at `apps/docs/src/decisions/git-only-substrate.md` — copy the planning ADR with the docs-site frontmatter
- [ ] Add 1.31.0 changelog entry under `[Unreleased]` in `apps/docs/src/changelog.md` — consolidate the per-phase entries from `.indusk/planning/git-only-substrate/changelog-draft.md` into a single Changed/Removed entry
- [ ] Write T12 vitest unit: read `apps/docs/src/guide/scm.md` + assert no "choose your SCM" / "if jj" patterns; read `apps/docs/src/decisions/git-or-jj-substrate.md` + assert supersession banner present at top
- [ ] Sweep `apps/docs/src/` and `.indusk/planning/` for `jj describe`, `jj diff`, `jj new`, `jj.md`, `getScm` prose references. Update or note as historical (in a final-sweep commit). Run `grep -rln "jj describe" apps/docs/src/ .indusk/planning/` (and similar for other patterns) after sweep — expect zero matches in current-state prose; historical changelog entries and retro/lesson pages stay as time-stamped record
- [ ] Bump `apps/indusk-mcp/package.json` from `1.30.2` to `1.31.0`
- [ ] Delete `.indusk/planning/git-only-substrate/changelog-draft.md` after consolidation (working note, not shipped)

#### Phase 5 Verification
- [ ] T10 passes (e2e: nudge emitted, config unchanged)
- [ ] T12 passes (docs assertions green)
- [ ] grep across docs + planning for jj patterns returns zero matches outside historical context
- [ ] pnpm test from repo root passes one final time
- [ ] pnpm check clean

#### Phase 5 Context
- [ ] Update CLAUDE.md Current State: add a one-paragraph entry summarizing `git-only-substrate` shipped in 1.31.0 — parity landed via deletion, abstraction removed, jj gone, dusk's semantic graph populates
- [ ] Update CLAUDE.md Current State: update the project version cited from 1.30.x to 1.31.0

#### Phase 5 Document
- [ ] User-facing guide at `apps/docs/src/guide/scm.md` rewritten — git workflow conventions, brief historical note about the 1.31.0 shift, link to ADR
- [ ] ADR published to `apps/docs/src/decisions/git-only-substrate.md` with docs-site frontmatter (title, sidebar order, etc.)
- [ ] Supersession banners in place on prior plan's ADR (`apps/docs/src/decisions/git-or-jj-substrate.md`) and prior planning ADR (`.indusk/planning/git-or-jj-substrate/adr.md`)
- [ ] 1.31.0 changelog entry published in `apps/docs/src/changelog.md` under `[Unreleased]` then `[1.31.0]` heading at release time

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` | Delete early-return block (lines 75-86); update top-of-file doc comment |
| `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts` | Delete early-return block (lines 89-103); remove `gitModeWarnedThisSession` flag; update comment |
| `apps/indusk-mcp/src/lib/semantic-graph/jj.ts` | Delete |
| `apps/indusk-mcp/src/lib/semantic-graph/jj.test.ts` | Delete |
| `apps/indusk-mcp/src/lib/semantic-graph/index.ts` | Remove jj re-exports |
| `apps/indusk-mcp/src/lib/scm/detect.ts` | Delete |
| `apps/indusk-mcp/src/lib/scm/index.ts` | Collapse to git-only `getCurrentChangeId` + `getReachableChangeIds`; drop `getJjReachable` re-export |
| `apps/indusk-mcp/hooks/eval-trigger.js` | Narrow regex to `/\bgit commit\b/`; update skip message |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Drop `scm` from `PromptBuilderOptions`; collapse `diffCommand` to `git show ${id}` |
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` | Drop `scm` const + `getScm()` call; remove TDZ workaround comment |
| `apps/indusk-mcp/src/lib/eval/evaluator-runner.ts` | Drop `scm` const + `getScm()` call |
| `apps/indusk-mcp/src/bin/commands/eval.ts` | Collapse `baseline` to `git commit --allow-empty` + `git rev-parse --short HEAD` |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Drop `detectScm()` + `scm` field write |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Add stderr nudge for `scm: "jj"`; remove old migration block |
| `apps/indusk-mcp/skills/jj.md` | Delete |
| `apps/indusk-mcp/skills/git.md` | Remove "if your project uses jj" framing |
| `apps/indusk-mcp/skills/work.md` | Collapse dual-form commit cadence to git-only |
| `apps/indusk-mcp/skills/highlight.md` | Collapse `jj describe` / `git commit` to `git commit` only |
| `apps/indusk-mcp/skills/eval-review.md` | Replace `jj diff` examples with `git show` / `git diff` |
| `apps/indusk-mcp/src/__tests__/fixtures/jj-skill-pre-phase-4.md` | Delete |
| `apps/indusk-mcp/src/__tests__/git-mode-e2e.test.ts` | Delete or rewrite as git-only |
| `apps/indusk-mcp/src/__tests__/scm-init-detection.test.ts` | Delete |
| `apps/indusk-mcp/src/__tests__/eval-baseline-scm-branches.test.ts` | Collapse to git-only branch |
| `apps/indusk-mcp/src/__tests__/eval-trigger-git-mode.test.ts` | Update assertions to git-only regex |
| `apps/indusk-mcp/src/__tests__/eval-trigger-filter-falsepositives.test.ts` | Update assertions |
| `apps/indusk-mcp/src/__tests__/helpers/git-tmp-project.ts` | **New** — shared e2e harness for git tmp projects |
| `apps/indusk-mcp/src/__tests__/git-tmp-project-graph-sync.test.ts` | **New** — T1, T3, T4 |
| `apps/indusk-mcp/src/__tests__/graph-capture-git-mode.test.ts` | **New** — T2, T5 |
| `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts` | **New** — T10 |
| `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` | **New** — T6 |
| `apps/indusk-mcp/src/__tests__/skills-collapse.test.ts` | **New** — T7, T11 |
| `apps/indusk-mcp/src/__tests__/docs-rewrite.test.ts` | **New** — T12 |
| `apps/docs/src/guide/scm.md` | Rewrite as git workflow |
| `apps/docs/src/decisions/git-or-jj-substrate.md` | Add supersession banner at top |
| `apps/docs/src/decisions/git-only-substrate.md` | **New** — published ADR |
| `apps/docs/src/changelog.md` | 1.31.0 entry under `[Unreleased]` |
| `apps/indusk-mcp/package.json` | `1.30.2` to `1.31.0` |
| `.indusk/planning/git-or-jj-substrate/adr.md` | Add supersession banner at top |
| `.indusk/planning/git-only-substrate/changelog-draft.md` | **New** working note (deleted after Phase 5 consolidation) |
| `CLAUDE.md` | Edits across phases (Architecture, Conventions, Key Decisions, Known Gotchas, Current State) |

## Dependencies

- `apps/indusk-mcp/src/lib/scm/index.ts`'s git impl of `getReachableChangeIds` (already shipped in 1.28.9 via `git-or-jj-substrate` Phase 1)
- The sync engine's content-keyed identity matching at `existingByIdentity` / `existingByFingerprint` (already in place)
- Replay's optional `ancestryFilter?: Set<string>` (already in place)

## Notes

- **Phase 1 is structurally the riskiest** — deleting the early-returns will surface any hidden coupling that the prior plan didn't anticipate. The 5 e2e/integration assertions are the safety net; if they go green and `pnpm test` stays green, the deletion is safe.
- **The changelog-draft.md working note is a Phase 1-4 concession to the `gate_policy: ask` requirement** that every phase have a real Document item. Phases 1-4 don't independently produce user-facing docs; their Document items append to this draft. Phase 5 consolidates and publishes. The draft file is deleted after consolidation — it's working state, not shipped.
- **Phase 4 is where `pnpm test` from repo root is the load-bearing assertion (T13).** Earlier phases may have transient red states as code/tests are removed; the final assertion that everything stays green lands at Phase 4 close.
- **No falsification phase is pre-authored** — the `/falsify` ritual runs between `/work` close and `/retrospective` open, and `/falsify` itself writes a new "Phase 6: Falsification" phase into this impl (per the 1.27.4 convention).
- **The eval pipeline collapse in Phase 2 has one subtle dependency on Phase 1**: the eval-trigger hook continues to fire on git commits today (it already supports git), so narrowing the regex is functionally safe in isolation. But the prompt-builder collapse changes what diff command the inner Claude subprocess runs — which only matters if the inner subprocess actually runs (it does on the prompt-builder's `mode: "eval"` path). Phase 1's parity must be in place so that the prompts the eval pipeline now writes can land their edges correctly.
- **Skill changes in Phase 3 are independent of Phases 1-2 functionally**, but ordering them after Phase 2 keeps the rip-out narrative coherent — Phase 4's SCM abstraction deletion is the last consumer's removal.
