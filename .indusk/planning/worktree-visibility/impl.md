---
title: "Worktree Visibility"
date: 2026-07-12
status: in-progress
trajectory: required
rationale: required
gate_policy: ask
---

# Worktree Visibility

## Goal

Make agent worktree isolation the default for every plan and observable in the presence bulletin.
Two halves: the **visibility** half (bulletin shows worktree/branch, collision flag) is mechanical
and unit/integration-testable; the **automatic-isolation** half (worktree created at impl kickoff,
`worktree: none` opt-out) is skill-driven with pure helpers extracted for deterministic coverage.

## Scope

### In Scope
- `AgentSection` gains `branch` + `worktree`; parser/serializer marker lines + sanitizer guard.
- `indusk agent list` `WORKTREE`/`BRANCH` columns; self-heartbeat recomputes from cwd.
- Same-tree collision flag in `agent list` + catchup wording.
- Pure helpers: `worktree: none` frontmatter decision; trunk-vs-worktree detection.
- Planner authors the impl kickoff step; `/work` executes it honoring the opt-out.
- Docs + manual smoke procedure.

### Out of Scope
- Hard gate at kickoff (nudge only in v1); migrations; per-session worktree requirement; numero process.

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `AgentSection.branch/worktree`, marker-line parse/serialize, sanitizer guard, `agent list` columns, recompute-in-heartbeat, collision flag | existing `current-md.ts` lib + `agent.ts` CLI |
| Phase 2 | `resolveWorktreeDecision(frontmatter)` helper, `detectTreeContext(cwd)` helper (trunk vs worktree) | `.indusk/config.json` / impl frontmatter, `git worktree list` |
| Phase 3 | planner kickoff step, `/work` execution wiring, catchup wording, docs, manual smoke procedure | Phase 1 visibility + Phase 2 helpers |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Kind |
|----|---------|-------------|-----------|-------|------|
| T1 | `indusk agent list` shows each active session's worktree path and branch. | Phase 0 | Phase 1 | passing | integration |
| T2 | After a session's branch/worktree changes, the next `agent list` shows the current branch, not the register-time one. | Phase 0 | Phase 1 | passing | integration |
| T3 | Two active sessions both in the shared trunk produce a collision warning naming them; two in separate worktrees do not. | Phase 0 | Phase 1 | passing | integration |
| T4 | A section body containing a `**Branch**:`/`**Worktree**:` line does not create a phantom agent or spoofed field in `agent list`. | Phase 0 | Phase 1 | passing | unit |
| T5 | Impl frontmatter with `worktree: none` yields a "skip" decision; absent yields "create". | Phase 2 | Phase 2 | passing | unit |
| T6 | The tree-context helper classifies a cwd inside the trunk as "trunk" and a cwd inside a worktree as "worktree". | Phase 2 | Phase 2 | passing | unit |
| T7 | Starting `/work` on a plan with no opt-out results in a git worktree existing for that plan before any code file is edited. | Phase 3 | Phase 3 | skipped | manual |
| T8 | Starting `/work` on a plan whose impl frontmatter has `worktree: none` proceeds in the current tree with no worktree created. | Phase 3 | Phase 3 | skipped | manual |
| T9 | `/catchup` reports other active agents' worktree and branch and surfaces a same-trunk collision. | Phase 3 | Phase 3 | skipped | manual |
| T10 | Running `agent list` from a non-git cwd (e.g. the workbench root, where `.indusk/` lives) preserves the caller's last-known worktree/branch instead of wiping them to empty — the session stays on the board and in the collision check. | Phase 0 | Phase 4 | planned | integration |
| T11 | `resolveWorktreeDecision` treats `worktree: false` (boolean) and YAML-falsy `no`/`off` as "skip", matching the intent to opt out — not "create". | Phase 0 | Phase 4 | planned | unit |

### Deferred Verification

- **Skill reliably creates the worktree at `/work`**
  - reason: The behavior is executed by an LLM following skill prose, not deterministic code — it cannot be asserted in vitest.
  - would require: A harness that runs the actual `/work` skill against a fixture plan and inspects the resulting git worktree state — not available in the unit/integration test tier.
  - mitigation: The *decision* the skill reads is extracted into the `resolveWorktreeDecision` pure helper (T5) and trunk-detection into `detectTreeContext` (T6), both unit-tested; T7/T8 manual smokes exercise the end-to-end outcome; and the failure mode is self-announcing — a plan left in the trunk trips the T3 collision flag in `agent list`/catchup.

### Trajectory Rationale

- **T5** `Writable at: Phase 2` — Subject is the `resolveWorktreeDecision` helper authored in Phase 2; the test's import line is a compile error against today's stack.
- **T6** `Writable at: Phase 2` — Subject is the `detectTreeContext` helper authored in Phase 2; no import target exists before then.
- **T7** `Writable at: Phase 3` — Manual smoke of the kickoff step, which is authored into the planner/work skills in Phase 3; there is no kickoff behavior to observe before then.
- **T8** `Writable at: Phase 3` — Same kickoff step; the `worktree: none` branch of it does not exist to exercise until Phase 3.
- **T9** `Writable at: Phase 3` — Manual smoke of catchup wording that surfaces the Phase 1 columns; the collision-surfacing prose lands in Phase 3.

## Checklist

### Phase 1: Visibility fields in the bulletin

- [x] Add `branch: string` and `worktree: string` (both may be empty) to `AgentSection` in
      `apps/indusk-mcp/src/lib/agents/current-md.ts`.
- [x] Serialize `**Branch**: <b>` / `**Worktree**: <p>` marker lines in the section body (alongside
      `**Session ID**:` / `**Last updated**:`); parse them back. Empty values omit the line (round-trip
      to `""`).
- [x] Add `**Branch**:` and `**Worktree**:` to the forbidden-marker list in `sanitizeSectionBody`
      so a section body cannot inject a fake marker line (same defense as the Session ID / Last
      updated markers).
- [x] `agent register` (`apps/indusk-mcp/src/bin/commands/agent.ts`): stop discarding the computed
      branch — populate `section.branch` and `section.worktree` (worktree = `git rev-parse
      --show-toplevel` of cwd via new `currentWorktree` helper). Removed the `const _branch = branch;
      void _branch` stub.
- [x] `formatTable`: added `WORKTREE` (basename cell) and `BRANCH` columns; refactored to a
      column-list to keep width computation DRY.
- [x] `agentList` self-heartbeat: **recomputes** `branch`/`worktree` from cwd before re-upserting the
      caller's section (mutates the printed `fresh` entry in place too, so the caller's own row shows
      the current tree and participates in collision detection with fresh data).
- [x] Collision flag: `detectCollisions` groups fresh sessions by resolved worktree toplevel; ≥2 in
      one tree prints a `⚠ collision:` warning (via `console.warn` → stderr) naming the sessions.
      Non-git cwds (empty worktree) are excluded.

#### Phase 1 Verification
- [x] T1 passes — `worktree-visibility-cli.test.ts` asserts `agent list` shows WORKTREE/BRANCH
      columns with the branch + worktree basename (`pnpm vitest run src/__tests__/worktree-visibility-cli.test.ts`).
- [x] T2 passes — register on `main`, `git checkout -b feature-x`, `agent list` shows `feature-x`
      and no stale `main` (recompute in heartbeat).
- [x] T3 passes — two sessions in one tree → `⚠ collision` on stderr; S2 moved to a linked worktree → absent.
- [x] T4 passes — `worktree-visibility.test.ts` asserts `sanitizeSectionBody` + `upsertSection` reject
      injected `**Branch**:`/`**Worktree**:` lines. Full run: 63 agents-domain tests green; `tsc --noEmit` clean; `biome check` clean.

#### Phase 1 Context
- [x] Update CLAUDE.md Conventions: `agent register` now records worktree/branch; `agent list` shows
      them recomputed-live; same-tree collision flag. Note the sanitizer's two new forbidden markers.

#### Phase 1 Document
- [x] Updated `apps/docs/src/reference/cli/agent.md`: new WORKTREE/BRANCH columns in the `agent list`
      table, recompute-live note, same-tree collision-flag section, and the `**Branch**:`/`**Worktree**:`
      markers in the section-shape example (noted as optional/emit-when-in-repo).

### Phase 2: Decision + detection helpers

- [x] `resolveWorktreeDecision(implContent): "create" | "skip"` — reads the `worktree:` impl
      frontmatter key via gray-matter (mirroring `isCleanupSkipped`); `"none"` (case-insensitive) →
      `"skip"`, anything else/absent/unparseable → `"create"`. Pure. In new
      `apps/indusk-mcp/src/lib/worktree/decision.ts`.
- [x] `detectTreeContext(cwd, run?): { kind: "trunk" | "worktree"; toplevel: string }` — compares the
      current `--show-toplevel` against the first (main) entry of `git worktree list --porcelain`;
      injectable `GitRunner` for testability. Non-git cwd → `{ kind: "trunk", toplevel: "" }`.
- [x] Kept internal for now (only the work/planner skills consume them, via `tsx`); no subpath export
      added until a cross-package consumer needs it.

#### Phase 2 Verification
- [x] T5 passes — `decision.test.ts` covers `resolveWorktreeDecision` for none / absent / other /
      case-insensitive / unparseable. (`pnpm vitest run src/lib/worktree/__tests__/decision.test.ts`)
- [x] T6 passes — `detectTreeContext` classifies trunk vs linked worktree via a faked git runner, and
      falls back to trunk for non-git cwds. 8 tests green; `tsc --noEmit` clean.

#### Phase 2 Context
- [x] Update CLAUDE.md Conventions: the `worktree: none` frontmatter opt-out + the two helpers as the
      deterministic core behind the skill-driven kickoff.

#### Phase 2 Document
- [x] (none needed — asked: "Phase 2 helpers are internal, no public API, documented in Phase 3's kickoff-step docs. Skip the Phase 2 Document gate?" — user: "Skip it")

### Phase 3: Kickoff step + catchup + docs + smoke

- [x] Planner skill (`apps/indusk-mcp/skills/planner.md`): step 7 now directs authors to open Phase 1
      with a worktree kickoff item; documents the `worktree: none` opt-out (no workflow default, hotfix
      included).
- [x] Work skill (`apps/indusk-mcp/skills/work.md`): new `## Worktree Kickoff` section — reads the
      frontmatter (`resolveWorktreeDecision`), compares tree context (`detectTreeContext`), and nudges
      `indusk worktree create <plan-slug>` when in the trunk. Explicitly nudge-not-gate.
- [x] Catchup skill (`apps/indusk-mcp/skills/catchup.md`): summary template surfaces each agent's
      worktree/branch and a dedicated collision line; the overlap-judgment note points at both the
      new columns and the `⚠ collision` stderr line.
- [x] Manual smoke procedure at `apps/indusk-mcp/test-fixtures/worktree-visibility-smoke.md`: T7
      (default plan → worktree exists), T8 (`worktree: none` → no worktree), T9 (catchup surfaces
      worktree/branch + collision).

#### Phase 3 Verification
- [x] T7 / T8 / T9 authored as the manual smoke procedure (`test-fixtures/worktree-visibility-smoke.md`);
      trajectory State `skipped` pending Sandy's live two-session run — flip to `passing` after. The
      deterministic core beneath them (T5 decision helper, T6 tree detection) is already `passing`, and
      the failure mode self-announces via the T3 collision flag.

#### Phase 3 Context
- [x] Update CLAUDE.md Current State: worktree-visibility shipped — bulletin shows worktree/branch,
      collision flag, worktree-per-plan default at impl kickoff (`worktree: none` opt-out).

#### Phase 3 Document
- [x] Added a "Worktree visibility and worktree-per-plan" section to `apps/docs/src/guide/multi-agent.md`
      (columns + recompute + collision + kickoff/opt-out); changelog Unreleased entry; published the ADR
      to `apps/docs/src/decisions/worktree-visibility.md` and registered it in the VitePress decisions
      sidebar. (Sequence-diagram update deferred — the existing diagram is register/list-shaped and the
      new columns don't change the message flow; noted for a docs-polish follow-up.)

### Phase 4: Falsification — non-git-cwd wipe + opt-out coercion

**Goal**: verify whether the attested state holds against two confirmed failure modes and one semantic gap found by `/falsify`. Each trajectory row below captures one hypothesis (test fails today, passes after the fix); the checklist items are the fixes.

Confirmed by investigation:
- **H3 (T10)** — `agentList`'s heartbeat recomputes `branch`/`worktree` from cwd and unconditionally overwrites the caller's stored values. From a **non-git cwd** — notably the **workbench root, which is intentionally not a git repo and is exactly where `.indusk/` lives** — `currentWorktree` returns `""` and `currentBranch` returns `null→""`, so a session that registered inside the trunk gets its worktree/branch **wiped to `—`** and silently **drops out of `detectCollisions`** (empty worktree is excluded). A real same-trunk collision goes unflagged the moment the reporting agent runs `agent list` from the workbench root. This is the most realistic invocation site, so the false-negative is likely, not exotic.
- **H4 (T11)** — `resolveWorktreeDecision` only treats the string `"none"` as opt-out. `worktree: false` parses (gray-matter/js-yaml) to boolean `false` → `typeof raw !== "string"` → returns `"create"`. `worktree: no` / `worktree: off` stay strings but `!== "none"` → also `"create"`. A user expressing "no worktree" the natural way (`false`/`no`/`off`) silently **gets** a worktree — the opposite of intent.
- **H1 (documentation)** — `detectCollisions` compares the caller's freshly-recomputed tree against every **other** session's *last-known* stored tree. Another session that moved between trunk and worktree but hasn't run any `agent` CLI command since carries a stale tree, so the collision verdict is eventually-consistent, not real-time. This is inherent (you can't run git in another session's cwd) and correct-by-design — but it is undocumented, so it reads as a bug when it surprises someone. Fix is to state the semantics, not to change the logic.

Investigated and **rejected** (no row): symlink path divergence between two sessions' `worktree` strings — `git rev-parse --show-toplevel` returns the physical path (`/private/tmp`, not `/tmp`), so all stored values are already realpath-normalized and compare equal.

- [ ] `agentList` heartbeat: only overwrite `branch`/`worktree` when the recompute yields a **non-empty** value; when `currentWorktree(cwd)`/`currentBranch(cwd)` come back empty (non-git cwd), **preserve** the caller section's prior stored value. The section still heartbeats `lastUpdated`. (H3/T10)
- [ ] `resolveWorktreeDecision`: broaden the opt-out — return `"skip"` for boolean `false`, and for the case-insensitive strings `none`/`no`/`off`/`false`/`skip`; everything else / absent / unparseable stays `"create"`. Keep the safe-default-create posture. (H4/T11)
- [ ] Document the collision flag's eventual-consistency semantics in `apps/docs/src/reference/cli/agent.md` and the `detectCollisions` doc comment: the verdict reflects each session's **last-known** tree, refreshed when *that* session next runs `agent register`/`agent list`; a moved-but-idle session shows its prior tree until its next heartbeat. (H1)

#### Phase 4 Verification
- [ ] T10: integration test registers a session inside a git repo, then runs `agent list` from a **non-git** cwd (the workbench root) with the same session ID; asserts the session's WORKTREE/BRANCH are preserved (not `—`) and, with a second session in the same tree, the `⚠ collision` still fires. Red today (heartbeat wipes to empty), green after the preserve fix.
- [ ] T11: unit test over `resolveWorktreeDecision` for `worktree: false` / `no` / `off` → `"skip"`; `worktree: create` / absent → `"create"`. Red today (`false`/`no`/`off` return `"create"`), green after the coercion fix.

#### Phase 4 Context
- [ ] Add a CLAUDE.md Known Gotcha: `agent list`'s heartbeat must never wipe worktree/branch to empty on a non-git cwd (the workbench root is not a git repo) — preserve last-known; and the `worktree:` opt-out accepts `false`/`no`/`off`/`none`/`skip`, not just `none`.

#### Phase 4 Document
- [ ] Update `apps/docs/src/reference/cli/agent.md`: the collision flag's eventual-consistency semantics (H1) and the broadened `worktree:` opt-out keyword set (H4).

## Files Affected
| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/agents/current-md.ts` | `AgentSection` fields, marker parse/serialize, sanitizer guard |
| `apps/indusk-mcp/src/bin/commands/agent.ts` | populate branch/worktree, table columns, recompute heartbeat, collision flag |
| `apps/indusk-mcp/src/lib/worktree/decision.ts` (new) | `resolveWorktreeDecision`, `detectTreeContext` |
| `apps/indusk-mcp/skills/{planner,work,catchup}.md` | kickoff step + nudge + catchup wording |
| `apps/indusk-mcp/test-fixtures/worktree-visibility-smoke.md` (new) | T7/T8/T9 manual procedure |
| docs (`reference/cli/agent`, `guide/multi-agent`, `decisions/worktree-visibility`, changelog) | doc gate |

## Dependencies
- Worktree extension (shipped) — `worktreeCreate` + `detectTreeContext` substrate.

## Notes
- Hard gate at kickoff is a deliberate v1 non-goal; revisit after the nudge is dogfooded.
- This plan's own `/work` will (per this plan) create a worktree for itself — dogfood the kickoff step live.
