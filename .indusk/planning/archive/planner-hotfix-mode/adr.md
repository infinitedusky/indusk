---
title: "Planner Hotfix Mode"
date: 2026-07-01
status: accepted
---

# Planner Hotfix Mode

## Goal

**Add a fifth planner workflow, `hotfix`, that lets a fix ship before any plan document exists, then structurally forces the paperwork back through a mandatory, fully-gated backfill phase — without inventing any new enforcement mechanism.**

Today a production-down bug has two bad options: go through `bugfix`'s ceremony (brief + test plan before any code — too slow for a real emergency), or get fixed entirely off-plan, with no plan folder, no gate, and nothing tracking that tests/docs still owe. This ADR gives that second path a name, a template, and a forcing function it currently lacks.

## Y-Statement

**In the context of:**
production-down or urgent bugs where the normal bugfix workflow's ceremony — a brief and a test plan authored before any code exists — is too slow to be realistic, and the actual fallback today is fixing the bug entirely off-plan with no tracked commitment to return and add tests, docs, or review.

**Facing:**
the tension between shipping fast (skip planning, ship now) and this project's standing discipline that every change earns verification, context, and document gates. If hotfix mode makes skipping too easy, it stops being a bounded emergency valve and becomes a permanent escape hatch from that discipline — used whenever ceremony feels inconvenient, not only when production is actually down.

**We decided for:**
a fifth workflow type, `hotfix`, whose plan folder is created retroactively — only `impl.md`, no brief, test plan, or ADR — with a fixed three-phase shape. Phase 1 (Ship) documents the fix that already shipped, with every required gate section explicitly deferred (`skip-reason: hotfix — deferred to Phase 2 backfill`) under `gate_policy: auto`. Phase 2 (Backfill) is a mandatory phase carrying real trajectory rows (the regression test proving the bug is `Writable at: Phase 0`, `Passes at: Phase 2`) and real verification/document gates. Phase 3 (Close) is a trivial single-item phase whose sole purpose is to not be Phase 2 — `check-gates.js`'s Gate B only inspects a phase's trajectory rows when a *later* phase's implementation item is checked, so without a trailing phase, nothing would ever force Backfill's rows to reach `passing` before the plan is done (verified empirically; see Research and the correction note below). With Phase 3 present, checking its one item triggers Gate B's existing, unmodified inspection of Phase 2's rows — confirmed blocking when unresolved, confirmed passing when resolved. `/falsify` and `/retrospective` run against the completed plan exactly as they would for any other workflow — just later in wall-clock time. Branch convention is a new, distinct `hotfix/{slug}` pattern (not `fix/{slug}`, not a worktree), created in the current working directory with in-progress work protected by a stash or safety commit.

**And against:**
a CLI/config-based tracking surface (e.g. `indusk hotfix status`) decoupled from the plan lifecycle — rejected because it stands up a second enforcement system next to one that already exists, and nothing structurally forces anyone to consult it. Isolating hotfix work in a worktree via the `indusk-worktree-extension` — rejected because that extension's setup ceremony (`apply_commits[]` file overlay, Doppler env provisioning, optional service spin-up) is real cost that fights the "as fast as possible" goal, and the extension is opt-in and unavailable on most projects (including dusk itself). A new `gate_policy` value or a new trajectory mechanic purpose-built for hotfix — rejected because `gate_policy: auto` and the existing Phase-0 rule for reported-bug regression tests already model this exact shape; inventing new mechanism would solve a problem the system doesn't have.

**To achieve:**
a sanctioned, bounded fast path for genuine emergencies that ships as fast as an off-plan fix would today, while guaranteeing — via the same phase-close enforcement the rest of the project already relies on — that tests, docs, and falsification happen afterward instead of never.

**Accepting:**
two hook files (`check-gates.js`, `validate-impl-structure.js`) each independently hardcode their own workflow-name regex and gate-requirements map with no shared TS source between them — this plan adds a fifth, duplicated entry to both rather than fixing the duplication. A hotfix's Phase 1 commits land in git before any plan file exists, so the eval agent's per-commit scorecard has no plan context for that window — an accepted traceability gap in exchange for speed. And: nothing structurally prevents an agent from marking a Phase 2 trajectory row `skipped` without genuine justification, which would defeat the backfill intent — a pre-existing, systemic property of the trajectory system (not unique to hotfix, not fixed here).

**Because:**
the fastest way to get *more* discipline out of an emergency is not more process at the moment of the emergency — it's a mandatory later phase that reuses enforcement the team already trusts, rather than either fighting the emergency's urgency with ceremony it will route around, or inventing a parallel bureaucracy nobody is structurally required to check. The trailing Close phase is the cheapest possible way to reuse that enforcement correctly, once it became clear (mid-implementation, via the same test-first discipline this ADR is trying to protect) that a two-phase shape would have quietly not delivered on that promise.

## Context

See `research.md` for the hook-level findings (duplicated workflow dispatch across three files, `gate_policy: auto`'s existing write-time skip-reason support, Gate B's row-targeting behavior, the Phase-0 trajectory rule for reported bugs) and `brief.md` / `test-plan.md` for the proposed flow and the eight behavioral assertions this ADR's decision must satisfy.

## Decision

1. **New workflow value `hotfix`**, recognized in three places:
   - `apps/indusk-mcp/skills/planner.md` — added to the workflow dispatch table and `argument-hint`, with a new step describing the retroactive, three-phase flow.
   - `apps/indusk-mcp/hooks/check-gates.js` — `detectWorkflow` regex gains `hotfix`; `WORKFLOW_GATES_BASE` gains `hotfix: ["verification", "document"]` — otel is unconditionally excluded (the array simply never contains `"otel"`), exactly matching `bugfix`'s existing entry. Correction from an earlier draft of this ADR: the `otelGateEnabled` filter only ever *removes* `"otel"` from arrays that already contain it (feature/refactor); it never adds otel to bugfix/spike, so bugfix's otel exclusion is unconditional, not conditional. Hotfix inherits the identical unconditional exclusion.
   - `apps/indusk-mcp/hooks/validate-impl-structure.js` — same regex addition; its inline map gains `hotfix: { verification: true, otel: false, context: false, document: true }` (matching `bugfix`'s literal `otel: false`, not `otelGateEnabled`).
2. **`apps/indusk-mcp/skills/git.md`** — new `hotfix/{slug}` row in the branch naming table, plus prose: stash-or-safety-commit to protect in-progress work, branch off `main` in the current working directory, explicitly not a worktree.
3. **Hotfix impl.md template** (embedded in `planner.md`, not a separate file — no `templates/workflows/` directory exists in this package) sets `workflow: hotfix`, `gate_policy: auto`, `trajectory: required` in frontmatter, and shows the three-phase skeleton (Phase 1 Ship — all-deferred; Phase 2 Backfill — mandatory, real trajectory rows and gates; Phase 3 Close — trivial single item, exists solely so Backfill isn't terminal and Gate B actually inspects its rows).
4. **`hotfix-shipped` highlight** fired when the retroactive plan folder is created (right after the PR merges), alongside the existing brief-accepted/test-plan-accepted/adr-accepted triggers.
5. **No changes** to `/falsify` or `/retrospective` — both already operate on "terminal phase of a plan" without reference to workflow type.
6. **No changes** to the trajectory validator/parser, no new `gate_policy` value, no worktree-extension integration, no CLI tracking surface.

## Alternatives Considered

### CLI/config-based backfill tracker (`indusk hotfix status`), decoupled from the plan lifecycle
Would let a hotfix ship with literally zero documentation at merge time, with a separate surface nagging about outstanding backfill later. Rejected: it's a second enforcement system running in parallel with the one `check-gates.js` already provides, and nothing forces anyone to run or heed it — exactly the "permanent excuse to skip quality" failure mode this ADR is trying to avoid.

### Worktree-based isolation for hotfix work
Would keep the primary working directory untouched during an emergency fix. Rejected on cost: the worktree *extension's* setup script does file-overlay + env provisioning + optional service spin-up, none of which is appropriate for a five-minute patch, and the extension isn't enabled on most projects (confirmed: not enabled on dusk itself). Raw `git worktree add` without the extension's ceremony was considered and rejected too, on scope grounds — it would introduce a second isolation mechanism (worktree vs. stash-and-branch) for the same problem the stash-and-branch flow already solves adequately.

### New `gate_policy` value (e.g. `gate_policy: hotfix`) or a phase-scoped gate policy
Would let Phase 1 defer everything while Phase 2 enforces strictly, without relying on the document-wide `auto` setting. Rejected: `gate_policy` is already document-wide by design, and `auto` already permits exactly the write-time skip-reasons Phase 1 needs; a phase-scoped policy would be new mechanism solving a problem `auto` + Gate B's row-targeting logic already solve together.

### Reuse `fix/{slug}` instead of a new `hotfix/{slug}` branch pattern
Simpler — no new convention to document. Rejected per discovery: loses the ability to structurally distinguish "this was a genuine hotfix" from an ordinary off-plan bugfix in git log / PR titles / any future automation that wants to key off it.

### Skip falsification and retrospective for hotfixes entirely
Would match the "speed over ceremony" framing most aggressively. Rejected per discovery: risks hotfix becoming the permanent bypass of the falsification discipline the rest of the project treats as load-bearing — the existing bugfix/refactor workflows already allow *skipping retrospective for small changes at the user's discretion*, which is a sufficient escape valve without exempting hotfix by default.

## Consequences

### Positive
- Gives the "just fix it and skip the ceremony" behavior that already happens informally a sanctioned name, a template, and — critically — a forcing function it doesn't currently have.
- Adds zero new enforcement code paths beyond workflow-name registration: `gate_policy: auto` and the Phase-0 trajectory rule are reused exactly as designed, not extended.
- `hotfix/{slug}` and `workflow: hotfix` are both grep-distinguishable, giving any future automation (backfill reminders, hotfix-rate tracking in master.md-style rollups) a clean signal.

### Negative
- `check-gates.js` and `validate-impl-structure.js` continue to duplicate the same workflow-gate-requirements table independently — this ADR adds a fifth entry to both rather than resolving the duplication (flagged in Research as a separate, out-of-scope refactor).
- Eval-agent traceability has a gap during the window between the hotfix's first commit and the retroactive plan folder's creation — commits in that window carry no plan context in their scorecards.

### Risks
- **Hotfix mode gets used for non-emergencies, eroding bugfix's discipline.** Mitigation: none structural — this is a social/review-time control. The distinct branch name and plan shape at least make hotfix usage visible in PR review and in any planning rollup.
- **Phase 2 (Backfill) never actually happens.** Mitigation: the Phase 3 (Close) trigger makes `check-gates.js`'s existing Gate B genuinely block the plan from reaching a completed state while Backfill's trajectory rows are unresolved — verified empirically, not assumed. This mitigation only works *because* of the three-phase shape: an earlier two-phase design (Ship, Backfill-as-terminal) was found, mid-implementation, to have Gate B silently not apply to Backfill's own rows at all (see Research). The plan sits visibly incomplete in `.indusk/planning/` (and in admin-ui, once that reads trajectory state) rather than quietly disappearing.
- **The general Gate B gap this plan uncovered — a terminal phase's own trajectory rows are never inspected — exists for every OTHER plan in this system already, not just hotfix.** Out of scope to fix here (would mean changing shared hook logic that every existing plan depends on), but real and worth a standing CLAUDE.md Known Gotcha so a future plan doesn't rediscover it the hard way, and worth considering as its own small fix later (e.g., extending Gate B's `closingPhase` loop to include the advancing phase itself).
- **A bad-faith Phase 2 marks its trajectory rows `skipped` without real justification.** Mitigation: none added by this plan — pre-existing, systemic gap in the trajectory system (see Notes in `test-plan.md`), out of scope here.

## Documentation Plan

### Pages
- **Update**: `apps/docs/src/reference/skills/plan.md` — its existing `## Workflow Types` section (table of four types + Mermaid decision diagram) gains a fifth `hotfix` row and an updated diagram branch.
- **Update**: `apps/indusk-mcp/skills/git.md` — new `hotfix/{slug}` branch pattern (this is also the skill file itself, synced to consumers via the existing `globSync("*.md")` mechanism — counts as both implementation and documentation).

### Diagrams
- Update the existing Mermaid decision diagram in `reference/skills/plan.md` (`## Workflow Types` section) to add the `hotfix` branch — no new standalone diagram needed.

### Changelog
- One entry: "Added `hotfix` planner workflow — ship-first, backfill-mandatory fast path for production-down bugs."

### ADR in Docs
- Yes — publish to `apps/docs/src/decisions/planner-hotfix-mode.md`, following the same pattern as `git-only-substrate` and `rationale-baseline-frontmatter`.

## References
- `.indusk/planning/planner-hotfix-mode/research.md`
- `.indusk/planning/planner-hotfix-mode/brief.md`
- `.indusk/planning/planner-hotfix-mode/test-plan.md`
- `.indusk/planning/archive/tests-first-planning/adr.md` (Test Trajectory design, Phase-0 rule origin)
- `.indusk/planning/archive/rationale-baseline-frontmatter/adr.md` (contrast case — `rationale_baseline` solves a different-shaped problem than hotfix's Phase-0 reuse)
- `apps/indusk-mcp/skills/git.md`, `apps/indusk-mcp/skills/planner.md`, `apps/indusk-mcp/hooks/check-gates.js`, `apps/indusk-mcp/hooks/validate-impl-structure.js`
