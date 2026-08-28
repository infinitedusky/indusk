---
title: "Workbench Code Roots — one answer to 'where is the code?'"
date: 2026-08-28
status: draft
---

# Workbench Code Roots — Brief

## Problem

Three separate features need the same fact — **where is this project's code?** — and
none of them can get it.

In a workbench, `.indusk/` sits in a wrapper repo and the code sits in an
application repo beside or inside it. Tooling that resolves paths from "the
project root" lands on the wrapper, where there is no code. 1.39.0 fixed three
consequences of that (health-check cwd, `init-docs` target, `doppler.apps[].path`)
by teaching each caller separately about declared repos.

But repo-root resolution is not enough, because **code is not at the repo root
either**. looper's tests are at `looper/backend/pytest.ini`; its packages are at
`looper/apps/mobile/`. So:

- **Health checks still cannot find instrumentation.** `test -f instrumentation.py`
  now runs at `looper/` instead of the wrapper — an improvement, and still wrong
  when the file is at `backend/`.
- **Language detection cannot see Python at all.** `detectTooling` looks for
  `vitest.config.ts` and `jest.config.js` at the project root and stops. It never
  looks for `pytest.ini`, `pyproject.toml`, `conftest.py` or `tox.ini`, and even if
  it did, they are not at the root.
- **Detection's answer is a value where the truth is a set.** looper has pytest in
  `backend/` and, once its packages have tests, vitest too. `verify.testRunner` is
  single-valued, so one of them is silently unrepresented.

## Proposed Direction

**One bounded walk, run once at init, that proposes; declarations thereafter.**

1. **A shared `codeRoots` primitive.** One function answers "where is code in this
   project", used by detection, health checks and `init-docs` — the three callers
   that each solved it differently in 1.39.0.

2. **A bounded walk to seed it.** `init` walks each declared repo to depth 3,
   pruning `node_modules`, `.venv`, `.git`, `dist`. Depth 3 because
   `backend/pytest.ini` is depth 1 and `apps/mobile/package.json` is depth 2, so it
   covers realistic monorepo shapes and stays cheap.

3. **Propose, then declare.** The walk writes what it found into config. Every
   consumer thereafter reads the declaration and never walks. Same shape as
   `doppler.apps[]`, which is hand-written today and could be seeded identically.

4. **Finding nothing omits.** The walk never defaults — exactly as 1.39.0 already
   ships for `verify.testRunner`.

5. **Detection returns a set.** `detectTooling` reports every runner and linter it
   found. `writeConfig` still narrows to one, and **says what it dropped**: *"found
   pytest and vitest, recording pytest — config cannot hold both yet."* That makes
   the schema's limit visible instead of silent, and leaves the follow-on plan a
   schema change with correct data already underneath it.

## Context

The chicken-and-egg is that `init` is what writes the config, so there is nothing
declared to read at the moment detection runs. That is why the walk exists and why
it runs exactly once.

Health checks have the same problem in a different shape: they run against whatever
the project is *now*, and the declaration was written at init. **This is the open
decision the ADR settles** — see below.

This project has already paid twice for checks that report the wrong thing rather
than nothing: a Doppler health check red on every project without Doppler, and an
audit green for seven weeks because its scope was wrong. Both were fixed this week.
The rule the research doc extracts is the one to hold here: *a check must be able to
distinguish "nothing to do" from "did not run."*

## Scope

### In Scope

- `codeRoots(projectRoot)` — the shared primitive, with a single definition
- The bounded walk: depth 3, prune list, run at `init` and on `indusk update`
- `code_roots` (or equivalent) declared in `.indusk/config.json`
- Python detection: `pytest.ini`, `pyproject.toml` with a pytest section,
  `conftest.py`, `tox.ini`
- `detectTooling` returns a set; `writeConfig` narrows and reports the drop
- Health checks and `init-docs` read the declaration

### Out of Scope

- **Making `verify` plural.** `verify.linter` and `verify.testRunner` are
  single-valued in the config type and read by `/verify`. Changing that is a schema
  migration touching the type, the skill and every consumer — its own plan, which
  this one makes cheap by getting the detection data right first.
- Linters for Python (`ruff`). Detection can *find* it; recording it needs the
  plural schema.
- Any change to how worktrees resolve. That landed in 1.38.x.

## Open Decision for the ADR

**Do health checks walk, or read the declaration?**

- **Read the declaration** — cheap, keeps the walk out of the hot path, and gives an
  obvious refresh point (`indusk update`). Fails when someone adds `backend/` after
  init and does not update.
- **Walk every time** — always current, but a walk per check per repo, and health
  checks run on every `check_health`.

Leaning toward reading the declaration with `indusk update` as the refresh, but the
staleness failure is real and the ADR should say which cost we are choosing.

## Success Criteria

- A polyglot workbench initialised from scratch records **pytest**, found at
  `<repo>/backend/`, without anyone editing config by hand.
- `check_health` finds instrumentation nested at `<repo>/backend/`, and still fails
  when it exists nowhere.
- Detection that finds two runners **says so**, even though config records one.
- `codeRoots` has exactly one definition, pinned by a test — three callers must not
  each grow their own.
- Nothing walks at runtime except `init` and `indusk update`.

## Depends On

- Nothing. 1.38.x shipped `repos_root` / `readWorkbenchRepos`, which this builds on.

## Blocks

- **`verify` goes plural** — the follow-on schema change. Named in the research
  doc's fix-shape section; this plan supplies its data.

## References

- `research.md` (this folder) — the six-defect report from looper
- `.indusk/planning/archive/versioned-workbench/adr.md` — `repos_root` and the
  two-roots refusal this extends
- 1.39.0 changelog — the three callers that each solved this separately
