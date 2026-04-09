---
title: "Context System Evaluation"
date: 2026-04-09
status: accepted
---

# Context System Evaluation

## Y-Statement

In the context of **measuring whether InDusk's context system makes agents better at real development tasks**,
facing **no way to know which context layers matter, which have gaps, and whether the system is improving over time**,
we decided for **a commit-triggered evaluator that runs on its own worktree, does a full project catchup, reads the session transcript and diff, answers evaluation questions, writes derived insights to Graphiti, and logs structured scorecards — with a baseline mode that pits a stripped-down vanilla agent against the same rubric to measure the context system's delta**
and against **pre-assembled context packages sent to a one-shot scorer, inline self-evaluation by the working agent, A/B worktree replays, and RAG evaluation frameworks (RAGAS, Trulens)**,
to achieve **continuous, zero-friction quality measurement that produces actionable findings and derived knowledge at commit granularity, with trend data showing system improvement over time and baseline comparisons proving the context system's value**,
accepting **the cost of spawning a background Opus agent per commit, ~2 minutes of compute per eval, that the question rubric starts small and must be iterated, and that baseline mode requires worktree setup and task curation**,
because **evaluation is inherently easier than creation — a judge that knows the outcome can audit backward from certainty, while the working agent explores forward into uncertainty — and the evaluator is the best position to distill knowledge because it has full context, knows the outcome, and is already doing the analysis work**.

## Context

InDusk invests heavily in project context: CLAUDE.md, skills, lessons, extensions, Graphiti episodic memory, semantic graph. But there's no feedback loop measuring whether this context produces better agent behavior. Development of the context system is guided by intuition.

A real exchange demonstrated the problem: an agent on a composable.env project made 4 commits of workaround code (fallback functions, env var chain resolution, smarter fallback) before finding the one-line config fix in the composable.env interface mapping. The transcript contained every signal needed to evaluate quality. A judge reading it after the fact would have flagged every misstep immediately — because evaluation is verification, not generation.

Two key insights:

1. **The judge knows the outcome.** It has the diff. It knows which files were touched. From that position, it can investigate those specific files deeply — their history, Graphiti nodes, imports, lessons — and ask "was this the best approach given what was knowable?" That's a fundamentally easier problem than what the working agent faces.

2. **The evaluator is the best position to write to Graphiti.** It has full context, knows the outcome, and is already doing the analysis work. User-side capture (what the user says during work) and outcome-side capture (what the evaluator extracts after) are complementary — both feed Graphiti, from different sources, at different times.

## Decision

### 1. Two modes, one evaluator

**Eval mode (always on):** Every jj commit triggers a background evaluator. This is the learning loop — the evaluator scores the work, extracts lessons, writes derived insights to Graphiti, and maintains its analysis as a record for general learning and InDusk MCP improvements. The scorecards and findings aren't just per-project feedback — they're the empirical basis for evolving skills, lessons, extensions, and the context system itself. Eval mode is how everything gets smarter over time.

**Baseline mode (controlled experiment):** A vanilla Claude Code agent (no MCP, no skills, no lessons, no graph) works on a stripped-down worktree. It gets tasks, does its best, commits to jj. The smart evaluator scores those commits with the same rubric. This measures the delta the context system provides. Baseline runs are reusable artifacts for demonstrating the tool's value.

Both modes use the same judge infrastructure and rubric. The difference is the working agent's capabilities, not the evaluator's.

### 2. Worktree architecture

Each participant operates on its own worktree:

- **Working agent** — feature worktree (or main worktree in day-to-day use)
- **Evaluator** — eval worktree/branch, merges in completed work, evaluates, writes to Graphiti
- **Main** — stays clean as the read-only source of truth

This solves MCP contention between working agent and evaluator, keeps eval artifacts off the working tree, and lets the evaluator take its time without racing the working agent. CLAUDE.md is branch-specific, so the baseline worktree can have a stripped version while the eval branch has the full one.

### 3. Judge is a full agent, not a scorer

The judge is a real Claude Code session with full MCP access (Graphiti, code graph, file system) running in auto-approve mode. It can't edit source files but can read anything, search anything, query anything, and write to Graphiti.

It follows a fixed process:
1. Merge the new commit into the eval branch
2. Read the session transcript (JSONL at `transcript_path`)
3. Do a full catchup (same as any new session — lessons, context, health, plans, extensions, graph)
4. Read the diff (`jj diff`)
5. Answer the evaluation questions
6. Write findings to Graphiti (outcome-side capture)
7. Append structured results to the eval log
8. If opted in, POST the scorecard to the configured eval endpoint (no-op if endpoint is not set or unreachable)

The judge produces two outputs: a **scorecard** (read-only evaluation logged to the eval file) and **Graphiti writes** (knowledge distillation that improves subsequent sessions). It does catchup because it needs to understand the project the same way a working agent would — but unlike the working agent, it already knows the outcome.

### 4. Evaluator as knowledge distillation layer

Two kinds of knowledge flow into Graphiti from two sources:

**User-side capture (working agent, real-time):** The user says "we're freezing merges Thursday" or "don't mock the database." This knowledge only exists in the conversation. The working agent captures it at existing trigger points — corrections, brief acceptance, retro lessons.

**Outcome-side capture (evaluator, after the fact):** The agent took a wrong path, missed an existing utility, skipped a convention. The evaluator extracts this by analyzing the transcript and diff together. These are *derived* insights — things nobody said explicitly but that emerge from watching the work.

The evaluator's writes are higher quality because they're selective — it only captures facts that would have actually changed the outcome. "Every time someone touches the payment module, they miss the webhook handler" is something you'd only see after watching multiple agents make the same mistake.

### 5. Questions are the rubric

The evaluation questions are the product. The infrastructure (hook, agent spawn, worktree, logging) is stable. Questions start simple and grow:

**v1 questions:**
1. Did the agent follow the project's conventions? (CLAUDE.md, skills, lessons)
2. Did it skip steps it was instructed to follow? (plan gates, verification, skill instructions)
3. Were there better approaches available in the codebase? (existing utilities, patterns, components)
4. Is there information missing from the graph that would have helped? (context sufficiency)

**Future questions (added as we learn what matters):**
- Did the agent check blast radius before editing shared code?
- Did it use test patterns from the testing extension?
- Did it create a plan before jumping to implementation?
- Did it avoid known gotchas listed in CLAUDE.md?

Adding a question is one line in the judge prompt. No infrastructure change.

### 6. Two dimensions of measurement

**Absolute quality (per commit):** Each commit gets a scorecard. Findings go to Graphiti, the next session picks them up, the work gets better. This measures the project.

**System improvement (over time):** Because the rubric is consistent, scores form a time series. You can track whether agents are getting better as you add lessons, improve skills, enrich the graph. This measures the context system.

The baseline gives the floor. The trend shows the trajectory. Both are independent — you can track the trend without running baselines, and run baselines without caring about the trend. Together they tell the full story. `indusk eval summary` surfaces both: per-commit scorecards, rolling averages, baseline comparisons, and trend lines.

### 7. Structured eval log

Results append to `.indusk/eval/results.log` as JSONL. Each entry includes the change ID, timestamp, mode (eval/baseline), question scores, evidence, and findings. Queryable by `indusk eval summary` for aggregations and trends.

### 8. Baseline mode specifics

To establish a baseline measurement:
1. Create a clean worktree from the target codebase
2. Strip it: remove `.claude/skills/`, wipe `.mcp.json` MCP servers, replace CLAUDE.md with a minimal skeleton
3. The dumb agent gets a task and works with vanilla Claude Code — no catchup, no lessons, no graph queries
4. It commits to jj at regular intervals
5. The smart evaluator scores each commit with the full rubric
6. Results become the baseline

Over time, baseline runs on different codebases and tasks become a library of evidence. These are reusable for promoting the tool — showing the before/after delta with hard numbers.

## Alternatives Considered

### Pre-assembled context package to a one-shot scorer
Build the context before spawning the judge — extract CLAUDE.md, lessons, skills, Graphiti results — then send everything as a single prompt to `claude --print`. Rejected because: we can't predict what context the judge needs. The judge should investigate from the outcome, not be spoon-fed. A pre-assembled package would miss relevant context we didn't think to include.

### Self-evaluation by the working agent
Ask the agent that just did the work to evaluate itself. Rejected because: self-evaluation is blind to its own assumptions. The agent that wrote fallback code thought it was doing the right thing. A fresh agent with no conversational history sees the transcript cold and notices things the working agent can't.

### A/B worktree replays
Create two worktrees (vanilla vs InDusk), run the same task, compare outputs. Rejected for v1 because: the transcript-based approach is simpler, cheaper, and more informative. The transcript already contains everything — you don't need to re-run the task to evaluate it. Baseline mode captures the vanilla side without replaying.

### RAG evaluation frameworks (RAGAS, Trulens, Braintrust)
Use existing RAG eval tools to score context retrieval and answer quality. Rejected because: these expect a standard RAG loop (query → retrieve chunks → generate answer → score against reference). InDusk's context is multi-layered and implicit — CLAUDE.md loaded at start, skills triggered on commands, Graphiti recalled during catchup. The retrieval step isn't a discrete vector search — it's spread across the entire session. Adapting these tools would require faking every input format, and the metrics would measure the wrong thing.

### Evaluate every response / every tool call
Run the judge at a finer granularity than commits. Rejected because: most tool calls are mechanical (grep, read file, run test). Evaluating each one is noise. The commit is the natural boundary where meaningful work completes.

### Evaluator as background process in the same workspace
Run the evaluator in the same workspace as the working agent. Rejected because: MCP contention, shared CLAUDE.md prevents baseline mode, eval artifacts pollute the working tree. The worktree model gives clean isolation with no trade-offs.

## Consequences

### Positive
- Zero-friction quality measurement — fires automatically, never blocks work
- Actionable findings — "you missed this convention, here's the evidence"
- Knowledge distillation — evaluator writes derived insights to Graphiti that improve subsequent sessions
- Context sufficiency signal — "the graph is missing X" drives what to build next
- Trend data — scores over time show whether the context system is improving
- Baseline comparison — controlled experiments prove the delta with hard numbers
- Rubric is evolvable — add questions without changing infrastructure
- The judge understands the project — it does catchup, not just text matching
- Worktree isolation — no contention between working agent and evaluator
- Promotional artifacts — baseline vs. eval delta, trend charts, before/after stories

### Negative
- Cost: one Opus agent per commit (~2 minutes compute each)
- Latency: results are async, not instant — you see them later, not during work
- Cold start: the rubric starts with 4 questions and needs iteration to become comprehensive
- jj dependency: requires jj for commit hooks and point-in-time context
- Baseline mode requires task curation and worktree setup

### Risks
- Judge may produce low-quality evaluations initially — mitigated by iterating the rubric based on whether findings are actionable
- Background agent may interfere with the working agent's MCP connections — mitigated by worktree isolation and separate session
- Eval log may grow large — mitigated by structured JSONL format and future compaction
- Questions may not capture what actually matters — mitigated by starting simple and adding based on real experience
- Baseline tasks may not be representative — mitigated by running on real codebases with real feature requests

## Documentation Plan

### Pages
- New: `reference/eval/overview.md` — how the eval system works, two modes, question rubric, reading results
- New: `guide/eval.md` — getting started with eval, interpreting scores, running baselines, adding questions

### Diagrams
- Mermaid sequence diagram: commit → hook → eval worktree → judge process → Graphiti + log
- Architecture diagram showing worktree layout and data flow between working agent, evaluator, and Graphiti

### Changelog
- Added context system evaluation — commit-triggered evaluator scores every commit, writes derived insights to Graphiti, with baseline mode for measuring context system delta

### ADR in Docs
- `decisions/context-eval.md`

## References
- [Brief](brief.md)
- [Anchor-overlay pattern whitepaper](../../research/anchor-overlay-pattern.md) — the context system being evaluated
- Claude Code hooks documentation — transcript_path, session_id
- Claude Code `--print` mode and agent spawning
- The composable.env transcript that motivated this plan
