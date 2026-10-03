---
title: "watch opens an incident and silently does not reopen its owner"
date: 2026-10-02
status: completed
trajectory: required
test_phases: required
gate_policy: ask
---

# watch reopen collision — Implementation

## Goal

A broken promise always reaches a plan that owns it, or `watch` says loudly
that it did not. The incident id allocator skips any id the owner's impl
already names in a Maintenance heading; the reopen, told whether an incident
was opened or extended, refuses an opened one whose heading exists with a
`collision`; and every reopen that did not happen for an opened incident is an
error line and a non-zero exit. See [brief.md](brief.md) and
[test-plan.md](test-plan.md).

## Scope

### In Scope
- The allocator: an id named by a Maintenance heading in the owner's live copy
  is taken
- The reopen: opened vs extended; `collision` for an opened incident whose
  heading exists
- The report of a watch run: one rule — any opened incident not reopened
  (`collision`, `no-owner`, `copy-problem`) prints an error and exits 1
- The new test file joins the system tier

### Out of Scope
- `watch` and the reopen writing `impl.md` with `writeFileSync`, unseen by the
  impl validator (brief, "Related, out of scope")
- The always-on pass, which detects and notifies and never reopens

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Test Phase 1 | A1–A4 authored; A1, A3, A4 red, A2 a regression guard | today's `watch`, `reopenOwner`, the promises fixture, a real local Jaeger |
| Build Phase 1 | `maintenanceIncidentIds(implText)`; `recordViolations` takes ids to avoid; `reopenOwner(…, kind)` with a `collision` reason; `watchReport(result)` → lines + exit code; the CLI prints it | Test Phase 1's rows |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Test |
|----|---------|-------------|-----------|-------|------|
| A1 | After an incident file is deleted while its Maintenance phase stays in the owner's impl, the next violation of that promise the same day opens an incident with a new id (`…-2`), and the owner gains a new Maintenance phase for it | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts |
| A2 | A violation while an incident is open extends it: no second Maintenance phase, no error line, exit 0 | Test Phase 1 | Test Phase 1 | passing | apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts |
| A3 | A new incident whose Maintenance heading already exists in the owner's impl is refused by the reopen as a collision with the impl untouched, and the report of that watch run prints an error naming the owner and the heading and exits non-zero | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/lib/promises/reopen-collision.test.ts |
| A4 | A watch run in which a newly opened incident did not reopen its owner — here, an owner that is not a plan folder — exits non-zero | Test Phase 1 | Build Phase 1 | passing | apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts |
| A5 | A violation that *extends* an open incident whose owner is not a plan folder still makes `watch` exit non-zero — an extended incident is as unowned as an opened one | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts |
| A6 | An open incident whose owner carries no Maintenance phase for it is reopened on the next `watch` run even when no new violation arrived; if the owner still cannot be reopened, that run says so and exits non-zero rather than "No new violations" | Build Phase 2 | Build Phase 2 | passing | apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts |

## Checklist

### Test Phase 1: author every assertion, RED

**Goal**: author all four rows now — every subject exists today, so nothing is
deferred — and read each failure.

- [x] Create/confirm this plan's worktree (`indusk worktree create watch-reopen-collision`, which records the assignment so the admin and plan tools read the plan from it) — worktree-per-plan default
- [x] Author A1, A2 and A4 in `src/__tests__/watch-reopen-collision.test.ts`: one real local Jaeger (`helpers/local-jaeger.ts`), one promise project per case (`helpers/promises-fixture.ts`) with an active owner plan whose `impl.md` is written by the fixture, violations loaded as spans, `indusk promises watch` run through the CLI. A1's owner carries `### Build Phase 3: Maintenance — i-<today>-<promise>` and no incident file; A2's carries the open incident and its phase; A4's promise names an owner with no plan folder. Add the file to `SYSTEM` in `vitest.tiers.ts` in the same commit
- [x] Author A3 in `src/lib/promises/reopen-collision.test.ts`: `reopenOwner` called with a sixth argument `"opened"` on an impl that already has the heading expects `{ reopened: false, reason: "collision" }` and the impl byte-for-byte unchanged; `watchReport` loaded by dynamic import (it does not exist yet — a static import would fail the file at load, not on an assertion) and asserted to exist, then given a result carrying that collision, expected to name owner and heading in an error line and return exit code 1
- [x] Run each and read each failure: A1 opens the bare id and reopens nothing; A3 gets `already`, and `watchReport` is not a function; A4 exits 0; A2 passes — read 2026-10-02, each exactly as predicted

#### Regression Guards

- **A2** — today's behaviour for an extended incident, which the fix must keep: quiet, one phase, exit 0. It passes when written, and that is the point; it goes red only if the opened-vs-extended split leaks into the extended path.

#### Test Phase 1 Verification

- [x] A1, A3 and A4 fail on their own assertions and A2 passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watch-reopen-collision` and `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/reopen-collision`)

### Build Phase 1: the allocator, the reopen, the report

- [x] `lib/promises/reopen.ts`: `maintenanceIncidentIds(implText): Set<string>` — the incident ids named by Build-phase Maintenance headings, the inverse of `maintenanceHeadingName`, beside it
- [x] `lib/promises/incidents.ts`: `recordViolations` and `newIncidentId` take `avoid: ReadonlySet<string>`; an id is free only when neither `incidents/<id>.md` exists nor `avoid` holds it
- [x] `lib/promises/watch.ts`: before recording, resolve the owner's live copy once (the copy `reopenLive` already resolves) and pass its `maintenanceIncidentIds` as `avoid`; an owner with no impl, or no folder, avoids nothing
- [x] `lib/promises/reopen.ts`: `reopenOwner(planRoot, owner, incidentId, promise, liveDir, kind: "opened" | "extended")` — `kind` defaults to `"extended"`, today's behaviour, for the other caller (`monitor-reopen-validator.test.ts`); `watch` passes the change's kind; an existing heading is `already` for `extended` and `{ reopened: false, reason: "collision", heading }` for `opened`, with nothing written
- [x] `lib/promises/watch.ts`: `watchReport(result): { out: string[]; err: string[]; exitCode: 0 | 1 }` — every line `promises watch` prints today, plus an error line for a collision naming the owner and the heading; exit 1 whenever an *opened* change was not reopened. `bin/commands/promises.ts` prints it and sets `process.exitCode`
- [x] Discovered: root `pnpm test` runs `turbo test --concurrency=1`. Since the two test tiers merged (2026-10-02) the mcp suite runs its files in parallel on every core, and turbo ran the admin suite beside it: the admin's real-Jaeger HTTP tests (`http-promise-health`) timed out, 3 failed, and passed 8/8 alone. Serialized, both pass in 77 s
- [x] Shape (Build Phase 1): reviewed `reopen.ts`, `incidents.ts`, `watch.ts` and `bin/commands/promises.ts`. Nothing found: `maintenanceIncidentIds` is the stated inverse beside the function it inverts; `ownerCopy` and `idsTakenByOwner` each answer one question, and resolving the copy once is what keeps the avoided ids and the reopened copy the same file; `watchReport` is a pure seam A3 reaches. Left as is: `watchReport` returns stdout and stderr lines separately, so the error lines now print after the run's other output rather than under the incident they belong to — each names its owner and incident, and a failure block at the end of a run reads as one; interleaving would need a tagged-line shape for one caller

#### Build Phase 1 Verification

- [x] A1, A3 and A4 pass and A2 still passes (the two commands in Test Phase 1's Verification); `monitor-watch.test.ts` still passes (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/monitor-watch`) — system tier 8/8 (A1, A2, A4 and monitor-watch's five), unit 6/6 (A3's two and `monitor-reopen-validator`)
- [x] The everyday suite and the system tier are green (`pnpm test`, `pnpm test:system`) — mcp 1,668 passed / 5 skipped, admin 342, `promises check` clean (77 s, packages serialized); system tier 22 files, 81 tests

#### Build Phase 1 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`), the promises entry: an opened incident never shares an id with a Maintenance heading in its owner (the allocator avoids them), and `watch` exits 1 for any opened incident it did not reopen — a skipped reopen never reads as success

#### Build Phase 1 Document

- [x] `apps/docs/src/reference/cli/promises.md`, the `watch` section: the exit codes (0, 1 for an opened incident not reopened — collision, no owner, unreadable worktree record — 2 when Jaeger is unreachable) and the collision line; `apps/docs/src/changelog.md` Unreleased, Fixed

### Build Phase 2: Falsification — a missed reopen is loud once, then quiet forever

**Goal**: verify whether the attested state — *a broken promise always reaches a plan that owns it, or `watch` says loudly that it did not* — holds past the first run. Build Phase 1 made the run that **opens** an unowned incident fail. Two paths still leave an incident owned by no plan behind a run that exits 0:

- **A5** — `watchReport` sets the failure only for `kind === "opened"`. A promise whose owner is not a plan folder fails on its first violation; on the second, the incident is *extended*, the error line prints, and the run exits 0. The incident is exactly as unowned as before.
- **A6** — `watchPromises` skips a promise with no fresh traces (`recordViolations` returns null, the loop `continue`s). So after a run that recorded an incident and could not reopen its owner, every later run reads "No new violations — nothing recorded." and exits 0, while the open incident has no Maintenance phase anywhere. A person who missed the one failing run — a cron job, a scrolled terminal — is never told again, and fixing the owner does not repair it: nothing ever retries the reopen.

- [x] Author A5 and A6 red in `src/__tests__/watch-reopen-collision.test.ts` (system tier): A5 — an open incident for a promise whose owner is not a plan folder, plus a new violation; A6 — an open incident whose trace is already recorded and whose owner exists with no Maintenance phase for it, then the same with an owner that is not a plan folder. Run each and read each failure
- [x] `lib/promises/watch.ts`, `watchReport`: the run fails for any change whose reopen did not happen except `already` (the owner carries the phase) — opened or extended alike
- [x] `lib/promises/watch.ts`, `watchPromises`: for every behaviour promise, after recording, each **open** incident with no change this run is checked against its owner's live copy: when the owner names no Maintenance phase for it, the reopen is attempted (`kind: "extended"` — the incident is not new) and the result reported as a change of kind `unowned`, so a quiet window can still repair, or report, an incident left unowned
- [x] `watchReport` prints an `unowned` change that reopened as `reopened <owner>: …` under a line naming the open incident, and one that did not as the same error lines as any other missed reopen

#### Build Phase 2 Verification

- [x] A5 and A6 pass, and A1–A4 and `monitor-watch.test.ts` still pass — system tier 11/11, unit 6/6; (`pnpm --filter @infinitedusky/indusk-mcp exec vitest run --config vitest.system.config.ts src/__tests__/watch-reopen-collision src/__tests__/monitor-watch`; `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/promises/reopen-collision`)
- [x] The everyday suite and the system tier are green (`pnpm test`, `pnpm test:system`) — mcp 1,668 passed / 5 skipped, admin 342, `promises check` clean; system tier 22 files, 84 tests
- [x] Shape (Build Phase 2): reviewed `watch.ts`. Nothing found: `WatchChange` names the run's unit now that it is not only an `IncidentChange`; `reopenFor` is the one reopen call the loop makes in two places, so the copy-problem fallback is written once; the retry reads the owner's ids after this run's own reopen, which is what keeps a just-reopened incident from being reported unowned

#### Build Phase 2 Context

- [x] mcp (`apps/indusk-mcp/CLAUDE.md`), the entry Build Phase 1 added: `watch` fails any run that leaves an incident without its owner's phase — opened, extended, or open from an earlier run — and retries that reopen on every run until it lands

#### Build Phase 2 Document

- [x] `apps/docs/src/reference/cli/promises.md`, the `watch` exit table and "Reopening the owner": exit 1 covers extended and earlier-run incidents too, and an unowned open incident is retried every run; `apps/docs/src/changelog.md` Unreleased, the same Fixed entry

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/promises/incidents.ts` | `avoid` set in the id allocator |
| `apps/indusk-mcp/src/lib/promises/reopen.ts` | `maintenanceIncidentIds`; `kind`; `collision` |
| `apps/indusk-mcp/src/lib/promises/watch.ts` | avoid set from the owner's live copy; `watchReport` |
| `apps/indusk-mcp/src/bin/commands/promises.ts` | prints `watchReport`, sets the exit code |
| `apps/indusk-mcp/vitest.tiers.ts` | the new system-tier file |
| `apps/indusk-mcp/src/__tests__/watch-reopen-collision.test.ts` | A1, A2, A4 |
| `apps/indusk-mcp/src/lib/promises/reopen-collision.test.ts` | A3 |

## Dependencies

- The two test tiers (`vitest.tiers.ts`, merged 2026-10-02)
