---
plan: mark-first
closed: 2026-10-19
run: unattended (INDUSK_GATE_POLICY=auto) — no person answered a question; every decision below is the retrospective's own, with its reason
---

# Retrospective — Tests and telemetry linked to clauses

## What We Set Out to Do

A clause is proved twice: its tests run and pass before a plan closes or lands, and its signal reports it upheld in a run of the real system. A clause with no report reads "no signal", never holding. A break names the promise and the clause it broke. (Brief and ADR: `brief.md`, `adr.md`.)

## What Actually Happened

- **Shape of the build.** Test Phase 1 wrote the tests red first; Build Phases 1–8 made them green in order. Build Phase 7 was the falsification phase and Build Phase 8 the cleanup phase, so the ritual gate passed on the phase sequence itself.
- **Size.** 67 commits against the merge base `dae89ebf`; 94 files, +4874 / −304 lines. Most of it is tests and the new clause readers (`clause-proof.ts`, `clause-standing.ts`, `closing-signal.ts`, `incident-signal.ts`, `status-signal.ts`, `command-tracer.ts`).
- **Ritual gate (Step 0).** `checkRetrospectiveReadiness` passed: falsification, cleanup and audit all satisfied; no non-terminal rows; no long skip reasons; no unproven promises.
- **Promise confirmation (Step 8a).** `indusk promises confirm mark-first` passed. It set `a-clause-is-proved-twice` to `enforced` with 14 test files and 6 code sites. The registry change is uncommitted and goes into the archive commit.
- **Context pointers (Step 7).** `indusk context check-pointers`: 48 pointers across 14 context files, all resolve.

### Getting to Done — the unplanned work

1. **The admin bundle was missing in this worktree.** `admin-recorder.test.ts` failed with "Admin UI bundle not found". Its own message gives the build command. I ran `pnpm --filter indusk-admin build` and `node scripts/bundle-admin.js`. This is environment setup, not a code change; `admin/` is git-ignored.
2. **One Must-not-break file is intermittently red in the landing run.** `admin-recorder.test.ts` (the must-not-break promise `a-production-break-is-recorded-unasked`) failed inside `indusk plans tests mark-first --landing` in two runs. It passed when run alone under the system config (twice), and passed inside the `src/__tests__/admin-` group. The runner deletes its JSON report, so the failure text from the batch runs was not captured. Its cause is **not established**. See the landing record below for the final status.
3. **The `closing-signal` defect.** The audit's first finding was that a refused close writes `upheld`. I checked it in the code: `closing-signal.ts:44–46` sets `broken = result.ok && half.refused.length > 0`, and `confirm.ts` returns `ok: false` whenever a half refuses, so `broken` is never true and a refused half writes `outcome: upheld`. That is the self-certifying path the ADR rejected. Confidence: high (read in source; not reproduced by a run). Decision below.

## Audit (`audit.md`) — triage

The audit (`claude-opus-5-5`) is advisory. Its findings are scenarios, not observed failures. I verified one and carried the rest as reported.

| Finding | Where | Status | Decision |
|---|---|---|---|
| A refused close writes `upheld` for the refused clause | `closing-signal.ts:44–46` | **Verified** in code | Not fixed in the retrospective. A fix changes what a close writes, and the rules require a test row for a behaviour change; a retrospective does not add rows. Filed as the first follow-up below. |
| `verified-before-release` is checked only at the owning plan's own close or landing; release runs no clause half | `clause-proof.ts:225` | Reported, not re-verified | Accepted as designed: the project's rule is that the slow tier never blocks release. Recorded so the promise's sentence is not read as broader than it is. |
| A11 live test is skipped unless `INDUSK_LIVE_CHECK=clause-signal`; the clause runner refuses an all-skipped file, and the refusal does not say so | `clause-signal.live.test.ts:71` | Reported, not re-verified | Follow-up: name the variable in the refusal text. |
| `healthOf` (admin chips, `promise_health`, editor) still shows green for a behaviour promise with an unreported clause | `health.ts:510` | Reported, not re-verified | Follow-up: align with the standing rule. |
| Verdict span from the recorder carries no `indusk.project`, so another project's pass can change this promise's read | `incident-signal.ts:57` | Reported, not re-verified | Follow-up. |
| Upheld spans measured past their bound open no incident | `watch.ts:126` | Reported, not re-verified | Follow-up; A34 says the opposite of what the code does. |
| `readsSignal` now also watches split/limit clauses of state and structure promises; the brief did not state this | `clause-standing.ts:110` | Reported | Follow-up: state the widened scope in the brief's Changes. |
| Command tracer caches its provider for the life of the process | `command-tracer.ts:31` | Reported | Follow-up: long-lived MCP and admin processes. |
| App helpers (`templates/signal.ts` and the Python helper) still write a symptom-only break event | `templates/signal.ts:58` | Reported | Follow-up: the clause is not in the event for applications. |
| Plan's own closing clause `no-signal-is-not-holding` had no writer at impl close | `impl.md` (Falsification Summary) | **Resolved** in Build Phase 7 — `status-signal.ts` writes it | None. Its heartbeat input is hard-coded `true` (`promises.ts:109`), so its blind-watcher half can fire only on a regression of the code it checks. Follow-up. |

Neither Build Phase's Shape review nor the falsification ritual raised the upheld-on-refusal path. It sits in the one function the close path depends on. That is the point to note for `/falsify`.

## Structural audit (Step 2)

`git diff --stat dae89ebf..HEAD`: 94 files, +4874 / −304. The plan touched promise readers and writers, the close and land paths, the admin recorder, the registry, the docs, and the test suite.

## Docs audit (Step 3)

- `apps/docs/src/guide/signals.md` — read against the built behaviour (attributes, the three reads, the close and land refusals). It describes what was built. Not re-checked: the other pages the plan named (`briefs.md`, `test-trajectory.md`, `reference/cli/promises.md`). I did not read them in full during this close.
- `apps/docs/src/decisions/mark-first.md` — exists, status `accepted`. **Its sidebar entry was missing** in `apps/docs/src/.vitepress/config.ts`; I added it (Step 8).
- The deferred mitigations (U1–U3) depend on dates "30 and 90 days after release". Nothing is published yet, so those dates have not started. This is recorded in the deferred list rather than changed.

## Test audit (Step 4)

- **Trajectory.** Every row is `passing`; no non-terminal or blocked rows (`nonTerminalRows: []`). The deferred rows (U1–U3) have reasons and mitigations; none is a vague mitigation. U1–U3 are dated to release, which has not happened. The carried tracer item is deferred with a reason.
- **Landing run.** `indusk plans tests mark-first --landing`: 29 of 30 files pass in the captured runs. `admin-recorder.test.ts` is the one that failed (see Getting to Done, item 2). The final status is recorded at the landing step below.
- Coverage gaps the audit names (the signal writers outside `markPromise`; `templates/signal.ts`; the closing-signal refusal path) are the follow-ups above.

## Quality audit (Step 5)

- No recurring lint or type errors were recorded in the impl; no Biome rule was added or removed. The ratchet was not changed.
- **Shape numbers.** Findings the Shape step raised across all eight Build Phases: **4** (Build Phase 4: one, the test-plan refusal before the clause check, fixed; Build Phase 5: one, a misnamed list, fixed; Build Phase 7: one, a module move, applied; Build Phase 8: one, the extraction, applied). Phases 1, 2, 3 and 6 recorded "nothing found". Findings a human judged wrong: **unknown**. The impl records no human judgment on any Shape finding, so this is not a zero; nobody reviewed them. The trigger ("second consecutive plan reporting findings a human judged wrong") cannot be evaluated from this plan alone; I did not check the earlier plans' Shape counts.

## Lesson capture (Step 6)

Highlights are filed as the ritual asks (`retro-lesson`, `retro-hindsight`, `retro-audit`); see the landing record.

## Context audit (Step 7)

- `pnpm`-free check: `indusk context check-pointers` passes (48 pointers).
- `.indusk/current.md`: `mark-first` left the **Next** list; a one-line closed entry added to the Project (shared) region. Its open item "audit-as-signal goes into `mark-first`" is closed by this plan.
- The root `CLAUDE.md` Key Decisions already carries the mark-first line; no change needed.
- Not done: a full re-read of every `CLAUDE.md` for narrative to demote (Step 7's classification pass). The budget hook did not trip on this close. I did not run the periodic "move one root entry down a tier" pass; that is a follow-up for the next retrospective.
- Sequence: the plan has a fate (`accepted`, then archived by this close). The next steps are in `current.md`.

## What We Learned

- A plan's rituals (falsify, cleanup, audit) read done from their own artefacts. The gate worked as designed; it cannot judge whether the code it checks is right.
- A check that reads its own output is circular. The signal for `upheld-by-its-signal` is written by the closing path it is meant to check; a refused close writes the upheld report that lets the next close pass (see the verified finding). Calling `confirm` twice produces its own proof.
- A Must-not-break file that depends on a built artefact (the admin bundle) fails in a fresh worktree and says nothing about the code. The landing run should check for built artefacts first.

## What We'd Do Differently

- Make the signal writer's outcome a function of the clause's standing, not of `result.ok`, and add a test row that closes a plan whose signal half refuses and asserts no `upheld` span was written.
- Have `indusk plans tests` keep the runner's JSON report on failure, so a red file's reason survives the run. Today the report directory is deleted before anyone reads it, which is why item 2 above could not be diagnosed.
- Build the admin bundle as part of worktree setup, not on the first failing test.

## Decisions made by this retrospective (unattended)

1. **Do not fix the upheld-on-refusal defect inside the retrospective.** Reason: it changes behaviour, the plan rules require a test row for behaviour changes, and a retrospective is not a build. Carried as the first follow-up; highlighted for `/falsify`.
2. **Build the admin bundle in this worktree and rerun.** Reason: environment setup the test's own message asks for; no code changed.
3. **Landing gate.** Reason: `plans land` refuses a red Must-not-break test. The retrospective lands only if the landing run is green; if it is not, the plan is not landed and the reason is recorded here.
4. **No version bump and no publish (Step 11).** Reason: the project installs its own build (`land.install`, `pnpm install:local`) and publishes deliberately; the close does not carry the person's decision to publish. Stated, recorded, stopped. `done when: published` is not met by this close.
5. **Audit findings recorded, not all verified.** Only the upheld-on-refusal finding was checked against the code. The others are carried as reported.

## Landing (Step 10) — blocked, not landed

- `indusk plans tests mark-first --landing` was run three times after the admin bundle was built. Result each time: 29 of 30 files passed; `admin-recorder.test.ts` (must-not-break: `a-production-break-is-recorded-unasked`) failed.
- The same file passed when run alone under the system config, twice, and inside its `src/__tests__/admin-` group once. Running the runner's full file set directly under the system config did not execute any tests (a file filter the runner builds did not match), so I could not reproduce the batch failure with the runner's own invocation.
- Cause: **not established.** The runner deletes its JSON report, so the failure text was not captured.
- Decision 3 applies: a red must-not-break file blocks landing. `indusk plans land mark-first` was **not run**. Nothing was merged to `main`, and the plan branch was not deleted.
- To finish: find the batch-only failure in `admin-recorder.test.ts` (likely contention or a stale daemon from another file in the batch), then rerun `indusk plans tests mark-first --landing` until green, then land, then add the landing line and run Step 11's stop.

## Follow-ups (not in this plan)

1. **Refused close writes `upheld`** (`closing-signal.ts:44–46`). Verified. Next: a plan with test rows; the test asserts no `upheld` span on a refused half.
2. Name `INDUSK_LIVE_CHECK=clause-signal` in the clause runner's refusal text (A11 / A36).
3. Align `healthOf` (`health.ts:510`) with the no-signal-is-not-holding standing.
4. Add `indusk.project` to the recorder's verdict span (`incident-signal.ts:57`).
5. Record upheld-past-bound spans as incidents (`watch.ts:126`) or change A34's sentence.
6. State the widened `readsSignal` scope in the brief's Changes.
7. Application signal helpers write the clause on the break event (`templates/signal.ts:58`).
8. Command tracer: re-resolve the daemon address for long-lived processes (`command-tracer.ts:31`).
9. Check the `admin-recorder` landing failure's cause, and keep the runner's report when a file is red.
