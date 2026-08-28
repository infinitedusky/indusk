---
title: Roadmap
---

# Roadmap

Where InDusk is, and where it is going. Dated **2026-08-28**, at **1.38.3**.

This page is deliberately honest about what is *not* happening. A roadmap that
lists everything anyone ever proposed is a wish list, and a wish list cannot be
used to decide anything.

## Where it is now

The core loop is built and in daily use: plans as documents, gates as hooks,
tests planned before written, three closing rituals, an eval agent that turns
work into lessons, and a context budget that is enforced rather than hoped for.

Two things shipped most recently:

- **Versioned workbenches** (1.37.0 – 1.38.3) — a workbench is a git repo with
  its own remote, wrapping N declared repos. Planning history and lessons now
  move between machines. [Decision](/decisions/versioned-workbench) ·
  [Lessons](/lessons/versioned-workbench)
- **The lifecycle rebalance** — the Shape check moved craft review into the phase
  that wrote the code, and test authoring became a phase of its own.
  [Decision](/decisions/lifecycle-rebalance)

## The two live directions

### Midnight — expectation and telemetry, linked

The current direction of record. The thesis: a test suite records what someone
thought to check, and telemetry records what actually happened, and nothing today
connects the two. Midnight is about making an expectation a first-class artifact
that can be *contradicted by production*, not just by a test runner.

This is the direction the [Signal Correlation](/strategy/signal-correlation) memo
sketches — that page describes an end state, not a built system, and lives here
rather than in the guide for exactly that reason.

**Next step:** an ADR.

### Dawn — running the loop without a human in it

InDusk's gates assume an agent working interactively. Dawn asks what survives when
nothing is watching. Shipped so far: [`indusk run`](/reference/cli/run), a
model-agnostic gated execution loop; [`indusk verify`](/reference/cli/verify),
phase-boundary verification for work the loop did not execute; hook parity so the
thin lane enforces every invariant the interactive one does.

**Remaining:** Shape in the thin lane, the Challenge ritual, folding `verify` into
the run loop.

## Not doing

Named because "we decided against this" is more useful than silence, and because
each of these has a document someone might otherwise pick up and act on.

| Idea | Why not |
|---|---|
| **Knowledge graph as the canonical store** | Tried it. Graphiti + CodeGraphContext + FalkorDB were removed entirely by the makeover — the graph was fed unstructured dumps and returned unstructured noise. The lessons registry replaced it: plain files, titles as rules, bodies loaded on demand. |
| **Editor-agnostic InDusk** | InDusk is tied to Claude Code's skills and hooks. Untying it is a real project and not a current priority; the gates *are* the product, and they exist because a hook can refuse an edit. |
| **A docs phase gate** | Documentation is gated per phase today. Moving it to one final phase was proposed and is not being pursued — the per-phase gate is what keeps docs describing what was built rather than what was planned. |

## How this page stays honest

Every plan close publishes its decisions and lessons here, and the retrospective
compacts what it adds. If this page lists something that shipped, or omits
something in flight, that is a bug in the close-out ritual rather than a stale
page to be tidied.

## See also

- [Decisions](/decisions/) — the record of why, plan by plan
- [Lessons](/lessons/) — what went wrong, and the rule that came out of it
- [Changelog](/changelog) — what shipped, when
