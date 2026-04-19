---
title: Admin UI — Component Conventions
---

# Admin UI — Component Conventions

The InDusk admin UI (`apps/indusk-admin/`) follows a load-bearing component-reuse discipline: every reusable visual primitive lives at exactly one path. Inline duplication of what should be a primitive is treated as cleanup debt to prevent before it accumulates, not after.

## Where primitives live

`apps/indusk-admin/src/components/ui/` is the single source of truth for visual primitives.

| Primitive | File | Variants |
|-----------|------|----------|
| `Button` | `src/components/ui/Button.tsx` | `primary`, `secondary`, `ghost` × `sm`, `md` |
| `Badge` | `src/components/ui/Badge.tsx` | `passing`, `blocked`, `skipped`, `planned`, `writable`, `written`, `unknown`, `neutral` |
| `Table` | `src/components/ui/Table.tsx` | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` |
| `CollapsibleSection` | `src/components/ui/CollapsibleSection.tsx` | accepts `headerRight` slot for badges/counts |
| `Sidebar` | `src/components/ui/Sidebar.tsx` | accepts `header` slot |

The `Badge` variant set deliberately mirrors the trajectory state lifecycle from `apps/indusk-mcp/src/lib/trajectory/parser.ts` (`planned → writable → written → passing → skipped/blocked`). Mapping a trajectory row's `State` cell to a Badge is one prop pass.

## The discipline

**No inline JSX for primitive concerns.** Anywhere a primitive exists, use it.

```tsx
// ❌ Don't do this:
<button className="px-4 py-2 bg-blue-600 text-white rounded">
  Submit
</button>

// ✅ Do this:
<Button variant="primary">Submit</Button>
```

```tsx
// ❌ Don't do this:
<span className="bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs">
  passing
</span>

// ✅ Do this:
<Badge variant="passing">passing</Badge>
```

This applies even when the inline version "works fine" — the cost paid by the discipline is single-source-of-truth maintenance; the cost avoided is "we have three slightly-different button styles across the app and now need a redesign sweep."

## How to add a new primitive

1. Create `src/components/ui/{Name}.tsx`
2. Export the component (named export, not default)
3. Use `forwardRef` for components that should be ref-able (form inputs, focusable items)
4. Use `"use client"` only when the component genuinely needs client-side interactivity (state, effects, refs that interact with the DOM at runtime)
5. Tailwind classes inline; no separate CSS files
6. If the primitive has variants, follow the `Record<Variant, string>` pattern from `Badge.tsx` and `Button.tsx` — a single object maps each variant to its class string
7. Add a colocated `{Name}.test.tsx` file that asserts the variant rendering contract

## How to refactor inline duplication into a primitive

When you find yourself writing the same JSX/className combination twice anywhere in the app, that's the signal:

1. Extract the duplicated JSX into a new primitive at `src/components/ui/`
2. Replace both call sites with the primitive
3. Add a test for the primitive's contract
4. The component-reuse audit (see below) will validate from then on

## Structural enforcement (the audit)

The audit lives at `apps/indusk-admin/src/__tests__/component-reuse-audit.test.ts` (Phase 6 of the indusk-admin-ui plan). It walks `src/` for `.tsx` files and flags inline JSX patterns matching `<button className=`, `<table className=`, etc., where a corresponding primitive exists.

Run via `pnpm test` from `apps/indusk-admin/`. A failing audit means a primitive should be introduced (or an existing one used) at the flagged location.

The audit is intentionally simple at v1 — grep-based, not AST-based. v2 may add AST-aware detection if the simple version produces false positives or misses subtle drift. Keep the simple version until it bites.

## Why this discipline matters

Pre-shipped UI utilities (shadcn-ui, Radix, etc.) solve component-reuse by giving you a comprehensive primitive library out of the box. The admin UI deliberately doesn't use them — see `.indusk/planning/archive/indusk-admin-ui/adr.md` for the rationale (number-stepper input frustrations, bundle size, opinionated form controls). Custom primitives mean WE are the library, and the discipline of single-source-of-truth has to be enforced manually (or by audit).

The cleanup-debt cost of duplicated components compounds: every duplicate is a divergence point, every divergence is a maintenance hazard, and the cost of removing them later scales with how long they've been duplicated. The discipline is to never let them accumulate in the first place.

## Data layer — reuse, don't duplicate

The admin UI's data layer (`apps/indusk-admin/src/lib/planning-reader.ts`) follows the same single-source discipline as the components, but applied to *parsing*: it reads `.indusk/planning/` and `.indusk/eval/` directly from disk and **reuses indusk-mcp's parsers** rather than reimplementing them.

| Concern | Source | How admin-ui uses it |
|---------|--------|----------------------|
| Trajectory parsing (the `## Test Trajectory` table) | `apps/indusk-mcp/src/lib/trajectory/parser.ts` → exposed as `@infinitedusky/indusk-mcp/trajectory/parser` | `parseTrajectory(impl.content)` — admin-ui never re-parses the table |
| Falsification log read | `apps/indusk-mcp/src/lib/falsification/log.ts` → exposed as `@infinitedusky/indusk-mcp/falsification/log` | `readFalsificationLog(planDir)` + `isFalsificationComplete(planDir)` |
| Frontmatter parsing | `gray-matter` (npm) | Direct dependency; same package indusk-mcp uses transitively |

The workspace dep `"@infinitedusky/indusk-mcp": "workspace:*"` in `apps/indusk-admin/package.json` lets the admin app import these via subpath exports declared in indusk-mcp's `package.json`:

```json
"exports": {
  ".": "./dist/server/index.js",
  "./trajectory/parser": {
    "types": "./dist/lib/trajectory/parser.d.ts",
    "default": "./dist/lib/trajectory/parser.js"
  },
  "./falsification/log": {
    "types": "./dist/lib/falsification/log.d.ts",
    "default": "./dist/lib/falsification/log.js"
  }
}
```

Adding a new subpath export is non-breaking (additive) and surfaces the cross-package API contract explicitly. If a parser needs a new exported function or type to support admin-ui, **add it to the indusk-mcp source**, then add the subpath export. Do not recreate the parsing in the admin app.

### Why direct filesystem reads, not an MCP tool

V1 admin-ui is a separate process (`indusk ui` CLI subcommand) that runs alongside the working agent's MCP servers — not inside the MCP runtime. Going through an MCP tool to read the same files the agent has direct access to would add a process boundary, a serialization cost, and a coupling to the MCP protocol's shape — for no benefit at v1, since admin-ui is read-only and the data is already plain markdown on disk.

The boundary is: **the working agent writes the planning files; admin-ui reads them; both use the same parsers via workspace import.** No data flows through MCP for the read path.

### What the planning-reader returns

A `Plan` object per folder under `.indusk/planning/{name}/` (and separately under `.indusk/planning/archive/{name}/`). Each `Plan` carries optional document fields (`brief`, `testPlan`, `adr`, `impl`, `falsification`, `retrospective`) — missing files yield `undefined` rather than errors, so plans can render in the sidebar even when documents are missing.

Malformed YAML frontmatter sets `malformed: true` on the Plan and leaves the affected document field undefined. The sidebar still shows the plan with a "malformed" indicator (T13); clicking it shows the raw content. This is the rail-integrity property: a partially-broken plan never blocks the UI.

The reader is server-side only (uses `node:fs`). Designed to be called from Next.js server components — never imported into client components.
