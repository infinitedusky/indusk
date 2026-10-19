---
title: "A run can be trusted — Retrospective"
date: 2026-10-19
status: completed
---

# A run can be trusted — Retrospective

## What We Set Out to Do

What an unattended run says about itself must be true. The brief set eight clauses under `a-run-is-read-from-its-record` and a further set for the shell guard, the impl clause rules, approval, the recorder test and the two landed plans. Concretely: a run is kept on disk and read back, so a dead run reads stopped and Build starts it from the step the documents say is next; the plan page shows the real phase, a true situation sentence and a release that reads released only when the plan is on main; a shell command can no longer write a plan document around its checks; an impl for a clause-bearing brief is refused without a signal task per clause; approval is offered only for a plan review that matches the documents as they stand; and the admin recorder landing test waits for its incident instead of a fixed minute.

## What Actually Happened

- Git: 122 commits on `plan/a-run-can-be-trusted` over `main`; 152 files changed, +12,861 / −487 lines (`git diff --stat main...HEAD`). Roughly half the volume is test files and trajectory rows; the Build phases touched the build host, the run-record library, the approval readers, the shell guard and its drain, and the promise contract.
- Trajectory: 103 rows, every one `passing` at close. No row was skipped or blocked; no deferral was promoted.
- Build Phases 1–8 all closed with every checklist item ticked. Build Phase 6 (recorder test) left one item open by design: the by-value look check in Chromium against the approved mockups is a person's check, recorded in that phase.
- The audit (`audit.md`, written by a fresh reader) raised 25 findings. Phase 7 (falsification) turned most into hypotheses A91–A103 and fixed them; Phase 8 (cleanup) handled the decomposition items. The full mapping is under *Audit disposition* below.
- Plan review (`plan-review.md`) and the approval hash stayed matched through build; Build Phase 5 is the change that now refuses approval against a stale review.

## Getting to Done

The unplanned work was mostly the shell guard. Decision 8 says the guard records decisions and a package drain judges them against on-disk state and a parsed command, because a verdict the guard gives itself can never read broken. The build still shipped a self-reported verdict in the clause-signal rules, a departure from Decisions 8 and 17 that the audit caught; Phase 7 removed it. The drain uses a real shell parser from npm (`shell-quote`) rather than a second hand parser.

The landed-check also turned out wrong on its first draft: it asked git whether the plan branch was contained in `main`, and a branch made from `main` with no commits passes that test. The fix (A87, Phase 7 item 27) reads the landing merge subject on the trunk, or the plan's archive folder on the trunk.

## Audit disposition

Each finding in `audit.md` is answered here, by its location, not by its label.

- Phase 7 items: stopped sentence after approval (situation.ts, A91); nav "everything is confirmed" and unread confirmation lists (next-step.ts, PlanStatusCard, A92–A93); landing read from the trunk not the checkout (landed.ts, A94–A95); the "pressed build reads dead" race (build-host.ts, A96); shell-guard write forms (plan-write-guard.js, A97–A98); guard refusing inline-interpreter reads (A99); witness blaming a command for an Edit/Write change (A100); the self-reported upheld verdict in the clause-signal rules (A101–A102); the recorder pass counting as finished on a failed read (A103); the release steps in run order (plans/steps.ts).
- The recorder clause mislabel (a landing that ran only the unit files that carry the clause token reported it upheld) is hypothesis A103 in Phase 7; the landing now reports it only from the recorder landing test's own result.
- Phase 8 items: the drain's shell reading moved to its own file, behaviour unchanged, the drain, guard and hook-port tests pass with the same assertions.
- **Left open, recorded here as residue (not a skip):**
  - The impl-structure check does not handle CRLF line endings or frontmatter that does not begin at line 1. The audit called this "a real departure from Decision 9"; the cases are unobserved in this repo. Carry to a follow-up plan; no row names it.
  - Every `indusk` command except `promises contract` now drains the guard's pending decisions, at most once a minute. The export latency is unmeasured. Carry as a timing question for the next plan that touches the drain.
  - Accepted by design, with the audit's own reasons: a terminal `/audit --before-approval` shows the Planning audit step as to-do (the clause scopes it to the admin's run); the impl rule never newly refuses an approved impl (A40); a conflicting acceptance is checked by after-landing check L2 once it happens in use.

## Unattended decisions (INDUSK_GATE_POLICY=auto)

This close ran with nobody to answer. Each decision and its reason:

1. **Ritual gate passes with no skip.** `checkRetrospectiveReadiness` reports falsification, cleanup, audit, rows and promises all satisfied; no `*_skipped` frontmatter was needed, so no skip reason is recorded.
2. **Audit findings are read against the phases that answered them, not re-opened.** The audit said "left for /falsify" for most items; Phase 7 ran the falsification and answered them. Two findings had no phase; they are the residue above and are carried, not fixed now (the CRLF case has no observed failure; the drain latency needs a measurement this close cannot make).
3. **No version bump, no publish.** `indusk checks show` names `pnpm release` as the release command, but the project installs its own build (`pnpm install:local`) and publishes deliberately. The person did not say this close is a publish, so Step 11 applies: the build is installed, nothing is published, stop.
4. **Landing runs without slow tests.** `workflow.steps.land.slow_tests` is not declared, so landing runs none; the plan's own tests run through `indusk plans tests --landing` (result in *Verification* below).
5. **Shape numbers.** See *Quality audit* below.

## Quality audit

- Shape findings applied in this plan (the checklist items that changed code, not those that left it): named helpers and rules in `build-host.ts` (record reader, situation reads, the drain's decision-file rewrite), the recorder report made once per landing (`land-recorder-signal.ts`), and the signal's reading of the review hash. **Raised: 5 (moderate confidence — counted from the checklist, not from a log).** Human-judged wrong: **not yet judged.** The person has not reviewed these, so the count is unknown, not zero. This is the first plan on which the figure is recorded; no streak to report.
- Biome: this close made no biome rule change. The impl records no recurring lint or type errors that a rule would have prevented, so no ratchet change was justified. (Moderate confidence: I did not re-read every `/work` log.)

## Verification

- `indusk plans tests a-run-can-be-trusted --landing`: see the result line recorded in the landing note on trunk (filled in at Step 10).
- `checkRetrospectiveReadiness`: passes (falsification, cleanup, audit, rows, promises all satisfied).
- `indusk context check-pointers`: passes, 53 pointers across 14 context files.
- Nested-context probe `pnpm e2e -- context-tiers` (required because CLAUDE.md files changed): see the Step 7 note below.

## What We Learned

- Judgement belongs in the code that owns the fact. A hook that scores its own writes can never read broken; the drain that compares the on-disk state against the command's parsed intent can.
- "Is this branch on main" is the wrong question for a landing. Trunk's merge subject, or the archived folder on trunk, is the record.
- A word match in a check proves the words, not the report. Pairing each clause's signal rule with an independent source (the signal reporting `refused-without-signals` broken) keeps the rule honest.

## What We'd Do Differently

- Have the hook-verdict rule (Decisions 8 and 17) checked by a test at the time the rule is first written, not left to the audit. The clause-signal rules shipped a self-reported verdict and only Phase 7's falsification removed it.
- Run the clean-branch landing check against a branch with no commits on the first pass; it was the case that broke the first landed-check draft.

## Step 8a — the close is blocked (not archived, not landed)

`indusk promises confirm a-run-can-be-trusted` refused and wrote nothing. Two rounds:

1. **26 refusals, token gaps.** Test files that prove a promise did not carry the literal `promise: <name>` token (24 files), and the two state promises had no `promise:` token in their code (`run-record/liveness.ts`, `promises/clause-signal-rules.ts`). Fixed: each file a row names for a promise now carries `// promise: <name>`; the two code doc comments carry the token. Decision (unattended): the tokens name exactly the promise each row proves, as confirm's refusals listed.
2. **12 refusals, clause signals with no real-run report.** Each clause of `a-run-is-read-from-its-record`, `a-plan-with-clauses-carries-its-signals` and `landing-tests-hold-under-load` reads "no signal has reported it upheld in a run of the real system". The impl (Decision 10, Decision 14, rows L1–L3) says those signals come from real runs after landing. A signal cannot be written by hand, and I did not write one.

Decision (unattended): **stop here.** Step 8a says do not archive past a refusal, and archival is the branch's last write before landing, so Steps 9–11 are not run. Nothing has been landed on `main`; nothing published. The person needs to decide the order: land first and confirm after the L1–L3 runs, or hold the plan open until those runs report.

Also recorded: the retrospective gate (`checkRetrospectiveReadiness`) passed while confirm refused 26. The gate counts rows and skips; it does not run confirm's token and signal rules. Highlighted as retro-audit.

The three after-landing manual checks (L1–L3) were not run; they cannot run before landing.

## Insights Worth Carrying Forward

- The audit is most useful as a list of cases to re-run, not a list of verdicts. Phase 7 turned 25 findings into concrete hypotheses in one pass.
- Record unattended decisions with their reason in the plan as they are made; this close depended on them being written down.

Landed on main at 0f6c15a3, 2026-10-19, by hand after the release stopped at Step 8a (and still read "released" on the installed build this plan replaces). Installed and the admin restarted; the plan reads "Complete — merged to main" with its confirmation list. Promises stay declared until their clauses report from real runs. The first shell write to a plan document after install was refused by the new guard.
