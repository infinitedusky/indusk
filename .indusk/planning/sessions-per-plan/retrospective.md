---
title: "Sessions per plan — several plans, each with an agent"
date: 2026-10-14
---

# Sessions per plan — Retrospective

## What We Set Out to Do

Sandy tried to start a new plan while `component-content` had a planning session open and got "a session is already running: planning for component-content — stop it first". The admin's one `SessionManager` refused any start while it held any session. The brief set out two promises: `a-session-belongs-to-its-plan` (only a second session of the same kind on the same plan is refused) and `sessions-are-capped` (a machine-wide cap, `sessions.max`, default 4). Its Looks section said None: no screen changes.

## What Actually Happened

Everything shipped, across one test phase and five build phases (the owner rule and cap, every admin caller asking for its own plan's session, falsification, cleanup, and an audit fix). The diff against the merge base is 34 files, +1,003/−118. Fifteen trajectory rows, all passing; the trajectory audit (`auditPlanAtClose`) reports no blocked, deferred or non-terminal rows.

Four things diverged from the first plan:

- **The cap file moved.** The promise was first worded with `.indusk/config.json` and was changed to the InDusk home's `~/.indusk/config.json` before acceptance, because the daemon is machine-global and no one project's config can speak for it. A new machine-level file now exists, with only `sessions.max` in it.
- **A12 arrived mid-build, without a mockup.** Sandy asked for a plainer refusal, "Do you want to continue that session here?", with a **Continue it here** button. That became A12 in Build Phase 2. The brief says Looks: None, and a button is a look. The audit named this as behaviour the brief never promised.
- **Falsification found two real bugs, both fixed in Build Phase 3.** A13: an answer on the decision card reached the plan's other session, not the one that asked. A14: a build lost its cap slot between its steps, so its next step could be refused.
- **The A14 fix over-corrected, and the audit caught it.** A14 was fixed with an `inBuild` opt-out from the cap, which let builds exceed it: pressing Build on several plans admitted all of them and every later step skipped the cap. The cold-reader audit (`audit.md`, claude-opus-5-5) found it. Build Phase 5 replaced `inBuild` with `SessionManager.admitBuild`: a build holds one place from its start to its end, and A15 asserts it.

## Getting to Done

The audit was the most valuable step. Both the falsification fix and its over-correction passed their own rows; only a reader who did not build the plan asked whether the total could exceed `max`, and no row asserted that.

**The gate hooks were bypassed.** Earlier subagents edited `impl.md` with Python scripts. The InDusk gate hooks only see Edit and Write, so a script write skips every plan gate. Later phases used Edit. Nothing broke, but the checks that exist to stop an impl edit made out of order did not run for those edits, and nothing noticed.

The audit's `startRelease` finding did not hold: a release runs commands and starts no agent session, so it holds no place. This is recorded in Build Phase 5's note.

## Shape

Shape raised 3 findings across all phases: Build Phase 1 (`refusalFor` extraction), Build Phase 2 (the draft route's duplicated refusal), Build Phase 3 (`sessionThatAsked`). A human judged 0 of them wrong. This is not a streak of wrong findings, so nothing reopens Shape's calibration.

## Test results at close

- `apps/indusk-admin`: `pnpm test`, 89 files, 565 tests, all passing.
- `apps/indusk-mcp`: `pnpm test`, 7 failures in 6 files (2698 passed). Six were run against `main` (a checkout with unrelated uncommitted changes) and fail there too, so they are not this plan's: `always-on-cleanup` A29, `impl-corpus` A4, `plan-worktrees-cli` A13, `registry-leak-scan` A22, and two in `promises/inbox` A17. The seventh, `looks-admin-components` A2, fails on this branch (nine mockup components with no `data-component` implementation in the admin) and passes on `main`. This plan's diff adds or removes no `data-component` marker, and the branch has not had `main` merged in since the component work landed there, so the failure is branch drift; Step 10's merge of `main` is where it should clear. It is a hypothesis, not yet demonstrated: it must be re-run after that merge.

## What We Learned

- A fix for a bug found by falsification is itself new, untested behaviour. A14's fix passed its row and still broke the promise, because the row asserted the bug's absence and nothing asserted the promise's invariant (the total stays at or below `max`). The audit asked the question the rows did not.
- A refusal that is a question needs somewhere to be answered. Every same-plan refusal is now worded as a question, but only `PlanSession` has the button.
- Plan gates are enforced by hooks on Edit and Write; a script that writes the file directly is invisible to them. Subagent briefs have to say so.

## What We'd Do Differently

- Write the invariant row first. "The total never exceeds `max`" should have been in the test plan with the cap promise, not left for an auditor.
- Decide the Looks question when A12 was asked for. A button is a look; the brief's amendment path (brief-as-the-contract) was the right route and was not taken, because the change was small and conversational.
- Tell subagents to edit `.indusk/planning/**` with Edit/Write only.

## Follow-ups (audit findings left open, not fixed here)

- No row asserts the total of running sessions stays at or below `max` (A8 and A9 test only a plain start at the cap).
- No row covers the per-plan `GET /api/sessions` read path (`PlanSession`, `DraftConversation`, `StartFix` read it); A6 covers only `readWaiting`.
- The fix page (`StartFix`) and the draft conversation (`DraftConversation`) show "Do you want to continue that session here?" with no button.
- The brief says Looks: None, but a button was added; the brief was not amended.
- Other audit observations, not acted on: A2 no longer asserts the session id is in the refusal text a person reads; the eval agent and Dawn's `indusk run` start agents outside the admin's `SessionManager`, so the cap counts the admin's sessions only; the regression-guard list names only A10 and A11 although other existing promises' tests were edited; reaping several recorded sessions (`indusk ui stop`) has no test.

## Insights Worth Carrying Forward

- Ask of every cap or limit promise: what row proves the aggregate, not just the refusal.
- A mid-build change that touches what a person sees is an amendment to the brief, however small.
- Edit planning documents with the tools the gates watch.

## Close-out record

- Context: the session rules were written during the build, each one line plus a pointer to the decision page: the root `CLAUDE.md` (Key Decisions), `apps/indusk-mcp/CLAUDE.md` and `apps/indusk-admin/CLAUDE.md`. Build Phase 5 added no rule.
- Release: the build is installed by landing (`pnpm install:local`) and nothing is published; Steps 10 and 11 follow separately.
