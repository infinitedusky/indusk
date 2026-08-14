---
title: "jj Residue Rip-Out"
date: 2026-08-13
status: in-progress
workflow: refactor
trajectory: required
test_phases: required
rationale: required
gate_policy: ask
---

# jj Residue Rip-Out

## Goal

Finish the jj removal that [`git-only-substrate`](../archive/git-only-substrate/) declared complete on 2026-06-27, and replace the enforcement test that could not have caught what it missed.

## Scope

### In Scope

- The one remaining jj execution path (`apps/indusk-admin/src/lib/vcs.ts`)
- User-facing admin copy naming jj commands
- The `scm: "jj"` back-compat shim (config field + `indusk update` nudge + its test)
- Stale jj comments in `indusk-mcp` source
- `apps/docs/src/reference/semantic-graph/jj-dependency.md`
- Widening `scm-rip-out-grep.test.ts` to both apps and to argv-level matching

### Out of Scope

- `apps/docs/src/decisions/git-or-jj-substrate.md`, `apps/docs/src/lessons/git-or-jj-substrate.md` — superseded records
- `.indusk/planning/**` — historical archive (~60 files)
- `apps/docs/src/guide/scm.md` — already correct as the git-only migration explainer
- `apps/indusk-mcp/lessons/community/*` — three bundled lessons that use jj as their worked example; removing it would leave them asserting something happened without saying what
- The other 8 pages in `apps/docs/src/reference/semantic-graph/` — dead docs for a subsystem the makeover removed; a separate plan
- Telemetry-daemon leak in the other three temp-home test files — diagnosed separately

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | Widened audit (both apps, argv-level patterns) with an observed red state; A1–A6 authored | The current tree, used as the red fixture |
| Build Phase 1 | `getCommitMessage` resolving via git only | A1 (partial), A3, A4 |
| Build Phase 2 | Admin copy naming git commands | A5 |
| Build Phase 3 | Config type and `update` with no jj surface; clean comments; one docs page gone | A1 (completes), A6 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| A1 | A repo-wide audit across `indusk-mcp` and `indusk-admin` finds no code executing jj and no config field offering jj as an option | Test Phase 1 | Build Phase 3 | written |
| A2 | The audit reports no violation against preserved history — planning archive, superseded decision/lesson pages, `guide/scm.md`, and the bundled community lessons | Test Phase 1 | Test Phase 1 | passing |
| A3 | With no `jj` on PATH, the scorecards page still displays a commit message for every scorecard that has one | Test Phase 1 | Test Phase 1 | passing |
| A4 | The commit message displayed for a scorecard matches that commit's actual git message | Test Phase 1 | Test Phase 1 | passing |
| A5 | No text rendered in the admin UI instructs the reader to run a jj command | Test Phase 1 | Build Phase 2 | written |
| A6 | A project whose config still contains `scm: "jj"` runs `indusk update` to completion with no error and no jj nudge | Test Phase 1 | Build Phase 3 | written |

## Checklist

### Test Phase 1: Arm the tripwire, and prove it can fire

**Goal**: author every assertion, and observe A1, A5, and A6 failing against the current tree. A widened audit that has never been seen red is the artifact this plan exists to replace — the red observation is the deliverable, not a formality.

- [x] Create/confirm this plan's worktree — worktree-per-plan default; skip only if `worktree: none` in frontmatter. **Deviation:** `indusk worktree create` refuses in dusk (`no workbench-shaped .indusk/config.json` — the worktree extension requires a workbench root and dusk is a plain repo). Used the form dusk's existing worktrees were made with: `git worktree add ../dusk-worktrees/jj-residue-rip-out -b plan/jj-residue-rip-out`
- [x] Rewrite `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` to resolve the **repo root** and scan both `apps/indusk-mcp/` and `apps/indusk-admin/`
- [x] Add argv-level patterns to the audit — match jj as an **executed command**, not only as a TypeScript identifier. **Discovered:** patterns must be matched against **whole-file content**, not line-by-line as the predecessor did — the real call site formats `execFileSync(` and `"jj",` on separate lines, so a line-at-a-time audit misses it even with a correct argv pattern. This was a second, independent layer of the same blindness
  ```typescript
  // The predecessor matched only symbol names, which is why an
  // execFileSync("jj", [...]) argument list slipped through for seven weeks.
  /execFileSync\s*\(\s*["'`]jj["'`]/,
  /execFile\s*\(\s*["'`]jj["'`]/,
  /spawn(?:Sync)?\s*\(\s*["'`]jj["'`]/,
  /\bscm\s*[?]?\s*:\s*["'`]jj["'`]/,
  ```
- [x] Add the preserved-history exemption list to the audit (A2) — `.indusk/planning/**`, `apps/docs/src/decisions/**`, `apps/docs/src/lessons/**`, `apps/docs/src/guide/scm.md`, `apps/indusk-mcp/lessons/**`
- [x] Author A1 and confirm it fails, naming `apps/indusk-admin/src/lib/vcs.ts` and the `scm?: "jj" | "git"` field — RED, 3 violations: `config.ts:77`, `update.ts:616`, `vcs.ts:28`
- [x] Author A2 and confirm it passes — the audit must not flag any preserved-history path
- [x] Author A3 (scorecards render commit messages with `jj` absent from PATH) and A4 (displayed message matches git's) as integration tests against a temp git repo — both GREEN as declared. jj **is** installed here (`/opt/homebrew/bin/jj`), so A3 builds a PATH containing only git and asserts jj is genuinely unreachable before making its claim
- [x] Author A5 (no jj command named in admin UI copy) and confirm it fails on `Scorecards.tsx` and `scorecards/page.tsx` — RED on both
- [x] Author A6 (`indusk update` on a `scm: "jj"` config emits no nudge) and confirm it fails against current behavior — RED. Authored as `update-scm-jj-removed.test.ts` (Build Phase 3 deletes the old nudge test it replaces). **Required a `dist/` build first**: the suite `skipIf`s on a missing CLI binary, so in a fresh worktree A6 would have reported "skipped" while looking authored. Its `afterEach` also stops the telemetry daemon before deleting the temp home — verified no leak (procs 1 → 1)

#### Regression Guards

- **A2** — Passes the moment it is written, because the current audit does not scan the exempted paths at all. It is not a driver; its job starts when A1 widens, pinning the boundary so a future widening cannot begin flagging the decision record. An audit that fires on ~60 archived files and three shipped lessons gets disabled, which is the state this plan is correcting.
- **A3** — Passes today. The current `vcs.ts` already falls back to git when jj is missing, so this cannot go red before the removal. It exists to prove Build Phase 1 did not break the feature the jj branch was nominally serving.
- **A4** — Passes today, same fallback. Guards against a Build Phase 1 rewrite that returns the wrong message rather than no message — a failure A3 alone would not catch, since A3 only asserts that *something* is displayed.

#### Test Phase 1 Verification

- [ ] A1, A5, A6 observed RED against the pre-removal tree; each failure names its expected violation rather than erroring on a missing import
- [ ] A2, A3, A4 observed GREEN, consistent with their declaration as guards
- [ ] A1's failure output lists `vcs.ts` — confirming the widened audit sees the file the predecessor's scope excluded

#### Test Phase 1 Context

- [ ] Record in the plan's notes which paths the audit exempts, so the Build Phase 3 CLAUDE.md edit can state the boundary rather than restate the removal

#### Test Phase 1 Document

- [ ] Capture A1's red output verbatim into the plan folder as the evidence artifact — the predecessor's failure was an audit no one had ever seen fail, and a claim that this one did needs a record

### Build Phase 1: Remove the executing jj path

- [ ] Collapse `getCommitMessage` in `apps/indusk-admin/src/lib/vcs.ts` to a single git lookup — delete the jj `execFileSync` branch and its `try`/fall-through
- [ ] Rewrite the file's doc comment, which currently asserts jj is "the project default in dusk" — false since 1.31.0
- [ ] Confirm `getCommitMessages` bulk path still deduplicates by id

#### Build Phase 1 Verification

- [ ] A3 and A4 still pass — the removal did not break commit-message display
- [ ] A1 still fails, now naming only the `scm?: "jj" | "git"` field (`vcs.ts` no longer flagged)

#### Build Phase 1 Context

- [ ] Check whether any CLAUDE.md entry describes the admin's commit-message lookup as SCM-agnostic or jj-first; correct it if found

#### Build Phase 1 Document

- [ ] Check `apps/docs/src/reference/admin-ui/` for any page describing the scorecard commit-message lookup as trying jj first; correct it if found

### Build Phase 2: Remove jj from user-facing copy

- [ ] Rewrite the three jj references in `apps/indusk-admin/src/components/Scorecards.tsx` to name `git commit`
- [ ] Rewrite the empty-state copy in `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx`

#### Build Phase 2 Verification

- [ ] A5 passes — no admin UI text names a jj command
- [ ] Scorecards page renders correctly with the new copy (`pnpm turbo test --filter=indusk-admin`)

#### Build Phase 2 Context

- [ ] Verify the admin-ui gotchas block in CLAUDE.md does not quote the jj-worded scorecards copy; correct if it does

#### Build Phase 2 Document

- [ ] Check whether any docs page screenshots or quotes the old scorecards copy; update if so

### Build Phase 3: Close the back-compat shim and sweep the remainder

- [ ] Remove the `scm?: "jj" | "git"` field from `InduskConfig` in `apps/indusk-mcp/src/lib/config.ts`
- [ ] Remove the `scm: "jj"` nudge from `apps/indusk-mcp/src/bin/commands/update.ts`
- [ ] Delete `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts`
- [ ] Remove the `".jj/"` ignore entry and the stale `git-or-jj-substrate` comment from `apps/indusk-mcp/src/bin/commands/init.ts`
- [ ] Rewrite the stale doc comments in `apps/indusk-mcp/src/lib/eval/findings.ts` and `lib/eval/prompt-builder.ts` — the latter also describes writing findings to Graphiti, removed in the makeover
- [ ] Delete `apps/docs/src/reference/semantic-graph/jj-dependency.md` and remove its sidebar entry from `apps/docs/src/.vitepress/config.ts`

#### Build Phase 3 Verification

- [ ] A1 passes — the audit is green across both apps
- [ ] A6 passes — `indusk update` on a `scm: "jj"` config completes silently
- [ ] A2 still passes — no preserved-history path became a violation
- [ ] Full suite green (`pnpm test`) and `pnpm check` clean
- [ ] Docs site builds with the deleted page removed from the sidebar (`pnpm turbo build --filter=docs`)

#### Build Phase 3 Context

- [ ] Update CLAUDE.md's git-only-substrate Key Decisions line so it states what is now true, and name the preserved-history boundary the audit enforces

#### Build Phase 3 Document

- [ ] Changelog entry for the removal, including the `scm` config field deprecation close
- [ ] Update `apps/docs/src/guide/scm.md`'s note that `indusk update` nudges about `scm: "jj"` — that nudge no longer exists

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/__tests__/scm-rip-out-grep.test.ts` | Widen to both apps + argv-level patterns + history exemptions |
| `apps/indusk-admin/src/lib/vcs.ts` | Delete jj execution branch; rewrite doc comment |
| `apps/indusk-admin/src/components/Scorecards.tsx` | 3 copy strings → git |
| `apps/indusk-admin/src/app/p/[project]/scorecards/page.tsx` | Empty-state copy → git |
| `apps/indusk-mcp/src/lib/config.ts` | Remove `scm?: "jj" \| "git"` |
| `apps/indusk-mcp/src/bin/commands/update.ts` | Remove `scm: "jj"` nudge |
| `apps/indusk-mcp/src/__tests__/update-scm-jj-nudge.test.ts` | Delete |
| `apps/indusk-mcp/src/bin/commands/init.ts` | Remove `.jj/` entry + stale comment |
| `apps/indusk-mcp/src/lib/eval/findings.ts` | Rewrite stale doc comment |
| `apps/indusk-mcp/src/lib/eval/prompt-builder.ts` | Rewrite stale doc comment (also drops Graphiti reference) |
| `apps/docs/src/reference/semantic-graph/jj-dependency.md` | Delete |
| `apps/docs/src/.vitepress/config.ts` | Remove sidebar entry |
| `apps/docs/src/guide/scm.md` | One line — the nudge no longer exists |
| `CLAUDE.md` | Key Decisions line now true |

## Dependencies

- None.

## Notes

- Deleting `update-scm-jj-nudge.test.ts` also removes one of four test files leaking orphaned telemetry daemon pairs. Incidental; the other three still need the separate fix.
- `guide/scm.md` is out of scope as a *jj* edit but gains one factual correction in Build Phase 3 — it currently documents a nudge this plan deletes.
- The VitePress sidebar config lives at `apps/docs/src/.vitepress/config.ts`; the root-level one is a stale scaffold (per the `vitepress-config-is-under-src-not-docs-root` lesson).
