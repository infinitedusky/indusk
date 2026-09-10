---
title: "Admin UI Phase Progress — see the phases and their stages while work runs"
date: 2026-09-03
status: draft
---

# Admin UI Phase Progress — Brief

## Problem

The admin UI renders an impl's phases as collapsible raw-markdown blobs
(`PlanDetail.tsx` → `PhasesSection`), with trajectory rows matched per phase.
You cannot see, at a glance or while `/work` / `atdawn run` is executing:
which phase is active, how far its checklist is, or the state of each stage
inside it (implementation items → Verification → Context → Document — the
gate cycle that defines "done" here). The parts that make up InDusk's
discipline are enforced everywhere and visible nowhere.

Two concrete defects underneath the feature gap:

- **The UI's phase parser has drifted.** `lib/phases.ts` carries a private
  `PHASE_HEADING_RE` matching only `### Phase N` — it cannot see
  `### Test Phase N` / `### Build Phase N` (test-phase-structure, 2026-08-12).
  Test phases are invisible or bleed into neighbors today. This is another
  private copy of the heading parser — the class `impl-headings.ts` exists to
  prevent, and the admin app already imports indusk-mcp subpath exports, so
  the copy is unnecessary.
- **Nothing is live.** The daemon re-reads disk per request
  (`force-dynamic`), but the page never refreshes itself, so "watch a plan
  execute" means mashing reload.

## Proposed Direction

1. **Parse with the canonical machinery, not a local regex.** Replace
   `extractPhases`' heading regex with the package's `impl-headings` /
   impl-parser exports (add a subpath export if one is missing — never
   duplicate parsing; that rule is already in CLAUDE.md). Test/Build phase
   sequences render as first-class phases in document order.
2. **Stages within a phase.** Per phase, render the gate cycle as structured
   stages with states: implementation items (n/m checked), Verification,
   Context, Document (each: done / pending / opted-out with proof). The data
   is already in the checklist; the UI stops treating it as prose.
3. **The active phase is visible.** Highlight the current phase from checklist
   state, corroborated by `.indusk/phase-boundary.jsonl` (when a phase opened
   — it is machine state written for exactly this kind of reader; `readBoundaries`
   semantics respected: malformed line = loud, not skipped).
4. **Live while it works.** Client-side polling refresh (interval, with a
   visible "last updated"); no websockets, no write surface — the UI stays
   read-only.

### The two-level state model (Sandy, 2026-09-03)

**Plan level** — derived from document frontmatter, the same facts `list_plans`
and retrospective Step 0 already read:

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

**Known gap — Shape has no live marker.** It is a step with no heading and no
checkbox; its only trace is appended findings. The UI therefore renders (a)
an inferred "shape window" (Verification checked, Context open) and (b) a
`shape findings: N` count per phase. A `shape-ran` stamp in
`.indusk/phase-boundary.jsonl` would make it directly observable — that is a
write-side change to Shape, flagged for this plan's ADR as an optional
follow-on, not assumed.

## Context

- `apps/indusk-admin/src/lib/phases.ts`, `components/PlanDetail.tsx` — current
  rendering; `lib/planning-reader.ts` already carries trajectory data via
  `@infinitedusky/indusk-mcp/trajectory/parser`.
- Fits the roadmap's visibility thread: dawn-ui-plan-grouping made the plan
  *hierarchy* visible; this makes plan *execution* visible. It is also the
  surface a Midnight `monitor` state will want later (a reopened plan's
  incidents next to its phases).
- Related, not included: the scorecard-only-loads-after-a-prompt issue
  (2026-08-31) — same app, separate plan/note in the root master.

## Scope

### In Scope
- Canonical phase parsing (Test/Build sequences included); delete the local regex
- Per-phase stage breakdown with checked/unchecked counts and gate states
- Active-phase indication (checklist + phase-boundary record)
- Auto-refresh polling on the plan detail page
- Browser tests per existing conventions (mock every import from its actual module)

### Out of Scope
- Any write/mutation surface (stays read-only)
- The scorecard load fix (separate)
- Websocket/push infrastructure
- Rendering eval/verify verdicts inline (natural follow-on once 6.5 lands)

## Success Criteria

- A plan mid-execution shows: which phase is active, n/m items per phase, and
  each stage's state — and updates within one polling interval of an edit,
  with no manual reload.
- An impl using `### Test Phase 1` + `### Build Phase N` renders both
  sequences correctly, in document order.
- `rg 'Phase\\s' apps/indusk-admin/src/lib/phases.ts` finds no private heading
  regex — parsing comes from the package export, pinned the way other shared
  definitions are.

## Depends On
- Nothing hard. (Subpath export addition to indusk-mcp if needed.)

## Blocks
- Nothing; enables the Midnight monitor-state surface later.
