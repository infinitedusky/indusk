# Why Dawn

## The problem

A forward-deployed engineer drops into a client's codebase and spends the first two-to-six weeks reconstructing context that was already in someone's head, in a Slack thread, in a buried Notion doc, in last quarter's PR description, in a half-finished ADR, in tribal knowledge nobody wrote down. They ship nothing of value during this time. The client pays full rate.

When they leave, that context evaporates. The next FDE — or the client's own engineer who inherits the work — starts from zero. Again.

This pattern repeats inside enterprise dev teams too. Every rotation, every internal-mobility move, every new hire pays the same context-reconstruction tax. The cost compounds across a team and across a quarter.

Tools that exist today address fragments. IDEs index code. AI agents read files. PR review tools surface diff history. Knowledge bases hold long-form decisions. None of them deliver *the running project* — what's in flight, why architectural decisions look the way they do, what's been tried and discarded, where the live gotchas are, what the team's conventions actually require — to a new engineer in usable form.

## The thesis

The right primitive is a **wrapper that sits beside the codebase, not inside it**, and that surfaces project context to whichever agent CLI the engineer is driving — Claude Code, Cursor, Codex, Aider — through a common protocol (AGENTS.md + MCP).

The wrapper holds: plans (research → brief → ADR → impl → retrospective), lessons (we tried X, it broke because Y), live work-in-flight, observability correlations across test and production, decision history, and the conventions specific to this codebase. The agent CLI gets all of that loaded into its context automatically every session.

The result: an engineer walks into a project they've never seen, opens their preferred agent CLI, and within a few minutes has the same situational awareness as someone who has been on the team for months.

## Why now

Three forces converging in 2026 make this the right moment:

1. **AGENTS.md has become a cross-CLI standard.** Claude Code, Cursor, Codex, Aider, and others all read `AGENTS.md`. A wrapper that contributes to this single file reaches every major agent without per-CLI integrations.

2. **MCP has stabilized.** Model Context Protocol is now the lingua franca for tool exposure across agents. The same MCP server can serve Claude Code today, Cursor tomorrow, whatever ships next year.

3. **FDE-shaped work is growing fast.** AI-native consultancies, internal platform teams, and forward-deployed engineering as a service are all expanding. The pattern of "engineer drops into unfamiliar codebase to ship a project" is more common, not less, as AI compresses the time-to-deliver and increases the *number* of projects an engineer can credibly take on.

## What "good" looks like

Day 1: a single FDE on a single codebase is measurably 5-10x faster to first-meaningful-contribution than they would have been without Dawn.

Year 1: a team of FDEs working concurrently on the same codebase produces 10-20x compounding value because every engineer's discoveries flow back into the shared context every other engineer reads. The "two engineers > sum of their parts" property emerges from architecture, not coordination.

Year 3: enterprise customers buy Dawn because their engineers can move between projects without losing institutional knowledge, and because every project's accumulated learning becomes durable organizational memory rather than evaporating with the engineer who held it.

## Why this team

> _TODO: partner-aligned section. Sandy has been building Indusk for a year — the prototype that proved the wrapper-shaped product works for one engineer. The partner brings [TODO: specific complementary expertise]. Together we have [TODO: distribution / customer / domain advantage]._

## Why we believe this

The hypothesis isn't speculative. Sandy has been driving a precursor (Indusk-mcp) for a year. The behavioral pattern works: the planner skill produces durable plans, the catchup skill restores session context in seconds, the lessons system makes "we tried X, here's what we learned" survivable across sessions. Every Indusk session demonstrates the wrapper hypothesis at solo-engineer scale.

Dawn is the product realization of that hypothesis: same wrapper shape, but architected for FDE workflows and team-multiplicative scale from day one.

## What changes if we're wrong

If the FDE wedge doesn't pull, the architecture still serves enterprise platform teams (a larger but slower-moving market). If neither pulls, the technology still serves Indusk's existing solo-dev audience and we maintain that product without commercializing.

The kill condition: if no design partner can describe a concrete win from Dawn-MVP within their first month using it, the FDE thesis fails and we revisit positioning.
