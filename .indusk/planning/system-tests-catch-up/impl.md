---
title: "system-tests-catch-up"
date: 2026-10-09
status: approved
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
gate_policy: ask
falsification: skipped
falsification_reason: "Test-only repair (Sandy, 2026-10-09: skip all three): three test files, a CLAUDE.md line and a changelog line; no product code changes for a hypothesis to break."
cleanup: skipped
cleanup_reason: "Test-only repair (Sandy, 2026-10-09: skip all three): three test files edited in place; nothing new to decompose."
audit: skipped
audit_reason: "Test-only repair (Sandy, 2026-10-09: skip all three): no product behaviour changes; the whole system tier passing (A4) is the evidence."
---

# system-tests-catch-up

## Goal

Rewrite the three system-tier tests the 2026-10-08 changes left behind so they assert what the code now rightly does, and bring the whole system tier back to green before the next release.

## Scope

### In Scope
- `apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts` A20's skill check.
- `apps/indusk-admin/src/__tests__/http-promise-remote.test.ts` A17.
- `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts` A9.

### Out of Scope
- Any change to `lib/promises/health.ts`, the recorder or the catchup skill.
- Running the system tier at landing (release-records-its-failures' follow-up).

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A3 rewritten, green as regression guards | the three failing tests, the admin recorder, `indusk promises fix` |
| Build Phase 1 | the whole system tier green (A4); the admin rule for tests that name a production source | Test Phase 1's rewrites |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | The catchup skill's check passes on today's text ("open violations outrank the roadmap") and fails on a skill that puts the roadmap first | Test Phase 1 | Test Phase 1 | passing | unit | a regression guard over the catchup half of an-open-incident-stays-loud, worded to the meaning | apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts |
| A2 | With the project's server unreachable, a behaviour promise with no incident reads hollow `unverified`, the promise whose break the admin recorded reads `amber`, and no chip reads green | Test Phase 1 | Test Phase 1 | passing | contract | the A17 regression guard, asserting what incident-recording made true | apps/indusk-admin/src/__tests__/http-promise-remote.test.ts |
| A3 | Production's chip is red while the incident the admin recorded for its break is open, and `fixed` once that incident is fixed with `indusk promises fix` | Test Phase 1 | Test Phase 1 | passing | contract | lesson: a-fixed-break-is-history-not-health | apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts |
| A4 | Every system-tier test in dusk passes | Test Phase 1 | Build Phase 1 | planned | contract | the release's precondition; the repair is done when this holds | apps/indusk-mcp/vitest.system.config.ts, apps/indusk-admin/vitest.system.config.ts, apps/vscode-extension/vitest.system.config.ts |

## Checklist

### Test Phase 1: Rewrite the three tests to what the code rightly does

**Tier**: med

**Goal**: rewrite A1–A3 to assert the behaviour the 2026-10-08 changes made true, and record A4 red against today's tree.

- [x] Create/confirm this plan's worktree (`indusk worktree create system-tests-catch-up` — already created by `plans start`; confirm `git worktree list`)
- [x] A1: widen the skill check in `always-on-health-tool.test.ts` to the meaning — open violations (or incidents) placed ahead of / before / outranking the roadmap — and add a negative case: a skill text that lists the roadmap first fails the check
- [x] A2: in `http-promise-remote.test.ts` A17, add a behaviour promise with no violation to the fixture; with the server stopped, assert it reads `unverified`, assert `seat-never-double-booked` reads `amber` (its break was recorded, so it is known-violated), and keep "no chip is green" and "health unknown since"
- [x] A3: in `http-promise-timeline-sources.test.ts` A9, stop hand-writing the incident: wait for the incident the admin recorded for `PROD_BREAK` to appear under the fixture's `.indusk/promises/incidents/`, assert production's chip is `red`, fix that incident with `indusk promises fix <id>` (through `runCli`), and assert `fixed`
- [ ] A4: run `pnpm -w test:system` on today's tree and record its result here (red on the three files above before their rewrite)

#### Regression Guards

- **A1** — the skill already says what the row asserts; the old check failed on a rewording, not on a regression. The negative case is what makes it a guard.
- **A2** — `healthOf` already reads a known-violated promise `amber` and an unseen one `unverified`; the old test predated the admin recording the break.
- **A3** — the chip already turns `fixed` when every incident on the break is fixed; the old test fixed its own hand-written incident while the recorder's stayed open.

#### Test Phase 1 Verification

- [ ] A1 passes and its negative case fails as intended (`cd apps/indusk-mcp && pnpm build && pnpm exec vitest run --config vitest.system.config.ts src/__tests__/always-on-health-tool.test.ts`)
- [ ] A2 and A3 pass (`cd apps/indusk-admin && node ../indusk-mcp/scripts/with-daemon-guard.js pnpm exec vitest run --config vitest.system.config.ts src/__tests__/http-promise-remote.test.ts src/__tests__/http-promise-timeline-sources.test.ts`); A4 is `written` with today's red recorded

### Build Phase 1: The whole system tier, green

**Tier**: med

- [ ] Run the whole system tier and fix anything else it turns up that the three rewrites did not cover, each as its own item here

#### Build Phase 1 Verification

- [ ] A4 passes: `pnpm -w test:system` exits 0, with each package's file and test counts recorded here

#### Build Phase 1 Context

- [ ] `apps/indusk-admin/CLAUDE.md`, the recorder entry: an HTTP test whose fixture names a production source (`promises.jaeger`) runs the daemon's recorder, so its breaks become incidents and its promises `known-violated` — assert through the recorder's incidents, never a hand-written one beside them

#### Build Phase 1 Document

- [ ] `apps/docs/src/changelog.md`, `## [Unreleased]` → `### Fixed`: the system tier passes again — three tests predated the admin recording production breaks and the catchup skill's rewording

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/__tests__/always-on-health-tool.test.ts` | A20's skill check worded to the meaning, with a negative case |
| `apps/indusk-admin/src/__tests__/http-promise-remote.test.ts` | A17 asserts `unverified` for a promise with no incident and `amber` for the recorded one |
| `apps/indusk-admin/src/__tests__/http-promise-timeline-sources.test.ts` | A9 goes through the recorder's incident and `promises fix` |
| `apps/indusk-admin/CLAUDE.md` | the recorder rule for HTTP tests |
| `apps/docs/src/changelog.md` | a Fixed entry |

## Dependencies

- None.

## Notes

- The system tier did not run between 2026-10-08's landings and the 1.69.0 release; these tests fell behind silently. release-records-its-failures is the structural answer.
