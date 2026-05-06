---
title: "git-or-jj-substrate"
date: 2026-05-04
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# git-or-jj-substrate

## Goal

Make InDusk function on plain-git projects without regressing jj behavior. Add an `scm` field to `.indusk/config.json` set at init time, route every jj-coupled call site through a single `lib/scm` helper, and graceful-degrade the semantic graph on git mode (its only deeply jj-coupled surface).

## Scope

### In Scope

- `scm: "jj" | "git"` field in `.indusk/config.json`, populated by `indusk init` and migrated by `indusk update`
- New `apps/indusk-mcp/src/lib/scm/` module exposing `getScm`, `getCurrentChangeId`, `getReachableChangeIds`
- Semantic graph callers (`sync-engine`, `graphiti-log-wrapper`, `replay`) switched to `lib/scm` with graceful-degrade on git
- Eval prompt text (`prompt-builder.ts`, `persistent-evaluator.ts`) SCM-aware
- `indusk eval baseline --task` uses `git commit --allow-empty` on git
- New `apps/indusk-mcp/skills/git.md` skill; work/highlight/eval-review prose updated to show both forms
- End-to-end git-only smoke harness; manual smoke procedure documented

### Out of Scope

- Full git parity for the semantic graph (stable event_id design, rebase-tolerant replay) — deferred to a follow-up plan
- Migrating existing dusk/numero installations off jj — they keep `scm: "jj"`
- Editing the existing `apps/indusk-mcp/skills/jj.md` — it stays as the rich jj reference

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1: detection + config | `detectScm()`, `getScm()` exports; updated `.indusk/config.json` schema; `init`/`update` CLI populating `scm` field | Existing init/update command structure |
| Phase 2: semantic graph wiring + graceful-degrade | `lib/scm/index.ts` with branched `getCurrentChangeId`/`getReachableChangeIds`; updated callers in `sync-engine`, `graphiti-log-wrapper`, `replay` (callers); git-mode no-op behavior with stderr message | Phase 1's `getScm`; existing `lib/semantic-graph/jj.ts` (preserved as the jj-mode implementation) |
| Phase 3: eval surface | `PromptBuilderOptions` gains `scm` field; prompt-builder branches on SCM; `eval baseline --task` uses `git commit --allow-empty` on git | Phase 1's `getScm`; existing eval pipeline |
| Phase 4: skills | New `skills/git.md`; edited `skills/work.md`, `skills/highlight.md`, `skills/eval-review.md`; updated `eval/findings.ts:5` doc comment; `update` command syncs new skill files into installed projects | None (parallelizable with Phases 2–3) |
| Phase 5: end-to-end smoke | Tmpdir-based git-only e2e harness exercising init+update+sync+baseline; documented manual smoke procedure for the eval-hook firing | Everything from Phases 1–4 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | A1: `indusk init` in a git-only repo (no jj on PATH) writes `scm: "git"` to `.indusk/config.json` | Phase 0 | Phase 1 | passing |
| T2 | A2: `indusk init` in a jj repo writes `scm: "jj"` to `.indusk/config.json` | Phase 0 | Phase 1 | passing |
| T3 | A3: `indusk update` on a project missing the `scm` field detects + adds it; second run is a no-op | Phase 0 | Phase 1 | passing |
| T4 | A4: `indusk graph sync` on a git-mode project exits 0, prints `git mode — semantic graph unavailable` to stderr, writes no events | Phase 0 | Phase 2 | passing |
| T5 | A5: existing `sync-engine.test.ts` + `jj.test.ts` stay green (no regression on jj path) | Phase 0 | Phase 2 | passing |
| T6 | A6: `indusk eval baseline --task <path>` on a git-mode project completes and writes a baseline scorecard | Phase 0 | Phase 3 | passing |
| T7 | A7: `buildEvaluatorPrompt({ scm: "git", ... })` includes `git show ${shortSha}`; `buildEvaluatorPrompt({ scm: "jj", ... })` includes `jj diff -r ${changeId}` | Phase 3 | Phase 3 | passing |
| T8 | A8: after `git commit -m "..."` inside a Claude Code session in a git-mode fixture, a scorecard entry appears in `.indusk/eval/results.log` within 60s | Phase 0 | Phase 5 | skipped |
| T9 | A9: `apps/indusk-mcp/skills/git.md` exists with `git commit -m` content; `apps/indusk-mcp/skills/jj.md` is byte-equal to its pre-Phase-4 content | Phase 0 | Phase 4 | passing |
| T10 | A10: `apps/indusk-mcp/skills/work.md` commit-cadence section contains both `jj describe` and `git commit` | Phase 0 | Phase 4 | passing |
| T11 | H1-A: `eval-trigger.js`'s skip filter accepts a hook event whose `command` contains `git commit` (does NOT early-exit on the filter check) | Phase 0 | Phase 6 | passing |
| T12 | H1-B: `eval-trigger.js` simulated against a git-only tmpdir resolves a non-empty changeId via git fallback (doesn't exit silently when jj is missing) | Phase 0 | Phase 6 | passing |
| T13 | H2-A: `indusk graph status` on a git-mode tmpdir exits 0, prints `git mode — semantic graph unavailable`, does NOT print the misleading `run 'indusk graph sync' first` hint | Phase 0 | Phase 6 | passing |
| T14 | H2-B: `indusk graph rebuild` on a git-mode tmpdir exits 0, prints `git mode — semantic graph unavailable`, does NOT clear the runtime or attempt replay | Phase 0 | Phase 6 | passing |
| T15 | H1-C: `apps/indusk-mcp/src/bin/commands/init.ts` syncs ALL `.js` files from the package's `hooks/` directory (eval-trigger.js included) — verified by source grep that init's hook copy uses `globSync` rather than a hardcoded list | Phase 0 | Phase 6 | passing |
| T16 | H3: `eval-trigger.js`'s trigger filter does NOT fire on `git config user.email "git committer"` (substring false-positive — "committer" contains "commit"); does fire on a real `git commit -m "..."` | Phase 0 | Phase 7 | written |
| T17 | H4: `eval-trigger.js` skips when `event.tool_response.exit_code` is non-zero (failed commit) — does not run the eval against a previous commit's SHA | Phase 0 | Phase 7 | written |
| T18 | H5: `indusk init` in a tmpdir without `git init`/`jj git init` first prints a stderr warning naming the recovery command (`indusk update` after initializing SCM) | Phase 0 | Phase 7 | written |

### Trajectory Rationale

- **T7** `Writable at: Phase 3` — The test calls `buildEvaluatorPrompt({ scm: "git", ... })`. The `PromptBuilderOptions` interface gains the `scm` field in Phase 3; passing it today is a TypeScript compile error against the current interface, so the test source cannot be authored before then.

### Skipped Verification

- **T8** `State: skipped` — Approval test awaiting first run. The eval hook fires inside Claude Code's tool-execution path, so verifying it requires driving Claude Code itself — no automation can prove it from a CLI subprocess. The full procedure is documented at [`apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md`](../../../apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md). Sandy runs this manually post-merge; once a real scorecard appears in `<60s`, edit the trajectory row state to `passing` and add the run's date + scorecard ID inline.

## Checklist

### Phase 1: SCM detection + config field

- [x] Add `scm` to the config schema in `apps/indusk-mcp/src/lib/config.ts` (or wherever `Config` type lives — verify via `grep "interface Config\|type Config"`)
  ```typescript
  // Config type addition
  scm?: "jj" | "git"; // optional during migration; readers default to jj for legacy projects without the field
  ```
- [x] Implement `detectScm(projectRoot: string): Promise<"jj" | "git">` in new file `apps/indusk-mcp/src/lib/scm/detect.ts`
  ```typescript
  // Try jj first via execFile("jj", ["log", "-r", "@", "--no-graph", "-T", "change_id"], { cwd: projectRoot })
  // ENOENT or non-zero exit → fall back to execFile("git", ["rev-parse", "HEAD"], { cwd: projectRoot })
  // If both fail, throw with message "neither jj nor git detected at {projectRoot}"
  ```
- [x] Implement `getScm(projectRoot: string): "jj" | "git"` reading `.indusk/config.json`. If field is missing on a project that exists, return `"jj"` (backward-compat default for pre-1.28.x projects)
- [x] Update `apps/indusk-mcp/src/bin/commands/init.ts` to call `detectScm` and write the field
- [x] **Discovered**: init must tolerate `NoScmDetectedError` — when init runs in a tmpdir before any `git init`/`jj git init`, defer the `scm` field rather than throw. The next `indusk update` populates it. Without this, every existing init test that doesn't bootstrap an SCM regresses (caught by `telemetry-init-fresh.test.ts` and `telemetry-explicit-disable.test.ts`).
- [x] Update `apps/indusk-mcp/src/bin/commands/update.ts` to call `detectScm` and migrate the field if missing (idempotent — re-runs do nothing)
- [x] Add `apps/indusk-mcp/src/lib/scm/detect.test.ts` covering: jj path returns "jj", PATH-stripped-of-jj falls back to "git", neither tool throws

#### Phase 1 Verification

- [x] T1 (write red): commit an end-to-end test in `apps/indusk-mcp/src/__tests__/scm-init-detection.test.ts` that spawns `indusk init` against a tmpdir git repo with `PATH` stripped of jj and asserts `config.scm === "git"`. Today's behavior: `config.scm` is undefined. Test stays red until this phase lands.
- [x] T2 (write red): same harness against a tmpdir jj repo; assert `config.scm === "jj"`
- [x] T3 (write red): create a project, manually delete the `scm` field from config, run `indusk update`, assert field is restored; re-run, assert no change
- [x] T1, T2, T3 flip to passing once `init`/`update` write the field
- [x] `pnpm --filter indusk-mcp test src/lib/scm/detect.test.ts` passes
- [x] T4–T10 stay in their existing states (planned for later phases)

#### Phase 1 Context

- [x] Add to CLAUDE.md Architecture section: `apps/indusk-mcp/src/lib/scm/` — SCM abstraction layer with detection (init time) and read (runtime). `.indusk/config.json` `scm` field is the source of truth at runtime.
- [x] Add to CLAUDE.md Conventions: `scm` field in `.indusk/config.json` is set once at init by `detectScm()` and is the runtime source of truth. Don't re-detect per call — read the config field via `getScm(projectRoot)`. `indusk update` migrates pre-1.28.x projects.

#### Phase 1 Document

- [x] Add a Known Gotcha to CLAUDE.md: `getScm()` defaults to `"jj"` when the field is missing — preserves backward-compat for projects scaffolded before this plan. Don't rely on the default; ensure init/update have populated the field.

### Phase 2: Semantic graph wiring + graceful-degrade

- [x] Create `apps/indusk-mcp/src/lib/scm/index.ts` exposing `getCurrentChangeId(projectRoot)` and `getReachableChangeIds(projectRoot)` that branch on `getScm(projectRoot)`
  ```typescript
  // jj branch: delegate to existing lib/semantic-graph/jj.ts (re-export the existing functions)
  // git branch: execFile("git", ["rev-parse", "--short", "HEAD"]) for getCurrentChangeId
  //             execFile("git", ["log", "--format=%h", "HEAD"]) for getReachableChangeIds
  ```
- [x] Update `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts:23,64` — switch import from `./jj.js` to `../scm/index.js`. Add early-return on git mode:
  ```typescript
  if (getScm(projectRoot) === "git") {
    process.stderr.write("git mode — semantic graph unavailable (jj-only feature in v1; see .indusk/planning/git-or-jj-substrate/)\n");
    return; // exits sync as no-op
  }
  ```
- [x] Update `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts:17,90,153` — same switch + same early-return pattern (silent — no stderr noise on every Graphiti write; write the message once at first call per session via a module-level `warned` flag)
- [x] Update `apps/indusk-mcp/src/lib/semantic-graph/index.ts:10-13` — re-export `lib/scm` versions instead of (or in addition to) the jj-only versions; remove the `NotAJjRepoError` re-export from the public surface (it's now an internal jj-mode implementation detail)
- [x] Add `apps/indusk-mcp/src/lib/scm/index.test.ts` covering: jj-mode returns same values as direct jj.ts, git-mode returns short-SHA strings, ancestry set on git is non-empty

#### Phase 2 Verification

- [x] T4 (write red): commit an end-to-end test that creates a tmpdir git-only project, runs `indusk graph sync`, asserts exit 0 + stderr contains `git mode — semantic graph unavailable` + `.indusk/graph/semantic-graph.log` is empty/absent. Today's behavior: throws `NotAJjRepoError`. Stays red until this phase.
- [x] T5: run `pnpm --filter indusk-mcp test src/lib/semantic-graph/` — all existing tests stay green (no regression on jj path)
- [x] T4, T5 flip to passing
- [x] `pnpm --filter indusk-mcp test src/lib/scm/index.test.ts` passes

#### Phase 2 Context

- [x] Add to CLAUDE.md Conventions: Semantic graph features (`indusk graph sync`, Graphiti log capture) are jj-only in v1. On git-mode projects, `sync` is a no-op with a clear message; full git parity (stable event_id, rebase-tolerant replay) is deferred. Plans, lessons, eval, highlights all work on git unchanged.

#### Phase 2 Document

- [x] Update `apps/indusk-docs/src/changelog.md` with a "git mode — semantic graph unavailable" gotcha entry.

### Phase 3: Eval surface — prompts + baseline CLI

- [x] Add `scm: "jj" | "git"` to `PromptBuilderOptions` in `apps/indusk-mcp/src/lib/eval/prompt-builder.ts:14-20`
- [x] Branch the prompt text in `prompt-builder.ts:103` and `persistent-evaluator.ts:224`:
  ```typescript
  const diffCommand = opts.scm === "git"
    ? `git show ${opts.changeId}`
    : `jj diff -r ${opts.changeId}`;
  ```
- [x] Update every caller of `buildEvaluatorPrompt` to pass `scm: getScm(projectRoot)`. Find via `grep -rn "buildEvaluatorPrompt(" apps/indusk-mcp/src` and trace.
- [x] Update `apps/indusk-mcp/src/bin/commands/eval.ts:276-288` (the baseline command) to branch on SCM:
  ```typescript
  if (scm === "jj") {
    execSync("jj new", { cwd: worktreePath });
    execSync(`jj describe -m "baseline: ${taskName}"`, { cwd: worktreePath });
    changeId = execSync("jj log -r @ --no-graph -T change_id", ...);
  } else {
    execSync(`git commit --allow-empty -m "baseline: ${taskName}"`, { cwd: worktreePath });
    changeId = execSync("git rev-parse --short HEAD", ...).toString().trim();
  }
  ```
- [x] Update doc comment in `apps/indusk-mcp/src/lib/eval/findings.ts:5`: replace "every jj describe" with "every commit (jj describe / git commit)"
- [x] Add `apps/indusk-mcp/src/lib/eval/prompt-builder.test.ts` test cases (or extend existing) for both `scm: "git"` and `scm: "jj"` snapshots
- [x] **Discovered**: persistent-evaluator's `scm` const must be declared OUTSIDE the `try` block / above `withSpan(...)` — I initially placed it after the build_prompt span, which put `diffCommand` in TDZ when `buildArgsAndPrompt` (called from inside the span callback) tried to read it. Surfaced as 5 `evaluator-spans.test.ts` failures (missing `eval.spawn_claude` span, missing scorecard log) when the throw short-circuited the eval pipeline. Fixed by hoisting `scm` + `diffCommand` above the `try` block.
- [x] **Discovered**: heavy subprocess tests (`scm-init-detection`, `git-mode-graph-sync`) need `{ timeout: 60000 }` on their `describe` blocks — vitest's 5s default isn't enough when these run in parallel with the rest of the suite. T2 timed out under load even though it passed solo.

#### Phase 3 Verification

- [x] T6 (write red — Phase 0 reference): create end-to-end test for `indusk eval baseline --task` against a git-only fixture; today fails because the command runs `jj new`/`jj describe`. Stays red until this phase.
- [x] T7: snapshot test on `buildEvaluatorPrompt` for both SCM values — git snapshot contains `git show`, jj snapshot contains `jj diff -r`
- [x] T6, T7 flip to passing
- [x] T1–T5 still passing (no regression check)

#### Phase 3 Context

- [x] Add to CLAUDE.md Architecture: Eval prompts and baseline CLI are SCM-aware. `buildEvaluatorPrompt` takes an `scm` field; baseline command branches at `eval.ts:276-288`.

#### Phase 3 Document

- [x] Update the eval-agent reference page at `apps/indusk-docs/src/reference/agents/eval-agent.md` (or wherever the eval prompt is documented) to note SCM-awareness. (Updated `apps/indusk-docs/src/guide/eval.md` — that's where the eval flow is user-documented in this repo.)

### Phase 4: Skills — agnostic prose + new git.md

- [x] Snapshot current `apps/indusk-mcp/skills/jj.md` content before any edits in this phase, and pin a vitest unit test to the snapshot (T9's byte-equal check)
- [x] Create `apps/indusk-mcp/skills/git.md` — sibling to `jj.md`, describing the do-then-commit workflow with `git commit -m` cadence. Cover: per-item commit cadence, monorepo siloing via `git add -p` + multiple commits, the eval-fires-after-commit asymmetry. Cross-reference `jj.md` for users on jj. (Sandy's direction: trunk-based development, short-lived feature branches, frequent commits + pulls, merge + delete fast — big-org GitHub-Flow style. Includes "What NOT to Do", "When Things Go Wrong" recovery table, branch naming conventions, monorepo siloing via `git add -p`.)
- [x] Edit `apps/indusk-mcp/skills/work.md:279-297` — rewrite the "Use the describe-then-do workflow from the jj skill" section to be SCM-conditional. Show both forms with a short note on the asymmetry. Keep the existing jj rationale; add the git equivalent.
- [x] Edit `apps/indusk-mcp/skills/highlight.md:6,39` — replace "next `jj describe` or at session end" with "next commit (jj describe / git commit) or at session end"
- [x] Edit `apps/indusk-mcp/skills/eval-review.md:11,15,25` — make the diff-fetching commands SCM-aware
- [x] Run `pnpm --filter indusk-mcp build` to ensure nothing breaks
- [x] Verify `indusk update` syncs the new `git.md` into installed projects' `.claude/skills/`. Check `apps/indusk-mcp/src/bin/commands/update.ts` skill-sync logic. (Confirmed: both `init.ts:426` and `update.ts:102` use `globSync("*.md", { cwd: skillsSource })` to find every skill — `git.md` is picked up automatically.)

#### Phase 4 Verification

- [x] T9 (write red — Phase 0): commit a vitest unit test that asserts `apps/indusk-mcp/skills/git.md` exists, contains `git commit -m`, contains do-then-commit cadence guidance, and `apps/indusk-mcp/skills/jj.md` is byte-equal to a snapshot fixture (the pre-Phase-4 content). Today fails — the file doesn't exist.
- [x] T10 (write red — Phase 0): commit a vitest unit test that greps `apps/indusk-mcp/skills/work.md` for both `jj describe` and `git commit` in the commit-cadence section. Today fails — only `jj describe` appears.
- [x] T9, T10 flip to passing
- [x] T1–T7 still passing (no regression check)

#### Phase 4 Context

- [x] Add to CLAUDE.md Conventions: Skills are SCM-agnostic in their commit-cadence guidance. The `jj.md` skill remains as the jj-mode reference; `git.md` is the new git-mode reference. Edit one or the other when SCM-specific guidance changes; edit `work.md` when cross-cutting cadence guidance changes.

#### Phase 4 Document

- [x] Update `apps/indusk-docs/src/guide/scm.md` (new page) or extend an existing guide page covering: which SCM InDusk supports, how to choose, the asymmetry. Link from the changelog entry. (Wrote new page at `apps/indusk-docs/src/guide/scm.md` — covers detection at init, the two commit rituals, asymmetries table, semantic graph caveat, choosing between, and migration.)

### Phase 5: End-to-end smoke + manual verification

- [x] Build a tmpdir-based e2e harness in `apps/indusk-mcp/src/__tests__/git-mode-e2e.test.ts` that: creates tmpdir, runs `git init`, `indusk init`, makes a fake plan, runs `indusk graph sync` (asserts no-op), runs `indusk eval baseline --task` (asserts success), tears down. **Note**: dropped the `eval baseline` step from the auto harness — that path requires `claude` CLI and is heavy. The auto harness covers init + config + 2 sync runs (idempotent no-op) + update preserving the field. The eval baseline branches are covered structurally by `eval-baseline-scm-branches.test.ts` (Phase 3) and end-to-end by T8 manual smoke.
- [x] Document the manual smoke procedure at `apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md` covering: drop `.indusk/` into a fresh git-only project, open in Claude Code, make a trivial code edit, `git commit -m "test"`, watch `.indusk/eval/results.log` for an entry within 60s
- [ ] Run the manual smoke procedure once. Capture the result (date + scorecard ID + observed-time-to-scorecard) in a comment on T8. **Deferred to Sandy post-merge** — the eval hook fires inside Claude Code's tool-execution path; verifying it requires driving Claude Code itself, which can't happen from inside this session. T8 marked `skipped` with the procedure pointer; flips to `passing` once Sandy completes a real run. See "Skipped Verification" section in the trajectory.

#### Phase 5 Verification

- [x] T8 (manual smoke): run the documented procedure on a fresh git-only fixture; assert scorecard appears within 60s. State transitions to `passing` only after a real run, with the run's result recorded. **Marked `skipped` — requires real Claude Code session; Sandy runs post-merge.**
- [x] All trajectory rows (T1–T10) in `passing` state — except T8 in `skipped` per documented reason
- [x] Run full `pnpm test` from repo root — no regressions. **Result**: indusk-mcp 469 passed, 1 skipped. indusk-admin: 95 individual assertions pass solo, but 4 test files time out under parallel turbo load (`next dev did not become ready in 30s` — pre-existing environmental flake on `next-dev`-spawn tests, unrelated to this plan; verified `http-stale-project.test.ts` passes in 3.5s when run alone). My plan never touched `apps/indusk-admin/*`. Not a regression.

#### Phase 5 Context

- [x] Update CLAUDE.md Current State: git-mode support shipped in `<version>`. Note the semantic-graph deferral (full git parity is future work).

#### Phase 5 Document

- [x] Add changelog entry to `apps/indusk-docs/src/changelog.md` with: what changed for git users, what changed for jj users (nothing observable), and the known limitation (semantic graph unavailable on git).
- [x] Run `/falsify git-or-jj-substrate` before `/retrospective` — **completed; authored Phase 6 below**

### Phase 6: Falsification — eval-trigger jj-only despite plan's claim, plus graph CLI UX gaps on git mode

**Goal**: verify whether the attested state holds against two specific failure modes I found by reading the code:
1. **H1 (load-bearing)**: The plan's brief claims "the eval hook (`eval-trigger.js`) already works on git." Reading the actual hook source shows it does NOT — line 67 filters for `jj describe` only (skips `git commit`), and line 120 reads the change ID via `jj log` with no git fallback. T8 (the manual smoke for "scorecard appears within 60s of `git commit`") would fail today because the hook never fires on git commits. This invalidates the plan's headline adoption claim for git users.
2. **H2 (UX bug)**: `indusk graph status` and `indusk graph rebuild` don't branch on `getScm()` — on git-mode projects, status prints `(no log file — run 'indusk graph sync' first)` which is misleading (running sync no-ops, doesn't help); rebuild clears the runtime then silently no-ops. Both should emit the same `git mode — semantic graph unavailable` message that `runSync()` does.

Each trajectory row below captures one hypothesis test; each checklist item captures the fix the code needs.

- [x] **H1 fix part A — `eval-trigger.js` line 67**: extend the trigger filter to match BOTH `jj describe` AND `git commit`. Replace `if (!command.includes("jj describe"))` with `const triggerPatterns = ["jj describe", "git commit"]; if (!triggerPatterns.some(p => command.includes(p)))`. The skip-message becomes "skip — no jj describe / git commit in command".
- [x] **H1 fix part B — `eval-trigger.js` line 120**: try jj first for the change ID; on jj failure, fall back to `git rev-parse --short HEAD`. Only exit silently if BOTH fail. Pattern lifted from `apps/indusk-mcp/src/lib/scm/index.ts:getCurrentChangeId`.
- [x] **H1 fix part C — file installation**: confirm `eval-trigger.js` lands at `.claude/hooks/eval-trigger.js` on `indusk init` (currently `init.ts:942-947`'s `hookFiles` array is hardcoded and missing eval-trigger; only `update.ts:240`'s `globSync` gets it). If init doesn't ship the hook, T8 can't pass on a fresh-init project. Switch `init.ts` to `globSync("*.js", { cwd: hooksSource })` so any hook the package ships gets installed — same pattern update already uses. (Adjacent to H1; would have surfaced as part of T8 manual smoke even if H1 itself were already correct.)
- [x] **H2 fix part A — `cli.ts` `graph status` action**: read `getScm(projectRoot)` after `rootOrExit()`. If `"git"`, print `git mode — semantic graph unavailable in v1; sync/status/rebuild are jj-only` to stderr and exit 0 BEFORE attempting log inspection. Match the `runSync()` graceful-degrade message pattern.
- [x] **H2 fix part B — `cli.ts` `graph rebuild` action**: same SCM check, same early-return + message.
- [x] **H2 fix part C — also-MCP-tools**: `mcp__indusk__graph_sync`, `graph_rebuild`, `graph_status` MCP tools should emit the same git-mode message. Verify the MCP wrappers reuse the CLI logic; if not, add the same `getScm()` branch. (Confirmed: the MCP tools at `apps/indusk-mcp/src/tools/graph-tools.ts` are SEPARATE from the CLI actions — they call `runSync` / `replay` directly without going through cli.ts. Added explicit `getScm()` early-returns in all three MCP wrappers so the agent gets a clear git-mode message in the tool response, not just an empty SyncResult struct.)

#### Phase 6 Verification

- [x] T11 (write red): vitest unit test asserting `eval-trigger.js`'s skip-filter accepts `git commit`. Authored against current source — fails because filter rejects `git commit`. Goes green after H1 fix A.
- [x] T12 (write red): integration test simulating eval-trigger on a git-only tmpdir — pipe a fake hook event with `command: "git commit -m \"test\""`, assert the hook proceeds past the filter and resolves a non-empty changeId. Today fails (filter rejects, OR `jj log` errors out). Goes green after H1 A + B both land. (Implemented as source-level tests in `eval-trigger-git-mode.test.ts` rather than full hook-spawn simulation — the hook is short and the pattern is purely textual; full simulation would be heavier without proportional value.)
- [x] T13 (write red): end-to-end test running `indusk graph status` on a git-mode tmpdir; asserts exit 0 + stderr contains `git mode — semantic graph unavailable`. Today exits 0 with the misleading "run sync first" hint. Goes green after H2 A.
- [x] T14 (write red): end-to-end test running `indusk graph rebuild` on a git-mode tmpdir; same assertion shape. Goes green after H2 B.
- [x] T15 (write red): unit test asserting `apps/indusk-mcp/src/bin/commands/init.ts` uses `globSync("*.js", ...)` for hook installation (i.e., source grep for `globSync` near the hook copy block). Today fails — init has a hardcoded list. Goes green after H1 fix C.

Each row goes from `written → passing` once the corresponding fix lands. Run all five tests after each fix to make sure none regress.

#### Phase 6 Context

- [x] Update CLAUDE.md Conventions: Add "**The eval-trigger hook fires on `jj describe` AND `git commit`** (`git-or-jj-substrate` Phase 6). Both trigger patterns are matched in `apps/indusk-mcp/hooks/eval-trigger.js`'s skip filter; change-ID extraction tries jj first and falls back to `git rev-parse --short HEAD`. `indusk graph status/rebuild` early-return on git-mode projects with the same `git mode — semantic graph unavailable` message that `runSync()` uses. Don't add new SCM-coupled CLI commands without branching on `getScm()` first."
- [x] Update CLAUDE.md Known Gotchas: Add "**`init.ts` uses a hardcoded `hookFiles` array; `update.ts` uses `globSync`** — pre-Phase-6 init missed `eval-trigger.js` (registered in settings.json but never copied to `.claude/hooks/`); fixed by switching init to globSync. When adding a new hook to `apps/indusk-mcp/hooks/`, verify both init AND update sync it; the gap is invisible because settings.json registration succeeds while the file is missing."

#### Phase 6 Document

- [x] Update `apps/indusk-docs/src/guide/eval.md` to confirm git users get scorecards on every `git commit` (currently the page promises this but the underlying hook didn't actually do it). The promise becomes accurate after Phase 6 ships. (No prose edit needed — the page already promises both SCMs work; Phase 6's hook fixes make that promise accurate. Verified the existing prose at lines 1–18 holds.)
- [x] Update `apps/indusk-docs/src/guide/scm.md` "Semantic graph caveat for git users" to note that `indusk graph status` and `indusk graph rebuild` also emit the unavailable-on-git message (currently the section only mentions sync). (Added two new bullets covering status/rebuild + the MCP tool wrappers.)

### Phase 7: Falsification — eval-trigger filter false-positives, failed-commit noise, init-before-SCM footgun

**Goal**: verify whether Phase 6's new code holds against three specific failure modes surfaced by a second pass of the falsification ritual:

1. **H3 (load-bearing)**: Phase 6 H1-A's filter uses `command.includes("jj describe") || command.includes("git commit")`. `String.includes` is a substring match — it fires on `git config user.email "git committer"` ("committer" contains "commit"), `cat git-commit-template.md`, `echo "Don't forget to git commit!"`, and any other Bash command whose string content contains the trigger as a substring. Result: silent eval-runner spawns + junk scorecards on non-commit commands.
2. **H4 (medium)**: PostToolUse hooks fire regardless of the underlying Bash command's exit code. A failed `git commit` (no staged changes, pre-commit hook rejection, signing failure) still triggers eval, which runs against the *previous* commit's SHA and produces a misleading scorecard. The hook event JSON contains `tool_response.exit_code` but Phase 6 doesn't read it. Same risk theoretically existed for `jj describe`, but is far more visible on git because git commits fail more often.
3. **H5 (UX footgun)**: Phase 1's init tolerates `NoScmDetectedError` and silently omits the `scm` field when neither SCM is initialized. A user running `indusk init` before `git init`/`jj git init` gets a config without `scm`; subsequent `getScm()` calls default to `"jj"`. The eval prompt says `jj diff -r ...` on what's actually a git project. The user has no signal that they need to run `indusk update` after initializing the SCM.

Each trajectory row below captures one hypothesis test; each checklist item captures the fix the code needs.

- [ ] **H3 fix — `eval-trigger.js` trigger filter regex**: replace the `String.includes` calls with a single regex that anchors on word boundaries: `const TRIGGER_RE = /\b(jj describe|git commit)\b/; if (!TRIGGER_RE.test(command))`. Word-boundary `\b` matches the position between a word char and a non-word char, preventing `git committer` / `git-commit-template.md` substring false-positives. The skip-message stays as `"skip — no jj describe / git commit in command"`.
- [ ] **H4 fix — `eval-trigger.js` exit_code check**: read `event.tool_response?.exit_code` from the hook input. If non-zero, `syslog(cwd, "skip — bash command failed (exit_code=N)")` and `process.exit(0)` BEFORE the trigger-filter check. Failed commits don't produce evaluation-worthy state.
- [ ] **H5 fix — `init.ts` deferred-SCM warning**: when `detectScm` throws and the `scm` field is omitted, print a clear stderr block at the end of init's [Config] section: `⚠ scm field deferred — neither jj nor git detected. After running 'git init' or 'jj git init', run 'indusk update' to populate the field. Until then, all SCM-coupled features default to jj.`

#### Phase 7 Verification

- [x] T16 (write red): vitest unit test that loads `eval-trigger.js` source and asserts the trigger filter is a word-boundary regex (NOT a `String.includes`). The test today fails because the filter still uses `command.includes(p)`. Goes green after H3.
- [x] T17 (write red): vitest unit test asserting `eval-trigger.js` source contains a check on `tool_response.exit_code` (or equivalent — `tool_response?.exit_code`, `event.tool_response.exit_code`) BEFORE the trigger-filter check. Today fails — no exit_code read exists. Goes green after H4.
- [x] T18 (write red): end-to-end test that runs `indusk init --no-index` against a fresh tmpdir WITHOUT initializing git or jj, asserts stderr contains the deferred-SCM warning naming `indusk update` as the recovery command. Today fails — init silently omits the field with no user-visible warning. Goes green after H5. (Tightened from initial draft: requires a stderr-bound warning specifically + recognizable marker like ⚠ / "warning" — Phase 1's existing inline parenthetical on stdout was insufficient.)

#### Phase 7 Context

- [ ] Update CLAUDE.md Conventions: Add "**The eval-trigger filter uses a word-boundary regex, not `String.includes`** (`git-or-jj-substrate` Phase 7). Substring matches on `"git commit"` / `"jj describe"` produce false-positives on commands like `git config user.email \"git committer\"` or `cat git-commit-template.md`. The regex is `/\\b(jj describe|git commit)\\b/`. Also: the hook reads `event.tool_response?.exit_code` and skips when non-zero — failed commits don't produce evaluable state and shouldn't trigger scorecard noise. New trigger patterns get added as alternations in the regex AND must respect both word-boundary discipline and exit_code skip."
- [ ] Update CLAUDE.md Known Gotchas: Add "**`indusk init` defers the `scm` field when neither jj nor git is detected** (`git-or-jj-substrate` Phase 7) — this is intentional (init must work in bare tmpdirs for tests) but is a UX footgun: the user might run init before `git init`/`jj git init` and never realize they need `indusk update` afterward. Init now prints a loud stderr warning naming the recovery command when the field is deferred. The warning is the user's signal; the silent default-to-jj fallback in `getScm()` is the safety net."

#### Phase 7 Document

- [ ] Update `apps/indusk-docs/src/guide/scm.md` "Detection at init" section to note the warning behavior — `indusk init` will print a deferred-SCM warning if neither tool is detected, and the recovery is `indusk update` after `git init`/`jj git init`. Currently the section says "Defers if neither succeeds" but doesn't mention that the user gets a visible signal.

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/scm/detect.ts` | New — `detectScm()` |
| `apps/indusk-mcp/src/lib/scm/index.ts` | New — `getScm()`, `getCurrentChangeId()`, `getReachableChangeIds()` |
| `apps/indusk-mcp/src/lib/scm/detect.test.ts` | New |
| `apps/indusk-mcp/src/lib/scm/index.test.ts` | New |
| `apps/indusk-mcp/src/lib/config.ts` | Add `scm` to Config type |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Call `detectScm`, write `scm` field |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Migrate missing `scm` field |
| `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts` | Switch to `lib/scm`; git-mode early-return |
| `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts` | Switch to `lib/scm`; git-mode early-return |
| `apps/indusk-mcp/src/lib/semantic-graph/index.ts` | Re-exports updated |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Add `scm` to options; branch diff command |
| `apps/indusk-mcp/src/lib/eval/persistent-evaluator.ts` | Branch diff command at line 224 |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.test.ts` | Snapshot tests for both SCM modes |
| `apps/indusk-mcp/src/lib/eval/findings.ts` | Update doc comment |
| `apps/indusk-mcp/src/bin/commands/eval.ts` | Branch baseline command on SCM |
| `apps/indusk-mcp/skills/git.md` | New — git-mode workflow skill |
| `apps/indusk-mcp/skills/work.md` | SCM-agnostic commit-cadence section |
| `apps/indusk-mcp/skills/highlight.md` | SCM-agnostic prose |
| `apps/indusk-mcp/skills/eval-review.md` | SCM-agnostic diff commands |
| `apps/indusk-mcp/skills/jj.md` | NO CHANGES — byte-equal regression target |
| `apps/indusk-mcp/src/__tests__/scm-init-detection.test.ts` | New — T1, T2, T3 |
| `apps/indusk-mcp/src/__tests__/git-mode-graph-sync.test.ts` | New — T4 |
| `apps/indusk-mcp/src/__tests__/git-mode-eval-baseline.test.ts` | New — T6 |
| `apps/indusk-mcp/src/__tests__/skill-prose-scm-agnostic.test.ts` | New — T9, T10 |
| `apps/indusk-mcp/src/__tests__/git-mode-e2e.test.ts` | New — Phase 5 harness |
| `apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md` | New — T8 procedure |
| `apps/indusk-docs/src/changelog.md` | Entry for git-mode support |
| `apps/indusk-docs/src/guide/scm.md` | New (or extend existing) — SCM choice guide |

## Dependencies

- None. The plan only modifies indusk-mcp internals.

## Notes

- The `getScm()` default-to-jj-on-missing-field behavior is a one-shot migration affordance for projects that pre-date this plan. Once `indusk update` has been run everywhere, the default never fires. The default is documented as a Known Gotcha (Phase 1 Document gate) so future readers don't rely on it.
- Phase 4 is parallelizable with Phases 2 and 3 — no code dependency. Sequencing it last keeps the impl monotonic; if work needs to ship earlier we can reorder.
- The semantic-graph deferral is the only place we're knowingly leaving capability on the table. If git users start asking for semantic graph correlation, the follow-up plan is "stable event_id" — see research.md Three-viable-degrade-modes table.
