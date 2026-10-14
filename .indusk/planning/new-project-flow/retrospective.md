---
title: "New project flow"
date: 2026-10-14
---

# New project flow — Retrospective

## What We Set Out to Do

Let a person start a new project from the admin by describing it: one text
box, a conversation in which the agent asks only what the idea leaves open, a
proposal the person accepts, and creation of the workbench, the repository
inside it, its worktrees folder, InDusk, the founding brief and the master
plan — with nothing created or published that the person did not accept
([brief](brief.md), [ADR](adr.md)). Ten promises, five looks of screens and
ten of new components.

## What Actually Happened

Three build phases were planned; eight ran. The plan grew twice from use and
once from its audit, and every addition went through the brief: amended,
mockups drawn and approved, `plans reapprove`, then built.

- **Build Phases 1–3** — as planned: the conversation and its draft store, the
  proposal with what can be turned off and declined, creation as a child
  process with rollback.
- **Build Phase 4 — the conversation as a thread** (added 2026-10-14, Sandy
  watching the agent's working scroll past): "you" and "agent" bubbles, the
  working folded behind See more, replies as Markdown, a shorter prompt, the
  transcript kept in the draft. Re-opened the same day for Start launching the
  agent at once and a status dot on every agent bubble (working, done,
  stopped).
- **Build Phase 5 — falsification**: the conversation's agent outlived its
  project and held the one session slot; the parent guard compared paths as
  text, so a symlink led out of it; a location inside an existing repository
  was accepted; a repository could be named `worktrees`. All four fixed.
- **Build Phase 6 — cleanup**: one `useSessionEvents` hook where two copies of
  the session subscription had grown, and one helper for finding a draft's
  agent in three routes.
- **Build Phase 7 — from the audit**: the parent set from the start page (the
  command no longer required), the agent told the parent, the GitHub box only
  the person can tick, creation from the proposal as the person saw it, the
  conversation's agent confined to its draft (Read/Write/Edit/Glob/Grep only),
  creation checking that InDusk was really installed, an unticked GitHub
  recorded as declined — and, asked for mid-phase, every look row saying
  whether it is a Mockup or a Story.
- **Build Phase 8 — the GitHub offer** (from the live check): it names the
  signed-in account, cannot be taken when nobody is signed in, and offers
  private or public.

217 commits; 180 files changed, +11,521 / −267 (120 files and +8,829 / −176
under `apps/`). 13 promises made, 44 trajectory rows, all passing.

## Getting to Done

The unplanned work was most of the work, and almost all of it came from a
person using the thing rather than from a test:

- **Two bugs found by typing into it.** A message that restarted the agent
  showed only after the next one was sent (the opening words were written after
  the new session's marker, which the history dropped, and the manager never
  replays them). Stop and "+ Add a document" were submit buttons, so Stop also
  sent the half-typed reply. Neither had a test; both have one now.
- **The approved conversation look was not what was built.** The mockup always
  showed bubbles; the build put the shared session panel there, and the looks
  check passed because it only opened the state with no agent running. A look
  held "by value" is held only in the states the check can reach.
- **The audit (a reader that had not seen the session) found what the builders
  did not**: three promises that held only because the prompt said so (the
  agent could run any shell command), a GitHub box the agent could pre-tick, a
  parent the agent was never told, an install nothing verified, and a creation
  span that is exported nowhere.
- **The live check was deferred, then half-run.** The Homework Gate run reached
  the founding brief and surfaced the two bugs above; the `hello-check` run
  reached a proposal and surfaced the GitHub questions. Creation was not
  carried to the end in either.
- **Looks churn.** Each component change reopened its stories and the screens
  that compose them, so the person approved `message` and `look-row` stories
  more than once. One Build Phase 7 change also slipped a raw Tailwind class
  past its own phase and was caught by the lint only in Build Phase 8.
- **Load-sensitive tests.** The creation tests spawn `indusk init`; under
  another session's looks check they crossed vitest's 5 s default and were
  given 20 s.

## What We Learned

- **Use finds what tests do not.** Every user-visible defect in this plan was
  found by a person using it or by a fresh reader, none by the tests written
  first. That is the case `mark-first` was written to answer: a mark where the
  promise is felt would have reported the lag bug the first time.
- **A promise held only by a prompt is not held.** If an agent can break a
  promise, the code has to stop it (confinement) and telemetry has to watch it;
  an instruction is neither.
- **A look check is only as good as the states it can reach.** The live
  conversation was never checked because no seed could start an agent.
- **Amend, approve, build works at speed.** Five brief amendments in one day,
  each with mockups and a re-approval, kept the brief true to what shipped.

## What We'd Do Differently

- Run the live check before closing Build Phase 3, not defer it: it would have
  found the thread, the lag and the GitHub questions before falsification.
- Give the conversation a state the looks check can reach with an agent
  "running" from the start (a transcript seed), instead of discovering in Build
  Phase 4 that the approved look was never held.
- Confine an agent the day it is given a session, not after an audit.

## Insights Worth Carrying Forward

- `mark-first` carries this plan's two telemetry gaps: the `new_project.create`
  span must be exported (expectations 1, 2 and 5 and the U1/U2 mitigations read
  it), and the three prompt-held promises need marks.
- `adopt-existing-project` is the follow-up for bringing an existing codebase
  (Numero) into InDusk — refused by this flow by design.
- The other agent conversations (a plan's, a build's, Fix with Claude) move onto
  `useSessionEvents` and the thread in a later plan.
- `message.agent` (a reply with no working) still has no status dot; changing it
  needs a redrawn look.

## Quality Ratchet

No new Biome rule: the one recurring slip was a raw Tailwind class
(`[overflow-wrap:anywhere]`), which `indusk looks lint` already refuses — it
was caught, one phase late, by the existing check.

Shape findings: 6 raised (Build Phases 1, 3, 4, 7 ×2 and 8), 0 judged wrong by
a person.

## Metrics

- Sessions spent: 1 long session, build phases on Sonnet subagents
- Files touched: 180 (+11,521 / −267)
- Promises made: 13; trajectory rows: 44, all passing
- Brief amendments re-approved: 5
- Shape: 6 raised, 0 judged wrong
