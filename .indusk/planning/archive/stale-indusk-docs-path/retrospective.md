---
title: "Stale apps/indusk-docs Path References in Skill Files — Retrospective"
date: 2026-07-06
---

# Stale apps/indusk-docs Path References in Skill Files — Retrospective

## What We Set Out to Do

Fix a small, genuinely real bug: the `apps/indusk-docs` → `apps/docs` directory rename (`indusk-worktree-extension` Phase 1, 2026-05-28) left live, agent-facing skill files pointing at a directory that no longer exists. Secondary goal: this was the first real dogfood of the `planner-hotfix-mode` workflow — ship the fix first on a `hotfix/{slug}` branch, create the plan folder retroactively, backfill tests, and prove the three-phase (Ship/Backfill/Close) mechanism actually enforces what it claims to.

## What Actually Happened

The Ship phase went exactly as designed: identified the bug (20 files: 7 skill sources + 1 extension skill + 8 installed `.claude/skills/*/SKILL.md` copies plus 4 more extension files found on a second look), fixed it, pushed `hotfix/stale-indusk-docs-path`, opened PR #11 — all before any plan document existed. Backfill authored a real regression test (20 assertions) and confirmed it would have failed pre-fix. Close's single item-check live-confirmed the core mechanism this whole plan exists to validate: checking off Close's item was genuinely blocked when I tested it with Backfill's row artificially left `written`, and genuinely allowed once it reached `passing` — not a synthetic fixture, an actual plan.

Then `/falsify` found the fix was incomplete in a way the Ship phase's own scoping couldn't have caught: it only touched dusk's own working tree. Three confirmed gaps — the published npm package (`@infinitedusky/indusk-mcp@1.31.12`, verified via `npm pack`, still ships all the broken files), 10 live VitePress docs-site reference pages, and `CLAUDE.md`'s own Architecture section. Phase 4 fixed two of the three; the third (actually publishing to npm) is blocked on credentials this environment doesn't have.

## Getting to Done

The path here was not linear. Three real corrections happened along the way, each caught by dogfooding the actual mechanism rather than assuming the design worked:

1. **The original two-phase hotfix design (Ship, Backfill-as-terminal) was wrong.** Before writing any hook code for `planner-hotfix-mode`, empirical testing against the live `check-gates.js` showed Gate B never inspects a terminal phase's own trajectory rows. Caught during `planner-hotfix-mode`'s own Phase 1, before this dogfood plan existed — fixed by adding the trailing Close phase.
2. **The hotfix template's Verification-section phrasing didn't satisfy the trajectory validator.** Writing this actual plan's `impl.md`, `validate-impl-structure.js` rejected `(none needed — skip-reason: hotfix — deferred...)` for Ship/Close's Verification sections — the cross-reference-integrity rule requires the exact phrase `(no tests flip at this phase — reason: {schema-only|delete|refactor|infra})`, and that rule is workflow-agnostic. `infra` was the best-fit existing value.
3. **A concurrent-session git collision mid-`planner-hotfix-mode`-authorship** (unrelated to this specific plan, but the reason this dogfood ended up running in an isolated worktree rather than the original shared directory) — a separate session was actively committing to `workbench-setup-command-phase-1` in the same working tree, and a commit landed on the wrong branch. Resolved via a non-destructive revert + branch recreation, not a history rewrite.

The scope of the Ship-phase fix itself also grew twice during execution, each time for a good reason: the original ~16-file estimate (skill files matching `apps/indusk-docs`) missed the relative-link form (`../../indusk-docs`) and several extension skills (`vitepress`, `otel`) that a narrower initial grep hadn't covered — caught by re-running a broader search after the first fix pass, not assumed complete on the first try.

## What We Learned

- **A hotfix's Ship phase fixes the working tree; for content bugs (docs, skills), "fixed" implicitly means "fixed everywhere a consumer encounters it."** The published npm package and the published docs site are separate distribution channels that a single git commit doesn't reach. This is generalizable beyond this specific bug — any future hotfix to distributed content needs an explicit "does this need to be published/deployed to take effect for consumers, not just merged?" check, ideally during Backfill, not discovered later during falsification.
- **The Test Trajectory validator's cross-reference-integrity rule has a fixed, narrow vocabulary (`schema-only`/`delete`/`refactor`/`infra`) for "no tests at this phase," and it's workflow-agnostic** — a workflow-specific skip-reason phrasing (however well-intentioned) will not satisfy it. Any new workflow template that includes phases with no tests needs to use this exact phrase, not a bespoke one.
- **Grep-based "find every affected file" scoping is inherently a lower bound, not a guarantee.** Both this plan's Ship phase and its own Falsification phase under-scoped on the first pass (missed relative-link forms, missed sibling extension-skill files, missed the docs-site mirror). Widening the search pattern and re-checking after the first fix is not paranoia — it found real, confirmed gaps twice.

## What We'd Do Differently

- Before scoping a "fix every reference to X" bug, run the broadest reasonable grep FIRST (bare string, not just the expected path prefix) — the narrower initial searches in both the Ship phase and the Falsification phase cost extra investigation cycles that a wider first pass would have caught immediately.
- For any future fix to published/distributed content, ask "does this need to be published to actually count as done?" as a standing Backfill-phase question, not something falsification has to discover.

## Insights Worth Carrying Forward

The `planner-hotfix-mode` capability itself gets two concrete corrections out of this dogfood: the Verification-section phrasing in its embedded template, and (worth considering, not yet decided) whether the Hotfix Workflow section should explicitly prompt "is this a fix to something published/deployed?" during Backfill. Both are captured as lessons for that plan's own retrospective/CLAUDE.md, not duplicated here.

## Quality Ratchet

No Biome rule opportunity here — this plan touched no application code, only markdown/prose and one `package.json` version bump. Nothing a linter would have caught.

## Metrics

- Sessions spent: 1 (part of a larger session also covering `planner-hotfix-mode` itself)
- Files touched: 20 (Ship) + ~14 (Falsification: 10 docs pages + CLAUDE.md + package.json + changelog) = ~34 content files, plus 1 new test file (34 assertions)
- Trajectory: 4 rows — T1/T3/T4 passing, T2 blocked (pending `npm publish`, outside this environment's credentials)
