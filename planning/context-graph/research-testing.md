---
title: "Context Graph — Testing Strategy"
date: 2026-03-25
status: in-progress
---

# Context Graph Testing Strategy — Research

## Question
How do we test whether the context graph actually helps? What does "helps" mean, and how do we measure it before committing to a fork/merge/integration decision?

## What We're Testing

The hypothesis: an agent with distance-weighted, graph-based context makes fewer mistakes, asks fewer clarifying questions, and produces code that respects existing conventions better than an agent with flat-file context (CLAUDE.md).

This needs to be testable before we invest in architecture decisions.

## Levels of Testing

### Level 1: Does the plumbing work?
Can Graphiti and CGC coexist on the same FalkorDB? Can we write semantic nodes and query them alongside code nodes? Can the context_beam query actually traverse both layers?

**How to test:**
- Spin up Graphiti MCP server pointed at our existing FalkorDB
- Add a few semantic nodes manually (a Concept, a Gotcha, a Convention)
- Link them to CGC's existing File nodes
- Run a combined Cypher query that traverses both
- Pass/fail: does the query return both structural and semantic context?

**This is a spike — do it first, before anything else.**

### Level 2: Does the context beam produce useful output?
Given a file the agent is about to edit, does context_beam return context that a human developer would say "yes, I'd want to know that before editing this file"?

**How to test:**
- Pick 5-10 files from numero that have known gotchas, conventions, or decisions attached
- Manually populate the graph with the context that currently lives in CLAUDE.md's gotchas/conventions
- Run context_beam on each file
- Have Sandy review: "is this the right context? Is anything missing? Is anything irrelevant?"
- Score: precision (% of returned context that's useful) and recall (% of useful context that was returned)

### Level 3: Does the agent actually use the context?
If we give the agent graph-derived context instead of CLAUDE.md, does it produce better code?

**How to test (A/B comparison):**
- Pick 3-5 real work items from an active plan
- Run each work item twice:
  - **Control**: agent reads full CLAUDE.md (current system)
  - **Test**: agent reads context_beam output for the relevant files (graph system)
- Compare outputs:
  - Did the agent respect conventions? (e.g., "no DB from Next.js")
  - Did the agent avoid known gotchas? (e.g., "pots() after showdown")
  - Did the agent ask fewer clarifying questions?
  - Did the agent produce code that passed verification on the first attempt?

**This requires real work items on a real codebase — numero is the test bed.**

### Level 4: Does the context graph grow correctly during work?
After a work session, did the graph get enriched with useful context, or did it accumulate noise?

**How to test:**
- Run a multi-phase work session with graph enrichment enabled
- After the session, audit the new nodes:
  - Are they correctly linked to files?
  - Are the descriptions accurate?
  - Would a new agent find them useful?
- Check for contradictions: did the new nodes conflict with existing ones?
- Check for noise: are there nodes that add no value?

### Level 5: Does it scale?
After 50 work sessions and 500 context nodes, is context_beam still fast? Is the graph still useful or has it become noisy?

**How to test:**
- Synthetic load: generate 500 context nodes with realistic distributions
- Run context_beam on various files, measure query time
- Measure precision/recall as the graph grows
- Compare to: how long does it take to parse a 500-line CLAUDE.md?

## Metrics

| Metric | What it measures | How |
|--------|-----------------|-----|
| **Context precision** | % of returned context the developer says is useful | Human review of context_beam output |
| **Context recall** | % of useful context that was returned | Human review: "what did you wish you knew?" |
| **Convention compliance** | Did the agent follow project conventions? | Compare output against convention checklist |
| **Gotcha avoidance** | Did the agent avoid known pitfalls? | Check if known gotchas were hit |
| **First-pass verification** | Did code pass typecheck/lint/test on first attempt? | Count verification retries |
| **Clarification requests** | How many times did the agent ask "should I...?" | Count in conversation |
| **Context beam latency** | How fast is the query? | Measure in ms |
| **Graph noise ratio** | % of context nodes that are never traversed | Track traversal frequency per node |

## The Spike: What to Do First

Before any architecture decisions, before any brief, before any fork/merge discussion:

1. **Get Graphiti MCP server running alongside CGC on the same FalkorDB** (30 min)
   - Use the Docker image: `falkordb/graphiti-knowledge-graph-mcp`
   - Point it at `falkordb.orb.local`

2. **Manually create 10 semantic nodes from numero's CLAUDE.md** (30 min)
   - 3 Gotchas (pots() guard, FK constraint, fold freeze)
   - 3 Conventions (no DB from Next.js, no fallback URLs, no chain client caching)
   - 2 Decisions (hybrid settlement, internalized poker-ts)
   - 2 Concepts (settlement, agent API)

3. **Link them to CGC's existing File nodes via Cypher** (30 min)
   - Gotcha "pots() guard" → AFFECTS → game-server hand handling files
   - Convention "no DB from Next.js" → APPLIES_TO → all Next.js app files
   - etc.

4. **Write and run the context_beam query** (1 hour)
   - Input: a file path
   - Output: distance-weighted context from both graphs
   - Test on 5 files, review output

5. **Sandy reviews: "is this useful?"** (30 min)
   - Does the beam return the right context?
   - Is anything missing?
   - Is anything irrelevant?

Total: ~3 hours for the spike. After that, we know if this approach has legs.

## What the Spike Answers

- Can the two graph systems coexist on FalkorDB? (technical feasibility)
- Does the combined query work? (integration feasibility)
- Is the output useful? (product feasibility)

If any of these are "no," we stop and reassess. If all three are "yes," we move to the brief with confidence.

## Open Questions
- Does Graphiti's MCP server conflict with CGC's MCP server when sharing FalkorDB? Different graph names should isolate them, but need to verify.
- Does Graphiti need its own LLM calls for contradiction detection? That adds cost and latency. Can we disable it for the spike?
- Should the spike use Graphiti's MCP tools or direct Cypher queries? MCP is more realistic but Cypher is faster for prototyping.
- How do we control for the A/B test? Same model, same temperature, same prompt structure — only the context source changes.
