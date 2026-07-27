---
title: "Dawn — Positioning"
date: 2026-07-27
status: draft
---

# Dawn — Positioning

Captured from the 2026-07-27 working session (orchestrator Phases 1–4 shipped, paused at the Phase 5 matrix). **Direction, not commitment** — nothing here schedules work, and maxim 8 (prove it for yourself first) gates all productization on the matrix + dogfooding.

## The thesis, one line

Tools are commoditized; approach is not. Everyone has the same models, the same compute, the same interfaces — the only differentiator left is how you work. Dawn owns that layer.

## Tagline candidates (not yet chosen)

- **"Everyone has the same tools. The difference is approach."** — best cold-audience hook.
- **"Own the approach. Rent everything else."** — maxim 2 compressed; most *native* (every architecture decision re-proves it). Recommended pairing with the category line.
- Category line: **"Dawn — the discipline layer for agentic development."**
- Manifesto opener (docs intro, not banner): *"Fools and geniuses use the same tools now. The models are identical, the compute is rented, the interfaces are commodities — the only thing left to own is how you work. Dawn is that."*

## Competition framing

- **Near-field** (what a user would evaluate Dawn against today): spec-driven-dev and agent-harness kits — GitHub Spec Kit, Amazon Kiro, BMAD/Taskmaster-style methodology kits, Factory-style orchestration. Winnable on substance: those are largely prompt templates wearing a methodology costume; Dawn has enforcement that actually blocks.
- **Endgame** (who wins the slot Dawn wants): **Linear**. The playbook parallel is exact — the Linear Method existed first as opinionated essays, then the tool embodied the method so you couldn't use it wrong, and it took the category. Dawn = method essays (maxims/rituals) in search of the tool that operationalizes them. Linear is also coming *down* the stack (Linear for Agents: issues as agent dispatch units); if the issue becomes the plan and Linear adds verification, they absorb the discipline layer with unmatched distribution.
- **Not competition:** Block's Buzz — a parts supplier (event log, ACP, signed identities), not a rival for the buyer.

## The wedge

Linear's method governs **coordination** — cadence, scope, priority, human agreement. Dawn's method governs **trustworthiness** — is the agentic output verified, falsified, gate-held. Their column is *status*; Dawn's column is *evidence*. Repo-native enforcement — a gate that refuses the edit in the write path — is the one thing a hosted coordination product structurally cannot do without becoming a different product. That is the moat.

## Dawn on Linear — rent the coordination substrate

Resolves the maxims' deliberately-held tension (maxim 6 files-substrate vs shared team state) by **renting** the coordination layer instead of building the event-log piece: Linear provides presence, portfolio state, team surface, notifications; the repo stays the substrate for verification. Posture: ride their dispatch, own the verification — integrate with PM, never rebuild it.

- **Repo = the record.** A compact, machine-facing state ledger stays in files and the gates keep enforcing on its writes. **The load-bearing constraint: the checkbox is the enforcement surface, not a todo item.** Done-state must live where the gate sits in the write path and can refuse the flip (exit 2, before application). Linear-side state is detect-and-complain only — a projection, never the truth.
- **Impl splits into spec + ledger.** The impl's prose becomes a pure technical spec — *what exactly we build and how* (vs the ADR's *what we decided and why*). The checklist becomes the machine ledger humans stop reading; human-facing progress lives in the Linear projection.
- **Linear = the view + the conversation.** Plan → project/parent issue; phases → sub-issues; status mirrors repo → Linear automatically.
- **Linear-native writes = human judgment only.** Approvals at human gates, priority, scope, in-thread instruction to the agent. The orchestrator picks these up and acts in the repo, under the gates.
- The sub-issue/comment mirror doubles as the audit timeline — absorbing most of what the Buzz-inspired event-log item wanted, rented instead of built.

## The @dawn Linear plugin

Linear's extension surface is agent-first (OAuth apps + Agents API + webhooks; no arbitrary UI panels) — exactly Dawn's shape:

- **@dawn as an assignable teammate** — assign an issue or @-mention and an agent session opens in-thread. (The `atdawn` CLI name completes itself: `atdawn` in the terminal, @dawn in the issue.)
- The conversation drives the lifecycle: scope in-thread → Dawn files the spec/brief in the repo → phases mirror as sub-issues → the gated loop runs on a worktree (an always-on rented box makes @dawn feel alive; see roadmap cloud-deployment).
- Verification state posts as issue activity; sub-issues flip only when the repo ledger flips, gate-verified.
- Human gates become Linear-native: exit-3 pause → @dawn assigns back with "check X"; the reply resumes the loop.
- Linear's integrations directory = distribution to exactly the audience that buys method-driven tooling.

## Layer stack — what rents where

```
Linear Agents API   → coordination surface (@dawn, threads, assignments)  [rented]
Dawn orchestrator   → loop control + gates (runLoop, the discipline)      [OWNED]
Vercel AI SDK       → the model↔tool execution loop                       [rented]
Providers           → Claude / Gemini / …                                 [rented]
```

The Linear plugin is a second *caller* of `runLoop` beside the CLI — never the engine. ACP (roadmap, Later) is the only candidate engine swap; Linear never is.

## Platform risk — the named bet

Dawn-on-Linear builds on the endgame competitor's land. The bet: gate enforcement is too repo-native for a hosted coordination tool to absorb. The hedge is architectural: Linear is *a* coordination backend, never *the* backend — the same pattern as the model drivers. Dawn must always run headless with no Linear in sight; losing the relationship loses the pretty view, not the system.

## Cross-references

- [maxims.md](maxims.md) — the selection function this positioning is checked against (esp. 2, 3, 6, 8).
- [roadmap.md](roadmap.md) — where the buildable pieces of this land as horizon items.
- [../dawn-external-orchestrator/](../dawn-external-orchestrator/) — the substrate all of this sits on; Phase 5 matrix is the pending evidence.
