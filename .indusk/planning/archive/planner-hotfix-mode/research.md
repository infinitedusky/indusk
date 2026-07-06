---
title: "Planner Hotfix Mode"
date: 2026-07-01
status: complete
---

# Planner Hotfix Mode — Research

## Question

The planner skill currently has four workflow types (`feature`, `bugfix`, `refactor`, `spike`), each with a fixed document set and a fixed per-phase gate requirement. Can a fifth type — `hotfix` — be added for production-down / urgent-bug scenarios where the fix ships (branch pushed, PR open) before any planning docs exist, with docs and tests backfilled afterward? What existing machinery does this interact with, and does it require new enforcement code or just a new usage pattern of what's already there?

## Findings

### Workflow dispatch is a hardcoded, duplicated pattern across three files

The workflow type isn't a single source of truth — it's parsed independently in three places, each with its own regex and its own per-workflow requirements table:

1. **`apps/indusk-mcp/skills/planner.md`** (prose, drives the working agent) — parses the first word of `/planner {word} {name}` against a literal list (`bugfix`, `refactor`, `spike`, `feature`), defaults to `feature`.
2. **`apps/indusk-mcp/hooks/check-gates.js:119`** — `content.match(/workflow:\s*(bugfix|refactor|feature|spike)/)`, defaults to `"feature"` if no match. Feeds `WORKFLOW_GATES_BASE` (`check-gates.js:147-152`):
   ```js
   const WORKFLOW_GATES_BASE = {
     feature: ["verification", "otel", "context", "document"],
     refactor: ["verification", "otel", "context", "document"],
     bugfix: ["verification", "document"],
     spike: [],
   };
   ```
   This list is what Gate A (phase-start completeness) and Gate B (phase-close trajectory-terminal check) enforce per phase.
3. **`apps/indusk-mcp/hooks/validate-impl-structure.js:148`** — same regex, same default, its own inline map (line 156-160):
   ```js
   {
     feature: { verification: true, otel: otelGateEnabled, context: true, document: true },
     refactor: { verification: true, otel: otelGateEnabled, context: true, document: true },
     bugfix: { verification: true, otel: false, context: false, document: true },
     spike: { verification: false, otel: false, context: false, document: false },
   }[workflow]
   ```

There is no shared TS module backing either hook (grepped `apps/indusk-mcp/src/lib/` for `WORKFLOW_GATES` / workflow-requirements shape — no hits). Both are standalone JS, each duplicating the same table. **Adding `hotfix` requires editing both hook files** (new regex branch + new map entry each), plus the prose in `planner.md`. This is small (a handful of lines per file) but is real code, not just documentation — confirms this plan needs more than a one-paragraph brief.

If an unrecognized workflow value is written to frontmatter (e.g. `workflow: hotfix` before either hook knows about it), both hooks silently fall through to their `"feature"` default — the *strictest* gate set (all four categories required every phase). Not a crash, but the opposite of what hotfix mode wants.

### `gate_policy: auto` already allows write-time skip-reasons — no new opt-out mechanism needed

From `validate-impl-structure.js:82-101`: gate policy is read from (in order) the impl's own frontmatter, the previous version of the file being edited, then `.indusk/config.json`'s `indusk.gate_policy`, defaulting to `"ask"`.

- `strict` / `ask`: `(none needed)` and `skip-reason:` are rejected at write time — the hook blocks the edit. Opt-outs can only happen later, during `/work` execution.
- `auto`: `(none needed)` / `skip-reason:` are accepted at write time.

This is exactly what a retroactively-authored Phase 1 needs: the fix already shipped with no tests/docs, so the impl.md being written *after the fact* has to be allowed to say `skip-reason: hotfix — deferred to Phase 2 backfill` on every required gate section, immediately, at file-creation time. `gate_policy: auto` already permits this. No new frontmatter value or hook branch is needed for the opt-out itself — only for recognizing `hotfix` as a workflow name at all (see above).

### Gate B (phase-close) only checks trajectory rows whose `Passes at` targets the closing phase

From `check-gates.js:300-309` (comments) and the logic at 320-375: closing Phase N requires every trajectory row with `Passes at: Phase K` (K ≤ N) to be `passing`, `skipped`, or `blocked`. A phase with **zero** rows targeting it has nothing to satisfy — it closes cleanly regardless of workflow-gate-section requirements (those are a separate check, satisfied via `gate_policy: auto` skip-reasons as above). This means: if every trajectory row in a hotfix plan has `Passes at: Phase 2`, Phase 1 can close immediately once its (skip-reasoned) gate sections exist — no special-casing needed in Gate B.

### The Test Trajectory system already has a rule that fits "test conceived before the fix, confirmed after backfill"

Per the existing trajectory-authoring discipline (`tests-first-planning` ADR, mirrored in `planner.md`): *"Regression tests for reported bugs: `Writable at: Phase 0` (the stack runs, the bug is reproducible today, no plan code needed to author). Passes at = the phase that lands the fix."* Phase 0 rows need no `### Trajectory Rationale` entry (the subsection is only required for rows with `Writable at` later than Phase 0).

Applied to hotfix: the regression test proving the bug exists is `Writable at: Phase 0` (true before the fix, before the plan file exists) and `Passes at: Phase 2` (the backfill phase, which is when it's actually authored and run — later than the fix itself, since the fix in Phase 1 shipped without it). This is a slightly unusual but structurally legal use of the existing rule — no new trajectory mechanic required, and no rationale-subsection obligation triggers since the row never claims `Writable at > Phase 0`.

### `rationale_baseline` frontmatter exists but doesn't fit this shape

`rationale_baseline: N` (from the `rationale-baseline-frontmatter` plan) exempts rows with `Writable at ≤ N` from rationale — built for "Phase 1 IS the enabling work" cases (schema migrations, scaffolding) where tests genuinely can't be authored before plan code lands. Hotfix is the opposite: the regression test *could* have been authored at Phase 0 (bug is real, reproducible, no plan code needed) — it just wasn't, because the fix outran the paperwork. Using Phase 0 correctly (not `rationale_baseline`) keeps the trajectory honest about *when the test could have existed* versus *when it actually got written*.

### Branch and worktree conventions (`apps/indusk-mcp/skills/git.md`)

Existing branch pattern table (git.md):
```
plan/{plan-name}-phase-{n}   — plan-driven impl work
fix/{slug}                   — bugfixes outside a plan
spike/{slug}                 — exploratory spikes
chore/{slug}                 — tooling, deps, lint config
```
No `hotfix/{slug}` entry exists yet. `fix/{slug}` already covers "bugfix outside a plan" — a hotfix is a specific, faster-and-riskier subtype of that, and the user wants it structurally distinguishable (confirmed in discovery: new `hotfix/{slug}` pattern, not reuse of `fix/{slug}`), so that future automation (eval-trigger, a backfill-reminder check) can grep for it.

The `indusk-worktree-extension`'s `setup-worktree.sh` does more than `git worktree add` — it also runs the `apply_commits[]` file-overlay and (per the worktree skill) can trigger env provisioning via Doppler and start pm2/docker services. That ceremony is designed for durable side-by-side dev environments, not a five-minute emergency patch. Raw `git worktree add` (no extension) is cheap (shared object store, no clone) but dusk itself doesn't have the worktree extension enabled (`.indusk/extensions/` has no `worktree` entry), and the extension is opt-in per project — a hotfix-mode design that assumed it would only work on the subset of projects that opted in. Confirmed direction (discovery): default to a plain branch off `main` in the current working directory (stash or WIP-safety-commit to protect in-progress work), not a worktree.

### Falsification + retrospective gating

`retrospective.md`'s Step 0 (Falsification Gate) blocks on `isFalsificationComplete(planRoot)` OR `falsification: skipped` + `falsification_reason` frontmatter, OR (post-`/falsify`-as-phase-author, 1.27.4+) "all impl phases terminal." None of these mechanisms care about workflow type — a hotfix plan's Phase 2 close still needs `/falsify` before `/retrospective` runs, exactly like any other plan. Confirmed direction (discovery): falsification/retrospective still required, just deferred until after Phase 2 backfill lands — no change needed here, it's just later in wall-clock time than for other workflows.

### Gate B does not enforce a plan's terminal phase's own trajectory rows (discovered mid-impl, empirically verified)

`check-gates.js`'s Gate B (phase-close trajectory check) only inspects a phase's `Passes at` rows when a *later* phase's implementation item is checked off (`for (let closingPhase = 1; closingPhase < advancingPhase; closingPhase++)`). Verified with two live fixtures spawned against the real hook:

- A 2-phase hotfix-shaped plan: checking off Phase 2's own implementation item, with its own `Passes at: Phase 2` row still `planned` — **exit 0, not blocked.**
- A vanilla 3-phase plan: checking off Phase 3's own item with its own row still `planned` — blocked, but by Gate A (test-first authoring: the row's `Writable at: Phase 3` requires state ≥ `written` before Phase 3's implementation items close), not Gate B. Bumping the row to `written` (red test exists, not passing) — **exit 0, not blocked.**

Consequence: a plan's terminal phase's own trajectory rows are never inspected by Gate B, because there is no "next phase" checkbox-check to trigger that inspection. Gate A forces the row to be *authored* (state ≥ `written`) but never forces it to *pass*. This means CLAUDE.md's existing claim — "the check-gates hook enforces phase-close structurally, deferral is impossible by construction" — holds for every non-terminal phase and is **false for the last phase of any plan**, not just a hotfix's backfill phase. This gap pre-dates hotfix mode and applies to every plan using Test Trajectory today; it was simply never exercised because the failure mode ("does the LAST phase's own rows get checked") isn't something anyone had reason to test until a workflow whose entire value proposition rests on that exact guarantee (hotfix mode) came along.

**Workaround verified working (no hook code changes):** if the phase carrying the real trajectory rows (`Backfill`) is *not* the terminal phase — i.e., a trivial `Close` phase follows it, with a single implementation item whose checking triggers the "next phase" mechanism — Gate B correctly fires and blocks. Verified with a live fixture: `Backfill`'s row at `written` (red) → checking `Close`'s item → **blocked** (`exit 2`, correct error naming the row); same row at `passing` → checking `Close`'s item → **exit 0, allowed**. This is the basis for reshaping the hotfix template to three phases (Ship → Backfill → Close) rather than two.

## Open Questions

- Should hotfix's gate-requirement map (in both hooks) mirror `bugfix`'s (`verification` + `document` required; `otel` conditional; `context` not required), or is `context` worth requiring given hotfixes often reveal something systemic worth a Known Gotchas entry? Proposed in brief; user to confirm.
- Should creating the retroactive plan folder fire an `mcp__indusk__highlight` (e.g. tag `hotfix-shipped`) so the eval agent captures a Graphiti episode for "a hotfix went out," mirroring the existing brief-accepted/adr-accepted triggers? Not yet decided — no existing trigger covers a plan whose Phase 1 predates the plan file's existence.
- Exact wording/shape of the `hotfix/{slug}` branch documentation in `git.md`, and whether `fix/{slug}` prose needs a cross-reference distinguishing the two.

## Sources

- `apps/indusk-mcp/hooks/check-gates.js`
- `apps/indusk-mcp/hooks/validate-impl-structure.js`
- `apps/indusk-mcp/skills/planner.md`
- `apps/indusk-mcp/skills/git.md`
- `apps/indusk-mcp/skills/retrospective.md`
- `.indusk/planning/archive/tests-first-planning/adr.md`
- `.indusk/planning/archive/rationale-baseline-frontmatter/adr.md`
- `.indusk/config.json`, `.indusk/extensions/` (dusk's own project state)
