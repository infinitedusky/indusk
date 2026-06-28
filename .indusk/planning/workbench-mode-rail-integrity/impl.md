---
title: "Workbench Mode Rail Integrity — Impl"
date: 2026-06-28
status: in-progress
trajectory: required
gate_policy: ask
---

# Workbench Mode Rail Integrity — Implementation

Ship a workbench-aware path resolution helper for the 4 hooks, refactor each hook to use it, add stray-state detection in `check_health`, run a manual backfill of the 86 numero_workbench highlights through the now-working rail.

## Boundary Map

**New files:**
- `apps/indusk-mcp/hooks/_hook-paths.js` — workbench-aware path resolver. Exports `resolveStateAndGitPaths(cwd)` returning `{statePath, gitPath}`. `statePath` is where `.indusk/` lives (workbench root in workbench mode; project root in single-repo mode). `gitPath` is where the git repo lives (derived via `git rev-parse --show-toplevel` against `cwd`).
- `apps/indusk-mcp/hooks/__tests__/hook-paths.test.js` — unit tests for the helper (single-repo and workbench cases).
- `apps/indusk-mcp/src/__tests__/hook-workbench-paths.test.ts` — TS-side integration test that drives each hook against a synthetic workbench tmpdir.
- `apps/indusk-mcp/src/__tests__/stray-state-detection.test.ts` — tests for the new stray-`.indusk/` audit.
- `apps/indusk-mcp/test-fixtures/numero-workbench-shape/README.md` — synthetic workbench fixture documentation.
- `apps/docs/src/guide/workbench-mode.md` — guide section explaining how state vs git paths separate in workbench mode (referenced from /reference/extensions/worktree).

**Modified files:**
- `apps/indusk-mcp/hooks/eval-trigger.js` — replace local `findProjectRoot()` with `resolveStateAndGitPaths()`; use `gitPath` for `git rev-parse --short HEAD`; use `statePath` for highlights, settings, system.log, results.log.
- `apps/indusk-mcp/hooks/check-catchup.js` — same refactor (uses statePath only; no git ops).
- `apps/indusk-mcp/hooks/check-gates.js` — same refactor.
- `apps/indusk-mcp/hooks/validate-impl-structure.js` — same refactor.
- `apps/indusk-mcp/src/tools/health-tools.ts` — extend `check_health` to detect stray `.indusk/` directories in workbench mode.
- `apps/indusk-mcp/extensions/worktree/manifest.json` — health check for the workbench-stray-state pattern.

**Runtime artifacts** (per-project, gitignored):
- No new artifacts. Existing `.indusk/eval/system.log` continues to be the diagnostic surface.

**NOT in scope** (explicit defers):
- Auto-cleanup of stray state (manual confirmation per directory).
- A full `indusk doctor` command (extending `check_health` is enough for v1).
- Migration tooling for projects with diverged state across stray paths.
- Per-worktree `.indusk/` for genuine scratch use is allowed and explicitly NOT flagged.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | `resolveStateAndGitPaths(cwd)` in a single-repo case (cwd inside a git repo that also contains `.indusk/`) returns `{statePath, gitPath}` where both point at the repo root | Phase 0 | Phase 1 | writable |
| T2 | `resolveStateAndGitPaths(cwd)` in a workbench-shaped case (workbench root has `.indusk/` but no `.git/`; wrapped repo lives in a subdirectory; cwd is inside the wrapped repo) returns `statePath` at workbench root AND `gitPath` at wrapped repo root | Phase 0 | Phase 1 | writable |
| T3 | `resolveStateAndGitPaths(cwd)` from inside a worktree (sibling to the wrapped repo) returns `statePath` at workbench root AND `gitPath` at the worktree's own git path | Phase 0 | Phase 1 | writable |
| T4 | `eval-trigger.js` driven against a workbench-shaped tmpdir from inside the wrapped repo successfully resolves the change ID via `gitPath` and writes its `evaluator spawned` lifecycle marker to `statePath/.indusk/eval/system.log` | Phase 0 | Phase 2 | writable |
| T5 | `eval-trigger.js` against a single-repo tmpdir (the existing pattern) still resolves change ID and writes lifecycle markers correctly — no regression | Phase 0 | Phase 2 | writable |
| T6 | `check-catchup.js`, `check-gates.js`, `validate-impl-structure.js` source code each `require`/`import` the new shared helper `_hook-paths.js` instead of carrying their own `findProjectRoot()` — source-level grep test | Phase 0 | Phase 3 | writable |
| T7 | The 3 non-eval hooks (catchup, gates, validate) continue to operate correctly on existing single-repo dusk plans — no regression on the existing hook surface | Phase 0 | Phase 3 | writable |
| T8 | `check_health` in workbench mode detects a stray `.indusk/` directory inside the wrapped repo and emits a `stray-state` error naming the path + a recommended `rm -rf` command | Phase 0 | Phase 4 | writable |
| T9 | `check_health` in workbench mode with NO stray state (only the legitimate workbench-root `.indusk/`) reports clean — no false-positive errors | Phase 0 | Phase 4 | writable |
| T10 | `check_health` in single-repo mode (NOT workbench) does NOT search for stray `.indusk/` directories — the audit is workbench-specific | Phase 0 | Phase 4 | writable |
| T11 | A worktree under the workbench with its own `.indusk/` scratch (e.g., for local-only telemetry binding) is NOT flagged as stray — only the wrapped-repo case is | Phase 0 | Phase 4 | writable |

### Deferred Verification

- **U1: Real numero_workbench backfill drain — 86 highlights → Graphiti episodes**
  - reason: requires actually running the eval agent (`claude --print`) against the live numero_workbench `.indusk/highlights.jsonl` after 1.31.7 is installed via `indusk update`. Output depends on real claude-sonnet behavior + Graphiti container state + the actual 86 entries' content. Cannot be programmatically asserted; the proof IS the resulting `numero_workbench` Graphiti group state.
  - would require: a way to spawn a real eval-agent subprocess inside a deterministic test environment with a mock Graphiti backend that asserts the same write-shape as production Graphiti. Heavy infrastructure for a one-shot operation.
  - mitigation: manual smoke procedure documented at `apps/indusk-mcp/test-fixtures/numero-workbench-shape/README.md` — Sandy runs (a) `indusk update` on numero_workbench after 1.31.7 publishes, (b) makes a trivial commit inside `numero/` and verifies the eval-trigger hook fires and writes to `.indusk/eval/results.log` (proves the rail), (c) runs the manual backfill drain command and verifies `mcp__graphiti__get_episodes({group_ids: ["numero_workbench"], max_episodes: 100})` returns ~86 episodes. Records the result inline in this plan's Phase 5 section. Findings file count > 86 OR scorecard parse errors in results.log = regression; reopen Phase 2.

## Checklist

### Phase 1 — Workbench-aware path helper

- [ ] Write red tests T1, T2, T3 first; commit failing
- [ ] Create `apps/indusk-mcp/hooks/_hook-paths.js` exporting `resolveStateAndGitPaths(cwd)`:
  - `statePath`: walk up from `cwd` looking for `.indusk/` directory; return first match. Falls back to `cwd` if none found.
  - `gitPath`: run `git rev-parse --show-toplevel` against `cwd`; on success, that's `gitPath`. On failure (cwd not in any git repo), return `null` — caller decides how to handle.
  - Returns `{statePath, gitPath}` where both may be null in pathological cases.
  - File is ESM-native (matches eval-trigger.js convention post-1.19.1 — no CJS `require()` per the eval-agent-bug-fix lesson).
- [ ] Implement `_hook-paths.js`. Use `node:fs`, `node:path`, `node:child_process` ESM-native imports.
- [ ] Add `apps/indusk-mcp/hooks/__tests__/hook-paths.test.js` (or `.ts` if convenient) covering T1, T2, T3 against synthetic tmpdir fixtures.
- [ ] Flip T1, T2, T3 to passing.

#### Phase 1 Verification

- [ ] T1 passes: single-repo case returns same path for state + git
- [ ] T2 passes: workbench case returns separate paths
- [ ] T3 passes: worktree case returns workbench-root state + worktree-local git
- [ ] `pnpm --filter indusk-mcp test apps/indusk-mcp/hooks/__tests__/hook-paths.test` — green
- [ ] `pnpm --filter indusk-mcp build` — clean

#### Phase 1 Context

- [ ] Add Architecture entry to CLAUDE.md: hook path resolution lives in `apps/indusk-mcp/hooks/_hook-paths.js`. All 4 hooks consume it. In workbench mode, `statePath` and `gitPath` differ; treat them as distinct concerns.
- [ ] Add Conventions entry: any new hook MUST use `_hook-paths.js`. Hooks may not duplicate `findProjectRoot()` logic. New hook checklist: import the helper, decide whether you need `statePath`, `gitPath`, or both, document why.

#### Phase 1 Document

- [ ] Create `apps/docs/src/guide/workbench-mode.md` — explains the state vs git path distinction for users + future hook authors. Diagrams the workbench directory shape.

---

### Phase 2 — Eval-trigger refactor (the load-bearing fix)

- [ ] Write red tests T4, T5 first; commit failing
- [ ] Refactor `apps/indusk-mcp/hooks/eval-trigger.js`:
  - Remove local `findProjectRoot()` function (lines ~104-130)
  - `import { resolveStateAndGitPaths } from "./_hook-paths.js"`
  - Replace `const projectRoot = findProjectRoot(cwd)` with `const {statePath, gitPath} = resolveStateAndGitPaths(cwd)`
  - Use `statePath` for: `readEvalConfig`, `syslog`, `system.log`, `results.log`, `findings.json`, evaluator-runner path resolution
  - Use `gitPath` (NOT `statePath`) for: `git rev-parse --short HEAD` invocation
  - Skip with explicit message when `gitPath` is null AND command was `git commit ...`: `skip — no git repo at cwd (workbench-mode state path: ${statePath})` so the operator can debug
- [ ] Flip T4, T5 to passing.

#### Phase 2 Verification

- [ ] T4 passes: eval-trigger against workbench tmpdir spawns evaluator
- [ ] T5 passes: eval-trigger against single-repo tmpdir still works
- [ ] `pnpm --filter indusk-mcp test` — all hook tests green (including pre-existing eval-trigger tests)

#### Phase 2 Context

- [ ] Add Known Gotcha to CLAUDE.md: in workbench mode, the eval-trigger hook resolves `gitPath` via `git rev-parse --show-toplevel` against the commit's actual cwd — NOT against the InDusk state directory. This is what makes workbench-shaped projects work end-to-end. Don't conflate the two paths.
- [ ] Reference `community-hook-bypass-is-rail-integrity-not-pacing` lesson in the context entry — this fix IS that lesson applied.

#### Phase 2 Document

- [ ] Update `apps/docs/src/reference/eval/overview.md` "Known Failure Modes" section: add a "Workbench-shape silent skip" entry describing the pre-1.31.7 symptom (system.log shows `skip — no git commit ID available` on every commit; results.log stays empty) and the fix.

---

### Phase 3 — Refactor other 3 hooks (consistency + future-proofing)

- [ ] Write red tests T6, T7 first; commit failing
- [ ] Refactor `apps/indusk-mcp/hooks/check-catchup.js` to use `resolveStateAndGitPaths` (statePath only — no git ops)
- [ ] Refactor `apps/indusk-mcp/hooks/check-gates.js` to use `resolveStateAndGitPaths` (statePath only)
- [ ] Refactor `apps/indusk-mcp/hooks/validate-impl-structure.js` to use `resolveStateAndGitPaths` (statePath only)
- [ ] Flip T6, T7 to passing.

#### Phase 3 Verification

- [ ] T6 passes: all 3 hooks source-grep test confirms they import the helper
- [ ] T7 passes: hook behavior on dusk's existing single-repo plans unchanged — run a known-good plan write that previously triggered each hook
- [ ] `pnpm --filter indusk-mcp test` — full suite green

#### Phase 3 Context

- [ ] No additional CLAUDE.md changes needed — the convention from Phase 1 covers it.

#### Phase 3 Document

- [ ] No additional docs needed — the eval-trigger doc from Phase 2 covers the user-facing aspect.

---

### Phase 4 — Stray state detection

- [ ] Write red tests T8, T9, T10, T11 first; commit failing
- [ ] Extend `apps/indusk-mcp/src/tools/health-tools.ts` (or wherever `check_health` lives):
  - Detect workbench mode by reading `.indusk/config.json` and checking for `worktree.wrapped_repo` field
  - If workbench mode: walk down from workbench root looking for ANY `.indusk/` directory OTHER than the canonical workbench-root one
  - Special-case worktrees: walk down only into directories that are NOT registered worktrees (per `worktree.json` or by checking for `.git` files marking a worktree). Worktrees may legitimately have their own `.indusk/`.
  - Report each stray directory with `path`, recommended `rm -rf` command, and a `note` indicating whether content might be salvageable (non-empty highlights queue, recent file modifications, etc.).
- [ ] Wire the stray-state check into `mcp__indusk__check_health` output as a new section `stray_state`.
- [ ] Add a manifest entry to `apps/indusk-mcp/extensions/worktree/manifest.json` so workbench-extension-enabled projects get the stray check by default.
- [ ] Flip T8, T9, T10, T11 to passing.

#### Phase 4 Verification

- [ ] T8 passes: stray `.indusk/` in wrapped repo reported
- [ ] T9 passes: clean workbench mode reports no stray state
- [ ] T10 passes: single-repo mode doesn't run the audit (no false positives)
- [ ] T11 passes: worktree-local `.indusk/` is NOT flagged

#### Phase 4 Context

- [ ] Add Known Gotchas entry: stray `.indusk/` directories inside the wrapped repo in workbench mode are an artifact of pre-1.31.7 `indusk init` runs that didn't know about workbench mode, OR of operators running `indusk init` from inside the wrapped repo. They confuse path resolution silently. Run `check_health` to detect; manually `rm -rf` after confirming nothing important is in them.

#### Phase 4 Document

- [ ] Update `apps/docs/src/guide/workbench-mode.md` (from Phase 1) with a "Detecting stray state" section showing the `check_health` output and recovery procedure.

---

### Phase 5 — Backfill + manual smoke

- [ ] Publish indusk-mcp 1.31.7 (bump in this phase, push tag, npm publish)
- [ ] Run `indusk update` on numero_workbench
- [ ] Make a trivial commit inside `numero_workbench/numero/`; verify `.indusk/eval/system.log` shows `evaluator spawned` (rail works)
- [ ] Run U1 manual backfill: invoke the eval agent manually against the workbench root's highlights queue to drain all 86 entries in one pass. Document the exact command + outcome inline below.
- [ ] Verify `mcp__graphiti__get_episodes({group_ids: ["numero_workbench"], max_episodes: 100})` returns ~86 episodes
- [ ] Document U1 outcome in this plan (inline section below)
- [ ] Run `check_health` on numero_workbench; verify no stray state OR document any found and resolved

### U1 Backfill Result

_(filled in by Sandy after running the manual smoke)_

- Drain command run:
- Highlights drained: ?/86
- Graphiti episodes created in `numero_workbench`: ?
- Findings/errors:
- Outcome: PASS / FAIL (if FAIL, reopen Phase 2)

#### Phase 5 Verification

(no tests flip at this phase — reason: infra)

- [ ] U1 manual smoke documented inline (above)
- [ ] T1–T11 all remain passing after publish (regression check)
- [ ] No other regressions in eval agent (results.log accumulates new scorecards over the next 5+ commits)

#### Phase 5 Context

- [ ] Update Current State in CLAUDE.md: workbench-mode rail-integrity shipped at indusk-mcp 1.31.7; numero_workbench backfill drained N/86 highlights to Graphiti episodes.
- [ ] If U1 surfaced any specific failure modes, add them as Known Gotchas.

#### Phase 5 Document

- [ ] Add a changelog entry: "Workbench mode rail integrity — hooks now distinguish `statePath` from `gitPath`; eval pipeline functions on workbench-shaped projects; stray-state audit available via `check_health`."
- [ ] Falsification ritual: run `/falsify workbench-mode-rail-integrity` and address the resulting Falsification Phase before retrospective.

## Out of scope (explicit defers)

| Deferred | Why | When to revisit |
|---|---|---|
| Auto-cleanup of stray `.indusk/` directories | Risk of deleting content an operator hasn't reviewed; manual cleanup is policy | When `check_health` has reported stray state but never with salvageable content for 6 months |
| Full `indusk doctor` command surface | Extending `check_health` covers the immediate need; `doctor` is a broader UX project | When >3 audit types accumulate (currently just stray-state) |
| Migration tooling for diverged state across stray paths | Such projects are rare; report and let operator merge manually | If a real consumer hits this case |
| Per-worktree `.indusk/` isolation guarantees | Worktrees may legitimately keep scratch; the audit just doesn't flag them | If two worktrees diverge in a way that causes silent bugs |
| Auto-discovery of git path when commit fires from outside any cwd | `git rev-parse` against null is structurally undefined; explicit skip is correct behavior | If a user-facing complaint emerges |

## Notes for next session

- This plan is **also a retroactive falsification finding for `indusk-worktree-extension`**. The worktree extension's brief asserted workbench-shape works without grep-verifying the 4 hooks understood the new layout. Textbook brief-author-bias-ground-truth-verification failure. When worktree-extension's still-owed falsification + retrospective run, this plan should be referenced as the rail-integrity gap the extension's original shipping missed.
- Sandy chose acceptance over an ADR — the brief's technical direction is specific enough (helper shape, statePath/gitPath split, audit approach) that an ADR would mostly restate it. If a future implementer wants the rationale, this plan + the brief + the cited lesson cover it.
- The backfill of 86 highlights in U1 is the proof-of-life for the entire rail. If U1 fails, the fix didn't work and Phase 2 reopens. If U1 passes, the rail is verified end-to-end against real production data, not just synthetic fixtures.
