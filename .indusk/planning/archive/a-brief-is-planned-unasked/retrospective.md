---
title: "A brief is planned unasked"
date: 2026-10-19
---

# A brief is planned unasked — Retrospective

## What We Set Out to Do

Speed item 2: brief in, approve once, review at the end. Accepting a brief whose looks
are approved starts an unattended run that writes the test plan, the ADR and the impl,
each checked before the next, and stops for approval; approving starts the build.

## What Actually Happened

Eight build phases after a test phase: 57 files changed, 3270 insertions(+), 87 deletions(-), 98 commits.

- **The admin's interface is what draws.** Server code no longer counts as a look
  change; done with an `exclude` list, because narrowing `sources` would have reset all
  187 approved admin looks (the approval hash covers `sources`).
- **`indusk plans accept-brief`** accepts a brief once its contract passes and asks the
  running admin to start the planning run; a planning step can approve nothing.
- **The planning loop** (`nextPlanningStep`, `runPlanning`, a reader of the plan's real
  state that runs the shipped impl hook) writes one document per unattended session.
- **The admin starts it**: at acceptance, at the last look's approval, or when the
  conversation that accepted the brief ends; approving the plan starts the build.

## Getting to Done

**Falsification confirmed all eight hypotheses**: two simultaneous starts, a run
starting while the person's conversation was open, the reader judging the impl under
a different gate policy than it was written under, a check that could not run read as
a failure, approval mid-run leaving no build, an ADR left proposed, a fenced `blocker:`
ending the run.

**One falsification fix broke the feature.** Refusing to start while the planning
conversation is open meant the run almost never started, because that conversation
is where the brief is accepted. Build Phase 6 started the run when the conversation
ends; the audit then found that any conversation's end started it, and Build Phase 8
limited it to the conversation that accepted the brief (`accepted_at`).

**Confirm refused 11 times** on clause tokens split across two lines or missing; one
clean line per clause fixed it.

**The live check runs after landing**, on the installed build (Sandy, 2026-10-18).

Carried:
- Audit: "each document passes its check" is weak for the ADR (non-empty passes), and
  nothing stops a planning step from editing files other than its own document.

## What We Learned

- **A safety fix can disable the feature it protects.** The open-conversation refusal
  was right and stopped every start; each fix needs the happy path re-run.
- **Approvals bound to a hash of configuration make configuration changes expensive.**
  The looks approval hash covers `sources`; adding a key outside the hash was the way.
- **Subagents write token comments that wrap.** `confirm` reads one line; tell builders
  to put each `clause:` on its own line.

## What We'd Do Differently

- Run the live check before closing when it is the plan's whole point; here it waits
  for landing.
- Bound subagents to the phase's own test set from the start: one phase spent 19 minutes
  on a whole admin suite.

## Quality Ratchet

No Biome rule applies. Shape findings: 0 raised across eight build phases (each
reviewed), 0 judged wrong by a human.

## Metrics

- Trajectory rows: 22 (21 passing, the live check deferred to after landing)
- Phases: a test phase and eight build phases (falsification 5, conversation start 6,
  cleanup 7, audit fix 8)
- Each phase's own test set: 9–11 files, about 12 s

Landed on main at d8cd4eafc, 2026-10-19. Installed with `pnpm install:local`; nothing published. Accepted with the plan's own build, since the installed one did not yet read the admin's exclude list.

The install that failed after this landing succeeded once admin-builds-with-the-planning-reader landed (d25bf51d).

Live check (T9), run after landing on the installed build, 2026-10-19: `indusk plans accept-brief` on a throwaway feature plan (`live-check-version-path`) started the unattended run with no other action; it committed the test plan 18 s, the ADR 1 min 06 s and the impl 2 min 24 s after acceptance; the contract check and the impl structure check both passed; the run stopped with the impl in draft and the ADR proposed, nothing approved or built. The throwaway plan was then withdrawn and removed.
