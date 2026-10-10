---
title: "Plan cockpit"
date: 2026-10-10
status: complete
---

# Plan cockpit — Research

## Question

What does the admin need so that the mockup in
[`research/promise-ui/mockups/plan-cockpit.html`](../../research/promise-ui/mockups/plan-cockpit.html)
is the real admin: a nav of every plan by Path, a plan page as its two
workflows with the decision it waits on, a promise dashboard with broken
promises first, and a page per promise with its proof? And how much of what it
draws already exists as data?

## Background

Stage 1 of the promise UI, step 10 of the [demo](../indusk-demo/master.md)
(the step before the rehearsal). Stage 2,
[contract-ui](../contract-ui/brief.md), is the hierarchy above these pages and
changes nothing inside them. The mockup and a draft brief, test plan and impl
were written on 2026-10-05, outside the InDusk templates, and left three
promises to be settled when the plan opened (the Paths nav, decisions in one
place, the phone-width nav); see the folder's
[README](../../research/promise-ui/README.md).

Today the admin is organised around the process. The sidebar lists plans
grouped by `master.md`; the plan page shows documents, a lifecycle bar,
phases and their trajectory rows; the Promises page is one table with state
per source, a timeline and incidents. There is no page for one promise, no
"needs you" list, and no fix action in the admin. The editor already has the
broken-first view (`every-promise-is-listed-in-the-editor`) and the fix action
(`a-break-opens-a-fix-in-one-click`).

## Findings

Paths below are under `apps/`; `mcp` is `indusk-mcp/src/lib`, `admin` is
`indusk-admin/src`.

### The mockup, view by view (read 2026-10-10)

1. **Plan page.** Sidebar: a Promises entry with a broken count, *Needs you*
   (4 plans, each with the step waiting), *Paths* nested two deep, each Path
   with "N/M released". Main: the plan's promises as chips with test counts;
   *Planning* (Brief → Test plan → Decision → Impl) and *Release* (Build →
   Falsify → Cleanup → Review → Release) as two vertical lists with their own
   progress; a "Claude needs you" card with one question and three answers
   (accept, the alternative, *Maybe…*), then Details and What happened.
2. **Promises dashboard.** A stacked bar of states with counts; group by
   Status / Plan / Path; sort; filter by text. Broken first. Each row: the
   sentence in words, name and plan, tests as pips (3/3), "evals · 30 days"
   (92 held · 2 broke), last activity.
3. **Promise page.** A red banner — what broke and that every test still
   passes, so the tests miss the case — with *Start a fix plan*; four tiles
   (tests, held, broke, last); *Tests that back it* (ID, what it checks,
   level, state, last run); *What triggers an eval* (signals, armed or
   failing); *In use* (30-day bars, broken days red); *Same plan*; *Where it
   lives*; a dated *History*.

### What exists as data

| Mockup element | What InDusk has | Where |
|---|---|---|
| Promise states (broken / being proven / declared / enforced) | `declared \| enforced \| known-violated \| retired`; health per source `red \| fixed \| green \| unverified \| amber \| grey` | `mcp/promises/vocabulary.ts`, `healthOf` `mcp/promises/health.ts:479` |
| "Being proven" | nothing; derivable from a declared promise's rows (written, not all passing) | — |
| Tests that back it | `rowsNaming(planRoot, promise)` scans every impl, active and archived, for rows whose `For` names the promise, with state and test files | `mcp/promises/rows.ts:50` — **not exported to the admin yet** |
| Evals held / broke over 30 days | violations: `heard.jsonl` per project, `countHeard(rows, {since, bucketMs})` buckets per promise ("meant for plan-cockpit's chart"); held: `readWindow` over the promise store | `mcp/promises/heard.ts:59`, `admin/lib/promise-timeline.ts:23` |
| Eval triggers, armed / failing | no declared list. A promise is marked on any span (`markPromise`); the reader returns per-promise `violations`, `lastUpheld`, each with `service` and `operation` | `mcp/promises/telemetry.ts:31,94` |
| History | declared/confirmed/changed dates in the registry, incidents, plan dates | `mcp/promises/registry.ts`, `incidents.ts`, `display.ts` |
| Names as words, plan titles, dates | `promiseWords`, `planTitle`, `planDates` (started, landed, released version + date), `readHealthNames` | `mcp/promises/display.ts` — the admin does not call it yet |
| Paths, nested | `readPlanDeclarations`: root `parents:` + `roadmap:`, each parent's `subplans:`; `buildGroups` renders root → parent → child, never deeper | `mcp/plan-parser.ts:338`, `admin/components/PlanList.tsx:65` |
| N/M released per Path | `planDates(...).released` per plan | `mcp/promises/display.ts:208` |
| Planning / Release steps | workflow type and required documents (`WORKFLOW_DEFINITIONS`); plan position segments incl. falsify, cleanup, audit, review, accepted (`derivePlanPosition`) | `mcp/workflow-types.ts:42`, `mcp/lifecycle.ts:374` |
| "Needs you" + the decision card | a planning question in a running session (`AskUserQuestion` answered over stdin via `POST /api/sessions/[id]/reply`); a build stopped at `review` (Accept → `acceptPlan`); approve (`POST /api/plans/approve`). Answers live only in memory; nothing is recorded in the plan | `mcp/session/manager.ts:130`, `protocol.ts:163`, `mcp/build/runner.ts:55`, `mcp/plans/accept.ts:27` |
| Start a fix plan | the editor's `fixFor` / `fixAction` start `claude` with the promise, symptom, trace and tests; the admin has nothing | `vscode-extension/src/core/fix.ts:24,60` |
| Live update | `LiveRefresh` re-renders on an interval | `admin/components/LiveRefresh.tsx` |

### Tests

The admin's vitest has a `node` project (`src/lib/**`) and a `browser` project
(headless Chromium via `@vitest/browser-playwright`) for components and pages;
pages are tested by awaiting the server component and rendering its result with
the fs readers mocked (`app/p/[project]/plan/[name]/page.test.tsx:94`). Tests
that start `next dev` or Jaeger are in the system tier. Width checks (the phone
drawer, no sideways scroll) can run in the browser project at a set viewport.

## Decisions

- **The mockup is the target, all of it** (Sandy, 2026-10-10: "exactly this is
  what we are working towards"), including the decision card — its write-back
  is the largest piece and the first candidate if the plan must be cut.
- **Mockup words map onto what InDusk has** (Sandy, 2026-10-10): "eval
  triggers, armed or failing" become the promise's **marks**, each last seen
  held or broken; "being proven" is a **derived** state — declared, with rows
  written but not all passing. No new data is invented to fill a mockup word.
- **Paths are the `master.md` declarations**, nested as deep as declared
  (today's sidebar stops at two levels).
- **The phone-width nav is in stage 1.**
- **`the-admin-keeps-what-it-heard` changes** rather than being replaced: its
  "promise page" becomes this plan's page.
- **Start a fix plan is the admin's form of `a-break-opens-a-fix-in-one-click`**,
  which stays as written; this plan's rows name it.

## Open Questions

- How a *Maybe…* reply reaches an agent when no session is running for the
  plan: start one with the reply as its prompt, or queue it. The ADR's.
- Where a plan's decision history is recorded (a plan document, the
  bookkeeping home). Answers are in memory today. The ADR's.
- Whether "marks" can be listed for a promise that has never been seen, since
  nothing declares them; an unseen promise may only be able to say "not seen
  yet".

## Sources

- [`research/promise-ui/`](../../research/promise-ui/README.md) — the mockup and
  the first drafts
- [contract-ui brief](../contract-ui/brief.md) — stage 2
- [indusk-demo master](../indusk-demo/master.md) — step 10
- `mcp/promises/heard.ts` — `countHeard`, written for this chart
