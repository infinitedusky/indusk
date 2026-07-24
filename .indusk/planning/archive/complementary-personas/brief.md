---
title: "Complementary Personas"
date: 2026-04-14
status: draft
blocked_by: [agent-roles, hermes-inspired-improvements, graph-knowledge-architecture]
---

# Complementary Personas — Brief

## Problem

AI assistants that model the user tend to become mirrors — reinforcing the user's existing thinking patterns, biases, and blind spots. If the system learns "Sandy thinks architecturally and loves abstractions," it produces more abstractions. The user never gets pushback. The code never gets challenged from a perspective the user doesn't naturally hold.

This is the opposite of what a good team provides. A strong team has people who think differently from each other — a pragmatist who asks "do we need this now?", a security-minded engineer who thinks about what breaks, a user advocate who asks "but what does someone actually experience?" The value isn't agreement, it's complementary friction.

## Proposed Direction

Use the user model **inversely** — not to mirror the user, but to identify gaps in their thinking and construct synthetic teammates that fill those gaps. The system analyzes the user's demonstrated expertise, preferences, and patterns, then creates persistent persona agents that think in complementary ways.

These aren't formatting modes (like Hermes's `hermes-persona` which just changes tone). They're actual agents with their own accumulated perspective, memory, and consistent point of view. They can review work, challenge decisions, and spot things the primary thinking style misses.

Architecture concepts (needs research):
- **User gap analysis** — derive what's missing from the user profile (auto-memory user type + Honcho-style structured profile)
- **Persona construction** — create 2-3 complementary agents from the gap analysis, each with a persistent system prompt and their own memory
- **Invocation model** — on-demand review (`/persona pragmatist "review this approach"`), automatic at decision points (ADR review, impl review), or persistent background agents
- **Persistence** — personas accumulate their own observations and perspective across sessions, stored in Graphiti or auto-memory under their own identity
- **Anti-sycophancy** — the explicit design goal is productive disagreement, not validation

Example personas derived from a user who thinks architecturally:
- **The Pragmatist** — "Do we need this abstraction? What's the simplest thing that works? Ship it."
- **The Adversary** — "What breaks? What's the attack surface? What happens under load? What if the dependency goes down?"
- **The User** — "I'm trying to use this for the first time. Where do I start? This error message tells me nothing."

## Context

Inspired by but fundamentally different from:
- **Hermes `hermes-persona`** — just formatting/tone modes (researcher, coder, analyst, creative, advisor). No gap analysis, no persistence, no complementary thinking.
- **Honcho dialectic profiling** — models the user to serve them better. Same direction as the user, just more accurately. We want the opposite direction.
- **Traditional code review bots** — review against rules. We want review against a *perspective*.

This needs proper research into:
- Adversarial collaboration patterns in software teams
- How to construct effective complementary viewpoints from a user profile
- Whether persistent persona memory actually produces better results than stateless prompting
- How to avoid personas becoming annoying rather than valuable

## Scope

### In Scope
- Research into user modeling for gap analysis
- Persona construction from inverse user profiles
- Persistence mechanism for persona observations
- Invocation model (on-demand, automatic at gates, or both)
- Integration with existing InDusk planning/work lifecycle
- Evaluation: do personas actually catch things the primary agent misses?

### Out of Scope
- General-purpose persona/role-play (this is specifically for complementary engineering perspectives)
- Replacing the primary agent's behavior (personas are reviewers/challengers, not implementers)
- User-facing chat personas (no Telegram/Discord integration)

## Success Criteria
- Personas consistently identify issues or perspectives the primary agent missed
- The user finds persona feedback genuinely useful, not annoying or repetitive
- Personas maintain a consistent perspective across sessions (not just random contrarianism)
- The system gets better over time as personas accumulate observations

## Depends On
- `hermes-inspired-improvements` — transcript search enables personas to reference past session context
- `graph-knowledge-architecture` — typed ontology gives personas structured knowledge to reason over (vs raw auto-memory)
- User profile structure needs to be rich enough for gap analysis (may need Honcho-style structured profiling)

## Blocks
- Nothing currently

## Ordering Note
This plan is deliberately last in the pipeline. It benefits from all preceding infrastructure (transcript search, typed graph, LSP indexing) and needs proper research into adversarial collaboration patterns before implementation.
