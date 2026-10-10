---
title: "Plan cockpit"
date: 2026-10-10
status: proposed
---

# Plan cockpit

## Goal

**The admin becomes the mockup: a nav of every plan by Path, a plan page as its two workflows with the one decision it waits on, a promise dashboard with broken promises first, and a page per promise with its proof.**

Today a broken promise in the admin is one row in a table, with no page of its own, no account of why the tests missed it and no way to start a fix; the editor can do all of that and the admin cannot. A planning question asked in the admin is answered in a session panel and forgotten when the admin stops. This plan fixes both, and is what the demo's recording runs through.

## Y-Statement

**In the context of:**
stage 1 of the promise UI, the step before the demo rehearsal: the existing Next.js admin, which already reads plans, promises, health per source, the timeline and the heard store through the package's subpath exports, and already runs sessions and builds.

**Facing:**
a mockup that draws things InDusk has data for (rows naming a promise, violations per day, plan release dates, ritual states) and things it does not (a general "needs you", a recorded decision, per-mark last seen, a fix action outside the editor), and a rule that the admin shows and never computes what the package owns.

**We decided for:**
rebuilding the admin's shell and three of its pages in place (the nav, the plan page, the promises dashboard) and adding a promise page at `/p/[project]/promises/[name]`, with every derived fact computed by a package module the admin reads: `plans/steps` (Planning and Release from the workflow type and plan position), `plans/waiting` (what a plan waits on), `plans/history` (decisions, recorded as a note on `main`), `promises/standing` (the dashboard's state, including "being proven"), `promises/proof` (rows, marks, thirty days and history for one promise) and `promises/fix` (the fix prompt, moved out of the editor so both use one).

**And against:**
a separate cockpit app beside the admin; computing the new facts in the admin's own `lib/`; recording decisions in the project's machine-state home or in the plan's own folder; queuing a reply to a plan with no running agent; and declaring a promise's marks in its file so an unseen promise could list them.

**To achieve:**
every promise in the brief, with each fact defined once so the editor and stage 2 can read the same thing, and decisions that outlast the admin and can be read by a person.

**Accepting:**
a large plan on the demo's path; a `chore(indusk):` commit on `main` for each decision answered; "never seen" as the only thing an unwatched promise can say about its marks; and the editor's fix module moving into the package, which touches a shipped extension.

**Because:**
the admin already has the readers, the sessions, the live refresh and the test harness, so a second app would duplicate them; `the-editor-shows-the-same-health-as-the-admin` and `display-names-are-defined-once` already establish that a fact a person reads is computed once in the package; and the bookkeeping decision puts notes people read on `main`, committed as written.

## Context

[research.md](research.md) maps each element of the mockup to the code that
backs it, or to nothing. The [brief](brief.md) makes eight promises and changes
one; the [test plan](test-plan.md) has 36 assertions, 35 of them `unit`.

## Decision

### 1. In place, in the admin

The cockpit is the admin. The shell (`app/p/[project]/layout`) gets the new
nav; the plan page and the promises page are rebuilt; one route is added,
`/p/[project]/promises/[name]`. The research and scorecards pages stay and are
reached from the nav. Live update stays `LiveRefresh`.

### 2. The nav

- **Promises**, with the count of broken promises (`broken-promises-come-first`).
- **Needs you**: each plan `plans/waiting` names, with the step it waits at.
- **Paths**: `readPlanDeclarations` walked recursively — a subplan that is
  itself a parent opens as a group, to any depth; a cycle stops at the first
  repeat. Each Path shows `released/total`, released from `planDates`. Plans
  no Path declares are listed after the Paths (the inventory comes from disk
  and is never subtracted).
- Below 760 px a drawer, closed by default; above, a collapsible strip whose
  state is kept in `localStorage` (wrapped, a per-viewer convenience).

### 3. The plan page

- Header: the plan's title and dates from `promises/display`, its Path, and its
  promises as chips with their test counts.
- **Planning** and **Release** from `plans/steps`. Planning is the documents the
  plan's workflow type requires, in order (Research → Brief → Test plan →
  Decision → Impl; a type that skips one does not show it). Release is Build →
  Falsify → Cleanup → Audit → Review → Release, each from `derivePlanPosition`'s
  segments; a ritual skipped with a reason shows *skipped*. No control sets a
  step.
- **The decision card**, when `plans/waiting` returns one. Today's documents,
  phases and rows move under the card as collapsible detail (the mockup's
  *Details*); nothing is removed.

### 4. What a plan waits on, and where the answer goes

`plans/waiting(project)` returns, per plan, at most one of:

| Waiting on | Read from | Accept does | The alternative / reply |
|---|---|---|---|
| a question from its agent | a running admin session's pending `AskUserQuestion` | answers with the chosen option, as the session panel does (`POST /api/sessions/[id]/reply`) | another option, or the words as the answer |
| approval | brief and test plan accepted, impl written and `draft` | `indusk plans approve` | the words go to the agent (below) |
| review | the build stopped at `review` | `acceptPlan`, as Accept does today, with the evidence shown (`a-review-shows-its-evidence`) | the words go to the agent |

**A reply in words** goes to the plan's running session if there is one
(`say`). If there is none, the admin starts one for the plan, in its worktree,
with the reply and the decision it answers as the prompt — the same start the
admin already uses for planning. A queue was rejected: nothing would drain it
until someone opened a session, which is the failure the card exists to end.

**Every answer is recorded** by `plans/history`, as a dated line — the
decision, the answer, who — appended to `.indusk/plan-history/<plan>.md` in
the main checkout and committed on `main` as `chore(indusk): <plan> — <answer>`,
through the same writer the bookkeeping decision gave `current.md` and lessons
(only those files committed; left uncommitted with a reason when `main` is not
clean to commit on). It is a note a person reads, so it lives on `main`.
Rejected: the project's home, which is machine state and per machine; the
plan's folder, which on its branch would race the building agent's commits and
on `main` would make a folder for a plan not yet approved.

### 5. The dashboard

`promises/standing(project)` gives each promise one state for a person:
**broken** (health red from the alarm source), **being proven** (declared, with
rows naming it and not all passing), **declared**, **enforced**, and **retired**
(hidden by default). It reads `promises/health` for health — the reader the
editor uses — and `promises/rows` for rows; it does not recompute either.
Rows: sentence and title from `promises/display`, tests as passing/total,
thirty-day held and broke, last activity. Group by state, plan or Path; sort;
filter by sentence, name or plan. Broken first, latest break first.

### 6. The promise page

`promises/proof(project, name)`:

- **Tests that back it**: `rowsNaming` (exported as `promises/rows`), active
  and archived, with state and files.
- **Where it is watched**: the marked spans grouped by service and operation,
  each with when it was last seen held and last seen broken; empty: "not seen
  yet". Rejected: declaring marks in the promise file — a second list beside
  the code that marks, to drift from it, for the sake of an empty state.
- **Thirty days**: per day and per source, broken from `countHeard` (the heard
  store, so a violation recorded with no page open is counted —
  `the-admin-keeps-what-it-heard`), held from the store's window.
- **History**: declared, confirmed and changed from the promise file's own
  History section, and each incident, dated.
- **The banner**, when broken: the latest break, and — when every row naming it
  passes — that the tests miss the case that breaks it.
- **Start a fix plan**: `promises/fix` builds the prompt (the promise, its
  symptom, its trace link, its tests) — the editor's `fixFor`, moved into the
  package and imported back by the extension — and the admin starts it as an
  admin session in the project, visible in the session panel.

### 7. Package exports

New subpaths: `plans/steps`, `plans/waiting`, `plans/history`,
`promises/standing`, `promises/proof`, `promises/rows`, `promises/fix`. The
admin imports only these and the existing ones; its own `lib/` keeps only
fs-to-props glue.

## Alternatives Considered

### A separate cockpit app
A second Next.js app, or a static page over a JSON endpoint. Rejected: it would
duplicate the admin's readers, session host, live refresh and daemon, and the
demo would show two UIs.

### Derive in the admin's `lib/`
Faster to write. Rejected: the editor and stage 2 need "being proven", the
proof and the fix prompt too, and `the-editor-shows-the-same-health-as-the-admin`
already forbids a second computation of what a person reads.

### Decisions in the project's home, or in the plan folder
See Decision §4.

### Queue a reply for a plan with no agent
See Decision §4.

### Declared marks
See Decision §6.

## Consequences

### Positive
- A break in the demo has a page, a reason and a fix, all in the admin.
- Decisions outlast the admin and read as a history on `main`.
- Seven facts the editor and stage 2 can reuse, each defined once.

### Negative
- One `chore(indusk):` commit on `main` per decision answered.
- The extension's fix code moves into the package: an extension release goes
  with this one.
- The plan page's detail (documents, phases, rows) moves a click down.

### Risks
- **The plan is large for the demo's path.** Mitigation: the build phases are
  ordered so the demo's story (dashboard → promise page → fix) lands before the
  decision card; if time runs out, the decision card phase is the cut, with its
  promise carried to a follow-on plan.
- **Session-backed "needs you" is only as live as the admin.** A question asked
  in a terminal session is invisible here. Accepted: the cockpit shows what the
  admin can see; terminal sessions are the editor's and the terminal's.
- **Nested Paths may have cycles** in hand-written masters. Mitigation: the walk
  stops at the first repeat, and a test holds it.

## Documentation Plan

### Pages
- Update: `apps/docs/src/reference/admin-ui/overview.md` — the nav, the plan page, the dashboard
- New: `apps/docs/src/reference/admin-ui/promise-page.md` — what each section shows and where it comes from
- Update: `apps/docs/src/reference/admin-ui/sessions.md` — decisions, Needs you, the recorded history
- Update: the package's subpath reference for the seven new modules

### Diagrams
- Mermaid in `promise-page.md`: the promise page's sections and the package module each reads.

### Changelog
- "The admin is the cockpit: plans by Path, each plan's two workflows and the decision it waits on, the promise dashboard with broken promises first, and a page per promise with its proof and a fix."

### ADR in Docs
- Yes: `apps/docs/src/decisions/plan-cockpit.md`.

## References
- [research.md](research.md), [brief.md](brief.md), [test-plan.md](test-plan.md)
- [`research/promise-ui/`](../../research/promise-ui/README.md) — the mockup
- [contract-ui](../contract-ui/brief.md) — stage 2
- `/decisions/bookkeeping-lives-where-it-is-read`, `/decisions/display-names`, `/decisions/admin-plan-authoring`
