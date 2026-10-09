---
title: "model-per-phase — Research"
date: 2026-10-09
status: complete
workflow: bugfix
---

# model-per-phase — Research

## Question

How does InDusk run each step and each phase on the right model, and end a session where the plan already holds everything, so building costs less without anyone switching models or sessions by hand?

## Background

Sandy, 2026-10-09, near the end of a credit allowance. One session had carried vscode-extension's close, a security report, the 1.68.0 release preparation, and the planning of display-names and clean-release-build. It compacted several times.

## Findings

- **The cost was the long session, not missing state.** Each compaction is another full pass over the conversation, and the large skill texts (planner, work, retrospective, cleanup, falsify) load again after each one. `plans approve` already merges every plan document and promise to the trunk, and `/work <plan>` resumes from the first unchecked item. A fresh session per plan, or per phase, loses nothing the plan holds.
- **What a fresh session does lose is what lives only in the conversation**: machine quirks (emptying `dist/` drops `cli.js`'s executable bit; a stale `node_modules` needs `pnpm install --frozen-lockfile --force`) and work waiting on Sandy. `/handoff` writes these into `current.md`.
- **The model should follow the work.** The strongest model goes where a mistake is expensive and the output is short: planning, `/falsify`, security work. A cheaper model fits where the output is long and something checks it: `/work` on a phase whose tests are already red, where a wrong build does not go green. Bookkeeping (retrospective prose, docs, changelog) fits a cheap model.
- **Three ways a model can be chosen without a person switching it:**
  - a skill's or subagent's `model:` frontmatter (believed honoured by Claude Code; **unverified, check first**);
  - the admin's headless `claude` taking `--model` for each step;
  - `/work` running each phase as a subagent on that phase's model, which also keeps the main conversation short.
- **The planner's judgement of a phase can be wrong.** A phase can look mechanical and be security work: clean-release-build's Build Phase 2 rewrites ten commands as argument lists. An override must carry its reason, and repeated failure must escalate.

## Decisions (Sandy, 2026-10-09)

- **Do this plan first, ahead of the queue**, so the weekend's building on another account costs less.
- **Nothing is switched by hand**: the system chooses the model, or tells the person the one command to run.
- **The planner decides each phase's model when it writes the phase**, against a default per step.

## Proposed shape (for the brief and impl; not yet agreed)

1. **A model for each step and phase.**
   - Each step has its model in `workflow.steps.<step>.model`: plan, work, falsify, cleanup, retrospective.
   - A phase in the impl may override it, and the override must give a reason; the impl validator refuses an override without one.
2. **`/work` runs each phase on its model.**
   - Each phase goes to a subagent on that model.
   - `plans approve`, and each phase close, end by printing the next command, with a new session: `/work <plan>`.
   - Three failed attempts on the cheap model stop the phase and suggest the stronger one.
3. **The admin's Build button passes `--model`** to the `claude` it starts. This can be deferred: the weekend's building is in the terminal.

Estimate: about 3–4 hours in full; phases 1–2 are about half.

## Open Questions

- Is a skill's or subagent's `model:` frontmatter honoured by this Claude Code version? If not, phase 2 prints the switch for the person instead (`/model <name>`).
- How do Fable 5.1 and Opus 5.5 compare on cost and strength? This decides which of them is "strongest" for planning.
