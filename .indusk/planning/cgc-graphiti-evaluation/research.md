---
title: "CGC + Graphiti Evaluation — Experimental Research Plan"
date: 2026-04-07
status: in-progress
workflow: spike
---

# CGC + Graphiti Evaluation — Research

## Question

**Does the InDusk dev system (CGC + Graphiti + planner/work/retrospective skill lifecycle + capture/recall triggers) materially improve agent-driven software development on real projects?**

This is a meta-evaluation of the dev system itself. The hypothesis behind every plan in the `context-graph` umbrella (graphiti-infrastructure, cgc-graphiti-bridge, future unified-graph work) is "yes." This spike exists to test that hypothesis empirically — design real experiments, run them, report results, refine the experiments over time, and produce actionable signal about what's working, what isn't, and what to build next.

The animating question, articulated by Sandy on 2026-04-07: "How are we going to judge whether this is improving things or not? How do we say, here's an example, I'm going to tell it to do this, create this file or change this file, and you're going to see that it's going to check and get information and look at this — and this is its context now whereas it would have been like this."

## Why this is its own plan

1. **It's about the system, not any one project that uses the system.** It needs its own home and its own lifecycle, separate from chitin-sportsbook (which is the experimental substrate but not the experiment itself), graphiti-infrastructure (which is the plumbing being evaluated), and dusk-v2 (which is downstream — its scope will be informed by what this spike learns).

2. **It's a long-running, iterative effort.** Not "design one experiment, run it, get an answer." More like "design experiments, run them, learn what we can and can't measure, design better experiments, repeat indefinitely." The output of the spike accumulates over time as a research log, not a one-shot deliverable.

3. **It has its own success criteria** — generating actionable signal about whether to invest more in the dev system, fewer hours, or pivot — which is different from any individual project's success criteria.

4. **Spike workflow is the right shape.** Spikes produce research only, no impl. This plan stays in `research.md` (this file) and grows over time. Each experiment iteration appends a new section. The spike never "completes" in the traditional sense — it's an ongoing investigation.

## Design philosophy

The user's framing is the right one and worth quoting verbatim:

> "For sure. Once we get going, we'll just create a mock. We just need to set up some experiments. They need to be good experiments with good controls and all that good stuff. And then we do that work and we report the findings and we keep doing it. We just make those better and better over time and say, okay, what can't we learn from this and how could we set it up so we do learn?"

Translated into research methodology:

- **Real experimental rigor.** Each experiment has a hypothesis, a control, an independent variable, a measurable outcome, and pre-registered success criteria. No vibes-based "I think it feels better."
- **Iterate on the method.** After every experiment, ask "what couldn't we learn from this, and how could we have designed it differently?" The next experiment fixes the previous one's limitations.
- **Report everything.** Wins, losses, ambiguous results, discovered confounds. The research log is the deliverable.
- **Continuous, not one-shot.** Better experiments come from doing more experiments. Don't try to design the perfect first experiment — get a flawed one going and refine.
- **Falsifiability matters.** If we can't imagine an experimental result that would make us say "the system isn't working," then we're not doing science. Define what failure looks like upfront.

## Initial experimental sketch — Two-Agent Comparative Study

### The basic idea

Run two parallel agents on identical tasks. One has the full InDusk stack (CGC + Graphiti + skills + capture/recall). The other doesn't (or has reduced access). Ask both to do the same work. Compare what each produces, what each consults, how each gets stuck, and what each remembers from prior sessions.

### The two arms

**Arm A — "Enhanced agent" (InDusk + CGC + Graphiti)**:
- Full InDusk dev system installed
- All MCP servers registered (`indusk`, `codegraphcontext`, `graphiti`)
- All skills loaded (`/planner`, `/work`, `/verify`, `/context`, `/document`, `/retrospective`, `/catchup`, `/handoff`, `/jj`)
- Capture and recall triggers active
- The whole stack as it exists in 2026-04-07's `infinitedusky`

**Arm B — "Baseline agent" (no Graphiti, possibly reduced CGC)**:
- Vanilla Claude Code
- No `mcp__graphiti__*` tools
- No capture or recall triggers
- No InDusk skill files in `.claude/skills/` (or a stripped-down set)
- Filesystem access, grep, basic CLAUDE.md only
- Possibly retains CGC for structural queries, possibly not — design question per experiment

### Two project-shape options

**Option 1 — Two sibling projects, identical content.**
Two repos: `chitin-sportsbook-a` (Arm A) and `chitin-sportsbook-b` (Arm B), both containing the same starting code. Each has its own Claude Code session with different `.mcp.json` config. Run identical tasks on both. Compare outputs.

Pros: clean isolation; no risk of one agent's actions polluting the other; can run in parallel.
Cons: 2x the disk space; have to manually keep them in sync; differences in tool calls and side effects might create divergence over time.

**Option 2 — One project, "observation mode."**
One real project (e.g. chitin-sportsbook). The "enhanced agent" does the actual work. A second agent process watches the first agent's actions (file diffs, tool calls, decisions) and is asked to predict or replicate them **without** access to Graphiti. This is closer to a "ghost replay" — the baseline agent tries to imagine what it would have done without the dev system, given the same starting state.

Pros: no duplicated state; the comparison is more direct because both agents see the same files.
Cons: harder to instrument; observation/mimicry has its own failure modes; the baseline agent may "cheat" by reading the enhanced agent's recent edits.

**Open question**: which shape is right? Probably depends on the experiment. Some experiments fit Option 1 (long-running, multi-session, decision recall), some fit Option 2 (single-task, structural queries, in-the-moment context).

### Continuous self-reporting

Both agents are asked to **introspect periodically**:

- Before any non-trivial decision: "Dump your current context. What do you know about this task, where did each piece come from, what's informing your plan, what gaps are you working with?"
- After any meaningful edit: "Briefly: what context informed this decision? Which queries (if any) shaped what you just did, and what would you have done differently without them?"
- At natural checkpoints (phase end, plan end, session end): "What did you query during this work? Which results changed your approach? Which were noise?"

The agent's answers become the **evaluation log**. They're saved as part of the experiment's results — either as files in the experiment directory or as Graphiti episodes (for the enhanced agent) or both. This is cheap, requires no infrastructure, and gives you the audit trail directly from the agent's working memory.

### Code experiments — the actual tasks

The point of comparison is **doing real work**, not contrived benchmarks. Some experiment task categories worth exploring:

1. **Add a function to existing code.** "Add a `cancelBet(betId)` function to the bet matcher that integrates with the existing match engine and respects the existing error handling pattern." Tests: pattern recognition, structural awareness, prior-decision recall.

2. **Refactor without breaking callers.** "Rename `processBet` to `placeBet` everywhere it's used." Tests: blast-radius awareness (CGC strength), grep-vs-graph speed.

3. **Find all uses of a pattern.** "Show me everywhere we call out to the oracle service. Group by purpose." Tests: structural discovery (CGC) vs lexical search.

4. **Remember what we decided three sessions ago.** "Why did we choose order book over AMM matching?" Tests: Graphiti recall and contradiction detection.

5. **Don't re-introduce a deleted decision.** Set up: in session 1, decide X. In session 2, mark X as wrong and decide Y. In session 3, ask the agent something where the natural answer is X. Does the agent remember Y was the correction? Tests: contradiction detection, temporal validity.

6. **Onboard cold to an unfamiliar file.** "What does `bet-matcher.ts` do, why does it exist in this shape, what should I be careful about when modifying it?" Tests: file-anchored context retrieval (the unified-graph vision's killer use case once it lands).

7. **Multi-session tasks with resumption.** Stop mid-implementation, start a new session, resume. Did the new session pick up the right context, or did it have to re-derive everything?

Each task is run on both arms. Outputs compared on:
- **Time to first edit** (proxy for orientation speed)
- **Number of tool calls before editing** (proxy for context-gathering thoroughness)
- **Correctness** (does the result actually work?)
- **Pattern fidelity** (did it match existing conventions?)
- **Duplication** (did it create code that already existed elsewhere?)
- **User corrections needed** (how much steering before it got it right?)
- **Self-reported context completeness** (the agent's own assessment of what it knew vs guessed)

### Pre-registered hypotheses

To avoid post-hoc rationalization, write down expected outcomes BEFORE running each experiment:

- **H1**: Arm A will need fewer tool calls to find existing patterns than Arm B (because CGC structural queries replace grep).
- **H2**: Arm A will be measurably faster on tasks that require recalling decisions from prior sessions (because Graphiti recall surfaces them automatically).
- **H3**: Arm A will be measurably better at not duplicating existing code (because find_code returns hits that grep would have missed).
- **H4**: Arm A will be measurably better at respecting prior corrections (because corrections were captured as `correction-*` episodes and surface in catchup).
- **H5**: Arm A will produce code that more closely matches existing project conventions on first attempt.

Each hypothesis should specify what "measurably" means before the experiment runs, so we can't move the goalposts after.

### Falsifiability

Things that would make us say "the system isn't paying for itself yet" (or "isn't paying for itself on this category of task"):

- Arm A and Arm B produce indistinguishable output on tasks 1-6
- Arm A produces output but has 2-3x more tool calls without measurable quality improvement
- Arm A's Graphiti queries return noise that the agent ignores in favor of grep
- Arm A's recall surfaces irrelevant context that distracts from the actual decision
- Arm A's self-reports show that capture/recall didn't actually inform any decision in the experiment

If we see these patterns repeatedly, the right move is **either** (a) re-design the experiment (we're measuring the wrong thing) **or** (b) change the system (capture/recall isn't useful in its current form).

## Open design questions

These are the things the spike has to figure out before any experiment runs. They're not blockers — they're the actual research questions of the spike itself.

### 1. Project shape

Is it Option 1 (two sibling projects) or Option 2 (one project, observation mode), or some hybrid? Probably depends on the experiment category, but this needs an explicit decision per experiment.

### 2. What does "no Graphiti" mean for the baseline arm

Hard mode: strip out all the InDusk skills, give the baseline agent only filesystem and bash. This is a strong control but unrealistic — nobody runs Claude Code with literally no skills.

Medium mode: give the baseline agent CGC (because that's just structural queries, useful regardless) but no Graphiti and no skill instructions about capture/recall. This isolates the temporal-knowledge-graph contribution from the structural-graph contribution.

Soft mode: give the baseline agent everything **except** Graphiti recall. The capture side fires (so Graphiti accumulates data) but the catchup recall step is disabled. This tests whether the recall side specifically is the value-add.

Probably we need to run experiments in all three modes to isolate which piece of the system contributes what.

### 3. How to measure "the agent's self-reported context"

Asking the agent to dump context is cheap but the answers aren't standardized. Different agents will format their context differently, making comparison hard. Options:
- A standardized prompt that asks for specific structured fields ("list every file you read, every tool you called, every decision you made")
- A post-experiment scoring rubric that an evaluator (you, or another agent) applies to both arms' outputs to extract comparable metrics
- A combination — agents respond freely, evaluator extracts metrics

Probably the third option. The agent's own framing is informative; the evaluator's extraction makes it comparable.

### 4. Who writes the task prompts

Tasks need to be:
- Specific enough that "correctness" is judgeable
- General enough that the answer isn't obvious from the prompt alone
- Diverse enough across the task categories to test different system features
- Realistic — actual work that you'd want done in chitin-sportsbook anyway

The user (Sandy) writes them. The spike maintains a library of task prompts in `experiments/tasks/` that grows over time.

### 5. How much setup is acceptable per experiment

If running an experiment takes an hour of setup, we'll do one a week and the data accumulates slowly. If it takes 5 minutes, we can do several in a session. The cheaper each experiment is to run, the more iterations we get.

The first few experiments will be expensive (we're inventing the methodology). Once the methodology stabilizes, subsequent experiments should drop to a few minutes each. Goal: experiments become as cheap to run as `pnpm test`.

### 6. How findings get written up

Each experiment produces:
- The hypothesis (pre-registered)
- The setup (project shape, baseline mode, task prompt, starting state)
- The raw outputs from both arms (file diffs, agent self-reports, tool-call timelines)
- The evaluator's extracted metrics
- The verdict (was the hypothesis supported, contradicted, or ambiguous)
- The lessons (what couldn't we learn from this, how could we have designed it differently)

These accumulate as `experiments/{date}-{name}/` directories under this plan. The aggregate verdict on "is the system paying for itself" comes from synthesizing across many experiments, not from any single one.

### 7. When to re-run old experiments

The dev system is changing — graphiti-infrastructure is still landing phases, cgc-graphiti-bridge hasn't started, dusk-v2 is parked. As features land, old experiments should be re-run to see if the gap between Arm A and Arm B widens (good) or stays the same (bad — we built features that don't measurably help). A re-run cadence is needed but not yet defined.

### 8. Sample size and statistical claims

We probably can't run enough experiments to make rigorous statistical claims. Each experiment is one observation. Don't pretend otherwise. The goal is **pattern accumulation**, not p-values: "across 12 experiments in the 'recall a prior decision' category, Arm A succeeded 11 times and Arm B succeeded 4 times." That's a useful pattern even without statistics.

## Plans this spike informs

When the spike has produced enough findings to act on, those findings shape the following plans:

- **`cgc-graphiti-bridge`** (currently draft brief, needs rewriting per the unified-graph vision): the experiments tell us which features of the bridge are most valuable and which are vanity. Don't write the bridge's ADR until experiments have shown which bridge capabilities actually move the needle.

- **`dusk-v2`** (parked at decision #1): the experiments inform what's worth keeping vs rewriting in the dusk-v2 refactor. If the experiments show that Graphiti recall is the highest-value feature, dusk-v2's design centers on making recall faster and more accurate. If they show that CGC structural queries are the highest-value feature, dusk-v2's design centers on the unified file-anchored graph.

- **Future plans we haven't named yet**: experiments may reveal capabilities we should build that aren't in any current plan. Those become new plans.

## What won't be in this spike

To prevent scope creep, this spike is explicitly NOT:

- An attempt to formally measure software engineer productivity (too contested, too hard, too long-term)
- An attempt to compare InDusk against other dev systems (Cursor, Windsurf, Continue, etc.) — only against vanilla Claude Code as a baseline
- A user study with multiple developers (it's just Sandy's machine)
- A peer-reviewed paper (the research log is for our own use)
- A blog post (maybe later, after several experiment iterations have produced clear findings)
- An academic-grade controlled study with N=100 (we're doing N=1 with care, not pretending otherwise)

## Status

**Spike is in-progress.** No experiments have been run yet. The first concrete next step is to get chitin-sportsbook scaffold-bootstrap further along (it provides the substrate and the first-pass observations) before designing Experiment 1 in detail.

When ready to start Experiment 1, this file gets a new section: `## Experiment 1 — {name}`. That section contains the hypothesis, setup, task prompt, raw outputs, metrics, verdict, lessons. Repeat indefinitely.

## Sources

- Conversation 2026-04-07 — Sandy articulated the experimental framing during chitin-sportsbook scaffold-bootstrap Phase 1 work
- The chitin-sportsbook project itself — `~/code/sandbox/chitin-sportsbook/.indusk/planning/sportsbook-bootstrap/research.md` and ongoing scaffold-bootstrap impl
- `graphiti-infrastructure/impl.md` Phase 6 — the original "evaluation" phase that this spike ultimately replaces
- `cgc-graphiti-bridge/brief.md` — the currently-too-small bridge plan that this spike will eventually inform
- `dusk-v2/research.md` — parked decisions that this spike's findings will eventually unblock
- `shared` Graphiti episodes captured 2026-04-07: `meta-infinitedusky-context-graph-direction`, `correction-shared-vs-codified-channels`, `meta-chitin-sportsbook-numero-relationship` — context for why this spike exists
