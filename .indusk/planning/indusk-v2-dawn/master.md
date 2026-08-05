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
| 1 | **Model-agnostic execution** — call any provider's model through one loop | **Done — A8 signed off 2026-08-03** | Acceptance met (matrix.md: 9 cells, mutation-based quality read — 8/8 kills across all models/harnesses; flash-for-mechanical routing; trajectories must name every deliverable). Remaining close-out items: config.env loader gap; `gpt`/`grok` factories | `atdawn run <plan> --model X` takes a plan to impl-complete | [dawn-external-orchestrator](../archive/dawn-external-orchestrator/) |
| 2 | **Gate portability** — InDusk's hooks enforce outside Claude Code | **Done — closed 2026-08-03** | Every invariant hook now enforces in the thin lane (`claude-md-budget` wired; `eval-trigger` served by the pending-eval queue + external drain); `ask` is the default in both lanes with a real headless pause; `gate-reminder` **deliberately shed** (advisory nudge, not an invariant — first keep-shed audit entry). Inventory corrected: 5 hooks on disk, not 6. Unpublished — consumers get it at the next publish | A fresh plan executes identically under both lanes, hook for hook, for every hook that is an invariant; sheds are recorded | [dawn-hook-parity](../archive/dawn-hook-parity/) |
| 3 | **Loop control** — the autopilot contract, ported | **Done** | — | Per-phase scope, advance-on-green probe, goalpost guard, human-gate pause, red-stop — all green (T5/T6) | [dawn-external-orchestrator](../archive/dawn-external-orchestrator/) |
| 4 | **Harness** — the tools the model works through | **Deliberately thin** | *A decision, not a gap* — see Open Decisions | n/a until the decision lands | — |
| 5 | **Headless/remote execution** | **Spiked once** | Manual provisioning; Fly rootfs is ephemeral; no bootstrap script or baked image | One command produces a working box that runs a plan | `dawn-cloud` *(not created)* |
| 6 | **Verification of work Dawn didn't do** | **Done — acceptance met 2026-08-05** | `atdawn verify <plan> --phase N` ships five detections (premature checkoff, skipped test-first duty, goalpost drift, **red tests**, **phantom work**) over a chained verify ledger. Detects and reports only — reverting is component 7's. Unpublished | **Met.** 6-cell matrix against a hookless `claude` session (hooks on disk, unregistered — the Cursor shape): 5/5 planted classes caught, 0 misses, 0 false positives on the honest control. See [matrix.md](../archive/dawn-verify/matrix.md) | [dawn-verify](../archive/dawn-verify/) |
| 7 | **Agent integration** — Claude Code / Codex / Cursor as executors | **Not started** | Everything | A phase dispatched to an external agent is verified and its verdict recorded | `dawn-agents` *(not created)* |
| 8 | **Coordination layer** — Linear as the substrate | **Not started** | Everything | `@dawn` on an issue runs a phase and posts verified state back | `dawn-linear` *(not created)* |

## Order

**1 → 3 → 2 → 6 → 7 → 8**, with 5 pulled in whenever the always-on box is actually wanted, and 4 settled as a decision rather than built.

- **1, 2 and 3 are done.** 1 and 3 closed with dawn-external-orchestrator (which also held 4 thin by design and spiked 5); 2 closed 2026-08-03 with dawn-hook-parity — the thin lane now fires the eval agent via the queue + drain, so it can finally teach the system, which was the whole reason to do it before the keystone.
- **6 was the keystone, and it is answered.** The assumption — *phase-boundary verification is sufficient enforcement when Dawn doesn't control the agent* — **held** under deliberate attack: five planted violation classes, five caught, no false positive on an honest uncontrolled run (2026-08-05). It is a *sample*, not a proof (U1 stays deferred), but the mechanism works and its failure modes are detectable after the fact. Component 6 also closed a gap wider than tier 3: nothing in InDusk had **ever** executed a test as a gate, so `passing` was an unverified self-report in every lane — verify is the first thing that checks it.
- **7 and 8 are unblocked, and 6's result picked the branch.** Boundary verification held, so **7 is integration over a proven command, not per-agent seam plumbing.** The seam question survives in a narrower form: verifying whether a harness's hook can actually *deny* still matters for the prevention tier, but it is no longer load-bearing for correctness — detection now has a floor under every tier.

## The enforcement ladder

Three tiers, by who owns the tool executor (recorded 2026-08-03; this is the rationale behind the 2 → 6 → 7 order):

1. **atdawn** — Dawn owns the executor; gates are wired into the write path itself (components 1–3, completed by component 2's parity work). Prevention: a refused write never exists.
2. **Harnesses with deny-capable hooks** — use theirs, same gate scripts, their seam. Claude Code's PreToolUse is the **one seam verified real**; every other harness's (Cursor, ACP) must be verified deny-capable before being trusted — that verification is component 7's first task.
3. **Harnesses Dawn doesn't control** — prompting is alignment lubricant, never enforcement. The enforcement is phase-boundary verification + reject-and-rerun (component 6): git before-snapshot, catch premature checkoff / goalpost drift / red tests, revert to snapshot — never rewrite history.

Component 6's verify is also the **universal floor**: it runs on every tier as detection defense-in-depth. **Proven 2026-08-05** — and the floor turned out to matter on tiers 1 and 2 as much as tier 3, because the trajectory's `passing` state had never been checked against a test run in *any* lane.

## Open decisions

- **Component 4 — does the harness stay thin?** The strategy says yes: it is the control group and the cheap mechanical lane, not a product. Every Claude Code feature it lacks (context compaction, subagents, an ask channel, conventions injection, grep/glob) is then *scope*, not a gap. **Until this is written down as a decision, those gaps will keep resurfacing as bugs.** Recommended: decide thin, record as an ADR under this plan.
- ~~**`gate_policy` under headless runs.**~~ **Resolved 2026-08-03 by component 2** — headless `ask` is a real pause: the loop classifies `check-gates`' proof-less-skip refusal and exits 3 with the question and required proof format. `ask` is now the default in both lanes; `auto` is an explicit per-plan opt-in for deliberately unattended runs.
- ~~**The acceptance experiment (A8).**~~ **Resolved 2026-08-03** — run at sonnet (C5 atdawn vs C6 Claude Code, same model/task/state): process parity held, no measurable quality delta (mutation kill-rate identical); signed off in the archived plan's matrix.md. The Opus pair remains available as a refinement, not a blocker.

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
| [dawn-external-orchestrator](../archive/dawn-external-orchestrator/) | 1, 3 (+ partial 2, spike 5) | closed; archived 2026-08-03 (A8 signed off) |
| [dawn-ui-plan-grouping](../archive/dawn-ui-plan-grouping/) | 0 — hierarchy visible in the admin UI | complete; archived 2026-08-03 |
| [dawn-hook-parity](../archive/dawn-hook-parity/) | 2 — gate portability | closed; archived 2026-08-03 |
| [dawn-verify](../archive/dawn-verify/) | 6 — verification of work Dawn didn't do | impl complete 2026-08-05; acceptance met; close-out rituals pending |

Everything else in the components table is unwritten. Create each with `/planner` when its turn comes — not before.

## History

Dawn was re-founded 2026-07-26 around the [maxims](maxims.md), after a session concluding that the runtime layers (interface, orchestration, compute) are commoditized while the discipline layer is unowned. The April–May research that preceded it — a greenfield rewrite of indusk-mcp, projection layers, fork-and-extract — is superseded and lives in [archive/](archive/) for provenance.

**Correction worth remembering (2026-08-02):** the first build, `dawn-external-orchestrator`, accumulated five components under one plan and was reported as "complete" when its checklist was ticked. The checklist was honest; the framing wasn't. This file exists so that never happens again — component status is tracked here, not inferred from a sub-plan's checkboxes.
