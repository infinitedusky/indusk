# Plan Cockpit — the admin as the cockpit

**Decided 2026-10-10.** Full ADR: `.indusk/planning/plan-cockpit/adr.md` (archived to `.indusk/planning/archive/plan-cockpit/adr.md` when the plan closes).

## What was decided

The admin becomes the cockpit: a nav of every plan by Path, a plan page as its two workflows with the one decision it waits on, a promise dashboard with broken promises first, and a page per promise with its proof and a fix. It is rebuilt in place. The admin already had the readers, the sessions, the live refresh and the test harness, so a second app would have duplicated them and the demo would have shown two UIs.

**Every fact the cockpit shows is computed once, in the package.** The admin's own `lib/` keeps only the glue from files and the daemon to props, so the editor and the next stage read the same thing. Seven subpaths:

| Module | What it gives |
|---|---|
| `promises/rows` | the test rows, active and archived, that name a promise |
| `promises/standing` | each promise's one state for a person — broken, being proven, declared, enforced, retired — from the health reader the editor uses |
| `promises/proof` | one promise's rows, the places it was marked and when each was last seen, thirty days held and broken per source, its dated history, and the banner |
| `promises/fix` | the fix prompt, moved out of the editor; the editor imports it back |
| `plans/steps` | Planning and Release as lists of steps, from the plan's type, its documents and its position |
| `plans/waiting` | what a plan waits on the person for: a question, approval or review, at most one |
| `plans/history` | the plan's decisions, recorded and read back |

A test (`cockpit-single-definition.test.ts`) fails on a second definition of any of them in the admin or the editor.

**The nav.** Promises, with the number broken. *Needs you*, each waiting plan with the step it waits at. Paths nested as deep as `master.md` files declare them, each with how many of its plans a release has shipped. Plans no Path declares come after. Below 760 px the nav is a drawer; above, it collapses to a strip and remembers that.

**Decisions wait in one place.** A waiting plan's page shows one card: the decision, accept, the alternative and a reply in words. Accept answers the agent's question, runs `indusk plans approve`, or accepts the plan and starts its release. A reply goes to the plan's running session, or a new session is started for the plan in its worktree with the decision and the words as its prompt.

**Every answer is recorded on `main`**: a dated line in `.indusk/plan-history/<plan>.md`, committed as `chore(indusk): <plan> — <answer>` by the notes writer `current.md` and lessons use. Only that file is committed. When `main` cannot take the commit, the line stays written and the reason is given.

## Alternatives rejected

- **A separate cockpit app.** It would duplicate the admin's readers, session host, live refresh and daemon.
- **Deriving the new facts in the admin's `lib/`.** Faster to write, but the editor needs "being proven", the proof and the fix prompt too, and a second computation of what a person reads is how two screens come to disagree.
- **Recording decisions in the project's machine-state home.** It is per machine and not read by people; decisions are notes, and notes live on `main`.
- **Recording decisions in the plan's own folder.** On its branch, the history would race the building agent's commits. On `main`, it would make a folder for a plan not yet approved.
- **Queuing a reply for a plan with no running agent.** Nothing would drain the queue until someone opened a session, which is the failure the card exists to end.
- **Declaring a promise's marks in its file**, so a promise never seen could list where it is watched. That is a second list beside the code that marks, free to drift from it, kept only for an empty state. A promise never seen says "not seen yet".

## Tradeoffs accepted

- One `chore(indusk):` commit on `main` per decision answered.
- *Needs you* is only as live as the admin: a question asked in a terminal session is not seen. The cockpit shows what the admin runs.
- A plan's documents, phases and rows moved one click down, under *Details*.
- The editor's fix code moved into the package, so an extension release goes with this one.

## See also

- [Admin UI overview](/reference/admin-ui/overview) — the nav, the dashboard, the plan page
- [The promise page](/reference/admin-ui/promise-page)
- [Sessions → Decisions](/reference/admin-ui/sessions#decisions)
- `/decisions/display-names`, `/decisions/bookkeeping-lives-where-it-is-read`, `/decisions/admin-plan-authoring`
