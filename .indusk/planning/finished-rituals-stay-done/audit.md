---
plan: finished-rituals-stay-done
audited: 2026-10-16
model: claude-sonnet-5-5
---

# Audit — finished-rituals-stay-done

## Does each row prove its promise's sentence, or something narrower?
- `brief.md:19` — `a-finished-ritual-stays-done` says a step reads done once its ritual is finished, defined as "its phase closed, its audit written, or a skip with a reason". Rows A1 and A3 (steps.test.ts) hand `releaseStep` a pre-built `finishedRituals` list, so they prove only the step list's rendering. A2 (planning-reader.rituals.test.ts) proves only the closed-phase plus audit.md case end to end; A6 and A7 add the legacy log and the open item. Together they cover closed phase, legacy log, and audit.md, which is narrower than the sentence in one place, below.
- `apps/indusk-mcp/src/lib/plans/steps.ts:145` — the promise counts "a skip with a reason" as finished and says the step reads done. The code and rows A5 and A8 make a skip read `skipped`, not `done`. The rows pass, but they prove the opposite of that clause. The promise wording is wrong or the tests are; the brief's own "Must not break" list (`a-skipped-step-shows-why-on-request`) shows which was intended.
- `apps/indusk-mcp/src/__tests__/cleanup-gate.test.ts:193` — A10 is cited for `a-finished-ritual-stays-done`. It proves `finishedRitualsOf` and `checkRetrospectiveReadiness` agree on two synthetic impls with a closed phase and a written audit. It does not cover the legacy log or an open item. It does not prove anything about what the page shows.
- `apps/indusk-admin/src/lib/plan-stage.test.ts:185` — A9 (nav says Build) builds a `Plan` with a hand-written `finishedRituals` array. It proves the nav's stage logic given that field, not that the reader fills it for a real reopened plan. A2 covers that only for step states, not for the nav.
- `apps/indusk-mcp/src/lib/plans/steps.ts:147` — "keep reading done when a later build phase reopens the plan" is tested only with one position (`impl`, `in-progress`). No row covers a reopened plan with the position at `retrospective` or `accepted` states.
- A4 and A5 are labelled regression guards for `a-plan-shows-two-workflows` and `a-skipped-step-shows-why-on-request`. A4 passes `missing: ["falsification"]` with no `finishedRituals`, which is the pre-change code path. It does not exercise a ritual that is current while an earlier ritual is finished.

## What does the diff change that no row touches?
- `apps/indusk-mcp/src/lib/cleanup/gate.ts:258-270` — `checkRetrospectiveReadiness` now takes cleanup through `isCleanupPhaseTerminal(implContent)` instead of `isCleanupComplete(planRoot)`, which re-read `impl.md` from disk. When the passed `implContent` differs from the file on disk (the callers' content vs the file), the verdict can change. A10 uses matching content, so no row exercises the difference.
- `apps/indusk-mcp/src/lib/cleanup/gate.ts:92` — `isCleanupComplete` is now unused anywhere in `apps/` (only its definition remains). Dead export left behind by the refactor.
- `apps/indusk-mcp/src/__tests__/cockpit-single-definition.test.ts:49-70` — adds `finishedRitualsOf` to the single-definition guard. Its own test, not a trajectory row.
- `apps/indusk-mcp/CLAUDE.md:123-130` and `apps/docs/src/changelog.md:9` — documentation edits, covered by no row (gated only by the document step).
- `.indusk/phase-boundary.jsonl` — four ledger lines, machine state.

## What does the code do that the brief never promised?
- `apps/indusk-mcp/src/lib/cleanup/gate.ts:150-154` — an exported public function `finishedRitualsOf` in the package, consumed by the retrospective gate. The brief promised only the plan page; the gate refactor (Build Phase 3) changes how the retrospective gate is computed, which the brief lists nowhere. The brief says "Changes: None."
- `apps/indusk-mcp/src/lib/cleanup/gate.ts:150` — a completed legacy falsification log counts as finished. The brief names only "its phase closed, its audit written, or a skip with a reason". It never mentions legacy logs, and this is the tested A6 behavior.
- `apps/indusk-mcp/src/lib/plans/steps.ts:147` — "done" is returned regardless of plan position. A plan that has not been built yet but has a stray `audit.md` file shows Audit done while Build is not. `isAuditComplete` is existence-only (`gate.ts:134`). Nothing in the brief promises this and no row covers it.
- `apps/indusk-mcp/src/lib/plans/steps.ts:147` — a re-run falsification phase that is closed after an earlier closed one still reads done. A re-run that is open reads current only because `isRitualPhaseTerminal` returns false on any unchecked item, which A7 pins for Cleanup only, not Falsification.

## Which rejected ADR alternative does the code quietly take?
- nothing — no ADR exists for this plan (the plan folder holds brief, test plan, impl, audit only).

## Which skip reason would you not accept?
- `.indusk/planning/finished-rituals-stay-done/impl.md:12-13` — `falsification: skipped` with reason "Probed open phases, skips, legacy logs, out-of-order and all snapshot callers; A6–A9 pin them, none broke." That is not a skip. It says falsification was done informally by the author, and the evidence is the author's own rows. It also names "all snapshot callers" but `waiting.ts` (via `stepAt`) takes snapshots from its caller and nothing shows it was checked.
- Cleanup is also skipped in the commit log ("cleanup skipped — nothing to decompose", commit 4a3f3523e), then a Cleanup phase was added later (commit b542e800e). The skip no longer matches the plan's own state; the frontmatter pair, if still present, would make Cleanup read `skipped` and hide the closed phase (A8 behavior). I did not find a `cleanup_reason` in the impl frontmatter lines 1-17, so this is only a history inconsistency.
- No `(none needed)` gates were checked beyond the frontmatter above.

## What else would have to change for each promise to hold?
- `a-finished-ritual-stays-done` — `apps/indusk-mcp/src/lib/plans/waiting.ts:124` calls `stepAt(plan)` on snapshots passed in by callers. `apps/indusk-admin/src/lib/decisions-reader.ts:50` goes through `snapshotOf` so it is covered; any other caller building a `PlanSnapshot` by hand (the MCP `list_plans` path, if it builds one) would not carry `finishedRituals` and would still show the old behavior. I did not find such a caller, but nothing enforces that every snapshot is built through `snapshotOf`.
- `a-finished-ritual-stays-done` — the shipped skills (`apps/indusk-mcp/skills/audit.md`, `falsify.md`, `cleanup.md`) are untouched. Their text on how the page reads (if any) and the docs reference for the plan page are not updated; only the changelog is.
- `the-nav-says-where-a-plan-is` — `apps/indusk-admin/src/lib/plan-stage.ts` is untouched and relies on `stepAt`'s first-current-then-first-not-yet rule. A reopened plan whose Build segment is not current (for example approved but not started, with rituals finished) would fall through to the first `not-yet` step, which may be Review. No row covers it.
- `a-plan-shows-two-workflows` — `Review` and `Release` steps still read from the single position (brief "Not promised"), so a reopened plan can show Review `not-yet` while Audit is `done`; the order the page implies is inconsistent until that follows.
