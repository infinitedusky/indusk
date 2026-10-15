---
title: "Phase summaries"
date: 2026-10-15
---

# Phase summaries — Retrospective

## What We Set Out to Do

Make an impl readable by someone who knows the project but none of the plan's shorthand. Every phase opens with a paragraph saying what it does for the whole plan; every task is one plain sentence; code, paths and row labels fold beneath it under a closed "Technical" fold. Opt-in per impl (`phase_summary: required`), enforced by the save check, drawn by the plan page, and taught by the planner. Three promises: `an-impl-phase-explains-itself`, `technical-detail-opens-on-request`, `hidden-detail-is-only-read` (see the brief and `adr.md`).

## What Actually Happened

The three planned build phases shipped as designed: the save check and tick check (Build Phase 1), the parser and plan page with the Technical fold (Build Phase 2), and the planner template, instructions, planning rules and component-content's impl converted as the first example (Build Phase 3). Then three more phases nobody planned: a falsification phase (Build Phase 4), a cleanup phase (Build Phase 5) and an audit-fix phase (Build Phase 6). Half the plan's phases were close-out work.

The plan changed 77 files (+4486 / −351); 36 of them are code and tests (+2791 / −108). 115 commits on the branch. Every phase ran on Sonnet as its `med` tier named, each in a subagent, with this session orchestrating and checking each result independently (goalpost guard, hook replay, re-running the phase's tests).

## Getting to Done

- **Falsification found two real gaps.** The ritual-phase "finished" check and Shape's "verification green" check still counted a box line at any depth, so a task whose fold quoted `- [ ]` — which this plan's own tasks do — held its phase open forever. And the falsify and cleanup skills still handed out templates in the old shape, so following either skill on an opted-in impl got the new phase refused.
- **Cleanup found the look approval was of a drawing, not the component.** The phase-row stories hand-copied the task list with different classes; the approved snapshot was not the real fold. Redrawn from `PhaseItems`, re-approved by Sandy.
- **The audit found the biggest gap of all**: the save check enforced the new rule only on whole-file writes. An Edit with no phase heading, unticked box or Tier line skipped every rule, so a paragraph could be deleted or code put on a task line silently. The tests behind the promise only exercised Write. It also found that an unclosed fold hid every later task (a hole the falsification fix opened), that the gated loop and the repair-phase writer — files the plan never touched — still broke the promises, and that docs overstated what the paragraph check refuses. Sandy chose to fix all of them in-plan (Build Phase 6).
- **Viewing the work was harder than doing it.** The admin daemon serves the main checkout's build, so neither a restart nor the plan link showed this branch's plan page. A temporary admin on port 3941 against a scratch `INDUSK_HOME` registry got Sandy a link without touching the real registry; the Looks page's `checkout=<plan>` parameter turned out to be the right way for stories.
- **A live-check row blocked every tick.** A person's-look row with no test file stays `planned`, and the tick check refuses any tick in its phase until it is `written`. Moving it to `written` at phase start (as A13 had been) cleared it; no approval was recorded until Sandy gave it.
- **The root `CLAUDE.md` went 83 bytes over its budget** from Build Phase 1's Key Decisions line; only the full-suite run in Build Phase 5 caught it. Shortened; main has since grown again, so landing will need the compaction step.
- **The close found two more.** The full suite showed the planner-template test (`template.test.ts`) red only on this branch: it called the TypeScript validator without the template's own `phase_summary: required`, so the row labels the template now keeps in a Verification fold went unseen; it now reads the opt-in from the frontmatter, as the save check does. Every other failure either passed when run alone (load timeouts under an overlapping run) or failed the same way on `main`. And `indusk promises confirm`, run through the globally installed CLI, listed the synced `.claude/hooks/_phase-summary.js` as a code site and the registry refused it: the CLI skips the package's own hooks by reading its *installed* `hooks/` folder, which is main's build and lacks the new module. Running confirm from this branch's source got it right; once landed and installed, the global CLI will too.
- **A subagent bypassed the edit hooks once**, writing two Shape findings to `impl.md` by script. Replaying the file through both hooks showed nothing slipped; later prompts forbade script edits to impls.

## What We Learned

- A rule enforced at save time has to be tested on both the Write and the Edit path. The save check's early exit for edits that "don't touch phase structure" silently exempted most real edits; three phases of green tests only ever used Write.
- Hiding text changes every reader of the file, not just the ones the plan names. Column-zero-only box reading had to reach five readers (tick check, save check, parser, ritual gate, Shape) and two the plan never listed (the gated loop's commit cadence, the repair-phase writer). Grep every reader of the syntax, not every reader you remember.
- A fold, like a fence, must fail open when unclosed. Skipping folded text without refusing an unclosed fold turns one missing `</details>` into a phase that reads finished with work still open.
- A story that copies a component's markup approves a drawing. The approved snapshot is only evidence about the component if the story renders the component.
- A fresh reader finds what the builder cannot. The audit, reading only the approved impl and the diff, found more promise-breaking gaps than falsification did, because falsification was run by the agent that built the plan.

## What We'd Do Differently

- Write each promise's tests against every entry point of the enforcer (Write, Edit, the gated loop) in Test Phase 1, not the most convenient one.
- List every reader of checkbox syntax in the research, by grep, before the ADR — `commit-cadence.ts` and `reopen.ts` were findable on day one.
- Have the phase-row story compose `PhaseItems` from the moment `PhaseItems` existed (Build Phase 2) rather than hand-drawing the fold; it cost a second approval round.
- Run the root-budget test (`context-tiers-register`) as part of any phase that edits a `CLAUDE.md`, not only at the full suite.

## Insights Worth Carrying Forward

The close-out rituals earned their place: falsification, cleanup and the audit each found something the others missed, and the audit — the only cold reader — found the most. For a plan whose subject is a rule about the plan format itself, the plan's own impl is the best test fixture; several bugs surfaced because this impl was opted in.

## Quality Ratchet

No recurring lint or type errors during `/work` suggested a missing Biome rule; the defects were behavioural (an enforcer's early exit, an unclosed fold), which a lint rule cannot see. No Biome change.

Shape findings: 3 raised (two in Build Phase 2 — naming the fold-edge tests and the one-task markdown writer; one in Build Phase 6 — naming the edit-time check), 0 judged wrong by a human. No streak.

## Metrics

- Sessions spent: one orchestrating session across all phases and rituals, with eight phase subagents (Sonnet) and one audit reader (Opus)
- Files touched: 77 (36 code and test)
- Lines added/removed: +4486 / −351 (code and tests +2791 / −108)
- Trajectory: 27 rows, all passing; 3 promises
- Commits on the branch: 115

Landed on main at 61c6f5403, 2026-10-15.
