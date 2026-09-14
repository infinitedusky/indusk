---
title: "InDusk defects: tooling assumes a shape the project does not have"
date: 2026-08-28
status: complete
---

> Copied from  in the
> looper workbench, written while building looper. Defects 1–6; this plan
> addresses the shared path-resolution root cause that 2, 3 and 5 depend on.
> Defects 1, 3, 4 and 6 shipped in 1.39.0.

# InDusk defects found building looper's telemetry foundation

Six defects, one session. **Updated after `indusk update` on 2026-08-28:**
defect 1 is now fixed upstream; defect 2's local patch was silently reverted,
which exposed defect 6.

## Root causes

**A. Flat project, not workbench.** In a workbench, `.indusk/` sits in a wrapper
repo and the code sits in an application repo beside it. Tooling that resolves
paths from "the project root" lands on the wrapper, where there is no code.

**B. JS project, not polyglot.** Scaffolding writes JS defaults without
detecting the language.

---

## 1. `doppler-token-present` tests for a file, not for working auth

**Cause:** neither — just wrong.

The check was:

```
node -e "…fs.existsSync('.indusk/extensions/doppler/.env') && /DOPPLER_TOKEN=\S/…"
```

**Wrong in both directions.** It reported a hard error while `doppler login`
auth was working perfectly, and it would report OK for a revoked or expired
token. It never tests auth. The extension's own skill says a developer who ran
`doppler login` needs no token file — so the check contradicts the documented
happy path, and it is the first thing a new user sees.

**Evidence:** this session opened with that error on a correctly-authenticated
machine. Acting on it produced a service token that was created, revoked, and
deleted — pure churn caused by the check.

**FIXED UPSTREAM (2026-08-28).** The manifest now ships `doppler-authenticated`:

```sh
doppler me >/dev/null 2>&1 || node -e "…token-file fallback…"
```

Auth first, token file as fallback. Exactly right.

**Original recommendation, for the record:**

```sh
doppler configs --project "$(node -p "require('./.indusk/config.json').doppler?.project||''")" --json >/dev/null 2>&1
```

Passes on login, passes on a valid token, fails only when auth is genuinely
broken. Rename to `doppler-auth-works`.

**Local patch:** check removed from the manifest entirely.

---

## 2. `otel` health checks resolve only at the project root

**Cause:** A.

```
test -f instrumentation.ts || test -f src/instrumentation.ts || test -f instrumentation.py
node -e "require('@opentelemetry/sdk-node')" || python -c "import opentelemetry"
```

Both run from the workbench root. In a workbench the instrumentation lives in
the application repo (`looper/backend/looper/telemetry/`) and the packages live
in that app's venv. **The checks can never find real instrumentation** — not
before the work, and not after.

**Fix:** search application repos and their venvs, not just the root. The local
patch walks up to `.indusk`, then searches down excluding `node_modules`,
`.venv`, `.git`, and additionally probes each discovered `.venv/bin/python`.

**Verification that a scope fix is not a relaxation:** after the fix both checks
were still red, because the instrumentation genuinely did not exist yet. They
went green only when it did. A scope fix that turns something green immediately
is a relaxation in disguise.

**Local patch:** applied in `.indusk/extensions/otel/manifest.json` — and
**silently reverted by `indusk update`**, see defect 6. A tracked copy now lives
in `.indusk/patches/otel-manifest.json` with a reapply step.

---

## 3. `indusk init-docs` scaffolds into the workbench, not the application

**Cause:** A.

Run from a workbench, it created `apps/looper-workbench-docs/` **in the wrapper
repo** — note it even derived the name from the wrapper. But the docs describe
the application and must travel with it: if `looper` is ever cloned standalone
or shared, workbench-level docs are orphaned.

**Fix:** detect workbench shape and target the application repo, or accept a
target argument. Deriving the site name from the wrapper is a second, smaller
bug in the same line.

**Local patch:** directory moved by hand into `looper/apps/docs`, renamed to
`@looper/docs`. Re-running `init-docs` will recreate the misplaced copy.

---

## 4. `doppler.apps[].path` cannot satisfy both of its callers

**Cause:** A. **This is the worst of the five**, because it fails silently and
reports success.

Two callers resolve the same config value against different roots:

| caller | resolves `path` relative to | needs |
|---|---|---|
| `indusk doppler env-pull` from the workbench | workbench root | `looper/backend` |
| auto-provisioning inside `indusk worktree create` | the worktree | `backend` |

**One value cannot be both.** With `path: "looper/backend"` a manual pull works
and every worktree silently gets no env.

**Evidence**, from a throwaway worktree created after Doppler was configured:

```
looper/backend: skipped — looper/backend not found
env-pull (local): wrote 0 file(s) from Doppler project "looper".
doppler: auto-provisioned env for env-probe
```

It reports **"auto-provisioned env" while writing zero files.** A developer sees
a success line and a worktree with no env.

**Fix, two parts:**
1. Resolve `path` relative to the *application repo* in both callers, so the
   value means one thing.
2. **Fail, or at minimum warn, when a pull writes zero files.** A success
   message over a no-op is the failure mode; this one is worth fixing even if
   part 1 slips.

**Local patch:** none. Not patchable from the project side.

---

## 5. `indusk init` writes `testRunner: vitest` without detecting the language

**Cause:** B.

`.indusk/config.json` declared:

```json
"testRunner": { "tool": "vitest", "config": "vitest.config.ts" }
```

No `vitest.config.ts` exists, vitest is not installed, and there are no JS test
files. Every test in the project is pytest against the Python backend. `/verify`
reads this field to decide what to run, so it would invoke a runner that is not
there.

**Fix:** detect at init — a `requirements.txt` or `pyproject.toml` implies
pytest; `package.json` implies vitest. Polyglot projects need more than one
entry, which the schema may not currently allow.

**Local patch:** set to `pytest` / `looper/backend/pytest.ini`.

**Related, not yet fixed:** `linter: biome` is correct but covers only the
TypeScript that exists. The Python has no linter configured (`ruff` is the
obvious choice), so "lint passes" currently says nothing about the backend.

---

## 6. Extension manifests are gitignored, so local patches cannot survive or be reviewed

**Cause:** neither of the above — a packaging decision with an unintended
consequence. **Found by `indusk update` reverting defect 2's fix.**

`.gitignore` line 12 ignores `.indusk/extensions/` wholesale. Consequences:

- A patched manifest is **untracked**. `git log` on the path is empty.
- `indusk update` replaces it with **no diff, no conflict, and no message**.
- The revert is undetectable except by re-running the check it affected.

This is structural rather than incidental: the extension layer presents as
editable and is effectively read-only. In one session three manifests needed
patching; one was silently undone.

It also corrupts the repo record. A commit here claimed to have scoped the otel
health checks; git only recorded the file deletions in that commit, because the
manifest edit was invisible to `git add`.

**Fix, two candidates, both small:**

1. **Un-ignore manifests, keep ignoring secrets.** Line 29 already ignores
   `.indusk/extensions/*/.env*` separately, so the secret case is handled.
   Manifests are configuration and belong in version control.
2. **Make `indusk update` report what it replaced.** Silent replacement is the
   actual harm; the gitignore only removes the safety net. Even a one-line
   "replaced 1 modified manifest" would have surfaced this immediately.

**Local patch:** `.indusk/patches/` holds tracked copies with a documented
reapply step. A workaround, to be deleted when the upstream fix lands.

## Suggested shape for the fix

These are not five unrelated bugs and should not be fixed as five patches.

1. **A shared path-resolution helper that is workbench-aware**, used by every
   extension and CLI command that resolves a project path. Defects 2, 3 and 4
   all disappear if one function answers "where is the application code?"
2. **A rule that health checks and pulls fail on zero work.** Defects 1, 2 and 4
   all reported success while verifying or writing nothing. The general rule
   (from `verification-layers-and-false-green.md`): *a check must be able to
   distinguish "nothing to do" from "did not run."*
3. **Language detection at init**, covering defect 5 and the linter gap. Note
   the intersection: in a workbench, `pytest.ini` is not at `projectRoot`, so
   language detection needs the helper from (1). Fix path resolution first.
4. **Track extension manifests** (defect 6). Until then, every fix to (1) or (2)
   that a project applies locally is destroyed by the next update — including
   the fixes recommended here.

A regression test for the family: initialise a workbench-shaped polyglot project
and assert that health checks, `init-docs`, `env-pull`, worktree provisioning
and `testRunner` all resolve to the application rather than the wrapper.
