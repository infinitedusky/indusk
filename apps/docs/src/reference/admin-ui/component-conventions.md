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

## Routing

As of indusk-mcp 1.27 (`admin-ui-hosting` plan), the admin UI is hosted as a single daemon serving every registered project. Routes split into three tiers:

| Tier | Path | Purpose |
|------|------|---------|
| Global | `/` | `<ProjectGrid>` — one card per registered project |
| Global | `/scorecards` | Cross-project eval scorecards (walks every registered project's `.indusk/eval/results.log`) |
| Per-project | `/p/[project]/` | Per-project empty state with sidebar + PlanList + ProjectSwitcher (the layout owns the chrome) |
| Per-project | `/p/[project]/plan/[name]` | Plan detail — nested under the per-project layout |

The per-project layout (`apps/indusk-admin/src/app/p/[project]/layout.tsx`) is the only place that reads a single project's plans — every file under `/p/[project]/...` inherits the sidebar + switcher for free. The root layout (`app/layout.tsx`) is deliberately thin (global header + nav only); it must NOT render a per-project sidebar or it would double up with the per-project layout's sidebar.

### Adding a cross-project route

New cross-project features (system-improvement signal, aggregate stats, etc.) belong at top-level paths like `/scorecards`. They read via `readRegistryProjects()` from `apps/indusk-admin/src/lib/registry-client.ts`, walk each project's path, and merge results.

### Adding a per-project route

Place the file under `src/app/p/[project]/<feature>/page.tsx` (or nested further). The route inherits the sidebar and project switcher from the per-project layout automatically. Resolve the project's filesystem path with `getProjectPath(params.project)` — returns null for unregistered names, at which point `notFound()` (or, post-Phase-4, the stale-project failure page) renders.

### The `planHrefPrefix` prop on `PlanList`

Because plan links need to stay scoped to the current project (`/p/dusk/plan/foo` vs `/p/numero/plan/foo`), `PlanList` accepts an optional `planHrefPrefix` prop. The default is `/plan/` for back-compat with the pre-1.27 single-project shape; the per-project layout passes `/p/${project}/plan/`. If you ever need to link a plan from a cross-project context, set the prefix accordingly.

## CollapsibleSection persistence (1.27.7+)

`<CollapsibleSection>` accepts an optional `persistKey: string` prop. When supplied, the component:

- **Reads** its initial open/closed state from `localStorage[persistKey]` on first render. Values are encoded as `"1"` (open) and `"0"` (closed). Any other value — or an absent key — falls through to the `defaultOpen` prop.
- **Writes** the new state to `localStorage[persistKey]` on every toggle. The write is fire-and-forget — it doesn't block the state update.

### Key convention

Build the key from stable identifiers so the mapping survives across renders and re-renders don't double-register:

```tsx
// Plan-scoped sections (brief, test-plan, adr, research, phases)
<CollapsibleSection persistKey={`plan:${plan.name}:section:brief`} ... />
<CollapsibleSection persistKey={`plan:${plan.name}:phase:${phase.number}`} ... />
```

Without a `persistKey`, the component behaves exactly as before — ephemeral state, `defaultOpen` on every render.

### SSR + hydration behavior

The component is a client component (`"use client"`). Server-side render produces the `defaultOpen` value because `localStorage` doesn't exist server-side. On client hydration, the state initializer reads `localStorage` and may produce a different initial state — causing a brief flash when the persisted value disagrees with `defaultOpen`. Acceptable for the admin UI's usage (reader-only, no interaction during hydration).

Privacy-mode browsers, quota-exceeded `localStorage`, and other failure modes are swallowed — both read and write operations are wrapped in try/catch blocks that fall through to `defaultOpen`-based behavior.

### Testing

Tests that render multiple `<CollapsibleSection>`s in series MUST reset the shared `localStorage` between tests, or state from an earlier toggle leaks into the next test's initial render:

```ts
beforeEach(() => {
  if (typeof window !== "undefined") localStorage.clear();
});
```

See `apps/indusk-admin/src/components/PlanDetail.test.tsx` for a reference implementation.

### Rationale

Without persistence, every navigation reopens the Brief, the ADR, and every phase — each of which is long prose. Users close sections once they've read them; re-opening on every visit is a papercut that compounds. The `localStorage` approach is simple (no server round-trip, no schema), per-user (localStorage is browser-local), and scopable (per-plan keys mean navigation to another plan doesn't clobber state).
