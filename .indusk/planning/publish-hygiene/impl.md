---
title: "publish-hygiene"
date: 2026-10-06
status: in-progress
falsification: skipped
falsification_reason: "investigated the leave-out rule's edges (a `types-*` sibling does not match; no runtime file ends in .map), whether next start reads anything left out (the trimmed bundle served / and the API by hand), the retried write's side effects (a denied write leaves no file), and the 2FA prompt under loglevel warn (npm prints it with output.standard); no specific hypothesis survived, and the live 2FA case is U1"
cleanup: skipped
cleanup_reason: "three edits: a named leave-out rule in bundle-admin.js, one word in the release script, a test's setup; nothing repeats across files and nothing warrants extraction"
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
gate_policy: ask
---

# publish-hygiene

## Goal

`pnpm release` for 1.63.0 runs clean and can be read: the session contract
test asks the question its promise makes rather than relying on the model to
try a write, the tarball carries only what runs, and the publish prints its
warnings, errors and 2FA prompt without a line per file ([brief](brief.md),
[research](research.md)).

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A planning session asked to write a file asks first and hears a denial; the test makes the model attempt the write, tries once more when it answers without trying, and says plainly when it never tried | Test Phase 1 | Test Phase 1 | passing | contract | promise: a-plan-can-start-from-the-admin | apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts |
| A2 | The published package carries no source maps, no Next build trace and no generated types | Test Phase 1 | Build Phase 1 | passing | contract | the package ships only what runs; the admin-ui-hosting decision bounds the tarball's size | apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts |
| A4 | A build session started under the project's gates waits on nothing: a question is declined as a build declines it, a session that has not ended in two minutes is stopped and tried once more, and a rate limit is judged by the shared rule | Build Phase 2 | Build Phase 2 | passing | contract | promise: gates-ran-at-every-checkoff | apps/indusk-mcp/src/__tests__/build-session-gates.test.ts |
| A3 | The release's publish step runs with npm's notices off, so its warnings, errors and 2FA prompt show and its per-file listing does not | Test Phase 1 | Build Phase 1 | passing | unit | the release's output stays readable; research records why the 2FA prompt survives the setting | apps/indusk-mcp/src/__tests__/release-script.test.ts |

### Deferred Verification

- **The next real publish reads cleanly (U1)**
  - reason: whether the 2FA prompt still appears needs a real publish, which needs a one-time password
  - would require: `pnpm release` for 1.63.0
  - mitigation: the release is run right after this plan lands; if the prompt does not appear, the publish fails loudly (npm cannot authenticate) and the script change is reverted in a bugfix plan

## Checklist

### Test Phase 1: The three tests, red

**Goal**: write A1–A3 against today's code and see each fail on its own assertion.

- [x] Confirm this plan's worktree (`indusk plans start bugfix publish-hygiene` made it and recorded the assignment) — worktree-per-plan default
- [x] A1: rewrite the write exchange in `session-protocol-contract.test.ts`: the prompt names the `Write` tool and offers no way out; a run whose events hold no tool use is started once more; the assertion message says "the model never attempted the write" when that is the failure. A regression guard (below): it passes once written, run three times from a clean environment as the terminal starts it
- [x] A2: `admin-bundle-pack.test.ts` gains: no packed file ends in `.map`, and none is under `admin/.next/trace`, `admin/.next/trace-build` or `admin/.next/types/`. RED: 160 maps and five build artefacts are packed today
- [x] A3: `release-script.test.ts` reads `apps/indusk-mcp/package.json` and asserts the `release` script runs `pnpm publish` with `npm_config_loglevel=warn` and keeps every step it runs today in the same order. RED: the setting is absent

#### Regression Guards

- **A1** — the protocol behaviour it guards holds today (research: every attempted write was asked about); the change is to its setup, so its red is the setup's flake, not a missing feature.

#### Test Phase 1 Verification

- [x] (A2 red: 165 packed — 160 maps, `trace`, `trace-build`, three files under `types/`, measured after `pnpm run prepublishOnly`, which `pnpm pack` does not run; A3 red: the publish step has no loglevel; A1 passed three of three from a clean environment) A2 and A3 run red on their assertions (`cd apps/indusk-mcp && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/admin-bundle-pack.test.ts` and `pnpm exec vitest run src/__tests__/release-script.test.ts`); A1 passes three runs from a clean environment (`env -i HOME PATH … pnpm exec vitest run --config vitest.system.config.ts src/__tests__/session-protocol-contract.test.ts`)

### Build Phase 1: The fixes

**Goal**: make A1–A3 pass.

- [x] `scripts/bundle-admin.js` leaves out `*.map`, `.next/trace`, `.next/trace-build` and `.next/types/` when it copies the build, beside the `.next/cache` and `.next/dev` it already leaves out; its header lists them with the reason
- [x] The `release` script runs the publish as `npm_config_loglevel=warn pnpm publish --no-git-checks`

#### Build Phase 1 Verification

- [x] A1, A2 and A3 pass (the three files above), and the bundled admin still starts: `admin-cli-lifecycle.test.ts` in the system tier — A2 with the lifecycle tests, 2 files and 11 tests; A3 with every test that reads the release script, 4 files and 16; A1 three of three from a clean environment. The lifecycle test only starts the daemon, so the trimmed bundle was also started by hand and served `/` (200) and `/api/sessions` (200), and refused a rebound host (403)
- [x] `npm pack --dry-run --json` from `apps/indusk-mcp`: no `.map`, no trace, no types; record the file count and size — 939 files, 14.5 MB unpacked, 4.1 MB compressed (1.63.0 as first cut: 1,170 files, 41.5 MB, 10.7 MB); 0 maps, 0 trace or types
- [x] Shape — this phase wrote `leftOut` in `bundle-admin.js` (one rule for what the copy skips, named, with its reasons where the filter used to inline two of them) and one changed word in the release script. Nothing to change

#### Build Phase 1 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`, Releases): the admin bundle leaves out maps, trace and types, and the publish runs with npm notices off. The file is 2 bytes under its budget, so an entry moves down a tier first — delivered by the enforcer tier instead, which comes first: guard `admin-bundle-pack.test.ts` carries lesson: the-published-package-ships-only-what-runs, and guard `release-script.test.ts` carries lesson: the-release-prints-what-a-person-must-read-not-every-packed-file. The package file is unchanged. `check-pointers` fails in this worktree on one pointer this plan did not write (`.indusk/eval/results.log`, untracked evaluator state absent from a fresh worktree); it passes on trunk

#### Build Phase 1 Document

- [x] `apps/docs/src/changelog.md` Unreleased → the 1.63.0 section, under Fixed: the package no longer ships source maps or build artefacts (size before and after); the release's output no longer lists every file

### Build Phase 2: The build-session contract waits on nothing

**Goal**: the landing run of `pnpm test:system` (16:28) timed out A24's first case at 300 s (`build-session-gates.test.ts`, admin-plan-authoring A24: a build session's checkoff is judged by the project's gates). Run alone from a clean environment it passed twice, in 15 s and 22 s. The test's setup can wait forever where a real build cannot:
- it answers permission requests but not questions, which a build declines with "decide and record why";
- no session has a deadline;
- it keeps a third copy of the rate-limit rule, matching the result's text, which Build Phase 12 of admin-plan-authoring (its cleanup phase) missed.

- [x] `build-session-gates.test.ts`: a question is declined with `refuseBuildQuestion`'s message, as the manager declines one for a build; each session is stopped if it has not ended in 120 s, and that attempt is retried once; a run is rate-limited by `isRateLimitedResult` and waits the shared schedule; a failure names which of these happened, with the session's last events

- [x] Discovered while verifying: the admin's `http-promise-health.test.ts` A20 timed out at 5 s on its first page fetch twice under the full system tier, both today (the admin-plan-authoring landing and this phase's clean-environment run); alone it passes. `beforeAll` starts `next dev`, which compiles a page on its first request, so A20 paid for the compile. `beforeAll` now fetches the page once, within its own 120 s budget

#### Build Phase 2 Verification

- [x] (passed four of four, both cases, after two more setup defects surfaced in the first runs and were fixed: the prompt never asked the model to read the file, and Claude Code refuses an `Edit` on an unread file — which would also let the case of a skip given without its reason pass for the wrong reason; and a retry after a hang judged only the last attempt, which found the line already checked. The prompt now reads first, and an attempt that tried the edit ends the retries) A4: `build-session-gates.test.ts` passes three times from a clean environment (`env -i HOME PATH … pnpm exec vitest run --config vitest.system.config.ts src/__tests__/build-session-gates.test.ts`)
- [ ] Both tiers green on the branch: `pnpm test` and `pnpm test:system`

#### Build Phase 2 Context

- [x] (holds: five non-test files mention rate limits, and a search for a matching rule — a `rate.?limit` pattern or a `429` comparison — finds one, in `session/rate-limit.ts`) guard: none new — after this phase `session/rate-limit.ts` is the only rate-limit rule under `apps/indusk-mcp/src` (`grep -rln "rate.?limit" apps/indusk-mcp/src`), and the package `CLAUDE.md` already names it

#### Build Phase 2 Document

- [x] (no page names it: 0 files) Confirm no page under `apps/docs/src` describes this test's retry or timeout (`grep -rn "build-session-gates" apps/docs/src`); a test's setup changes nothing a reader of the docs relies on

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/scripts/bundle-admin.js` | leave out maps, trace and types |
| `apps/indusk-mcp/package.json` | the publish runs with npm notices off |
| `apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts` | the write exchange's setup |
| `apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts` | no maps, trace or types |
| `apps/indusk-mcp/src/__tests__/release-script.test.ts` | new |
| `apps/docs/src/changelog.md` | 1.63.0 Fixed |
