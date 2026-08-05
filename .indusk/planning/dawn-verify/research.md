---
title: "Dawn Verify — Verification of work Dawn didn't do"
date: 2026-08-04
status: complete
---

# Dawn Verify — Research

## Question

Dawn's master plan calls component 6 **the keystone**: *"The whole integration strategy rests on one untested assumption — phase-boundary verification is sufficient enforcement when Dawn doesn't control the agent."*

This research answers three things before any direction is proposed:

1. **What must `atdawn verify` actually catch?** The master names three classes: premature checkoff, goalpost drift, red tests.
2. **What already exists that verify can reuse, and what is genuinely missing?**
3. **Where does the "before" state come from**, given the defining constraint — Dawn was not running when the work happened.

## Findings

### 1. The constraint that makes this a different problem

Every enforcement Dawn has today is **in the write path**. `check-gates` is a `PreToolUse` hook: it receives `{tool_name, tool_input, cwd}`, sees an *old string and a new string*, computes which checkbox just flipped, and exits 0 or 2 *before the edit is applied*. The atdawn loop's gate (`src/lib/run/gate.ts`) is the same contract with a different invoker.

Component 6 removes that seam. The work happened in Cursor, or in a plain `claude` session with no hooks, or by hand. By the time verify runs:

- the edits are already applied,
- the checkboxes are already `[x]`,
- there is no `old_string`/`new_string` pair to diff,
- and there is no in-process snapshot of what the trajectory looked like before.

**Confidence: high.** This is the structural difference, and it's why verify is a new command rather than a flag on `run`. Everything Dawn enforces today is *prevention*; component 6 is *detection after the fact*, over committed state.

### 2. Three of the five detections already have working machinery

| Detection | Status | Where it lives |
|---|---|---|
| Premature checkoff (a phase advanced while a prior phase's gate items sit unchecked) | **Exists, reusable as-is** | `check-gates.js` "Gate B", reached via `probePhaseClose` |
| Test-first duty skipped (a row still `planned` at its `Writable at` phase) | **Exists, reusable as-is** | `check-gates.js` "Gate A", same path |
| Goalpost drift (Asserts edited, `Passes at` deferred, row deleted, self-assigned terminality) | **Exists, but in-process only** | `checkGoalposts` / `snapshotTrajectory` in `src/lib/run/goalposts.ts` |
| **Red tests** — a row marked `passing` whose test does not pass | **Missing entirely** | nowhere |
| **Phantom work** — an item checked off with no corresponding code change | **Missing entirely** | nowhere |

**The single most important reusable asset is `probePhaseClose`** ([probe.ts](apps/indusk-mcp/src/lib/run/probe.ts)). It already solves the hard half of "run an edit-triggered hook against committed state": it writes a temp copy of the impl with a *synthetic* `Phase N+1` containing one unchecked item, then feeds `check-gates` an envelope that checks that item off. The hook answers the question *"would you allow the next phase to advance?"* against the real current content. That is exactly a static verifier over already-committed state, built for a different reason (the loop not trusting the model's self-report) and directly applicable here.

It has one non-obvious subtlety already handled: rows *writable* at N+1 are the next phase's duty, not part of phase N's greenness, so the probe copy neutralizes them to `skipped` before asking. Reimplementing this would reintroduce that bug.

Blast radius for reuse is small: `probe` has 1 non-test importer, `goalposts` 2, `trajectory/parser` 2. Nothing here is load-bearing across the codebase in a way that makes extension risky.

### 3. The gap that matters most: `passing` is an unverified self-report

**Nothing in the entire system ever executes a test as part of gate enforcement.** I grepped the whole `src/lib/run/` tree: the only subprocesses spawned are `git` (commit cadence) and the gate scripts themselves. `check-gates` reads the impl's markdown and checks that State cells say `passing`. It never runs the suite.

In the atdawn lane this is partly covered by the goalpost guard: `checkGoalposts` forbids flipping a row to `skipped`/`blocked` mid-phase, because that's a model declaring its way out of a test. But it **explicitly allows** `planned → written → passing` as "honest forward progress." So a model — or a human, or Cursor — can write the word `passing` into a State cell while the test is red, and every gate in the system says green.

This is the most consequential finding in this research. The trajectory's entire credibility rests on a string in a markdown table that no machine has ever checked against reality. Component 6 is the first place that gets closed, and the master's acceptance test names it directly ("red tests").

**Confidence: high** — verified by exhaustive grep of the run library plus reading `check-gates.js` end to end.

A related consequence: the project *does* already declare how it verifies itself. `.indusk/config.json` carries a `verify` block (`testRunner: vitest`, `linter: biome`, `typeCheck: tsc`), and `src/lib/config.ts` types it — but the only consumer is `init.ts` writing it during detection. **No code reads it to run anything.** The `/verify` skill reads it as instructions for a human/agent to follow. So a verify command that executes tests would be the first real consumer of a config surface that has existed unused.

### 4. Phantom work — the detection nobody has named yet

The master's list is premature checkoff / goalpost drift / red tests. Investigating the code surfaces a fourth that the git before-snapshot makes almost free:

**An item checked off with no corresponding change in the diff.** Today a Cursor session can flip six checkboxes and write no code; every trajectory row was already `passing` from a prior phase, no gate item is unchecked, no goalpost moved, tests are green — and all five existing detections pass. The work simply didn't happen.

This is only detectable with a before-snapshot, which component 6 introduces anyway. Worth naming explicitly rather than discovering later.

### 5. The baseline problem — four candidate mechanisms

Verify needs a "before" to compare against. Since Dawn wasn't running, it must be reconstructed from the repo. Four options, compared:

**A. Explicit two-call protocol** — `atdawn verify --snapshot` before dispatch, `atdawn verify --phase N` after.
Honest and simple. Fatally fragile in exactly the case it's for: it depends on a human remembering a ceremony *before* handing work to an agent Dawn doesn't control. A forgotten snapshot means no verification, silently.

**B. Infer from git history** — find the last commit touching `impl.md` before the phase's work.
No ceremony, but the assumption "the external agent committed at sensible boundaries" is precisely what cannot be assumed about work Dawn didn't run. Squashed commits, one giant commit, or no commits at all all break it.

**C. Chained verify ledger** — each successful verify records `{phase, sha, trajectory-hash}`; the next verify uses the previous record as its baseline; the first bootstraps from the merge base with the trunk.
No pre-dispatch ceremony (the baseline is a *byproduct* of the previous verification), degrades honestly (a missing link is visible, not silent), and matches two patterns already in the codebase: the append-only JSONL ledger (`pending-evals.ts`) and the merge-base candidate-fallback chain in `cleanup/oversized.ts` (`baseRef` → `origin/main` → `main` → `origin/master` → `master`), which exists because `origin/main` alone silently yielded an empty diff on an unfetched remote.

**D. Signed phase-close records** — only works if Dawn wrote them, which is the case component 6 exists to handle. Circular; rejected.

**C is the strongest**, with A available as an optional strengthener for the paranoid case. **Confidence: moderate-to-high** — the reasoning is sound and the precedents are in-repo, but the bootstrap case (first verify on a plan with a messy history) needs to be proven, not assumed.

### 6. "Revert to snapshot — never rewrite history"

The master's tier-3 rung says the enforcement is *"phase-boundary verification + reject-and-rerun: git before-snapshot, catch premature checkoff / goalpost drift / red tests, revert to snapshot — never rewrite history."*

That last clause rules out `git reset --hard`. The git-safe shapes are `git revert` (a new commit undoing the range) or restoring the working tree to the baseline while leaving history intact. There's a hard-won in-repo precedent for the underlying lesson: during `dawn-hook-parity`'s falsification, hypothesis A11 was **refuted mid-fix** on exactly this ground — `git reset` unstages but cannot un-write the working tree, so the assertion had to be reframed as "whatever a commit contains, its message accounts for." Any revert design here inherits that constraint: **what has been written cannot be unwritten, only accounted for.**

There is also a scope question the master leaves genuinely open: whether "reject-and-rerun" belongs to component 6 at all, or whether 6 delivers the *verdict* and component 7 (agent integration) owns the *re-dispatch*. Verify-as-detector is independently useful, composable, and testable; verify-as-actor couples the keystone to agent plumbing that doesn't exist yet. This is the main fork the brief must settle.

### 7. Where the command attaches

`atdawn` is one of three bin aliases (`indusk`, `dev-system`, `atdawn`) all pointing at `dist/bin/cli.js`. `run` is registered at [cli.ts:335](apps/indusk-mcp/src/bin/cli.ts#L335) with a lazy `await import("./commands/run.js")`. A `verify` command follows the identical shape — one commander registration, one `src/bin/commands/verify.ts`, lazily imported.

Exit-code convention is already established by `run`: `0` = clean, `3` = paused at a human gate, `1` = stopped loud. Verify needs its own vocabulary but should not contradict this.

## Open Questions

- **Does verify act, or only report?** (§6) — the primary scope fork; determines whether component 6 can close without component 7.
- **How is the test command resolved?** The `verify` block in `.indusk/config.json` names tools, not runnable commands. Deriving `vitest` → `pnpm test` is a guess; a project with a 10-minute suite also makes "verify runs the suite" expensive at every phase boundary.
- **Can a red test always be attributed to a trajectory row?** Detecting "the suite is red" is easy; detecting "row T7 claims `passing` but *its* test is red" requires mapping rows to test names or files. The trajectory table has no test-name column today (`Kind`/`Scope` are optional and free-text).
- **What is the bootstrap baseline** for the first verify on a plan whose history predates the ledger?
- **Does verify need to work on uncommitted state?** An external agent may leave work in the working tree, never committed.

## Sources

- `.indusk/planning/indusk-v2-dawn/master.md` — component 6 row, the Order section, the enforcement ladder (tiers 1–3)
- `.indusk/planning/indusk-v2-dawn/maxims.md` — esp. maxim 1 (make agentic output trustworthy), 4 (earn its weight), 5 (evidence over assertion)
- `.indusk/planning/indusk-v2-dawn/positioning.md` — "their column is *status*; Dawn's column is *evidence*"; the checkbox-as-enforcement-surface constraint
- `apps/indusk-mcp/src/lib/run/probe.ts` — the reusable static-verification primitive
- `apps/indusk-mcp/src/lib/run/goalposts.ts` — drift detection, and the states it deliberately allows
- `apps/indusk-mcp/hooks/check-gates.js` — Gate A / Gate B, gate-policy override semantics
- `apps/indusk-mcp/src/lib/cleanup/oversized.ts` — merge-base candidate-fallback precedent
- `apps/indusk-mcp/src/lib/run/pending-evals.ts` — append-only JSONL ledger precedent
- `.indusk/planning/archive/dawn-hook-parity/` — the A11 refutation (revert semantics)
