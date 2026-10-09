---
title: "plan-review-subagent — the audit step"
date: 2026-10-09
---

# plan-review-subagent — Retrospective

## What We Set Out to Do

Every other close-out ritual — falsification, cleanup, the retrospective — is run by the agent that built the plan, in the session that holds every document and diff it wrote. The brief asked for one reading by someone who had not: before a plan closes, a reader that never saw the building session reads it and writes what it finds to `audit.md`, the retrospective refuses to start until that file exists (or the impl says why the audit was skipped), the reader runs on the model `workflow.steps.audit.tier` names, and nothing it finds blocks anything. Four promises: the plan is audited by a fresh reader; the auditor sees the plan, not the session; the auditor runs on its tier; an audit blocks nothing.

The ADR chose a document (`audit.md`) rather than a phase appended to the impl, found the approved impl by the approval merge's commit subject rather than by parsing later phases out, and spawned the reader from the skill rather than from the package.

## What Actually Happened

All of it shipped, across one test phase and six build phases: three planned, a falsification phase (Build Phase 4), a cleanup phase (Build Phase 5), and a sixth phase the audit itself produced. 90 commits; 20 source files (+461/−66), 17 test files (+969/−79), 21 markdown and docs files (+363/−35). Twenty-two trajectory rows, A1–A22, all passing.

- **Build Phase 1** made `audit` a ritual word: `isAuditSkipped`/`isAuditComplete`, `audit` in the readiness check's `missing`, `plans next` → `audit`, `next-session` → `/audit`, and the runner's `audit` step.
- **Build Phase 2** built `indusk plans audit-inputs` (`lib/audit/inputs.ts`), `audit` in `TIER_STEPS`, and `plans model --step`. It also wired the admin build to run every step on its tier's model, a thing the approved impl had listed as out of scope (see below).
- **Build Phase 3** wrote the `/audit` skill, the planner's `**Tier**:` line under every phase, the live check (A9: an Agent spawned with `model: haiku` reported `claude-haiku-5-5`), and the docs.
- **Build Phase 4 (falsification)** found five ways the auditor still saw the builder's notes or could not be handed the plan at all: the diff carried the impl's post-approval phases; the approved impl was named by the working file's path; `stat` held no file the plan did not touch; every workbench plan was refused; and an audit skip was invisible on the review panel. All five fixed (A15–A19).
- **Build Phase 5 (cleanup)** consolidated the three copies of the skip-pair reader into `isRitualSkipped` (A20) and routed `plans model --step` through `buildStepModel`.
- **The audit**, the plan's own step run on itself, ran on `claude-opus-5-5`. No tier is configured for the step, so it ran on the session's model. It found 23 things and two defects that broke the plan's own promises. **Build Phase 6** fixed those two (A21, A22): the impl validator hook's step list lacked `audit`, so setting the audit tier would have refused every impl edit carrying a `**Tier**:` line; and the plan bar put a cleaned plan with no audit at `review`, so the admin offered Accept before the audit had run.

## Getting to Done

- **The plan's first real audit was of itself.** `/audit` was not installed in the session (skills load from the main checkout), and the installed `indusk` lacked `audit-inputs` and `--step`. The audit ran from the worktree's skill text and the worktree's built CLI. The installed `indusk plans next-session` printed `/retrospective`, skipping the audit, for the same reason.
- **A cleanup note tripped the human-gate detector.** A left-as-is item mentioning the trajectory's deferred-verification subsection by its heading matched `detectHumanGate`'s `/deferred verification/i` pattern, and `plans next` answered `judgement` — an unattended build would have stopped at a note. Reworded before commit.
- **`.indusk/current.md` was about to make the hook defect live.** Its line for this plan says to set `workflow.steps.audit.tier: strong` when the weekend's building starts. That instruction plus the hook's missing step would have refused every impl edit the next plan made. This is why the two audit fixes were done before close rather than carried.

## What We Learned

- **The audit earned its place on its first run.** The falsification phase and the cleanup phase were run by the builder, and neither found that the hook's hand-ported step list had fallen behind `TIER_STEPS`, nor that the plan bar's position ignored the new readiness entry. The fresh reader found both by reading `tree` against `stat`: the files the plan did not touch that its promises depend on. Both are "a list somewhere else that enumerates the same thing," and a builder who added `audit` to six lists does not go looking for the seventh.
- **A parity test that enumerates its cases by hand cannot catch a new member.** `phase-tier-parity.test.ts` fed both copies the same configs, but the configs named steps literally, so a step added to the TS and not the hook passed. A21 now builds a case from `TIER_STEPS` itself.
- **"Out of scope" in the impl did not stop the work.** Build Phase 2 wired the admin build's per-step model although the approved impl's Out of Scope named it as the model-per-phase follow-up, and the ADR still says "the admin needs no change." It was claimed under a must-not-break promise (A14) rather than declared. The audit's question 3 caught it.
- **The human-gate detector matches words, not intent.** A checklist item that mentions a deferred-verification heading in passing is treated as a person's judgement.

## What We'd Do Differently

- **Read the inputs' provenance against the promise before building them.** The promise says the auditor sees nothing of the builder's findings, but the brief, test plan and ADR are read from the working copy, and `trajectoryNow` carries rows falsification and cleanup added. The impl as approved was protected carefully; the other documents were not considered. The docs page now says so; the fix is a follow-up.
- **Grep for every enumerator of the thing you extend.** Adding a ritual meant touching `TIER_STEPS`, `BuildStepName`, `SESSION_STEPS`, `skippedRituals`, `RITUAL_TITLES`, the hook's `STEPS`, `PlanPosition`. The first five were found; the last two were found by the audit.
- **Declare scope expansions when they happen.** When Build Phase 2 took on the admin's per-step model, it should have amended the brief and ADR (or asked) rather than letting a must-not-break row carry new behaviour.

## Insights Worth Carrying Forward

- The audit's question 6 ("what else would have to change," `tree` vs `stat`) is the one a builder structurally cannot answer. Watch whether it keeps producing the real findings across the next five plans (the brief's expectation 1).
- Unaddressed audit findings, carried to a follow-up: the documents and trajectory rows still reach the auditor as they stand; `--approved <sha>` accepts any commit; `stat` is not filtered for `.indusk/`; `plans model --step` answers for a plan name that does not exist; nothing commits `audit.md`; the admin's own `skippedRituals` (`planning-reader.ts`) does not list an audit skip; the admin build resolves the retrospective's model after recording acceptance, so a bad tier config leaves the plan accepted with the release failed; `next-step` answers `audit` before `rows`, spending an audit on a plan that will then stop for non-terminal rows.

## Quality Ratchet

No recurring lint or type errors during `/work`; no Biome rule is warranted.

**Shape**: 5 findings raised across the phases (Build Phase 1: one; Build Phase 2: three; Build Phase 4: one), 0 judged wrong by a person. Four further Shape entries were "reviewed, left as-is" or "nothing found" (Phases 1, 4, 5, 6). Phase 1's Shape noted `isAuditSkipped` as the third copy of the skip reader and left it to cleanup, which extracted it: the division between Shape and cleanup worked as designed.

## Metrics

- 90 commits; 58 code/test/docs files changed outside `.indusk/`.
- 22 trajectory rows, 22 passing.
- Audit: 23 findings over six questions; 2 fixed before close; the rest carried.
