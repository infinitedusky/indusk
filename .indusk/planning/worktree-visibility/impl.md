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
| T5 | Impl frontmatter with `worktree: none` yields a "skip" decision; absent yields "create". | Phase 2 | Phase 2 | planned | unit |
| T6 | The tree-context helper classifies a cwd inside the trunk as "trunk" and a cwd inside a worktree as "worktree". | Phase 2 | Phase 2 | planned | unit |
| T7 | Starting `/work` on a plan with no opt-out results in a git worktree existing for that plan before any code file is edited. | Phase 3 | Phase 3 | planned | manual |
| T8 | Starting `/work` on a plan whose impl frontmatter has `worktree: none` proceeds in the current tree with no worktree created. | Phase 3 | Phase 3 | planned | manual |
| T9 | `/catchup` reports other active agents' worktree and branch and surfaces a same-trunk collision. | Phase 3 | Phase 3 | planned | manual |

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

- [ ] `resolveWorktreeDecision(frontmatter): "create" | "skip"` — reads `worktree` from impl
      frontmatter; `"none"` → `"skip"`, anything else/absent → `"create"`. Pure, no I/O. Place in a
      new `apps/indusk-mcp/src/lib/worktree/decision.ts` (or extend an existing worktree lib module).
- [ ] `detectTreeContext(cwd): { kind: "trunk" | "worktree"; toplevel: string }` — classify via
      `git worktree list` membership / comparing toplevel against the workbench's `wrapped_repo`
      trunk. Pure-ish (shells `git`); inject the git runner for testability.
- [ ] Export both via subpath if the skills/hooks need them; otherwise keep internal.

#### Phase 2 Verification
- [ ] T5 passes — unit test over `resolveWorktreeDecision` for `none` / absent / other values.
- [ ] T6 passes — unit test over `detectTreeContext` with a faked git runner returning trunk vs
      worktree toplevels.

#### Phase 2 Context
- [ ] Update CLAUDE.md Conventions: the `worktree: none` frontmatter opt-out + the two helpers as the
      deterministic core behind the skill-driven kickoff.

#### Phase 2 Document
- [ ] (none needed — helpers documented via the kickoff-step doc in Phase 3)

### Phase 3: Kickoff step + catchup + docs + smoke

- [ ] Planner skill (`apps/indusk-mcp/skills/planner.md`): the impl-authoring step emits a first
      impl phase kickoff item — "create/confirm the plan's worktree unless `worktree: none`" — at the
      research→impl boundary.
- [ ] Work skill (`apps/indusk-mcp/skills/work.md`): on starting impl, call `resolveWorktreeDecision`;
      if `create` and `detectTreeContext` says `trunk`, **nudge** to run `indusk worktree create
      <plan-slug>` before editing code. Nudge, not a block — no `check-gates.js` change.
- [ ] Catchup skill (`apps/indusk-mcp/skills/catchup.md`): wording surfaces other agents' worktree/
      branch from `agent list` and calls out a same-trunk collision when present.
- [ ] Manual smoke procedure at `apps/indusk-mcp/test-fixtures/worktree-visibility-smoke.md`: T7
      (default plan → worktree exists), T8 (`worktree: none` → no worktree), T9 (catchup surfaces
      worktree/branch + collision).

#### Phase 3 Verification
- [ ] T7 / T8 / T9 run via the manual smoke procedure (mark `passing` after Sandy's run, or
      `blocked` with reason if deferred).

#### Phase 3 Context
- [ ] Update CLAUDE.md Current State: worktree-visibility shipped — bulletin shows worktree/branch,
      collision flag, worktree-per-plan default at impl kickoff (`worktree: none` opt-out).

#### Phase 3 Document
- [ ] Update `apps/docs/src/guide/multi-agent.md` (worktree/branch in bulletin + collision flag) and
      the worktree-setup guide (worktree-per-plan default + opt-out); update the multi-agent
      sequence/state diagram; add the changelog entry; publish ADR to
      `apps/docs/src/decisions/worktree-visibility.md`.

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
