---
title: "Dawn External Orchestrator — ADR: agentic-loop library + gate mechanism"
date: 2026-07-26
status: accepted
---

# ADR — Dawn External Orchestrator: agentic-loop library + pre-edit gate

**Status:** accepted · **Plan:** [dawn-external-orchestrator](brief.md) · **Under:** [Dawn](../indusk-v2-dawn/maxims.md)

## Context

The [brief](brief.md) commits to lifting InDusk's discipline out of Claude Code into a model-agnostic external orchestrator (`indusk run <plan> --model claude|gpt|gemini|grok`), **reusing** the existing gate scripts (verified externalizable: `{tool_input, cwd}` stdin JSON → exit 0/2), **renting** the agentic tool-loop, and **owning** only a thin discipline shell. Two decisions gate the build:

1. Which agentic-loop library to rent (provider-agnostic, TS-native — stack is Node/pnpm/Turborepo).
2. How to intercept a file-edit tool call *before it lands* so the gate can block it identically across models (PreToolUse parity).

A focused library survey (2026-07-26) scored Vercel AI SDK, Mastra, LangGraph.js, OpenAI Agents SDK, Claude Agent SDK, and LiteLLM on exactly these two axes.

## Decision

**1. Rent the agentic loop from the Vercel AI SDK (`ai`, v7).**
It is the only TS-native framework first-class across all four targets — `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/xai` — with genuine one-line provider swaps and a mature multi-step loop (`stopWhen`/`stepCountIs`/`hasToolCall`, `prepareStep`, `onStepFinish`, `ToolLoopAgent`). It's also the substrate the runner-up (Mastra) and OpenAI's non-OpenAI adapter build on — the provider-abstraction center of gravity.

**2. Enforce the pre-edit gate primarily by owning the edit tool's `execute`, backed by the SDK-native `toolApproval` callback.**
- **Primary (model-invariant core):** the edit/write tool's `execute` spawns the gate program, writes the tool-call JSON to stdin, reads the exit code — applies on `0`, refuses (returns the block message as the tool result) on `2`. This lives in *our* code *below* the provider swap, so it's model-invariant by construction and portable if we ever change frameworks.
- **Secondary (SDK-native, defense-in-depth):** wire the AI SDK `toolApproval` callback as a centralized policy layer that fires *above* the provider swap — true PreToolUse parity — with `experimental_toolApprovalSecret` HMAC-signing approvals so a forged/tampered approval is rejected before execution (a bonus audit property for an edit gate).

Both mechanisms sit above the provider driver, so gate behavior is **structural, not per-model**.

**3. Reuse the existing gate scripts as-is** (Tier-1 invariants), invoked through a ~50-line adapter mapping the AI SDK tool-call shape → the scripts' `{ tool_input: { file_path, old_string, new_string }, cwd }` envelope.

**4. Own the thin shell:** the adapter + the loop control ported from `/work --autopilot` (scoped-per-phase, advance-on-green, goalpost guard, pause-at-human-gate), shipped as an `indusk run` command. **Claude is the first driver**; GPT-5 / Gemini / Grok drivers are the same loop with a different `@ai-sdk/*` factory line.

**5. Direct per-provider API keys behind a thin provider-registry — no commercial gateway.** Each provider is hit directly with your own key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_*`, `XAI_*`) via a ~20-line config registry (provider → key + default model) that `--model` selects from. This preserves **per-provider credit arbitrage** — route to whichever provider currently has the cheapest/free credits. A commercial gateway (Vercel AI Gateway / OpenRouter) would be a single surface but bill through the middleman and forfeit those credits. The AI SDK supports direct providers natively; the registry is config, not a dependency.

**6. Billing lane split (ruthless-efficiency reallocation).** Metered *cheap* models run the mechanical stages (build) in the orchestrator; the freed **Claude Max flat-rate** is reallocated to judgment-heavy work — weekly audits, large refactors, deep architectural thought (the `challenge`/`refactor`/audit end of the loop) — via **Claude Code native**. Max = deep-judgment-tier compute; orchestrator cheap models = mechanical-tier compute. Route by **cost-to-durably-done** (informed by the acceptance matrix), not cost-per-token — a cheap model that thrashes gates and forces reverts is not cheap.

## Alternatives considered

- **Claude Agent SDK** — has the *best* native `PreToolUse` hook (exactly our stdin-JSON/exit-code model), but is **Claude-only**. Disqualified: it's the coupling we're removing.
- **Mastra** (runner-up) — same provider story for free (built on the AI SDK) plus agent/workflow scaffolding, but its native processors gate *messages/steps*, not individual edits, so per-edit gating falls back to own-the-`execute` anyway. Choose only if we'll use its workflow primitives; else it's abstraction paid for unused.
- **OpenAI Agents SDK (TS)** — real approval/guardrail gates, but multi-provider is a **beta** `aisdk()` bolt-on that re-enters the AI SDK. Wrong center of gravity.
- **LangGraph.js** — genuine `interruptBefore:["tools"]`, but engineered for stateful checkpoint/resume HITL (a checkpointer we don't need for a headless exit-code gate); xAI/Grok first-party support unverified.
- **LiteLLM** — 100+ providers but no first-party TS SDK (Python/gateway); the AI SDK's own gateway covers that slot in-process.
- **Hand-rolled loop** — rejected by maxim 2 + "don't reinvent"; the AI SDK is the rented loop.
- **Fork `@ai-sdk/anthropic` for Claude Max (subscription) auth** — considered, rejected: it re-makes Claude the special case (breaks parity — the whole point), very likely violates the Max subscription terms (subscription OAuth is scoped for Claude.ai/Claude Code; risks rate-limit/suspension), is a fragile fork against a moving target, and is unnecessary given the two-lane cost model (Claude Code on Max for heavy work; metered direct-provider API for the matrix + other models).
- **Commercial model gateway (Vercel AI Gateway / OpenRouter) as the key surface** — rejected: a single key surface, but bills through the middleman and forfeits per-provider credit arbitrage (see Decision 5).

## Consequences

- **Enables the acceptance matrix directly:** one program run via `indusk run --model {claude|gpt|gemini|grok}` across environments, gates enforced identically — the comparative "is there a speed advantage with discipline intact?" read, with data.
- **Owned surface stays thin:** adapter (~50 lines) + loop control (a port, not new logic) + tool definitions (read/edit/bash bound to a worktree). Loop, provider abstraction, and gate logic are all rented or reused.
- **Billing implication (Claude driver):** the AI SDK's `@ai-sdk/anthropic` provider authenticates with an **Anthropic API key** (metered, pay-per-token) — it *cannot* use a Claude Max/Pro subscription (that OAuth authorizes Claude.ai + Claude Code, not arbitrary SDK calls). So running Claude *through the orchestrator* is metered API cost, separate from Max. The only framework that could run Claude on the Max subscription is the disqualified, Claude-only **Claude Agent SDK** — so **parity and the Max flat-rate for Claude are mutually exclusive.** Consistent with "nothing works differently on Claude," the orchestrator routes Claude via the API like every other model; keep **Claude Code (native, Max)** for heavy flat-rate Claude work where the orchestrator isn't needed. Matrix/experiment cost is trivial regardless. The AI SDK itself is open-source (Apache-2.0), in-process, uses your own keys — **not** the Vercel AI Gateway (a separate commercial product); no Vercel account or billing involved.
- **Risks / verify at impl (from the survey):**
  - AI SDK version labels (v6→v7; `toolApproval` current, `needsApproval` deprecated) — pin the version and confirm the `toolApproval` API on install (moderate confidence on exact labels).
  - Confirm each provider's tool-calling + `toolApproval` fire identically (especially **Grok/xAI**) before trusting the parity claim.
  - Confirm the gate scripts run headless outside a Claude Code session (expected — plain Node reading stdin).

## Open questions deferred to impl

- **Reference program (acceptance guinea-pig):** small, forces the full loop, has ≥1 gate that *must* block. Candidates: a `semver` parse/compare/bump CLI, or a CSV↔JSON converter — both edge-case-rich enough that tests-first is real and a phase's checkoff genuinely depends on green tests. Pick at impl Phase 0.
- **Matrix cost bound:** cap it — full loop on Claude + one non-Claude locally first, then widen — rather than running the full model × environment cross-product up front.
- **Tool surface:** minimal coding-agent tool set (read, write/edit, bash, list) bound to the worktree — enumerate at impl.
