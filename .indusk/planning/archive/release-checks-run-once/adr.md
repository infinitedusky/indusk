---
title: "Release checks run once"
date: 2026-10-08
status: accepted
---

# Release checks run once

## Goal

**Releasing a plan that landed green does not run the slow tests a second time, and the landing and release steps fit any project.**

Today `pnpm release` runs the whole system tier, six to eight minutes, minutes after landing ran it on the same code; nothing records that landing's run passed, so release cannot know. And the steps every InDusk project installs tell it to run `pnpm test:system`, `release-guard.sh` and dusk's changelog path, which most projects do not have.

## Y-Statement

**In the context of:**
a slow test tier that runs at landing (the retrospective's Step 10) and again at release, on code that differs only by the version bump and the changelog entry, in a repository where the landing and release steps are prose every project installs.

**Facing:**
no record of what a slow run covered or whether it was green; a release commit that never equals the commit landing tested; and steps that name one project's commands.

**We decided for:**
one command, `indusk checks slow`, that runs the project's declared slow tests and, only when they are fully green on a clean tree, records the code they covered in the project's home; with `--unless-covered`, it skips when a record already covers the code at hand, and says which run did. The code is keyed by the content of the paths the project declares the slow tests cover, with its changelog left out and its version file read without the `version` field. The commands, the covered paths, the version file and the changelog are declared under `workflow.steps` in `.indusk/config.json`, a section shaped for every step's tooling though this plan fills only landing's slow tests and release; `indusk checks show` names them back, and the retrospective's landing and release steps name only what it prints. The section holds facts, never logic: every value is a command, a path or a name.

**And against:**
keying on the commit (the bump always differs, so release would never skip); running the slow tests only at release (failures then surface at publish time, which is what 1.66.0 did); a CI server (a different plan); trusting a record kept in git (it would travel to machines that never ran the tests, and every run would be a commit); a `release` block of its own (a third place for step tooling beside `verify.testRunner` and `plans.land_checks`, where one section shaped for every step costs the same); a standard format for the steps (none describes a project's workflow tooling: AGENTS.md is prose, Spec Kit and OpenSpec fix their own order, CDEvents describes what happened rather than what to run).

**To achieve:**
`slow-checks-run-once-per-tree` and `landing-and-release-name-the-projects-commands`, while landing still refuses an unaccepted plan and the everyday suite is untouched.

**Accepting:**
a record per machine (another machine runs the tests once itself); a key that over-runs rather than under-runs (a change to any covered file, documentation included if the project covers it, runs the tier again); and a `workflow` section a project fills in before the steps name its commands, held to facts so it never becomes a language to learn.

**Because:**
the decision of whether a run is still valid then rests on what the run read, not on which commit happened to be checked out, and the project, not the skill, says what its slow tests are.

## Context

[research](research.md) maps what runs where and why the commit cannot be the key; the [brief](brief.md) holds the two promises; the [test plan](test-plan.md) holds A1–A10.

## Decision

**D1 — `indusk checks slow`.** Runs `workflow.steps.land.slow_tests` in the main checkout or the worktree it is called from, with its own output. When it exits 0 and the covered paths had no uncommitted change before and after the run, it appends `{ key, at, command, cwd }` to `<home>/slow-runs.jsonl`. A failing run, a guard failure (the command's own exit code includes it), or a dirty tree records nothing. Exit code is the command's.

**D2 — `--unless-covered`.** Computes the key of the code at hand; when the tree is clean on the covered paths and `slow-runs.jsonl` holds a record with that key, prints `slow tests skipped: covered by the green run at <at> (<cwd>)` and exits 0 without running anything. Otherwise it runs, as D1.

**D3 — The key.** For each file `git ls-files` lists under `workflow.steps.release.covers` (default: the whole repository except `.indusk/`): its path and the hash of its content, except that `workflow.steps.release.changelog` is left out and `workflow.steps.release.version_file` is hashed with its `version` field removed (JSON) or its first `version` line removed (otherwise). sha256 over the sorted lines. Content, not commit, so the bump and a landing note on `main` change nothing; the lockfile, test configs and anything else covered change it.

**D4 — `workflow.steps`.** `.indusk/config.json`:

```json
"workflow": {
  "steps": {
    "land":    { "slow_tests": "pnpm test:system" },
    "release": { "command": "pnpm release",
                 "version_file": "apps/indusk-mcp/package.json",
                 "changelog": "apps/docs/src/changelog.md",
                 "covers": ["apps", "packages", "examples", "package.json", "pnpm-lock.yaml"] }
  }
}
```

Every key is optional, and a project that declares none still gets an honest workflow; `ensureConfigBlock` adds `workflow: { steps: {} }` on `update`. `indusk checks show` prints each step's declared tooling, or says plainly what is not declared and what that means: landing runs no slow tier, release has nothing to publish (A9). The section is shaped for every step's tooling; `verify.testRunner` and `plans.land_checks` stay where they are and move in by a later plan.

**D5 — Facts, never logic.** Every value under `workflow` is a command, a path or a name: no conditionals, no templating, no variables, no expressions. A project that needs a condition writes a script it owns and names it, and a command is whatever the project already runs (`mise run test:slow`, `just release`, `pnpm release`), never an InDusk language. A later plan that wants a key whose value is not a command, a path or a name argues against this decision by name. (The configuration complexity clock: settings grow rules, rules grow a language nobody can debug.)

**D6 — Landing and release in dusk.** dusk declares its steps (`slow_tests: pnpm test:system`, `command: pnpm release`, its version file and changelog, `covers` the apps, packages, examples, root configs and lockfile). Its `plans.land_checks` gains `indusk checks slow`, so the run that lands is the run that records; its `release` script replaces `pnpm -w test:system` with `indusk checks slow --unless-covered`, through the package's own built CLI so the release tests the code it ships.

**D7 — The steps.** The retrospective's Steps 10 and 11 tell the agent to run `indusk checks show` and use what it names, and name no dusk path; a test over every installed skill refuses dusk's commands and paths in the landing and release steps (A7).

## Alternatives Considered

### Key on the commit
The release commit always differs from the one landing tested. Release would never skip.

### Run the slow tests only at release
One run per release, but every failure appears at publish time, after the plan is closed.

### Keep the record in git
Travels to machines that never ran the tests, and each run becomes a commit on `main`.

## Consequences

### Positive
- A plan released after a green landing pays for the slow tests once.
- Any project's landing and release steps name its own commands, or say it has none.

### Negative
- A per-machine record: a release from another machine runs the tests.
- A project fills in `workflow.steps` before the steps name anything.

### Risks
- **A key that misses something the tests read**, so a stale green run is trusted. Mitigation: the default covers the whole repository except `.indusk/`; dusk narrows it deliberately, and a narrowed list errs toward listing more.
- **A record written by a run that did not really pass.** Mitigation: only a zero exit records, and the command's exit includes the leaked-daemon guard and every package's tier (the `&&` fix of 1.66.0).

## Documentation Plan

### Pages
- New: `apps/docs/src/reference/cli/checks.md` — `indusk checks slow`, `--unless-covered`, `indusk checks show`, `workflow.steps` and its facts-only rule.
- Update: `apps/docs/src/reference/skills/retrospective.md` — Steps 10 and 11 name the declared commands.

### Changelog
- Added: `indusk checks`; the `workflow.steps` config section. Changed: release skips the slow tests when a green run covered the same code.

### ADR in Docs
- `decisions/release-checks-run-once.md`.

## References

- [research](research.md), [brief](brief.md), [test plan](test-plan.md)
- `.indusk/planning/archive/bookkeeping-lives-where-it-is-read/` — the project home
