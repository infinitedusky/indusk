# Before InDusk promises a rule, ask whether it is a project's choice or InDusk's — the everyday/system tier split was dusk's own script, promised and guarded for three phases before anyone asked

tests-never-make-us-wait, 2026-10-18: InDusk promised (everyday-tests-never-wait), guarded and extended an everyday/system test-tier split over three phases, until Sandy pointed out that `pnpm test` is this repository's own script and a fast/slow split is each project's choice. The tier logic is to be retired from InDusk once a promise can be retired (draft plan a-promise-can-be-retired).

Why: a rule built into the package binds every project that installs it; a repository's own arrangement should stay in the repository. How to apply: at the brief, for each promise ask "would another project that installs InDusk want this?"; if not, it belongs in that project's config or scripts, not in the package's promises, guards or skills.

See .indusk/planning/archive/tests-never-make-us-wait/retrospective.md (What We'd Do Differently).
