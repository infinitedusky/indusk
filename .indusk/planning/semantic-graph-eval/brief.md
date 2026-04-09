---
title: "Context System Evaluation"
date: 2026-04-09
status: accepted
---

# Context System Evaluation — Brief

## Problem

InDusk builds rich project context but there's no way to measure whether it makes the agent better. Without measurement, development is guided by intuition.

## Proposed Direction

### Two modes, one evaluator

The evaluation system has two modes that share the same judge infrastructure:

**Eval mode** — normal operation. Every jj commit triggers a background evaluator that scores the work, extracts lessons, and writes findings to Graphiti. This is the learning loop. The evaluator runs on its own worktree (the eval branch), merges in completed work, and evaluates from a clean position. Eval mode is always on — it's how the context system gets smarter over time.

**Baseline mode** — controlled experiment. A dumb agent (no MCP access, no skills, no lessons, no Graphiti, no code graph) works on a clean worktree with a stripped-down CLAUDE.md. It gets tasks, does its best, commits to jj. The smart evaluator scores those commits with the same rubric. This measures the delta — "how much better does the context system make things?" Baseline runs are reusable artifacts for demonstrating the tool's value.

### The evaluator as knowledge distillation layer

The evaluator isn't just a scorer — it's the primary source of derived knowledge. Two kinds of knowledge flow into Graphiti from two sources:

**User-side capture (working agent, real-time):** The user says "we're freezing merges Thursday" or "don't mock the database." This knowledge only exists in the conversation. The working agent captures it at trigger points — corrections, brief acceptance, retro lessons — because it's the only one who heard it.

**Outcome-side capture (evaluator, after the fact):** The agent took a wrong path, missed an existing utility, skipped a convention. The evaluator extracts this by analyzing the transcript and diff together. The working agent can't see these patterns because it's still in the middle of the work.

The evaluator's Graphiti writes are the *derived* insights — things nobody said explicitly but that emerge from watching the work. "Every time someone touches the payment module, they miss the webhook handler" is something you'd only see after watching multiple agents make the same mistake.

### Worktree architecture

Each participant operates on its own worktree:

- **Working agent** — feature worktree (or main worktree in day-to-day use)
- **Evaluator** — eval worktree/branch, merges in completed work, evaluates, writes to Graphiti
- **Main** — stays clean as the read-only source of truth

This solves MCP contention, keeps eval artifacts off the working tree, and lets the evaluator take its time without racing the working agent.

### The judge process

```
1. Merge the new commit into the eval branch
2. Read the transcript (JSONL — Claude Code provides transcript_path to hooks)
3. Catch up (full catchup — lessons, context, health, plans, extensions, graph)
4. Read the diff (jj diff) — know exactly what was built
5. Answer the evaluation questions
6. Write findings to Graphiti (outcome-side capture)
7. Log results to eval file
8. If opted in, POST the scorecard to the configured eval endpoint
```

The judge is a full agent with MCP access, running in auto-approve mode. It can search Graphiti, query the code graph, read any file. It produces two outputs: a scorecard (read-only evaluation) and Graphiti writes (knowledge distillation). It does a real catchup, so it understands the project the same way a working agent would — but it starts from a position where it already knows the outcome.

### Why this works

**Evaluation is easier than creation.** The working agent explores forward into uncertainty — it has to decide what to do, which files to touch, which patterns to follow. The judge audits backward from certainty — it knows what was built, which files were touched, what the final state is. Same codebase, same tools, completely different problem.

**The judge knows where to look.** It has the diff. It knows exactly which files were touched. It can go deep on those specific files — read their history, their Graphiti nodes, their imports, their lessons — with perfect focus. The working agent had to discover all of this while also doing the work.

### Evaluation questions (v1)

Start with a few, iterate:

1. **Did the agent follow the project's conventions?** (CLAUDE.md, skills, lessons)
2. **Did it skip steps it was instructed to follow?** (plan gates, verification, skill instructions)
3. **Were there better approaches available in the codebase?** (existing utilities, patterns, components)
4. **Is there information missing from the graph that would have helped?** (context sufficiency)

Each question produces: yes/no, evidence (file, line, what should have happened), severity.

Question 4 is the context-beam signal — it tells you what to build next in the context system.

### The rubric grows over time

The questions are the product. The infrastructure (hook, agent spawn, logging) is stable. As we learn what matters, we add questions:

- "Did the agent check blast radius before editing shared code?"
- "Did it use the test patterns from the testing extension?"
- "Did it create a plan before jumping to implementation?"

Each new question is one line in the judge prompt. The evaluation gets better without changing the system.

### Baseline mode specifics

To establish a baseline measurement:

1. Create a clean worktree from the target codebase
2. Strip it: remove `.claude/skills/`, wipe `.mcp.json` MCP servers (no indusk, no graphiti, no CGC), replace CLAUDE.md with a minimal skeleton
3. The dumb agent gets a task and works with vanilla Claude Code — no catchup, no lessons, no graph queries, just its own training data and whatever's in the files
4. It commits to jj at regular intervals (or is told to commit at intervals)
5. The smart evaluator scores each commit with the full rubric, using the full context system
6. Results become the baseline — "this is how an uninformed agent performs on this codebase"

Over time, baseline runs on different codebases and tasks become a library of evidence for the context system's value. These are also reusable for promoting the tool — showing the before/after delta.

### Two dimensions of evaluation

The system measures along two independent axes:

**Absolute quality (per commit):** Each commit gets a scorecard — did the agent follow conventions, skip steps, miss existing patterns, lack context? This is actionable feedback for the project itself. Findings go to Graphiti, the next session picks them up, the work gets better.

**System improvement (over time):** Because the rubric is consistent, scores form a time series. You can track whether agents are getting better as you add lessons, improve skills, enrich the graph. This measures the context system itself, not just the work.

The baseline gives you the floor — "this is how an uninformed agent performs." The trend shows the trajectory — "scores are improving week over week as the context system matures." Both are independent: you can track the trend without ever running a baseline, and you can run baselines without caring about the trend. Together they tell the full story: where you started, where you are, and which direction you're heading.

`indusk eval summary` surfaces both: per-commit scorecards, rolling averages, baseline comparisons, and trend lines. This data is as much for evaluating and promoting the tool as it is for improving any individual project.

### What this enables

- **Quality signal per commit** — not just "did it work" but "was it good work"
- **Context sufficiency signal** — "the graph is missing X, add it" drives context-beam
- **Convention drift detection** — catches when the agent ignores established patterns
- **Instruction compliance** — verifies skills and lessons are actually followed
- **Trend data** — are scores improving over time as the context system matures?
- **Baseline comparison** — controlled experiments prove the context system's value with hard numbers
- **Knowledge distillation** — evaluator writes derived insights to Graphiti that the working agent can't see
- **Promotional artifacts** — baseline vs. eval-mode delta, trend charts, before/after stories

## Context

Motivated by a real exchange where an agent made 4 commits of workaround code before finding a one-line config fix. The transcript contained every signal needed to evaluate quality — a judge reading it backward from the outcome would have flagged every misstep immediately.

Key insight: evaluation is verification. It's easier to check "did the agent use the right pattern?" when you know the outcome than to generate the right pattern in real time. The judge has an inherent advantage over the working agent.

Second insight: the evaluator is the best position to write to Graphiti. It has full context, knows the outcome, and is already doing the analysis work. User-side capture (what the user says) and outcome-side capture (what the work reveals) are complementary — both feed Graphiti, from different sources, at different times.

## Scope

### In Scope
- **Eval mode (always on):**
  - Commit-triggered hook (fires on `jj describe`)
  - Evaluator runs on its own worktree/eval branch
  - Judge agent: full MCP, full catchup, reads transcript + diff, answers questions
  - Writes findings to Graphiti (outcome-side capture)
  - Eval log (append-only JSONL at `.indusk/eval/results.log`)
  - `indusk eval summary` — aggregate scores over time
  - `/eval review` — manual trigger for mid-session eval
- **Baseline mode:**
  - Worktree setup: clean checkout, stripped skills/MCP/CLAUDE.md
  - Dumb agent harness: spawns vanilla Claude Code with a task, commits to jj
  - Smart evaluator scores baseline commits with full rubric
  - Results stored as baseline artifacts for comparison
- Works on any InDusk-enabled project with jj

### Out of Scope
- VS Code extension / dashboard — CLI and log for v1
- Automated fixes from eval findings — human reviews and decides
- Non-jj projects
- LLM judge fine-tuning
- Context-beam (separate plan — eval results inform its design)

## Success Criteria
- Hook fires automatically on every `jj describe` with zero friction
- Evaluator runs on its own worktree, never blocks the working session
- Questions produce specific, actionable findings with evidence
- Evaluator writes derived insights to Graphiti that improve subsequent sessions
- Baseline mode produces measurable delta between dumb and smart agents
- "Missing from graph" findings drive real context improvements
- Rubric grows over first month of use as we learn what matters
- Running on infinitedusky and at least one other codebase

## Depends On
- Nothing — can start immediately

## Blocks
- Results inform context-beam design (what context the agent actually needs)
- "Missing from graph" findings drive Graphiti capture improvements
- Convention compliance findings drive skill/lesson updates
- Baseline results demonstrate the tool's value for promotion
