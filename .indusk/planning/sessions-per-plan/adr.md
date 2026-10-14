---
title: "Sessions per plan"
date: 2026-10-14
status: accepted
---

# Sessions per plan

## Goal

**Several plans can each have an agent at once; only the same plan's same kind of session, or the machine's cap, refuses a start.**

Today the admin's one `SessionManager` refuses any start while any session runs, so a
planning session on `component-content` stopped Sandy from starting a new plan
(2026-10-14). After this, that start goes through, and the only refusals are a second
session of the same kind on the same plan, or a machine already running its cap.

## Y-Statement

**In the context of:**
one admin daemon per machine starting Claude sessions for every project's plans and drafts, each plan already working in its own worktree on its own branch.

**Facing:**
a manager that holds sessions in a map but refuses any start while the map is not empty, and nine admin callers that ask it for "the" running session (`current()`) and compare that one session to their own plan.

**We decided for:**
keying the refusal by owner (project, plan, kind) inside `SessionManager.start`, with a machine-wide cap `sessions.max` read from the InDusk home's `config.json` (default 4); replacing `current()` with `forPlan(project, plan, kind?)` and `running()`, so every caller names the plan it means.

**And against:**
a manager per project (the cap is the machine's, and the record file and crash reaping are already one per machine); no cap (an accidental burst of unattended builds would run unbounded); the cap in each project's `.indusk/config.json` (the daemon serves every project, so no one project can speak for the machine); keeping `current()` as "the first" (callers comparing it to their own plan would silently miss their own session whenever another plan's started first).

**To achieve:**
plans worked side by side from the admin, planning and building at once, with each page showing its own plan's agent (A1–A6, A8, A9).

**Accepting:**
that a new machine-level file, `~/.indusk/config.json`, appears (only `sessions.max` in it for now), and that two plans' agents run on one machine at once, costing tokens in parallel.

**Because:**
the worktree per plan already makes two plans' sessions unable to write the same checkout, so the one-at-a-time rule protected nothing that is not already protected; it was the simplest safe start (`08ad8a34`), and the cap keeps what remains of its purpose, a bound on what runs at once.

## Context

See `research.md`: the guard is `SessionManager.start` (`apps/indusk-mcp/src/lib/session/manager.ts`); its callers in the admin are listed there. The plan page and the brief page already share one planning session per plan through `PlanSession`, so nothing changes for a person moving between them.

## Decision

1. **The owner is (project, plan, kind).** `start` refuses only when a held session has the same project, plan and kind, with `SessionBusy` naming it: `a planning session is already running for <plan>: <id> — stop it first`. A draft's conversation is owned by its draft's key as the talk route passes it today (`convo.plan`), so it never collides with a plan.
2. **The cap.** `start` refuses when the manager holds `max` sessions: `<max> sessions are running (sessions.max): <kind> for <plan>, … — stop one from its plan's page in the admin`. `max` comes from the constructor when given (tests), else `readSessionsMax()`: `sessions.max` from `join(induskHome(), "config.json")`, a positive integer, else 4. A malformed file reads as the default, never a crash of the daemon.
3. **Readers name their plan.** `current()` is removed. `forPlan(project, plan, kind?)` returns that plan's session record (of that kind, or either), and `running()` returns every record. Each admin caller moves to the one it means: the build host and build route, the draft routes, the decision delivery and `readWaiting` (one entry per running session of the project), the sessions route (`GET ?project&plan&kind`), and the promise fix route.
4. **Stopping is per session**, as today: `stop(id)` ends one and leaves the rest; the record file lists the remaining ones.

## Alternatives Considered

### A manager per project
The cap and the crash record are the machine's. Two managers would each think the machine is theirs.

### No cap
A person pressing Build on many plans, or a loop starting sessions, would run without bound.

### Cap in the project's config
The daemon is machine-global; a project's file cannot decide for others.

## Consequences

### Positive
- Plans move in parallel from the admin; planning and building one plan at once.
- Every caller says which plan it means, so a page can never show another plan's agent.

### Negative
- A new machine-level config file to document.

### Risks
- A caller left on "the first session" shows the wrong plan's agent. Mitigation: `current()` is deleted, so a missed caller fails to compile.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/admin-ui/overview.md` (sessions: one per plan and kind, the cap).
- Update: `apps/docs/src/guide/multi-agent.md` (several plans' agents at once from the admin).

### Diagrams
- None.

### Changelog
- Changed: "Several plans can each have an agent at once; a machine runs at most `sessions.max` (4) sessions, set in `~/.indusk/config.json`."

### ADR in Docs
- `apps/docs/src/decisions/sessions-per-plan.md`.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder.
- `.indusk/planning/approve-then-improve/brief.md` (draft): the parallel-first direction this is the first plan of.
