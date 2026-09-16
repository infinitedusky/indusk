---
title: "Admin UI Phase Progress — see the phases and their stages while work runs"
date: 2026-09-03
revised: 2026-09-16
status: draft
---

# Admin UI Phase Progress — Brief

## Problem

The admin UI renders an impl's phases as collapsible raw-markdown blobs
(`PlanDetail.tsx` → `PhasesSection`), with trajectory rows matched per phase.
You cannot see, at a glance or while `/work` / `atdawn run` is executing:
which phase is active, how far its checklist is, or the state of each stage
inside it (implementation items → Verification → Context → Document — the
gate cycle that defines "done" here). Nor can you see where a plan is in its
own lifecycle, or how far a master plan is through its subplans. The parts
that make up InDusk's discipline are enforced everywhere and visible nowhere.

Research (2026-09-16, `research.md`) ground-truthed the brief and found four
defects underneath the feature gap, two of them wider than first written:

- **The UI's phase parser is a private copy, blind to the current impl
  shape.** `lib/phases.ts` matches only `### Phase N`. `### Test Phase N`
  *and* `### Build Phase N` both fail to match and both fold into the
  previous phase's markdown — every impl authored since test-phase-structure
  (2026-08-12) renders as one long Phase 1. Gate headings are not parsed at
  all. Trajectory rows attach to phases by bare number, so a row passing at
  Test Phase 1 is shown under Build Phase 1. This is another private copy of
  the heading parser, the class `impl-headings.ts` exists to prevent.
- **The canonical parsers are not reachable from the admin.** `impl-headings`
  and `impl-parser` have no subpath export; the admin can only copy them.
- **No composed lifecycle definition exists.** Document stages live in a
  private `STAGE_ORDER` that omits `test-plan`; the ritual order (falsify →
  cleanup → retrospective) is written only in skill prose; gate kinds have two
  disagreeing types. A UI that derives its bars from "the lifecycle" has
  nothing to derive from, and writing the join inside the admin would be a
  fourth copy.
- **Nothing is live.** The daemon re-reads disk per request (`force-dynamic`),
  but the page never refreshes itself. Five client components, all leaf
  widgets; no polling, no API routes.

Two smaller facts the plan inherits: phase identity is a bare `number` in
every reader that matters (the progress computation, the phase-boundary
record, all twelve Shape functions, the admin's row matching), and the admin's
type-check has been red since August — ten fixture errors on the trajectory
row's new phase-kind fields, with nothing gating on it.

## Proposed Direction

Build the finished picture of the lifecycle as it is defined today, from one
definition, so the next stage the system grows is an addition to that
definition and its rendering, not a rewrite.

1. **One lifecycle definition, in the package.** A `lifecycle` module in
   indusk-mcp names the document stages (research, brief, test-plan, adr,
   impl, retrospective), the execution state, the ritual order, and the
   terminal state (archived; `monitor` reserved for Midnight). `parsePlan`'s
   stage logic, the retrospective readiness gate and the admin all read it.
   Pinned single-definition like `resolveImplPath` and its siblings.
2. **Export the canonical parsers; delete the local regex.** Add subpath
   exports for `impl-headings` and `impl-parser`; the admin's `extractPhases`
   becomes a thin call over `parseImplString`. Test and Build sequences render
   as first-class phases in document order, with gates parsed, and rows
   attached by `{kind, number}`.
3. **Phase identity carries its kind.** `getPhaseCompletion`, the
   phase-boundary record and the Shape surface take a phase reference that
   distinguishes Test Phase 1 from Build Phase 1 (the ADR decides between
   `{kind, number}` and `ordinal`, and what changing the tracked boundary
   record's shape costs). This is the carried Shape item and the same change.
4. **Three bars that fill.** *Phase*: the stages inside the active phase
   (implementation n/m → Verification → Context → Document; each done /
   pending / opted-out with proof) completing in order, the active phase
   highlighted from checklist state and corroborated by the phase-boundary
   record. *Plan*: one bar from research through archived with the current
   step marked, the same steps on every plan whether reached or not — the bar
   doubles as the definition of what a plan requires. *Master*: a parent's
   bar is the sum of its declared subplans, growing as plans are declared and
   filling as they close.
5. **Live while it works.** A client shell calls `router.refresh()` on an
   interval with a visible "last updated"; server components re-render in
   place, collapsibles and scroll survive. No websockets, no API route, no
   write surface.
6. **The sidebar draws the root.** One master node with the parents and the
   unclaimed plans under it (`PlanList.buildGroups` plus a header row; the
   reader already returns the root declaration). Dawn sub-plans stay declared
   under both parents.
7. **Registry hygiene.** `indusk ui prune [--dry-run]` removes entries whose
   path no longer exists, backing up first the way the quarantine path does;
   the two tests that write the developer's real registry set `INDUSK_HOME`.
   The project list shows every registered project that exists, labelled by
   shape (workbench / normal-mode), rather than filtering to workbenches — the
   folded plan's "workbenches only" was an over-simplification (Sandy,
   2026-09-16): a normal-mode project is a real project.
8. **Scorecards say why they are empty.** The delay is on the write side (the
   eval directory is created on the first evaluated commit); the admin's
   honest change is an empty state that says "no evaluations recorded yet",
   not a loading fix.

### The convention this plan installs

**A plan that adds a lifecycle step, a gate kind or a ritual also adds its
rendering to the admin UI, in the same plan, as a Document gate item.**
Otherwise the UI drifts behind the system the way its phase parser already
has. Stated in this plan's ADR and CLAUDE.md, and pinned: the stage model
reads the one lifecycle definition, and a test asserts the UI renders every
stage that definition names, so a new step that skips the UI fails a test
rather than going unnoticed.

### The three-layer progress model (Sandy, 2026-09-16)

**Master level** — a parent's bar is derived from its declared `subplans:`
and each one's plan-level position.

**Plan level** — derived from document frontmatter and the impl body, the
same facts `list_plans` and retrospective Step 0 already read:

```
researching → brief drafted (awaiting acceptance) → test plan drafted (awaiting
acceptance) → ADR proposed (awaiting acceptance) → impl approved (awaiting
/work) → executing → awaiting /falsify → awaiting /cleanup → awaiting
/retrospective → archived   (→ monitor, once Midnight lands)
```

**Phase level** — derived from per-gate checkbox states plus the
phase-boundary record:

```
Test Phase 1: authoring red / done
Build Phase N: implementing → verifying → context → documenting → closed
```

**Positions and activities are different kinds of state (Sandy, 2026-09-16).**
The plan bar is made of *positions* — nouns, facts about which documents
exist and what their status says: brief accepted, ADR proposed, impl approved,
archived. Nothing is happening in a position; it records where the plan
stands. The phase bar is made of *activities* — verbs, present tense: authoring
Test Phase 1 red, implementing Build Phase 2, verifying it, documenting it,
falsifying, cleaning up. Something is happening now, and it happens inside
exactly one position, *executing*, because that is the only stretch of the
lifecycle that leaves observable traces on disk every few minutes (checkboxes,
boundary records). Before the impl the work is conversation and disk records
only its outcomes; after archive nothing moves. So: the plan bar shows nouns;
the executing position expands into the phase bar, which names the current
activity as a verb; the lifecycle definition carries both vocabularies so a
plan can never render as "archived" and "verifying" at once.

**A caution for the ADR.** A bar implies steps of similar size and they are
not — research through ADR is conversation, `/work` is most of the calendar
time. Either weight the impl segment by phase count or state plainly that the
bar is a checklist, not a time estimate; the first version must not mislead.

**Known gap — Shape has no live marker.** It is a step with no heading and no
checkbox; its only trace is appended findings. The UI therefore renders (a)
an inferred "shape window" (Verification checked, Context open) and (b) a
`shape findings: N` count per phase. A `shape-ran` stamp in
`.indusk/phase-boundary.jsonl` would make it directly observable — a
write-side change to Shape, flagged for the ADR as an optional follow-on, not
assumed.

## Context

- `research.md` (2026-09-16) — the survey behind the Problem section, with
  line numbers and counts.
- `apps/indusk-admin/src/lib/phases.ts`, `components/PlanDetail.tsx`,
  `components/PlanList.tsx`, `lib/planning-reader.ts` — current rendering and
  reading; `planning-reader.ts` already imports `trajectory/parser`,
  `falsification/log` and `planning/plan-parser` from the package.
- `apps/indusk-mcp/src/lib/impl-headings.ts` + `impl-parser.ts` — the
  canonical phase vocabulary and `ImplPhase {number, kind, ordinal, name,
  gates}`; `getPhaseCompletion` already computes n/m per gate, keyed by bare
  number. `plan-parser.ts` `STAGE_ORDER`; `cleanup/gate.ts`
  `checkRetrospectiveReadiness`; `shape/boundary.ts` (exported, unread by the
  admin).
- Fits the roadmap's visibility thread: dawn-ui-plan-grouping made the plan
  *hierarchy* visible; this makes plan *execution* visible. It is also the
  surface a Midnight `monitor` state will want later (a reopened plan's
  incidents next to its phases).
- Carried (2026-09-14): the scorecard-only-loads-after-a-prompt issue
  (2026-08-31) — resolved by research finding 9 into direction 8 above.
- Carried (2026-09-15, Sandy): **the sidebar draws no root node** — direction 6.
- Carried (2026-09-14, from workbench-trust-fixes and the
  `shape-cannot-see-test-phases` lesson): the Shape library's phase addressing
  — direction 3.
- Folded in (2026-09-14): `.indusk/planning/archive/project-list-workbenches-only/`
  — the registry held 1,588 entries, 1,577 dead temp dirs from tests that never
  set `INDUSK_HOME`. Direction 7 takes the prune and the test fix; the
  workbenches-only filter is replaced by a labelled list.
- Carried (2026-09-16, Sandy): **the finished picture as of now, built so the
  next picture is an addition, not a rewrite** — everything the system defines
  today is rendered completely; only stages that are not yet defined wait for
  the plan that defines them. See "The convention this plan installs".
- Considered, not committed (2026-09-14): provenance links between plan
  documents, so a claim in a brief can point at the research line it came
  from and the phase that acted on it. Revisit if the phase view makes them
  cheap; otherwise it stays a note.
- Related notes: `.indusk/research/indusk-interface.md` (April; the Kanban
  "phases as columns" idea is this view's ancestor).

## Scope

### In Scope
- The `lifecycle` module in indusk-mcp, single-definition pinned; `parsePlan`
  and `checkRetrospectiveReadiness` read it (behaviour-preserving for them)
- Subpath exports for `impl-headings` and `impl-parser`; canonical phase
  parsing in the admin; the local regex deleted
- Phase identity with kind through `getPhaseCompletion`, the phase-boundary
  record and the Shape surface (`prepareShapeReview`, `verificationIsGreen`,
  `recordReviewedNothingFound` and siblings), so a Test Phase can be reviewed
  and recorded
- Per-phase stage breakdown with checked/unchecked counts and gate states,
  including OTel where the project emits it
- Active-phase indication (checklist + phase-boundary record)
- Plan-level and master-level progress bars
- Auto-refresh on the plan detail page with a visible "last updated"
- Sidebar root node
- `indusk ui prune [--dry-run]`, the two leaking tests fixed, project list
  labelled by shape
- Scorecards empty state
- The admin's `tsc --noEmit` green, and kept green by a check the suite runs
- The "a plan that adds a stage renders it" convention, in the ADR, CLAUDE.md
  and a pin test
- Browser tests per existing conventions (mock every import from its actual
  module)

### Out of Scope
- Any write/mutation surface (stays read-only)
- A real dark theme. Forced light on 2026-09-10 (the scaffold's
  `prefers-color-scheme` block was the only dark handling and every component
  is hardcoded light); `dark:` variants + `prose-invert` are a follow-on here
- Websocket/push infrastructure, API routes
- Rendering eval/verify verdicts inline — 6.5 landed 2026-09-16, so the data
  exists; it stays out because the plan that defines evidence as a stage (Day
  step 5, `day-claim-evidence`) renders it, per the convention above
- A Midnight `monitor` state — reserved in the lifecycle definition, rendered
  by `midnight`
- Filtering the project list to workbenches only

## Success Criteria

- A plan mid-execution shows: which phase is active, n/m items per phase, and
  each stage's state — and updates within one polling interval of an edit,
  with no manual reload.
- Every impl in `.indusk/planning/` and its archive that uses `### Test Phase
  1` + `### Build Phase N` renders both sequences correctly, in document
  order, with rows attached to the right phase.
- Every plan shows the same plan-level bar with its current step marked;
  every parent shows a bar derived from its subplans; the definition the bars
  read is the one `list_plans` and the retrospective gate read.
- `rg 'Phase\\s' apps/indusk-admin/src/lib/phases.ts` finds no private heading
  regex; a single-definition pin asserts one lifecycle definition and one
  phase-heading parser across the package and the admin.
- A test asserts the UI renders every stage the lifecycle definition names.
- `pnpm exec tsc --noEmit` in `apps/indusk-admin` exits 0 and the suite fails
  if it does not.
- `indusk ui prune --dry-run` lists dead entries without writing;
  `indusk ui prune` removes them with a backup; no test in the repo writes
  `~/.indusk/projects.json`.

## Depends On
- Nothing hard. The subpath exports and the lifecycle module are this plan's
  own first phase.

## Blocks
- Day step 5 (`day-claim-evidence`) renders its verdicts into the stage model
  this plan builds.
- Midnight's `monitor` state renders into the lifecycle definition this plan
  installs.
