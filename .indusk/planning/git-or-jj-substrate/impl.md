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
| T1 | A1: `indusk init` in a git-only repo (no jj on PATH) writes `scm: "git"` to `.indusk/config.json` | Phase 0 | Phase 1 | written |
| T2 | A2: `indusk init` in a jj repo writes `scm: "jj"` to `.indusk/config.json` | Phase 0 | Phase 1 | written |
| T3 | A3: `indusk update` on a project missing the `scm` field detects + adds it; second run is a no-op | Phase 0 | Phase 1 | written |
| T4 | A4: `indusk graph sync` on a git-mode project exits 0, prints `git mode — semantic graph unavailable` to stderr, writes no events | Phase 0 | Phase 2 | planned |
| T5 | A5: existing `sync-engine.test.ts` + `jj.test.ts` stay green (no regression on jj path) | Phase 0 | Phase 2 | planned |
| T6 | A6: `indusk eval baseline --task <path>` on a git-mode project completes and writes a baseline scorecard | Phase 0 | Phase 3 | planned |
| T7 | A7: `buildEvaluatorPrompt({ scm: "git", ... })` includes `git show ${shortSha}`; `buildEvaluatorPrompt({ scm: "jj", ... })` includes `jj diff -r ${changeId}` | Phase 3 | Phase 3 | planned |
| T8 | A8: after `git commit -m "..."` inside a Claude Code session in a git-mode fixture, a scorecard entry appears in `.indusk/eval/results.log` within 60s | Phase 0 | Phase 5 | planned |
| T9 | A9: `apps/indusk-mcp/skills/git.md` exists with `git commit -m` content; `apps/indusk-mcp/skills/jj.md` is byte-equal to its pre-Phase-4 content | Phase 0 | Phase 4 | planned |
| T10 | A10: `apps/indusk-mcp/skills/work.md` commit-cadence section contains both `jj describe` and `git commit` | Phase 0 | Phase 4 | planned |

### Trajectory Rationale

- **T7** `Writable at: Phase 3` — The test calls `buildEvaluatorPrompt({ scm: "git", ... })`. The `PromptBuilderOptions` interface gains the `scm` field in Phase 3; passing it today is a TypeScript compile error against the current interface, so the test source cannot be authored before then.

## Checklist

### Phase 1: SCM detection + config field

- [ ] Add `scm` to the config schema in `apps/indusk-mcp/src/lib/config.ts` (or wherever `Config` type lives — verify via `grep "interface Config\|type Config"`)
  ```typescript
  // Config type addition
  scm?: "jj" | "git"; // optional during migration; readers default to jj for legacy projects without the field
  ```
- [ ] Implement `detectScm(projectRoot: string): Promise<"jj" | "git">` in new file `apps/indusk-mcp/src/lib/scm/detect.ts`
  ```typescript
  // Try jj first via execFile("jj", ["log", "-r", "@", "--no-graph", "-T", "change_id"], { cwd: projectRoot })
  // ENOENT or non-zero exit → fall back to execFile("git", ["rev-parse", "HEAD"], { cwd: projectRoot })
  // If both fail, throw with message "neither jj nor git detected at {projectRoot}"
  ```
- [ ] Implement `getScm(projectRoot: string): "jj" | "git"` reading `.indusk/config.json`. If field is missing on a project that exists, return `"jj"` (backward-compat default for pre-1.28.x projects)
- [ ] Update `apps/indusk-mcp/src/bin/commands/init.ts` to call `detectScm` and write the field
- [ ] Update `apps/indusk-mcp/src/bin/commands/update.ts` to call `detectScm` and migrate the field if missing (idempotent — re-runs do nothing)
- [ ] Add `apps/indusk-mcp/src/lib/scm/detect.test.ts` covering: jj path returns "jj", PATH-stripped-of-jj falls back to "git", neither tool throws

#### Phase 1 Verification

- [x] T1 (write red): commit an end-to-end test in `apps/indusk-mcp/src/__tests__/scm-init-detection.test.ts` that spawns `indusk init` against a tmpdir git repo with `PATH` stripped of jj and asserts `config.scm === "git"`. Today's behavior: `config.scm` is undefined. Test stays red until this phase lands.
- [x] T2 (write red): same harness against a tmpdir jj repo; assert `config.scm === "jj"`
- [x] T3 (write red): create a project, manually delete the `scm` field from config, run `indusk update`, assert field is restored; re-run, assert no change
- [ ] T1, T2, T3 flip to passing once `init`/`update` write the field
- [ ] `pnpm --filter indusk-mcp test src/lib/scm/detect.test.ts` passes
- [ ] T4–T10 stay in their existing states (planned for later phases)

#### Phase 1 Context

- [ ] Add to CLAUDE.md Architecture section: `apps/indusk-mcp/src/lib/scm/` — SCM abstraction layer with detection (init time) and read (runtime). `.indusk/config.json` `scm` field is the source of truth at runtime.
- [ ] Add to CLAUDE.md Conventions: `scm` field in `.indusk/config.json` is set once at init by `detectScm()` and is the runtime source of truth. Don't re-detect per call — read the config field via `getScm(projectRoot)`. `indusk update` migrates pre-1.28.x projects.

#### Phase 1 Document

- [ ] Add a Known Gotcha to CLAUDE.md: `getScm()` defaults to `"jj"` when the field is missing — preserves backward-compat for projects scaffolded before this plan. Don't rely on the default; ensure init/update have populated the field.

### Phase 2: Semantic graph wiring + graceful-degrade

- [ ] Create `apps/indusk-mcp/src/lib/scm/index.ts` exposing `getCurrentChangeId(projectRoot)` and `getReachableChangeIds(projectRoot)` that branch on `getScm(projectRoot)`
  ```typescript
  // jj branch: delegate to existing lib/semantic-graph/jj.ts (re-export the existing functions)
  // git branch: execFile("git", ["rev-parse", "--short", "HEAD"]) for getCurrentChangeId
  //             execFile("git", ["log", "--format=%h", "HEAD"]) for getReachableChangeIds
  ```
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/sync-engine.ts:23,64` — switch import from `./jj.js` to `../scm/index.js`. Add early-return on git mode:
  ```typescript
  if (getScm(projectRoot) === "git") {
    process.stderr.write("git mode — semantic graph unavailable (jj-only feature in v1; see .indusk/planning/git-or-jj-substrate/)\n");
    return; // exits sync as no-op
  }
  ```
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/graphiti-log-wrapper.ts:17,90,153` — same switch + same early-return pattern (silent — no stderr noise on every Graphiti write; write the message once at first call per session via a module-level `warned` flag)
- [ ] Update `apps/indusk-mcp/src/lib/semantic-graph/index.ts:10-13` — re-export `lib/scm` versions instead of (or in addition to) the jj-only versions; remove the `NotAJjRepoError` re-export from the public surface (it's now an internal jj-mode implementation detail)
- [ ] Add `apps/indusk-mcp/src/lib/scm/index.test.ts` covering: jj-mode returns same values as direct jj.ts, git-mode returns short-SHA strings, ancestry set on git is non-empty

#### Phase 2 Verification

- [ ] T4 (write red): commit an end-to-end test that creates a tmpdir git-only project, runs `indusk graph sync`, asserts exit 0 + stderr contains `git mode — semantic graph unavailable` + `.indusk/graph/semantic-graph.log` is empty/absent. Today's behavior: throws `NotAJjRepoError`. Stays red until this phase.
- [ ] T5: run `pnpm --filter indusk-mcp test src/lib/semantic-graph/` — all existing tests stay green (no regression on jj path)
- [ ] T4, T5 flip to passing
- [ ] `pnpm --filter indusk-mcp test src/lib/scm/index.test.ts` passes

#### Phase 2 Context

- [ ] Add to CLAUDE.md Conventions: Semantic graph features (`indusk graph sync`, Graphiti log capture) are jj-only in v1. On git-mode projects, `sync` is a no-op with a clear message; full git parity (stable event_id, rebase-tolerant replay) is deferred. Plans, lessons, eval, highlights all work on git unchanged.

#### Phase 2 Document

- [ ] Update `apps/indusk-docs/src/changelog.md` with a "git mode — semantic graph unavailable" gotcha entry.

### Phase 3: Eval surface — prompts + baseline CLI

- [ ] Add `scm: "jj" | "git"` to `PromptBuilderOptions` in `apps/indusk-mcp/src/lib/eval/prompt-builder.ts:14-20`
- [ ] Branch the prompt text in `prompt-builder.ts:103` and `persistent-evaluator.ts:224`:
  ```typescript
  const diffCommand = opts.scm === "git"
    ? `git show ${opts.changeId}`
    : `jj diff -r ${opts.changeId}`;
  ```
- [ ] Update every caller of `buildEvaluatorPrompt` to pass `scm: getScm(projectRoot)`. Find via `grep -rn "buildEvaluatorPrompt(" apps/indusk-mcp/src` and trace.
- [ ] Update `apps/indusk-mcp/src/bin/commands/eval.ts:276-288` (the baseline command) to branch on SCM:
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
- [ ] Update doc comment in `apps/indusk-mcp/src/lib/eval/findings.ts:5`: replace "every jj describe" with "every commit (jj describe / git commit)"
- [ ] Add `apps/indusk-mcp/src/lib/eval/prompt-builder.test.ts` test cases (or extend existing) for both `scm: "git"` and `scm: "jj"` snapshots

#### Phase 3 Verification

- [ ] T6 (write red — Phase 0 reference): create end-to-end test for `indusk eval baseline --task` against a git-only fixture; today fails because the command runs `jj new`/`jj describe`. Stays red until this phase.
- [ ] T7: snapshot test on `buildEvaluatorPrompt` for both SCM values — git snapshot contains `git show`, jj snapshot contains `jj diff -r`
- [ ] T6, T7 flip to passing
- [ ] T1–T5 still passing (no regression check)

#### Phase 3 Context

- [ ] Add to CLAUDE.md Architecture: Eval prompts and baseline CLI are SCM-aware. `buildEvaluatorPrompt` takes an `scm` field; baseline command branches at `eval.ts:276-288`.

#### Phase 3 Document

- [ ] Update the eval-agent reference page at `apps/indusk-docs/src/reference/agents/eval-agent.md` (or wherever the eval prompt is documented) to note SCM-awareness.

### Phase 4: Skills — agnostic prose + new git.md

- [ ] Snapshot current `apps/indusk-mcp/skills/jj.md` content before any edits in this phase, and pin a vitest unit test to the snapshot (T9's byte-equal check)
- [ ] Create `apps/indusk-mcp/skills/git.md` — sibling to `jj.md`, describing the do-then-commit workflow with `git commit -m` cadence. Cover: per-item commit cadence, monorepo siloing via `git add -p` + multiple commits, the eval-fires-after-commit asymmetry. Cross-reference `jj.md` for users on jj.
- [ ] Edit `apps/indusk-mcp/skills/work.md:279-297` — rewrite the "Use the describe-then-do workflow from the jj skill" section to be SCM-conditional. Show both forms with a short note on the asymmetry. Keep the existing jj rationale; add the git equivalent.
- [ ] Edit `apps/indusk-mcp/skills/highlight.md:6,39` — replace "next `jj describe` or at session end" with "next commit (jj describe / git commit) or at session end"
- [ ] Edit `apps/indusk-mcp/skills/eval-review.md:11,15,25` — make the diff-fetching commands SCM-aware
- [ ] Run `pnpm --filter indusk-mcp build` to ensure nothing breaks
- [ ] Verify `indusk update` syncs the new `git.md` into installed projects' `.claude/skills/`. Check `apps/indusk-mcp/src/bin/commands/update.ts` skill-sync logic.

#### Phase 4 Verification

- [ ] T9 (write red — Phase 0): commit a vitest unit test that asserts `apps/indusk-mcp/skills/git.md` exists, contains `git commit -m`, contains do-then-commit cadence guidance, and `apps/indusk-mcp/skills/jj.md` is byte-equal to a snapshot fixture (the pre-Phase-4 content). Today fails — the file doesn't exist.
- [ ] T10 (write red — Phase 0): commit a vitest unit test that greps `apps/indusk-mcp/skills/work.md` for both `jj describe` and `git commit` in the commit-cadence section. Today fails — only `jj describe` appears.
- [ ] T9, T10 flip to passing
- [ ] T1–T7 still passing (no regression check)

#### Phase 4 Context

- [ ] Add to CLAUDE.md Conventions: Skills are SCM-agnostic in their commit-cadence guidance. The `jj.md` skill remains as the jj-mode reference; `git.md` is the new git-mode reference. Edit one or the other when SCM-specific guidance changes; edit `work.md` when cross-cutting cadence guidance changes.

#### Phase 4 Document

- [ ] Update `apps/indusk-docs/src/guide/scm.md` (new page) or extend an existing guide page covering: which SCM InDusk supports, how to choose, the asymmetry. Link from the changelog entry.

### Phase 5: End-to-end smoke + manual verification

- [ ] Build a tmpdir-based e2e harness in `apps/indusk-mcp/src/__tests__/git-mode-e2e.test.ts` that: creates tmpdir, runs `git init`, `indusk init`, makes a fake plan, runs `indusk graph sync` (asserts no-op), runs `indusk eval baseline --task` (asserts success), tears down
- [ ] Document the manual smoke procedure at `apps/indusk-mcp/test-fixtures/git-mode-manual-smoke.md` covering: drop `.indusk/` into a fresh git-only project, open in Claude Code, make a trivial code edit, `git commit -m "test"`, watch `.indusk/eval/results.log` for an entry within 60s
- [ ] Run the manual smoke procedure once. Capture the result (date + scorecard ID + observed-time-to-scorecard) in a comment on T8.

#### Phase 5 Verification

- [ ] T8 (manual smoke): run the documented procedure on a fresh git-only fixture; assert scorecard appears within 60s. State transitions to `passing` only after a real run, with the run's result recorded.
- [ ] All trajectory rows (T1–T10) in `passing` state
- [ ] Run full `pnpm test` from repo root — no regressions

#### Phase 5 Context

- [ ] Update CLAUDE.md Current State: git-mode support shipped in `<version>`. Note the semantic-graph deferral (full git parity is future work).

#### Phase 5 Document

- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md` with: what changed for git users, what changed for jj users (nothing observable), and the known limitation (semantic graph unavailable on git).
- [ ] Run `/falsify git-or-jj-substrate` before `/retrospective`

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
