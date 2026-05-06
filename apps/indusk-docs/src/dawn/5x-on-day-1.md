# 5x on day 1

Dawn-MVP must demonstrably make a forward-deployed engineer 5-10x faster on day 1 of a new codebase. This document defines what "5x" means concretely, what the MVP includes to deliver it, and how we measure.

## The success metric

A named FDE drops into a codebase they have never seen before. Without Dawn, time-to-first-meaningful-PR (TTFP) is measured for a baseline engagement. With Dawn-MVP, the same engineer (or a peer of comparable seniority) on a comparable codebase achieves 5-10x lower TTFP.

> _TODO: define "meaningful PR" with the design partner. Candidate definitions: a PR that touches more than one file, modifies real production code (not just docs), passes review without architectural pushback, ships within their first week. Whichever definition, the metric must be agreed BEFORE the comparison runs._

## Why 5x is the floor

Below 5x, "this is faster" is hard to feel and easy to dismiss. The signal must be strong enough that the design partner notices unprompted, not strong enough that we have to explain the metric to them. The Indusk-mcp catchup skill at solo-engineer scale already produces this magnitude of speed-up subjectively; the FDE-on-unfamiliar-codebase use case has even more headroom.

## Why 10x is the ceiling for v1

Above 10x in MVP scope claims more than the architecture can credibly deliver before team-multiplicative effects kick in. 10-30x is the year-1 promise once shared context across multiple FDEs is wired up. Don't claim it for v1.

## What MVP includes to deliver 5-10x

The MVP is the *minimum* set of capabilities that delivers the day-1 promise. Everything else defers to follow-up work or gets cut.

**In MVP scope:**

1. **Project context auto-loaded into every agent CLI session.** Via `AGENTS.md` (cross-CLI standard) and per-CLI adapters that project Dawn's plans, lessons, and conventions into the agent's working context.

2. **Catchup-style onboarding.** A single command (or, ideally, automatic on first session) that surfaces: what's currently in flight, what's been decided, what's been tried and discarded, the architecture's WHY (not just its WHAT), the live gotchas this codebase has accumulated.

3. **Dawn app sits outside the codebase.** The codebase only contains production code, tests, and OTel rules ([per architectural decision A13](https://github.com/infinite-dusky/dusk/blob/main/.indusk/planning/indusk-v2-dawn/decisions.md)). All durable Dawn state — plans, lessons, memory — lives in the Dawn app. This is what makes fork-and-extract clean and what unlocks team-multiplicative scale later.

4. **One agent CLI adapter (Claude Code).** Other adapters (Cursor, Codex, Aider) defer to v1.x. Claude Code is what Sandy drives daily and what the design partner is presumed to use. Single CLI for MVP keeps scope tight; the architecture supports cross-CLI from day one.

5. **The structured-workflow skills that already work in Indusk** — planner, work, verify, retrospective — ported into Dawn's adapter shape. These are Dawn's differentiation; they are NOT generic "agent platform" features, they are opinions about how engineering work should flow.

**Explicitly NOT in MVP** (see [Out of scope](./out-of-scope)):

- Multi-user collaboration features (defer to v1.1)
- Team-coordination UI (defer to v1.x)
- Hosted multi-tenant service (defer; MVP is local-first with hosted backing optional)
- Approval gates / governance / RBAC (defer)
- All non-Claude-Code adapters (defer)
- Enterprise SSO / compliance (defer)

## How we measure

**Baseline measurement** — before the design partner uses Dawn:

- Pick one FDE engagement starting in the next 4 weeks
- Measure TTFP without Dawn
- Capture: hours from codebase access to first merged PR, number of clarifying questions to the team, subjective ramp-pain self-report

**Test measurement** — first engagement using Dawn-MVP:

- Same engineer or peer of comparable seniority
- Comparable codebase complexity (same client, different team if possible)
- Measure same TTFP and capture same data
- Compare ratios

**Falsification triggers**:

- TTFP improvement < 3x → MVP scope is wrong; reconvene on what's missing
- TTFP improvement 3-5x → directionally right; identify the bottleneck and ship one more cycle
- TTFP improvement 5-10x → MVP claim validated; ship v1
- TTFP improvement > 10x → either we're measuring wrong or the design partner had unusually painful baseline

## What we expect to learn

The 5-10x measurement is necessary but not sufficient. The qualitative signal we need: does the design partner *unprompted* describe the pain Dawn solves in their own words within the first week? If they don't reach for Dawn the second time without us reminding them, the metric is a vanity metric and the product hasn't earned its place in their workflow.

## The design partner is the gating dependency

This document is uncalibrated until a design partner is named and a baseline engagement is measured. Until then, "5-10x" is hypothesis, not commitment.
