# Worktree Visibility — Manual Smoke Procedure

Covers trajectory rows **T7, T8, T9** — the skill-driven kickoff behavior that can't be asserted in
vitest (LLM-executed prose). Run against a real workbench-shaped project with the worktree extension
enabled and a built/installed `indusk` (`pnpm --filter indusk-mcp build`, or a global install at the
version under test).

Prereq: a workbench project where `.indusk/` lives at the workbench root and the trunk is a child git
repo (dusk itself qualifies). Two terminals simulate two sessions; set `CLAUDE_CODE_SESSION_ID` to a
distinct UUID in each.

---

## T7 — default plan creates a worktree at `/work` kickoff

1. Author a throwaway plan with `/planner feature smoke-default` and accept through to an impl whose
   frontmatter has **no** `worktree:` key.
2. From the **trunk**, run `/work smoke-default`.
3. **Expect:** before editing any code, `/work`'s Worktree Kickoff nudges to run
   `indusk worktree create smoke-default` (because `resolveWorktreeDecision` → `create` and
   `detectTreeContext` → `trunk`).
4. Accept the nudge. **Expect:** a new worktree exists (`git worktree list` shows it) and its env is
   provisioned, before the first code file is touched.

**Pass:** a worktree for the plan exists prior to any code edit. **Fail:** `/work` edits code in the
trunk with no worktree and no nudge.

## T8 — `worktree: none` plan proceeds in place

1. Author a plan whose impl frontmatter includes `worktree: none`.
2. From the trunk, run `/work` on it.
3. **Expect:** no worktree nudge; `/work` proceeds in the current tree (`resolveWorktreeDecision` →
   `skip`).

**Pass:** no worktree is created and no nudge fires. **Fail:** a worktree nudge appears despite the
opt-out.

## T9 — catchup surfaces worktree/branch + collision

1. Terminal A (session UUID A): `cd` into the **trunk**, run `indusk agent register --task "sess A"`.
2. Terminal B (session UUID B): `cd` into the **same trunk**, run `indusk agent register --task "sess B"`.
3. In either terminal, run `/catchup` (or `indusk agent list`).
4. **Expect:** the bulletin shows both sessions with their `WORKTREE` + `BRANCH`, and a
   `⚠ collision: 2 sessions share worktree …` warning appears; `/catchup`'s summary surfaces it.
5. Move session B into its own worktree (`indusk worktree create smoke-b`, `cd` there,
   `indusk agent register --task "sess B"` again), then re-run `indusk agent list` from A.
6. **Expect:** no collision warning — the two sessions now report different worktrees.

**Pass:** collision flag appears when both share the trunk and disappears once separated; catchup
surfaces worktree/branch. **Fail:** no worktree/branch shown, or collision not flagged / not cleared.

---

After running, update the T7/T8/T9 `State` cells in
`.indusk/planning/worktree-visibility/impl.md` to `passing` (or `blocked` with a note if a step
fails).
