---
title: "Local Init Mode — Retrospective"
date: 2026-04-09
---

# Local Init Mode — Retrospective

## What We Set Out to Do

Enable `indusk init --local` so InDusk can be used as a personal dev system on team codebases without modifying committed files. Consolidate `.indusk/` as the home directory for both modes and introduce `config.json` as the central project profile.

## What Actually Happened

The plan executed cleanly across 5 phases (0–4) with no significant deviations from the brief or ADR. The core deliverables all landed:

- `.indusk/config.json` as central project profile (both modes)
- `planning/` migrated to `.indusk/planning/` (all modes)
- `--local` flag with `.git/info/exclude` management
- Settings overlay with `pr-clean` / `pr-restore` lifecycle
- Local-mode biome, tests, docs in `.indusk/`
- Tooling detection (linter, test runner, OTel, typecheck)
- All skills, hooks, and tools updated for new paths
- Guide and getting-started docs written

The migration fallback (check old `planning/` if `.indusk/planning/` doesn't exist) was a good defensive choice — it prevented breakage during the transition.

## Getting to Done

Relatively smooth. The main unplanned work:

- **Pre-existing test reference fix.** The `otel-core-skill` test fixture referenced a path that was wrong before this plan. Fixed it alongside Phase 0 since it was blocking test runs.
- **Import ordering.** Biome flagged import order in `config.ts` during Phase 0 verification — quick auto-fix.
- **Formatting in update.ts.** Pre-existing formatting issues surfaced during Phase 3 check — fixed as part of the pass.

No blockers. No significant debugging. The plan was well-scoped — each phase was small enough to complete and verify in one pass.

## What We Learned

1. **`.git/info/exclude` is per-clone, not per-repo.** This means re-cloning a team repo requires re-running `init --local`. Not a deal-breaker (init is idempotent), but worth documenting as a gotcha. We did.

2. **Settings overlay is the right pattern for `.claude/settings.json`.** The alternative was modifying the file directly and hoping the user never commits it. The overlay provides a clean audit trail of what InDusk added and makes `pr-clean` deterministic.

3. **`config.json` centralizes what was previously scattered detection logic.** Before this plan, verify guessed at the tooling setup every run. Now it reads config once. This also made the otel.role gate possible (added in graphiti-infrastructure Phase 5.25).

4. **Moving `planning/` to `.indusk/planning/` was the right call for both modes.** It reduced InDusk's root-level footprint and made the ownership boundary explicit. The migration fallback ensured zero breakage.

## What We'd Do Differently

1. **Would have added the sidebar entry for the local-mode guide during the impl, not left it for retrospective.** The guide page exists but is orphaned from the sidebar — the "always add to sidebar" lesson applies here too.

2. **Would have written config.ts tests.** The config read/write helpers are untested — they were verified manually during each phase but have no unit tests. For a file that's now consumed by init, update, hooks, and the semantic graph, that's a gap.

## Insights Worth Carrying Forward

- The overlay pattern (merge on init, strip on clean, re-apply on update) is reusable for any scenario where you need to temporarily modify a shared file without owning it.
- Consolidating a tool's artifacts into a single directory (`.indusk/`) makes the ownership boundary explicit and simplifies gitignore/exclude management.
- Tooling detection at init time (recording results in config) is better than re-detecting at runtime — it's faster, deterministic, and lets the user override.
