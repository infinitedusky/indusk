# Sessions per plan — several plans, each with an agent

**Decided 2026-10-14.** Full ADR: `.indusk/planning/archive/sessions-per-plan/adr.md`.

## Goal

**Several plans can each have an agent at once; only the same plan's same kind of session, or the machine's cap, refuses a start.**

The admin's one `SessionManager` refused any start while any session ran, so a planning session on `component-content` stopped a new plan from starting (2026-10-14). The rule dates from `08ad8a34`, the simplest safe start; nothing recorded a reason for one. Each plan works in its own worktree on its own branch, so two plans' sessions never write the same checkout and the rule protected nothing that was not already protected.

## Y-Statement

**In the context of:** one admin daemon per machine starting Claude sessions for every project's plans and drafts, each plan already working in its own worktree,

**Facing:** a manager that refused any start while it held a session, and nine admin callers that asked it for "the" running session (`current()`) and compared it to their own plan,

**We decided for:** keying the refusal by owner (project, plan, kind) inside `SessionManager.start`, with a machine-wide cap `sessions.max` read from the InDusk home's `config.json` (default 4); replacing `current()` with `forPlan(project, plan, kind?)` and `running()`, so every caller names the plan it means,

**And against:** a manager per project, no cap, the cap in each project's `.indusk/config.json`, and keeping `current()` as "the first",

**Accepting:** a new machine-level file, `~/.indusk/config.json` (only `sessions.max` in it for now), and two plans' agents costing tokens in parallel.

## What was decided

1. **The owner is (project, plan, kind).** `start` refuses only when a held session has the same project, plan and kind, naming it: `a planning session is already running for <plan>: <id> — stop it first`. A plan can have a planning session and a build at once. A draft's conversation is owned by its draft's key, so it never collides with a plan.
2. **The cap.** `start` refuses when the manager holds `max` sessions, naming each running session and how to stop one. `max` is the constructor option when given (tests), else `sessions.max` from `~/.indusk/config.json` (honouring `INDUSK_HOME`): a positive integer, else 4. A malformed file reads as 4, never a crash of the daemon.
3. **Readers name their plan.** `current()` is removed, so a caller left on "the first session" fails to compile instead of showing another plan's agent.
4. **Stopping is per session**, as before: `stop(id)` ends one and leaves the rest recorded.
5. **A build holds one place under the cap, start to end.** `SessionManager.admitBuild(project, plan)` admits a build at the cap or refuses it, and returns a function that frees the place; a build-kind start for an admitted plan takes its build's place, so the gaps between steps hold it too. An earlier `inBuild` opt-out let several builds exceed the cap (found by the audit) and was removed. A release starts no agent session and holds no place.
6. **A same-plan refusal asks to continue.** It says the session is already running on this plan, asks "Do you want to continue that session here?" and hands back its id; the plan page shows a **Continue it here** button. This was added mid-build at Sandy's request, after the brief said Looks: None, so the brief was not amended. The fix page and the draft conversation show the question without a button; a follow-up.

## Why a machine file for the cap

The daemon is machine-global, so no one project's config can speak for it. The record file and crash reaping were already one per machine.

## References
- Full ADR: `.indusk/planning/archive/sessions-per-plan/adr.md`
- [Admin plan authoring](/decisions/admin-plan-authoring) — where the session manager was introduced
- [Worktree visibility](/decisions/worktree-visibility) — the worktree per plan that makes parallel sessions safe
