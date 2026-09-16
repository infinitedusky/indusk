---
title: "Admin UI Phase Progress — one lifecycle definition, rendered as three bars that fill"
date: 2026-09-16
status: proposed
---

# Admin UI Phase Progress — one lifecycle definition, rendered as three bars that fill

## Goal

**Open a plan in the admin UI while `/work` is running and see, without
reloading, which phase is active, which stage of it is being worked, how far
the plan is through its lifecycle, and how far its parent is through its
subplans — all read from one definition of the lifecycle that the rest of
InDusk reads too.**

Today the plan page shows an impl's phases as raw markdown, and its private
heading regex cannot see `### Test Phase 1` or `### Build Phase N`, so every
impl written since August renders as one long Phase 1 with its trajectory
rows misattributed. Nothing on the page refreshes. There is no definition of
the lifecycle to render: the document stages, the ritual order and the gate
kinds each live in a different place, two of them only in prose. This ADR
decides where that definition lives, how a phase is identified once there
are two numbered sequences, how the bars derive from it, how the page stays
live, and what convention keeps the UI from drifting behind the system again.

## Y-Statement

**In the context of:**
The admin UI, a read-only Next.js viewer over `.indusk/planning/` served by
the `indusk ui` daemon, which since dawn-ui-plan-grouping shows the plan
*hierarchy* and is now asked to show plan *execution*: the active phase, its
stages, the plan's lifecycle position and the parent's aggregate, live,
across every plan shape the repository has (test-phase impls, ritual phases,
plans that skipped research, archived plans, parents with subplans).

**Facing:**
The admin parses phases with a private regex that predates test-phase-structure
and cannot be pointed at the package's parsers because they have no subpath
exports; phase identity is a bare number in every reader that matters, so
Test Phase 1 and Build Phase 1 collide in progress counts, the boundary record
and all of Shape; and there is no single lifecycle definition — `STAGE_ORDER`
is module-private and omits `test-plan`, the ritual order lives in skill
prose, the gate kinds have two disagreeing types. A UI that composed its own
lifecycle from those parts would be a fourth private copy of the thing it is
displaying, which is the drift this plan exists to end.

**We decided for:**
A `lifecycle` module in indusk-mcp that is the one definition of positions
(nouns: research … archived, `monitor` reserved) and activities (verbs:
authoring, implementing, verifying, capturing context, documenting, closing;
falsifying, cleaning up), read by `parsePlan`, the retrospective readiness
gate and the admin, pinned single-definition. Phase identity as
`PhaseRef {kind, number}` — already the package's vocabulary — threaded
through `getPhaseCompletion`, the boundary record (an optional `kind` whose
absence means `build`, a rule not a migration) and every Shape function.
Subpath exports for `impl-headings` and `impl-parser`, with the admin's
`phases.ts` reduced to an adapter over `parseImplString`. Three tri-state bars
(done / active-with-message / pending, skipped drawn as skipped) derived from
the definition. Liveness by a client shell calling `router.refresh()` on a
configurable interval. And the convention, pinned by a test, that a plan which
adds a position, activity or gate kind also adds its rendering in the same
plan.

**And against:**
Composing the lifecycle inside the admin from `parsePlan` plus
`checkRetrospectiveReadiness` (a fourth copy). Keying phases by `ordinal`
(unique and what the loop iterates, but opaque to a reader and shifts if a
phase is inserted). Migrating the tracked boundary record to a new shape
(every existing record would need rewriting; absence-as-rule costs nothing).
A JSON route handler polled by the client (a second data path and a second
place the reader's shape is defined). Websockets or a file watcher (a write
surface and a daemon change for a page that reloads itself well enough).
Filtering the project list to workbenches (a normal-mode project is a real
project). Weighting bar segments by estimated effort in the first version
(no evidence yet for the weights).

**To achieve:**
A plan page that is the finished picture of the lifecycle as defined today —
every position, every activity, every gate kind rendered completely and live —
built so that the next stage the system grows (Day 5's evidence, Midnight's
`monitor`) is one entry in the definition plus its renderer, with a test that
fails until the renderer exists.

**Accepting:**
This plan reaches into indusk-mcp's plan parser, retrospective gate, Shape
surface and package exports — behaviour-preserving, parity-tested over all 83
plan folders, but wider than a UI plan. `router.refresh()` re-renders the
whole route on every tick rather than fetching a delta; at one page per open
tab and a five-second default that is cheap, and it is the tradeoff that keeps
one data path. The two live assertions need a browser against a running
server; if Playwright over the existing `next dev` harness proves heavy they
become written manual smokes. The first version's plan bar is an unweighted
checklist and says so.

**Because:**
Every defect the research found has the same shape — a reader that copied a
definition instead of importing it, then fell behind when the definition
moved. The fix is not a better copy in the admin; it is one definition with
every reader on it and a pin that fails when a reader is missing. The bars
then cost almost nothing to derive and cannot disagree with `list_plans` or
the retrospective gate, because they are reading the same thing.

## Context

- `brief.md` (accepted 2026-09-16) and `research.md` (2026-09-16) — the
  survey with line numbers; `test-plan.md` (accepted 2026-09-16), 25 rows
  A1–A25, U1–U2.
- The three-layer model, the noun/verb distinction and tri-state segments are
  Sandy's (brief, 2026-09-16). The convention "a plan that adds a stage
  renders it" is the brief's.
- Prior art in this repository for every mechanism chosen: single-definition
  pins (`shared-resolution.test.ts` and five siblings), absence-as-rule
  (`codeSha` on the verify ledger, `repo` on the eval queue),
  `PhaseRef {kind, number}` (`impl-headings.ts:131`), corpus parity tests
  (`impl-corpus.test.ts`).

## Decision

### D1 — One lifecycle definition: `apps/indusk-mcp/src/lib/lifecycle.ts`

Exports:

```ts
/** Where a plan stands. Nouns. Facts about documents and their status. */
export type PlanPosition =
	| "research" | "brief" | "test-plan" | "adr" | "impl-approved"
	| "executing" | "falsify" | "cleanup" | "retrospective" | "archived"
	| "monitor";                       // reserved for midnight; never derived here
export const PLAN_POSITIONS: readonly PlanPosition[];   // in order

/** What is happening inside `executing`. Verbs. */
export type PhaseActivity =
	| "authoring" | "implementing" | "verifying" | "capturing-context"
	| "documenting" | "closed"
	| "falsifying" | "cleaning-up";
export const GATE_STAGES: readonly GateKind[];          // one home; OTel included

export interface PlanPositionState {
	position: PlanPosition;
	/** done | active | pending | skipped, per position, in PLAN_POSITIONS order */
	segments: Record<PlanPosition, SegmentState>;
	awaiting: string | null;          // "brief drafted, awaiting acceptance"
}
export function derivePlanPosition(summary: PlanSummary, impl: ParsedImpl | null, readiness: RetrospectiveReadiness | null, archived: boolean): PlanPositionState;
export function derivePhaseActivity(phase: ImplPhase, boundary: PhaseBoundaryRecord | null): { activity: PhaseActivity; stages: StageState[] };
```

`plan-parser.ts`'s `STAGE_ORDER` becomes a projection of `PLAN_POSITIONS`
onto document stages (so `test-plan` joins it — `determineStage` gains one
file to look for, `determineNextStep` one string; A13 parity guards both).
`cleanup/gate.ts` imports the ritual order from here rather than restating it
in two `isRitualPhaseTerminal` calls. The admin imports the module via a new
subpath `@infinitedusky/indusk-mcp/lifecycle`.

Pinned by `lifecycle-single-definition.test.ts`: exactly one `PLAN_POSITIONS`,
one `GATE_STAGES`, no `STAGE_ORDER` literal anywhere else, no ritual-word
list outside the module.

**Skipped positions.** A position whose document is absent while a later one
exists (research skipped for a bugfix; adr skipped for a refactor) is
`skipped`, never `pending`, so every plan's bar has the same shape (A8, A10).

### D2 — Phase identity is `{kind, number}`

`getPhaseCompletion(parsed, ref: PhaseRef)` and `getAllPhaseCompletions`
return `PhaseRef` on each entry. Every `shape/` function that took
`phase: number` takes `PhaseRef` (`prepareShapeReview`, `verificationIsGreen`,
`verificationGateLines`, `recordReviewedNothingFound`, `recordSkipped`,
`recordLeftAsIs`, `appendItemToPhase`, `appendFindingToPhase`,
`changedFilesForPhase`, `findPhaseStart`), resolving headings through
`buildPhaseHeadingFor` / `gateHeadingFor` extended with the test-phase form.
The work skill's documented `recordPhaseStart` invocation gains `kind`.

`PhaseBoundaryRecord` gains `kind?: "test" | "build"`; **absent means
`build`** — every record written before this plan was a build phase, because
Shape could not open a test phase. No file is rewritten. `findPhaseStart`
matches on both.

Callers of the old signatures: `tools/plan-tools.ts:63,120`,
`bin/commands/check-gates.ts:53`, `run/loop.ts` (uses `number` for
`currentPhase` and `isPhaseDone`; unchanged — it iterates by ordinal already),
`skills/work.md`'s Shape section.

### D3 — Canonical parsing in the admin

`package.json` `exports` gains `./impl-headings`, `./impl-parser`,
`./lifecycle`. `apps/indusk-admin/src/lib/phases.ts` keeps its exported
`Phase` view type for the five importers but builds it from
`parseImplString(content).phases` — kind, number, ordinal, name, gates with
items — and attaches trajectory rows by `(passesAtKind, passesAt)`. The
heading regex and the checkbox regex are deleted. `splitPhasesAroundFalsification`
uses the lifecycle module's ritual detection. A3 runs the adapter and the
package parser over every impl in both planning folders and asserts equality
of `(kind, number, name, itemCount)` sequences.

### D4 — The active phase

For a plan with an impl: the active phase is the phase with the **most recent
boundary record among phases that still have unchecked gate items**. If no
phase has a boundary record, the first phase in document order with unchecked
items is active (the pre-boundary-record world, and a plan whose executor
never opened a boundary). A phase with all gates checked is `closed` whatever
its record says. `readBoundaries` throwing on a malformed line surfaces as a
visible error block on the page (A7); the fallback is never applied over a
malformed file.

### D5 — Three tri-state bars

Every segment is `done | active | pending | skipped`. Exactly one segment per
bar is `active` (none, for an archived plan). The active segment carries the
message:

- **Phase bar** — stages from `GATE_STAGES` preceded by `implementation`;
  the active stage shows `n of m` and its verb from `derivePhaseActivity`.
- **Plan bar** — `PLAN_POSITIONS`; the active position shows `awaiting`, or,
  when `executing`, the active phase's `activity` and name.
- **Master bar** — one segment per declared subplan in `subplans:` order,
  each filled by the subplan's own position index over `PLAN_POSITIONS.length`;
  label `${closed} of ${total} closed, ${executing} executing`. Placeholders
  (declared, not yet a folder) are `pending`.

**Unweighted in v1.** Segments are equal width; the plan bar carries a
one-line note "steps, not time". U1's review by Sandy against three plans
decides whether v2 weights the `executing` segment by phase count.

### D6 — Live by `router.refresh()`

A `LiveRefresh` client component wraps the plan page body: `setInterval` →
`router.refresh()`; shows "last updated HH:MM:SS"; pauses when
`document.hidden`; on a refresh that rejects, stops and shows "refresh
failed — reload". Interval from `admin.refresh_ms` in `.indusk/config.json`,
default 5000, minimum 1000. Server components re-render and stream in;
`CollapsibleSection` state lives in `localStorage` already, so it survives.
No route handlers, no fetch, no write surface.

### D7 — Sidebar root node

`buildGroups` returns `{ root: Plan | null, groups, rest }`; the render draws
one root node (the root master's title) with parent groups and then the
unclaimed plans nested beneath it. A sub-plan declared under two parents
appears under both (A20).

### D8 — Registry

`indusk ui prune [--dry-run]` in `lib/admin/registry.ts` as `pruneRegistry`:
lists entries whose `path` does not exist; without `--dry-run` writes
`projects.json.bak.<ISO>` beside the registry, then rewrites via the existing
temp-file-and-rename. The project list (`app/page.tsx`) shows entries whose
path exists, labelled `workbench` or `normal-mode` by `isWorkbench` on the
project's config. A22 is a node scan: every test file under both apps that
spawns `init`, `update` or `ui` must set `INDUSK_HOME`; the two known leakers
(`init-workbench.test.ts`, `multi-agent-init.test.ts`) are fixed in the same
phase.

### D9 — Two gates the suite runs

`apps/indusk-admin/src/__tests__/typecheck.test.ts` spawns
`pnpm exec tsc --noEmit -p .` and asserts exit 0 (A25). The ten existing
fixture errors are fixed in Test Phase 1 by giving the fixtures
`writableAtKind` / `passesAtKind`.

`lifecycle-render-parity.test.ts` (A17): the admin's label and renderer maps
are typed `satisfies Record<PlanPosition, …>` / `Record<PhaseActivity, …>` /
`Record<GateKind, …>`, so a new member fails `tsc`, and the test additionally
renders each member and asserts a label — so the failure names the stage.

### D10 — The live rows' mechanism

A14/A15 use Playwright from the node project (`playwright` is already a
dependency via the browser runner) against the existing `next dev` harness in
`src/__tests__/http-*.test.ts`, serialized like the other HTTP smokes. If the
harness cannot host a browser inside the suite's time budget, the two rows
become `manual:`-prefixed procedures in the trajectory (verify reports them
unverified, never passed) and this ADR is amended.

## Alternatives Considered

### Compose the lifecycle in the admin from `parsePlan` + `checkRetrospectiveReadiness`
Rejected. It is a fourth definition, written in the one app that cannot be
imported by the others. The first time a stage is added it drifts silently —
exactly how the phase regex got here.

### Key phases by `ordinal`
Rejected for the UI and the boundary record. Ordinal is document position:
unique and what the run loop iterates, but a reader cannot say "ordinal 3"
and mean anything, and appending a ritual phase does not move earlier
ordinals while inserting one would. `{kind, number}` is what humans and the
impl already write.

### Migrate `phase-boundary.jsonl` to `{kind, number}` records
Rejected. Every existing record is a build phase by construction; an optional
`kind` whose absence means `build` is a rule the reader states, and the file
is never rewritten — the same pattern `codeSha` and `repo` used this week.

### A JSON route handler polled by the client
Rejected. A second data path with its own shape to keep in step with the
server render; the win (a smaller payload) does not matter at one open page.

### Websockets, or a file watcher in the daemon
Rejected. A push channel is infrastructure for a page that reloads itself
correctly at five seconds; a watcher is a daemon change with its own failure
modes. Out of scope by the brief.

### Filter the project list to workbenches
Rejected (Sandy, 2026-09-16). A normal-mode project is a real project. Label
by shape; prune the dead.

### Weight the plan bar's segments in v1
Rejected. No evidence for the weights yet; U1 gathers it. An unweighted bar
that says "steps, not time" misleads less than a weighted one that guesses.

## Consequences

### Positive
- One lifecycle definition, three readers, one pin. `list_plans`, the
  retrospective gate and the UI cannot disagree.
- Every impl written since August renders correctly; rows attach to the
  right phase.
- Shape can review a Test Phase — the `shape-cannot-see-test-phases` lesson
  closes.
- The admin's type-check is green and gated for the first time since August.
- The dead-registry leak is closed structurally, not purged once.
- Day 5 and Midnight each add one entry and one renderer, and a test tells
  them when the renderer is missing.

### Negative
- A UI plan touches the plan parser, the retrospective gate, Shape and the
  package's export map. Parity rows (A3, A13) are the guard.
- Whole-route re-render every interval; acceptable at the daemon's scale.
- Twelve Shape signatures change; the work skill's documented invocation
  changes with them.

### Risks
- **`determineStage` gaining `test-plan` changes `list_plans` output for
  plans that stopped at a test plan.** Mitigation: A13 parity over the corpus
  before and after; any difference is reviewed, not assumed.
- **`router.refresh()` under `force-dynamic` re-reads every plan document per
  tick.** Mitigation: pause on hidden tab; 5s default; only the plan page
  wraps in `LiveRefresh`.
- **Playwright inside the suite may be slow or flaky.** Mitigation: D10's
  documented fallback to manual procedures, decided in the phase that
  authors A14/A15, not silently.
- **The active-phase rule can be wrong when two phases have unchecked items
  and neither has a boundary record.** Mitigation: the fallback is stated
  (first in document order) and rendered with a "no boundary record" hint,
  never as a confident marker.

## Documentation Plan

### Pages
- New: `decisions/admin-ui-phase-progress.md` — this ADR's summary.
- Update: `guide/plan-lifecycle.md` — the lifecycle definition as the one
  source: positions, activities, gate stages; the noun/verb rule; the "a plan
  that adds a stage renders it" convention.
- Update: `reference/admin-ui/overview.md` — the phase view, the three bars,
  live refresh, the sidebar root node, the project list labels.
- Update: `reference/admin-ui/cli.md` — `indusk ui prune [--dry-run]`.
- Update: `guide/shape.md` and the work skill — `recordPhaseStart` and the
  Shape functions take `{kind, number}`.
- Update: `reference/trajectory/parser.md` — the new subpath exports.

### Diagrams
- Mermaid state diagram of `PLAN_POSITIONS` with the `executing` node
  expanding into `PhaseActivity`, in `guide/plan-lifecycle.md`.
- Mermaid sequence: browser `LiveRefresh` → `router.refresh()` → server
  components → disk, in `reference/admin-ui/overview.md`.

### Changelog
- "Admin UI: phases render from the package parser (Test/Build sequences,
  gate stages), three live progress bars from one lifecycle definition,
  sidebar root node, `indusk ui prune`, scorecards empty state; Shape and the
  boundary record address Test Phases."

### ADR in Docs
- Yes — `decisions/admin-ui-phase-progress.md`, sidebar entry beside
  `dawn-ui-plan-grouping`.

## References
- `research.md`, `brief.md`, `test-plan.md` in this folder
- `.indusk/planning/archive/dawn-ui-plan-grouping/adr.md` — the sidebar's declarations
- `.indusk/planning/archive/test-phase-structure/adr.md` — two sequences, `PhaseRef`
- `.indusk/planning/archive/lifecycle-rebalance/adr.md` — Shape and the boundary record
- `.indusk/planning/archive/project-list-workbenches-only/brief.md` — the registry leak
- `.claude/lessons/shape-cannot-see-test-phases.md`
- `/decisions/dawn-workbench-execution` — absence-as-rule precedent (`codeSha`, `repo`)
