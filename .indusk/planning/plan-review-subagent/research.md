---
title: "plan-review-subagent — Research"
date: 2026-10-09
status: complete
---

# plan-review-subagent — Research

## Question

How does a plan get read once, before it closes, by someone who did not build it, on the strongest model, without anyone switching models or sessions by hand?

## Background

Sandy, 2026-10-09, right after `model-per-phase` landed. The tiers now exist (`workflow.tiers`, `workflow.steps.<step>.tier`), `/work` hands each phase to a subagent on its tier's model, and every boundary names the next session. The close-out is `/falsify` → `/cleanup` → `/retrospective`, and all three are run by the same agent that built the plan, in a session that has read every document and every diff it wrote. Falsification is a goal-flip of the same mind; it found four holes in `model-per-phase`, cleanup found a fifth, and all five were the builder's own blind spots pointed at by the builder. Nothing in the close-out is read by a mind that has not seen the session.

Sandy's proposal: after cleanup, a step on the strongest tier that reads the whole plan and points out issues, run by a subagent so it has no bias from the session. Sandy's choices in conversation (2026-10-09): the output is advisory (a document, nothing blocks on a finding); the reviewer gets the plan's documents and its diff, never the conversation, and not the falsify/cleanup commentary either; it runs as a step after cleanup, before the retrospective, for interactive plans and for an admin build.

## Findings

### What exists

- **A subagent is context-free by construction.** Claude Code's Agent tool gives a spawned agent only its prompt; it cannot see the parent session's conversation. `/work` already uses this with `model` (model-per-phase A5: `model: "haiku"` reported `claude-haiku-5-5`). The "no bias" property needs no machinery beyond *what the prompt hands over*: the plan's document paths and a diff, and nothing the session wrote in chat.
- **The tier config already has a slot.** `TIER_STEPS` in `lib/models/tier-names.ts` is `plan, work, falsify, cleanup, retrospective`; `readWorkflowSteps` refuses any other key. Adding `review` is one entry in that list, read by `readTierConfig` as the others are.
- **The build runner has a step list.** `BuildStepName` (`lib/build/runner.ts`) is `work | falsify | cleanup | retrospective`; `stepPrompt` (`build-session.ts`) words each; `nextBuildStep` (`next-step.ts`) decides from `checkRetrospectiveReadiness`'s `missing` list (`falsification`, `cleanup`, `rows`, `promises`). A new ritual is one more word in `missing`, one more `BuildStep`, one more prompt. `BuildSessionOptions` already takes `model`.
- **The retrospective's gate is `checkRetrospectiveReadiness`.** Adding `review` to `missing` makes the retrospective refuse to start without it, which is what Sandy chose ("the retrospective must see it exists; findings block nothing").
- **`RITUAL_ORDER` is `["falsification", "cleanup"]`** in `lib/lifecycle.ts`, read by the admin to name a plan's activity from its phase title. The review is not a phase in the impl (it is a document), so this list does not change; the admin's lifecycle derivation needs a new document position instead if it is to show "under review".
- **The plan's diff is already computed.** `branchFileChanges` (`lib/plans/plan-branch.ts`) lists what the branch changed against the trunk; `buildReview` (`lib/build/review.ts`) uses it for the files list on the admin's review panel.

### The name collides

`indusk plans review` and the admin's "review" already mean *the evidence a person reads before accepting a build* (`a-review-shows-its-evidence`). A second thing called review, written by a model, next to it would confuse both. Options: call the new step **`audit`** (`/audit`, `audit.md`, `workflow.steps.audit.tier`), or keep **`review`** and rename nothing (the admin's panel could show `review.md` as one more piece of evidence). Decision needed in the brief.

### What the reviewer reads

- The brief (promises), the test plan (assertions), the ADR (decision and rejected alternatives), the impl (rows, phases, every skip and its reason), and the diff of the plan's branch against the trunk, limited to code and docs: `.indusk/` bookkeeping excluded, the plan's own documents included once.
- Not: the research (holds the conversation's reasoning — the one document that carries the session's framing), the falsification and cleanup commentary (those are phases in the impl; the reviewer sees their *items* because they are in the impl, but not the "read, not run" prose — which is prose in the impl too. **Finding:** the falsify and cleanup commentary cannot be stripped from the impl without a parser; Sandy's "not the falsify/cleanup commentary" is only achievable by handing the reviewer the impl *as approved* (`git show main:…/impl.md` at the approval merge) plus the trajectory table as it stands now. That gives: the promises, the rows and their final states, the phases as planned, and none of the later prose.)
- The reviewer is asked a fixed set of questions, not "review this": does each promise's row prove the promise's sentence or something narrower; does the diff do anything the brief does not promise; what does the diff change that no row touches; which rejected alternative in the ADR does the code quietly take; which skip reason would the reviewer not accept.

### What it costs

Input-heavy, output-light: the plan documents (10–30 KB) plus the diff (model-per-phase: 36 files, +1444/−53, about 60 KB) on the strongest model, once per plan. Comparable to one falsification session's reading, with no tool calls beyond reads.

### Sizing

One package module, one CLI verb, one skill, the step in the runner, the readiness word, a docs page. Estimate 3–4 hours; three build phases.

## Decisions

- **Advisory, as a document** (Sandy, 2026-10-09): findings go to a file in the plan folder; the retrospective refuses to start until the file exists or the impl says why it was skipped; no finding blocks anything.
- **Documents and diff, never the conversation** (Sandy): the reviewer is a subagent; its prompt names files and a diff.
- **A step after cleanup, for interactive plans and admin builds** (Sandy): `workflow.steps.<step>.tier` names its tier; the runner runs it as a step.
- **The subagent is spawned by a skill, not by the package** (this research): the package cannot call Claude Code's Agent tool; only a session can. So the skill spawns the reviewer, as `/work` spawns a phase; the package supplies what to hand it (`indusk plans review-inputs`, or the chosen name) and checks the result exists.

## Open Questions

- **The step's name**: `audit` or `review`? (Collides with `plans review`.)
- **The impl as approved vs as it stands**: does the reviewer see the falsify and cleanup phases at all? Seeing their items tells it what the builder already found; not seeing them means it may repeat findings — which is itself information (two independent readers agreeing).
- Should the admin's acceptance panel show the document? Not promised here; a follow-up.

## Sources

- `apps/indusk-mcp/src/lib/build/{runner,build-session,next-step,review}.ts`, `lib/cleanup/gate.ts`, `lib/models/tier-names.ts`, `lib/lifecycle.ts`
- `.indusk/planning/archive/model-per-phase/` (research, A5)
- `.indusk/planning/archive/admin-plan-authoring/adr.md` (D4–D7, the build runner)
