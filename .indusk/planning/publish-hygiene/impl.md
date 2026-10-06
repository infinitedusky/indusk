---
title: "publish-hygiene"
date: 2026-10-06
status: approved
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
| A2 | The published package carries no source maps, no Next build trace and no generated types | Test Phase 1 | Build Phase 1 | written | contract | the package ships only what runs; the admin-ui-hosting decision bounds the tarball's size | apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts |
| A3 | The release's publish step runs with npm's notices off, so its warnings, errors and 2FA prompt show and its per-file listing does not | Test Phase 1 | Build Phase 1 | written | unit | the release's output stays readable; research records why the 2FA prompt survives the setting | apps/indusk-mcp/src/__tests__/release-script.test.ts |

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

- [ ] A1, A2 and A3 pass (the three files above), and the bundled admin still starts: `admin-cli-lifecycle.test.ts` in the system tier
- [ ] `npm pack --dry-run --json` from `apps/indusk-mcp`: no `.map`, no trace, no types; record the file count and size

#### Build Phase 1 Context

- [ ] mcp (`apps/indusk-mcp/CLAUDE.md`, Releases): the admin bundle leaves out maps, trace and types, and the publish runs with npm notices off. The file is 2 bytes under its budget, so an entry moves down a tier first

#### Build Phase 1 Document

- [ ] `apps/docs/src/changelog.md` Unreleased → the 1.63.0 section, under Fixed: the package no longer ships source maps or build artefacts (size before and after); the release's output no longer lists every file

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/scripts/bundle-admin.js` | leave out maps, trace and types |
| `apps/indusk-mcp/package.json` | the publish runs with npm notices off |
| `apps/indusk-mcp/src/__tests__/session-protocol-contract.test.ts` | the write exchange's setup |
| `apps/indusk-mcp/src/__tests__/admin-bundle-pack.test.ts` | no maps, trace or types |
| `apps/indusk-mcp/src/__tests__/release-script.test.ts` | new |
| `apps/docs/src/changelog.md` | 1.63.0 Fixed |
