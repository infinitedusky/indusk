---
title: "Dawn — Master Plan"
date: 2026-08-02
status: living
# Ordered children. A name here that has no folder yet is normal — it renders
# as a placeholder, which is how the sidebar shows the sequence ahead.
subplans:
  - dawn-ui-plan-grouping
  - dawn-external-orchestrator
  - dawn-hook-parity
  - dawn-verify
  - dawn-agents
  - dawn-linear
  - dawn-cloud
---

# Dawn — Master Plan

**Dawn is the discipline layer for agentic software development**: it plans the work, dispatches it to whatever agent the developer already uses, and is the only thing in the stack that says whether what came back is trustworthy. The *why* lives in [positioning.md](positioning.md); the *selection function* for what Dawn keeps and cuts lives in [maxims.md](maxims.md). **This file is the sequence** — what the components are, which are done, and what closes each one.

Open this file to answer "where are we." If the answer isn't here, the answer doesn't exist yet.

## Rules for this plan

1. **One component, one sub-plan, closed before the next opens.** A sub-plan that grows a second component's work has failed — split it.
2. **Every component has an acceptance test written before work starts.** "Done" means the test passes, not that a checklist is ticked.
3. **Status is honest at the component level.** A sub-plan can be `impl complete` while its component is partial — say so, in the table.

## Components

| # | Component | Status | What remains | Acceptance test | Sub-plan |
|---|-----------|--------|--------------|-----------------|----------|
| 1 | **Model-agnostic execution** — call any provider's model through one loop | **Done** | Claude cell run 2026-08-03 (C5: impl-complete first attempt, gate-hold held — matrix.md); A8's human read now has both columns. `atdawn run` still needs config.env sourced (loader gap, close-out item). `gpt`/`grok` resolve but have no factory | `atdawn run <plan> --model X` takes a plan to impl-complete | [dawn-external-orchestrator](../dawn-external-orchestrator/) |
| 2 | **Gate portability** — InDusk's hooks enforce outside Claude Code | **Partial** | 4 of 6 hooks unwired (`check-plan-order`, `claude-md-budget`, `gate-reminder`, `eval-trigger`); `gate_policy` forced to `auto` | A fresh plan executes identically under both lanes, hook for hook | `dawn-hook-parity` *(not created)* |
| 3 | **Loop control** — the autopilot contract, ported | **Done** | — | Per-phase scope, advance-on-green probe, goalpost guard, human-gate pause, red-stop — all green (T5/T6) | [dawn-external-orchestrator](../dawn-external-orchestrator/) |
| 4 | **Harness** — the tools the model works through | **Deliberately thin** | *A decision, not a gap* — see Open Decisions | n/a until the decision lands | — |
| 5 | **Headless/remote execution** | **Spiked once** | Manual provisioning; Fly rootfs is ephemeral; no bootstrap script or baked image | One command produces a working box that runs a plan | `dawn-cloud` *(not created)* |
| 6 | **Verification of work Dawn didn't do** | **Not started** | Everything — `atdawn verify <plan> --phase N`, git-based before-snapshot | Catches a bad phase executed in Cursor: premature checkoff, goalpost drift, red tests | `dawn-verify` *(not created)* |
| 7 | **Agent integration** — Claude Code / Codex / Cursor as executors | **Not started** | Everything | A phase dispatched to an external agent is verified and its verdict recorded | `dawn-agents` *(not created)* |
| 8 | **Coordination layer** — Linear as the substrate | **Not started** | Everything | `@dawn` on an issue runs a phase and posts verified state back | `dawn-linear` *(not created)* |

## Order

**1 → 3 → 2 → 6 → 7 → 8**, with 5 pulled in whenever the always-on box is actually wanted, and 4 settled as a decision rather than built.

- **1 and 3 are done.** Their sub-plan closes with an honest scope statement: it delivered components 1 and 3, partially delivered 2, held 4 thin by design, and spiked 5.
- **2 comes next and is small.** Not for completeness — because a lane that never fires the eval agent cannot teach you anything, which destroys the one job the thin harness has left (being the control group).
- **6 is the keystone.** The whole integration strategy rests on one untested assumption: *phase-boundary verification is sufficient enforcement when Dawn doesn't control the agent.* Nothing after it is safe to plan until that's answered.
- **7 and 8 branch on 6's result.** If boundary verification holds, integration is a thin skin over a proven command. If it leaks, 7 becomes per-agent seam work — starting with Claude Code's PreToolUse, the one seam known to be real — and the ACP question needs its own spike.

## Open decisions

- **Component 4 — does the harness stay thin?** The strategy says yes: it is the control group and the cheap mechanical lane, not a product. Every Claude Code feature it lacks (context compaction, subagents, an ask channel, conventions injection, grep/glob) is then *scope*, not a gap. **Until this is written down as a decision, those gaps will keep resurfacing as bugs.** Recommended: decide thin, record as an ADR under this plan.
- **`gate_policy` under headless runs.** Dawn can currently only run `auto`, the most permissive mode. Either teach it a headless equivalent of `ask` (a real pause), or state plainly that headless runs are `auto`-only and accept the weaker policy. Belongs to component 2.
- **The acceptance experiment (A8).** The original matrix varied model *and* harness at once, so its comparison is uninterpretable. The clean experiment holds the model constant and varies the harness: `Opus + Claude Code` vs `Opus + atdawn`, same plan, same starting commit, comparing process parity (expect none) and outcome quality (expect a delta). Needs an Anthropic key. Belongs to component 1's close-out.

## Horizon — direction, not commitments

Kept so the intent isn't lost. None of these are scheduled, and none should start before component 6 answers its question.

- **Tier-2 judgment checker** — a checker at the phase boundary reviewing the diff for judgment-invariants (broke something / ignored the instruction / real bug). The natural upgrade to component 6.
- **Hook invariant/procedure keep-shed audit** — classify every gate as invariant (keep), procedure (cut), or judgment (→ Tier-2). Unblocked by matrix evidence; scopes Tier-2.
- **ACP driver** — swap the whole *agent* rather than the model, via the emerging agent-interop protocol. Load-bearing for component 7 if per-agent seams prove costly. **Verify first: can an ACP client deny a tool call, or only observe it?**
- **Event-log coordination layer** *(from Block's Buzz)* — presence, agent actions, gate decisions, approvals as one append-only signed stream. Largely absorbable by the Linear substrate if component 8 lands.
- **Agents as signed, audited identities** — generalizes the HMAC-signed approvals into a full audit trail.
- **Cross-IDE front-ends** — thin clients over the headless core; discipline never lives in an IDE's hook system.
- **Retire the Claude Code hooks** — only if Dawn ever becomes the sole execution surface. Unlikely under the current strategy, which keeps Claude Code as a first-class lane.
- **Comparative-methodology benchmark** — Dawn's discipline against spec-first, TDD-heavy, and let-it-rip, on the same agent and workload. The honest test of maxim 5.
- **The `monitor` lifecycle stage** — the ninth loop stage becomes a real ritual: production signal feeds the next cycle's research and remember.

## Sub-plans

| Plan | Component(s) | Stage |
|------|--------------|-------|
| [dawn-external-orchestrator](../dawn-external-orchestrator/) | 1, 3 (+ partial 2, spike 5) | impl complete; awaiting A8 + retrospective |
| [dawn-ui-plan-grouping](../archive/dawn-ui-plan-grouping/) | 0 — hierarchy visible in the admin UI | complete; archived 2026-08-03 |

Everything else in the components table is unwritten. Create each with `/planner` when its turn comes — not before.

## History

Dawn was re-founded 2026-07-26 around the [maxims](maxims.md), after a session concluding that the runtime layers (interface, orchestration, compute) are commoditized while the discipline layer is unowned. The April–May research that preceded it — a greenfield rewrite of indusk-mcp, projection layers, fork-and-extract — is superseded and lives in [archive/](archive/) for provenance.

**Correction worth remembering (2026-08-02):** the first build, `dawn-external-orchestrator`, accumulated five components under one plan and was reported as "complete" when its checklist was ticked. The checklist was honest; the framing wasn't. This file exists so that never happens again — component status is tracked here, not inferred from a sub-plan's checkboxes.
