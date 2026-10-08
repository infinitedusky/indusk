---
title: "Release checks run once"
date: 2026-10-08
status: complete
---

# Release checks run once — Research

## Question

Why does the slow test tier run twice between landing a plan and publishing it, and what would let release trust the run landing already made? Separately: why can a project that does not publish a package not follow the landing and release steps as written?

## Background

Opened at planner-promises' landing (Sandy, 2026-10-05): "it's very, very frustrating that we're running these massively long tests more than once." The retrospective's landing step runs `pnpm test:system`, and `pnpm release` runs it again minutes later on the same code.

1.66.0 (2026-10-08) showed the other side. Landing's system run failed, though not on a test: indusk-mcp's tests were all green, and the leaked-daemon guard failed on two orphaned daemons. The root script chained the packages with `&&`, so the admin's tier never ran. The release run then found two real admin failures. That chain is fixed (d182205c: every package's tier runs, and the script fails if any did, pinned by a test). So a green run at landing now means every tier passed. The release run caught a gap only because landing's run had not been green, and a rule that skips only after a green run would still have run it.

## Findings

### What runs where, today

- **`pnpm release`** (`apps/indusk-mcp/package.json`): `release-guard.sh` → `pnpm -w test:system` → `npm whoami` → `pnpm publish` → `record-release.js`. The system tier always runs.
- **`indusk plans land`** (`lib/plans/land.ts`): brings the trunk into the branch, runs `plans.land_checks` from `.indusk/config.json` (each a shell command in the worktree; none configured in dusk), merges with `--no-ff`. The suites at landing run only because the retrospective skill's Step 10 tells the agent to run `pnpm test` and `pnpm test:system`; nothing records that they ran or passed.
- **Cost**: the root `test:system` is indusk-mcp's tier (41 files, about 165 tests, plus `prepublishOnly`'s builds) then the admin's (13 files, 56 tests, about three minutes on 2026-10-08). Six to eight minutes in all, paid twice per plan that is released.

### What "the same code" is

- The bump is a commit of its own on `main` after the merge (retrospective Step 11): `package.json`'s `version` and the changelog's heading. So the release's HEAD is never the commit landing tested, and a rule keyed on the commit would never skip (Sandy chose "same code", 2026-10-08).
- `release-guard.sh` already names what ships: `PACKAGED_PATHS` (`apps/indusk-mcp/src`, `skills`, `templates`, `hooks`, `lessons`, `extensions`, …), mirrored in `version-state.ts`. The system tier also reads the admin (`apps/indusk-admin`), the root and package test configs, and the lockfile. A key over those paths, with the `version` field and the changelog left out, says whether the code release would test is the code landing tested.
- Uncommitted changes must count: a run over a dirty tree proves nothing about the committed one.

### Where a record of a green run lives

bookkeeping-lives-where-it-is-read (1.66.0) gave each project a home outside every checkout, `~/.indusk/projects/<id>-<hash>/`, shared by the main checkout and every worktree. A record written by landing in a worktree is readable by release on `main`, never in git, and per machine, which is right: a run on another machine is not evidence here.

### Commands that name dusk

The retrospective skill, which every InDusk project installs, names `pnpm test`, `pnpm test:system`, `pnpm release`, `release-guard.sh`, `PACKAGED_PATHS`, `apps/indusk-mcp/package.json` and `apps/docs/src/changelog.md`; `verify.md` and `work.md` name the two test commands. `.indusk/config.json` already declares some commands (`verify.testRunner`, `plans.land_checks`), but no slow tier, release command, version file or changelog path.

## Decisions

- **Skip on the same code, not the same commit** (Sandy, 2026-10-08): the bump commit always differs from the tested one, so a commit rule would never skip.
- **The release still runs the tier when nothing green covers its code** (the draft brief, kept): plans pile into one version, so release is the only point that tests what ships.
- **Landing keeps running both tiers**; release is the one that may skip. Moving the slow tier to release only would surface failures at publish time, which is what 1.66.0 did.

## Open Questions

- The exact set of paths in the key, for dusk and for a project that declares its own (the ADR's).
- Whether `plans land` should run the declared slow tier itself, so the record is written by the command that lands rather than by an agent following prose (the ADR's).

## Sources

- `apps/indusk-mcp/package.json` (`release`, `test:system`), root `package.json` (`test:system`)
- `apps/indusk-mcp/scripts/release-guard.sh` (`PACKAGED_PATHS`), `apps/indusk-mcp/src/lib/plans/land.ts` (`landChecks`)
- `apps/indusk-mcp/skills/retrospective.md` Steps 10–11
- `.indusk/planning/archive/bookkeeping-lives-where-it-is-read/` (the project home)
