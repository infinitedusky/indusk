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
a fifth workflow type, `hotfix`, whose plan folder is created retroactively — only `impl.md`, no brief, test plan, or ADR — with a fixed three-phase shape. Phase 1 (Ship) documents the fix that already shipped, with every required gate section explicitly deferred (`skip-reason: hotfix — deferred to Phase 2 backfill`) under `gate_policy: auto`. Phase 2 (Backfill) is a mandatory phase carrying real trajectory rows (the regression test proving the bug is `Writable at: Phase 0`, `Passes at: Phase 2`) and real verification/document gates. Phase 3 (Close) is a trivial single-item phase whose sole purpose is to not be Phase 2 — `check-gates.js`'s Gate B only inspects a phase's trajectory rows when a *later* phase's implementation item is checked, so without a trailing phase, nothing would ever force Backfill's rows to reach `passing` before the plan is done (verified empirically, mid-implementation — see below). With Phase 3 present, checking its one item triggers Gate B's existing, unmodified inspection of Phase 2's rows — confirmed blocking when unresolved, confirmed passing when resolved. `/falsify` and `/retrospective` run against the completed plan exactly as they would for any other workflow — just later in wall-clock time. Branch convention is a new, distinct `hotfix/{slug}` pattern (not `fix/{slug}`, not a worktree), created in the current working directory with in-progress work protected by a stash or safety commit.

**And against:**
a CLI/config-based tracking surface (e.g. `indusk hotfix status`) decoupled from the plan lifecycle — rejected because it stands up a second enforcement system next to one that already exists, and nothing structurally forces anyone to consult it. Isolating hotfix work in a worktree via the `indusk-worktree-extension` — rejected because that extension's setup ceremony (`apply_commits[]` file overlay, Doppler env provisioning, optional service spin-up) is real cost that fights the "as fast as possible" goal, and the extension is opt-in and unavailable on most projects (including dusk itself). A new `gate_policy` value or a new trajectory mechanic purpose-built for hotfix — rejected because `gate_policy: auto` and the existing Phase-0 rule for reported-bug regression tests already model this exact shape; inventing new mechanism would solve a problem the system doesn't have.

**To achieve:**
a sanctioned, bounded fast path for genuine emergencies that ships as fast as an off-plan fix would today, while guaranteeing — via the same phase-close enforcement the rest of the project already relies on — that tests, docs, and falsification happen afterward instead of never.

**Accepting:**
two hook files (`check-gates.js`, `validate-impl-structure.js`) each independently hardcode their own workflow-name regex and gate-requirements map with no shared TS source between them — this plan adds a fifth, duplicated entry to both rather than fixing the duplication. A hotfix's Phase 1 commits land in git before any plan file exists, so the eval agent's per-commit scorecard has no plan context for that window — an accepted traceability gap in exchange for speed. And: nothing structurally prevents an agent from marking a Phase 2 trajectory row `skipped` without genuine justification, which would defeat the backfill intent — a pre-existing, systemic property of the trajectory system (not unique to hotfix, not fixed here).

**Because:**
the fastest way to get *more* discipline out of an emergency is not more process at the moment of the emergency — it's a mandatory later phase that reuses enforcement the team already trusts, rather than either fighting the emergency's urgency with ceremony it will route around, or inventing a parallel bureaucracy nobody is structurally required to check. The trailing Close phase is the cheapest possible way to reuse that enforcement correctly, once it became clear (mid-implementation, via the same test-first discipline this ADR is trying to protect) that a two-phase shape would have quietly not delivered on that promise.

## Context

`hotfix` slots in alongside the planner's existing four workflow types (`feature`, `bugfix`, `refactor`, `spike`), each with its own document set and gate-requirements shape. Workflow-name recognition turned out to be hand-duplicated across three places with no shared source (`check-gates.js`, `validate-impl-structure.js`, `planner.md`'s prose dispatch) — adding `hotfix` meant touching all three, not just documentation.

A significant mid-implementation discovery reshaped this ADR's core mechanism: `check-gates.js`'s phase-close check (Gate B) only inspects a phase's `Passes at` trajectory rows when a *later* phase's implementation item is checked off. A plan's terminal phase's own rows are therefore never inspected — verified empirically against the live hook, not just read from source. The originally-designed two-phase shape (Ship, Backfill-as-terminal) would have silently failed to enforce backfill at all. The fix — a trailing, trivial Close phase whose sole job is to be the "later phase" that triggers the existing check — required no new hook mechanism, just a template shape correction.

## Decision

1. **New workflow value `hotfix`**, recognized in three places:
   - `apps/indusk-mcp/skills/planner.md` — added to the workflow dispatch table, `argument-hint`, and a new `## Hotfix Workflow` section describing the retroactive, three-phase flow in full.
   - `apps/indusk-mcp/hooks/check-gates.js` — `detectWorkflow` regex gains `hotfix`; `WORKFLOW_GATES_BASE` gains `hotfix: ["verification", "document"]` — otel is unconditionally excluded, exactly matching `bugfix`'s existing entry.
   - `apps/indusk-mcp/hooks/validate-impl-structure.js` — same regex addition; its inline map gains `hotfix: { verification: true, otel: false, context: false, document: true }`.
2. **`apps/indusk-mcp/skills/git.md`** — new `hotfix/{slug}` row in the branch naming table, plus prose: stash-or-safety-commit to protect in-progress work, branch off `main` in the current working directory, explicitly not a worktree.
3. **Hotfix impl.md template** (embedded in `planner.md`) sets `workflow: hotfix`, `gate_policy: auto`, `trajectory: required` in frontmatter, and shows the three-phase skeleton (Ship — all-deferred; Backfill — mandatory, real trajectory rows and gates; Close — trivial single item, exists solely so Backfill isn't terminal and Gate B actually inspects its rows).
4. **`hotfix-shipped` highlight** fired when the retroactive plan folder is created (right after the PR merges), alongside the existing brief-accepted/test-plan-accepted/adr-accepted triggers.
5. **No changes** to `/falsify` or `/retrospective` — both already operate on "terminal phase of a plan" without reference to workflow type.
6. **No changes** to the trajectory validator/parser, no new `gate_policy` value, no worktree-extension integration, no CLI tracking surface.

## Alternatives Considered

### CLI/config-based backfill tracker (`indusk hotfix status`), decoupled from the plan lifecycle
Would let a hotfix ship with literally zero documentation at merge time, with a separate surface nagging about outstanding backfill later. Rejected: it's a second enforcement system running in parallel with the one `check-gates.js` already provides, and nothing forces anyone to run or heed it — exactly the "permanent excuse to skip quality" failure mode this ADR is trying to avoid.

### Worktree-based isolation for hotfix work
Would keep the primary working directory untouched during an emergency fix. Rejected on cost: the worktree *extension's* setup script does file-overlay + env provisioning + optional service spin-up, none of which is appropriate for a five-minute patch, and the extension isn't enabled on most projects (confirmed: not enabled on dusk itself).

### New `gate_policy` value (e.g. `gate_policy: hotfix`) or a phase-scoped gate policy
Would let Phase 1 defer everything while Phase 2 enforces strictly, without relying on the document-wide `auto` setting. Rejected: `gate_policy` is already document-wide by design, and `auto` already permits exactly the write-time skip-reasons Phase 1 needs.

### Reuse `fix/{slug}` instead of a new `hotfix/{slug}` branch pattern
Simpler — no new convention to document. Rejected: loses the ability to structurally distinguish "this was a genuine hotfix" from an ordinary off-plan bugfix in git log / PR titles / any future automation that wants to key off it.

### Skip falsification and retrospective for hotfixes entirely
Would match the "speed over ceremony" framing most aggressively. Rejected: risks hotfix becoming the permanent bypass of the falsification discipline the rest of the project treats as load-bearing.

## Consequences

### Positive
- Gives the "just fix it and skip the ceremony" behavior that already happens informally a sanctioned name, a template, and — critically — a forcing function it doesn't currently have.
- Adds zero new enforcement code paths beyond workflow-name registration: `gate_policy: auto` and the Phase-0 trajectory rule are reused exactly as designed, not extended.
- `hotfix/{slug}` and `workflow: hotfix` are both grep-distinguishable, giving any future automation a clean signal.

### Negative
- `check-gates.js` and `validate-impl-structure.js` continue to duplicate the same workflow-gate-requirements table independently.
- Eval-agent traceability has a gap during the window between the hotfix's first commit and the retroactive plan folder's creation.

### Risks
- **Hotfix mode gets used for non-emergencies, eroding bugfix's discipline.** Mitigation: none structural — a social/review-time control. The distinct branch name and plan shape make hotfix usage visible in PR review.
- **Phase 2 (Backfill) never actually happens.** Mitigation: the Phase 3 (Close) trigger makes `check-gates.js`'s existing Gate B genuinely block the plan from reaching a completed state while Backfill's trajectory rows are unresolved — verified empirically.
- **The general Gate B gap this plan uncovered — a terminal phase's own trajectory rows are never inspected — exists for every other plan in this system already, not just hotfix.** Out of scope to fix here; documented as a standing CLAUDE.md Known Gotcha.
- **A bad-faith Phase 2 marks its trajectory rows `skipped` without real justification.** Mitigation: none added by this plan — pre-existing, systemic gap in the trajectory system, out of scope here.

## References
- `.indusk/planning/planner-hotfix-mode/` (research, brief, test-plan, ADR source)
- `.indusk/planning/archive/tests-first-planning/adr.md` (Test Trajectory design, Phase-0 rule origin)
- `apps/indusk-mcp/skills/git.md`, `apps/indusk-mcp/skills/planner.md`, `apps/indusk-mcp/hooks/check-gates.js`, `apps/indusk-mcp/hooks/validate-impl-structure.js`
