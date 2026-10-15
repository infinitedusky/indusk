---
title: "template-reload-on-cold-cache — Retrospective"
date: 2026-10-15
---

# Tests and landing work from a cold machine — Retrospective

## What We Set Out to Do

Make `pnpm test` and landing's install stop depending on a warm machine. On a cold Vite cache, the browser template test reloaded its page partway through and failed the root run on main. Landing's install step (`pnpm install:local`) failed whenever the merge brought in a new dependency, until someone ran `pnpm install` by hand. The brief made two promises: `a-browser-test-passes-on-a-cold-cache` and `landing-installs-after-a-dependency-change`. It also brought the day-monitor end-to-end test up to date: it had been asserting Claude Code's wording for an unknown model, and that wording changed.

## What Actually Happened

The branch touched 11 files (+505/−30). Most of it is one new test file (`templates-prebundle.test.ts`, 201 lines) and the plan's own documents. The fixes themselves are a single `extends: true` line, a script prefix and three assertions.

- **Build Phase 1, the fixes.** main-suite-green had added the missing package to the root `optimizeDeps.include` list and believed the templates project would read it. It did not: a Vitest project inherits nothing from the root config unless it sets `extends: true`. The list had never reached the browser page. After adding the line, three runs from a deleted Vite cache all passed with no reload. `install:local` now starts with `pnpm install --frozen-lockfile`. The day-monitor test now matches the model name it sets, and a third assertion of the old wording (line 182) turned up during the build.
- **Falsification (Build Phase 2)** found that the new guard only saw what its author had imagined: named imports of `@opentelemetry/*` packages, in two hard-coded files. A side-effect import, a package from anywhere else, or a second browser test would all have passed. The guard now reads every file the browser project's globs match, follows their local imports, and counts every bare specifier.
- **Cleanup** was skipped because the one new file is cohesive.
- **The audit (Build Phase 3)** found two more gaps. The guard reduced a subpath import (`pkg/sub`) to its package name, but Vite treats a subpath as a separate entry. And the retrospective skill, the text the landing agent actually follows, still described the old install step. Only the docs page had been updated. Both are fixed: the skill now explains the sync and what a refused install means.

## Getting to Done

- The impl planned to put the `extends: true` rule in `apps/indusk-mcp/templates/CLAUDE.md`. That file is the blank skeleton `init` installs into every user project, so the rule went into A1's failure message instead, A1 being the test row that checks every browser import is pre-bundled. The Files Affected table still listed that file until this retrospective.
- Running `prepublishOnly` rewrote the tracked `apps/indusk-mcp/admin/next.config.ts`, and the change was reverted. The same file shows as modified on trunk right now, so this is a standing side effect of the build, not something this plan introduced.
- The global `npm install -g` part of `install:local` was deliberately not run from the worktree. Landing deletes the worktree, and the global `indusk` would have been left pointing at it. Landing's install is the first time the full command runs end to end.

## What We Learned

- **A Vitest `projects` entry inherits nothing from the root config without `extends: true`.** A root `optimizeDeps`, `resolve` or plugin silently does not apply. main-suite-green's fix for this exact reload was a no-op that only looked like it worked, because the failure was intermittent.
- **A guard written alongside its fix checks the cases its author imagined.** Falsification widened the import scan in one pass, and the audit still found a subpath gap. That is three readers to get one static check right.
- **Updating the docs page is not updating the instructions.** The agent follows the skill file, not the docs. A change to how landing works has to edit `apps/indusk-mcp/skills/retrospective.md` (and resync), or it never reaches the landing agent.

## What We'd Do Differently

- When a fix "works" against an intermittent failure, prove the mechanism, not just one green run. main-suite-green would have caught the missing `extends` if it had deleted the Vite cache and rerun.
- When a plan changes a step an agent performs, list the skill file in Files Affected from the start, not just the docs page.

## Insights Worth Carrying Forward

- Static guards for runtime behaviour (here, "Vite will not discover a dependency mid-run") are only as good as their model of the runtime. A2, the live check of three cold runs with no reload, is the only row that observes the promise itself, and nothing reruns it. The audit's point holds: A1 proves the list is complete by its own model of what Vite does, not that a reload can never happen.

## Audits

- **Docs:** `apps/docs/src/reference/skills/retrospective.md` and the skill's Step 10 item 7 both describe the merged script, including the refusal and how to recover. They match `package.json`.
- **Tests:** the first root `pnpm test` was red only on `NewProjectProposal` A3, the admin browser flake the brief left out of scope (a "declining a recommendation" test timing out at 18 s), and turbo stopped indusk-mcp before it reported. A rerun with `turbo test --continue` exited 0: admin 116 files / 722 tests, indusk-mcp 442 files / 2,948 tests, templates 12 passed / 1 skipped with no reload, indusk 48, seat-holds 3, promises check 148 with 0 known-violated, no leftover daemons. The flake has now been seen twice. A4, the day-monitor row, is in the e2e suite, which `pnpm test` does not run; it passed by hand in Build Phase 1.
- **Trajectory audit:** A1–A7 all `passing`. No deferred, blocked or non-terminal rows.
- **Quality:** no recurring lint or type errors, and no new Biome rule. Shape ran 4 reviews and raised 0 findings, with 1 left as is (the `packagesIn` name). None were judged wrong by a person.
- **Audit findings not acted on:** `extends: true` inherits the whole root config, not only `optimizeDeps`, and `--frozen-lockfile` runs on every `install:local`, not only at landing. Both are accepted and recorded here.
- **Confirm:** `indusk promises confirm` refused twice at close. First, A2's Test cell (prose) was read as a file name, so the row was rewritten in the live-check form earlier plans use. Second, `landing-installs-after-a-dependency-change` had no code site, because `package.json` cannot hold a comment. A top-level `"//"` key next to `install:local` now carries its token. Both promises are `enforced`.
- **Periodic pass:** no root CLAUDE.md entry moved down a tier this close. The candidate (the daemon-guard sentence in Conventions) has no `lesson:` token in its enforcer yet. This is recorded as not done, not as done.
- **Changelog / bump:** nothing in the published package changed (test config, root script, e2e assertion), so there is no changelog entry.
- **Context:** the known issue "Landing a plan that adds a dependency breaks `pnpm install:local`" has been removed from `known-issues.md`, since this plan fixes it. The parked "day-monitor e2e expects the old wording" note in `current.md` has been removed. No CLAUDE.md was touched, so the nested-context probe does not apply.
