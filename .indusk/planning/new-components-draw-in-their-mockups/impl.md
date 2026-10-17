---
title: "New components draw in their mockups"
date: 2026-10-17
status: draft
trajectory: required
test_phases: required
test_levels: required
test_purpose: required
rationale: required
phase_summary: required
gate_policy: ask
falsification: skipped
falsification_reason: "a one-function regression fix with its own red test; Sandy asked to skip the rituals"
cleanup: skipped
cleanup_reason: "one function changed and one parameter threaded through; nothing to decompose"
audit: skipped
audit_reason: "a one-function regression fix; Sandy asked to skip the rituals"
---

# New components draw in their mockups

## Goal

A component a mockup declares new and draws itself is styled by that mockup
again in the cockpit, while a component it places by name stays clear of the
mockup's own styles.

## Scope

### In Scope

- The page-only scoping skips the components a mockup declares new.

### Out of Scope

- Anything else about how mockups compose.

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State | Level | For | Test |
|----|---------|-------------|-----------|-------|-------|-----|------|
| A1 | A component a mockup declares new and draws itself takes that mockup's own styles in the cockpit | Test Phase 1 | Build Phase 1 | planned | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/overview.test.ts |
| A2 | In the same mockup, a component it places by name still takes none of the mockup's own styles, nor does anything inside it | Test Phase 1 | Build Phase 1 | planned | unit | promise: mockups-render-in-the-cockpit | apps/indusk-mcp/src/lib/looks/overview.test.ts |

## Checklist

### Test Phase 1: Both tests written, the first red

**Tier**: med — the work step's default

This phase writes the two tests the fix is measured by: one showing a new component drawn in its mockup gets that mockup's styles, which fails today, and one holding that a placed component still does not, which passes today and must keep passing.

- [ ] Write the two tests against the cockpit's mockup page builder, the first failing on its own assertion.
  <details><summary>Technical</summary>

  `overview.test.ts`: a mockup declaring `<meta name="indusk-new-components" content="idea-row">` with `.ir { display: grid }` on its own `[data-component="idea-row"]` element, composed by `mockupDocument` — A1 asserts the rule reaches it (the scoped selector does not exclude `[data-component="idea-row"]`); A2 asserts a placed `[data-component="card"]` in the same mockup, and an element inside it, are still excluded. Both carry `promise: mockups-render-in-the-cockpit`.

  </details>

#### Regression Guards

- **A2** — a placed component is kept clear of a mockup's own styles today; the row holds that the fix does not undo it.

#### Test Phase 1 Verification

- [ ] The new-component test fails because the mockup's styles do not reach it, and the placed-component test passes.
  <details><summary>Technical</summary>

  A1 red on its assertion, A2 green: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/overview.test.ts`.

  </details>

#### Test Phase 1 Context

- [ ] Leave the package's rules unchanged in this phase, since they change with the fix.
  <details><summary>Technical</summary>

  (no rule is written at this phase; Build Phase 1's Context item writes it.)

  </details>

#### Test Phase 1 Document

- [ ] Leave the docs unchanged in this phase, since they change with the fix.
  <details><summary>Technical</summary>

  (no page changes at this phase; Build Phase 1's Document item writes it.)

  </details>

### Build Phase 1: The scoping skips what a mockup draws itself

**Tier**: med — the work step's default

This phase makes the fix: the scoping that keeps a mockup's own styles off components leaves out the components that mockup declares new, so they draw as drawn, and still keeps the styles off every component it places.

- [ ] Make the page-only scoping leave out the components a mockup declares new, and pass that list from each mockup to it.
  <details><summary>Technical</summary>

  `pageOnly(css, drawnHere: readonly string[] = [])` in `component-styles.ts`: the guard becomes `:not(:where(P, P *))` with `P = [data-component]` followed by `:not([data-component="<name>"])` for each name drawn here. `mockupDocument` takes the list (`mockup.declaresNewComponents`) and passes it through `withPageOnlyStyles`; `viewOf` passes it; `storyDocument` passes none.

  </details>

#### Build Phase 1 Verification

- [ ] A new component drawn in its mockup takes the mockup's styles, a placed one still does not, and the mockup that showed bare text draws styled.
  <details><summary>Technical</summary>

  A1 and A2 pass: `pnpm --filter @infinitedusky/indusk-mcp exec vitest run src/lib/looks/`; typecheck and biome clean on the changed files; `draft-row.aged`, composed by `readAppLooks`, has its `.dr` rule unexcluded.

  </details>

#### Build Phase 1 Context

- [ ] Record in the looks rules that a component a mockup declares new is styled by that mockup.
  <details><summary>Technical</summary>

  `apps/indusk-mcp/src/lib/looks/CLAUDE.md`, the `_reset.css` / `pageOnly` entry: `pageOnly` leaves out the components the mockup declares new (`indusk-new-components`).

  </details>

#### Build Phase 1 Document

- [ ] Say in the looks reference that a mockup's own styles still reach the components it declares new.
  <details><summary>Technical</summary>

  `apps/docs/src/reference/cli/looks.md`, the page-only paragraph; and a changelog line under Fixed.

  </details>

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-mcp/src/lib/looks/component-styles.ts` | `pageOnly` skips names drawn here |
| `apps/indusk-mcp/src/lib/looks/overview.ts` | passes each mockup's new components |
| `apps/indusk-mcp/src/lib/looks/overview.test.ts` | A1, A2 |
| `apps/indusk-mcp/src/lib/looks/CLAUDE.md`, `apps/docs/src/reference/cli/looks.md`, `apps/docs/src/changelog.md` | rule and docs |
