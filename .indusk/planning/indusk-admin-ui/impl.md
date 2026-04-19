---
title: "InDusk Admin UI"
date: 2026-04-19
status: in-progress
workflow: feature
trajectory: required
rationale: required
gate_policy: ask
---

# InDusk Admin UI

## Goal

Ship `apps/indusk-admin/` (a Next.js + React + Tailwind standalone web app) plus the `indusk ui` CLI subcommand that runs it. v1 is a read-only viewer over `.indusk/planning/` and `.indusk/eval/*` — sidebar of plans ordered by master.md, click-into shows phases and color-coded trajectory rows, falsification log and scorecards alongside. Demo asset and operator surface in one. Component-reuse discipline structurally enforced.

## Scope

### In Scope
- New app at `apps/indusk-admin/` with Next.js (App Router) + React + Tailwind + custom components + `lucide-react`
- New CLI subcommand `indusk ui` at `apps/indusk-mcp/src/bin/commands/ui.ts`
- File-system read layer reusing existing parsers from `apps/indusk-mcp/src/lib/trajectory/` and `apps/indusk-mcp/src/lib/falsification/`
- Sidebar nav, plan list, phase view with trajectory tables, color-coded states, falsification log, eval scorecards
- Empty state and malformed-input handling (no blank screens, no JS errors)
- Component primitives in `apps/indusk-admin/src/components/ui/` — Sidebar, CollapsibleSection, Table, Badge, Button (built once, reused everywhere)
- vitest-browser-mode tests for assertions A2–A14
- Manual smoke for A1 (`indusk ui` opens browser) and A15 (30-second outsider demo)
- Custom vitest audit for A16 (component-reuse discipline structural check)
- Smoke verification on dusk + Numero (generalization)

### Out of Scope
- Any write/mutate operations
- Graph/Graphiti data display
- Test-run history timeline
- Runtime telemetry debug panel
- Live file-watching / hot-reload of planning state
- Auth, multi-user, hosted deployment
- Build-once-static export mode
- VS Code extension wrapping
- Markdown WYSIWYG editor

## Boundary Map

| Phase | Produces | Consumes |
|-------|----------|----------|
| Phase 1 | `apps/indusk-admin/` scaffold (Next.js, Tailwind, tsconfig, package.json); `src/components/ui/` primitives (Button, Badge, Table, CollapsibleSection, Sidebar) — all renderable with placeholder content | (nothing — fresh app) |
| Phase 2 | `src/lib/planning-reader.ts` — file-system layer that reads `.indusk/planning/{*,archive/*}/`, returns structured `Plan[]` data. Reuses `apps/indusk-mcp/src/lib/trajectory/parser.ts` and `apps/indusk-mcp/src/lib/falsification/log.ts` | Phase 1 (no UI dep) |
| Phase 3 | Sidebar showing plans ordered by master.md, archive in collapsed section. Plan list links to plan detail page | Phase 1 (Sidebar primitive), Phase 2 (planning-reader) |
| Phase 4 | Plan detail page: brief summary, ADR goal, impl phases as collapsible sections with trajectory tables, color-coded States via Badge | Phase 1 (Table, CollapsibleSection, Badge), Phase 2 (planning-reader) |
| Phase 5 | Falsification log section, eval scorecards section, edge-case handling (empty, malformed, missing) | Phase 2 (parsers), Phase 4 (plan detail page) |
| Phase 6 | `indusk ui` CLI subcommand at `apps/indusk-mcp/src/bin/commands/ui.ts` — spawns `next dev`, opens browser; bump + publish; smoke on dusk + Numero | Phases 1–5 |

## Test Trajectory

| ID | Asserts | Writable at | Passes at | State |
|----|---------|-------------|-----------|-------|
| T1 | Running `indusk ui` from a project root prints a localhost URL and opens browser by default. | Phase 0 | Phase 6 | planned |
| T2 | When the URL opens, the user sees a sidebar listing every active plan in this project. | Phase 1 | Phase 3 | planned |
| T3 | The sidebar's plan list appears in the order defined by `master.md`'s pipeline. | Phase 2 | Phase 3 | planned |
| T4 | Plans in `.indusk/planning/archive/` appear in a separate "Archived" section, visually distinct, collapsed by default. | Phase 1 | Phase 3 | planned |
| T5 | Clicking a plan in the sidebar shows that plan's content in the main pane. | Phase 1 | Phase 4 | planned |
| T6 | The main pane shows the plan's brief — Problem and Proposed Direction at minimum. | Phase 2 | Phase 4 | planned |
| T7 | The main pane lists the plan's impl phases as collapsible sections. | Phase 2 | Phase 4 | planned |
| T8 | Expanding a phase shows its trajectory rows in a table with columns: ID, Asserts, Writable at, Passes at, State. | Phase 2 | Phase 4 | planned |
| T9 | Each trajectory row's State is visually color-coded (passing green, blocked red, planned/written gray, etc.) so pass/fail status is at-a-glance. | Phase 1 | Phase 4 | planned |
| T10 | When a plan has a falsification log, the main pane shows it as a section with one entry per hypothesis (text + outcome). | Phase 2 | Phase 5 | planned |
| T11 | When the active plan has eval scorecards from `results.log` in its date range, those scorecards appear listed in the main pane (most recent first). | Phase 2 | Phase 5 | planned |
| T12 | When the planning directory is empty, the user sees an empty-state message rather than a blank screen or JS error. | Phase 1 | Phase 5 | planned |
| T13 | When a plan's brief.md has malformed YAML frontmatter, the plan still appears in the sidebar with a "malformed" indicator and clicking shows raw content. | Phase 2 | Phase 5 | planned |
| T14 | When a plan is missing optional documents (e.g., no ADR), the main pane renders without an error — missing sections simply don't appear. | Phase 2 | Phase 5 | planned |
| T15 | An outsider can be shown the UI and within 30 seconds correctly identify: which plan is active, which phase, and at least one passing test row vs one failing/blocked row. | Phase 0 | Phase 6 | planned |
| T16 | Audit walks `apps/indusk-admin/src/`: every visual primitive lives at exactly one path under `src/components/ui/`. No inline `<button className="...">` patterns where a Button primitive exists. | Phase 0 | Phase 6 | planned |

### Trajectory Rationale

**Phase 0 baseline: every test is writable today against the current stack — Phase 0 rows need no rationale.** Below: rationales for rows where `Writable at > Phase 0`.

- **T2** `Writable at: Phase 1` — Test imports the `Sidebar` primitive (and the App shell that hosts it) from `apps/indusk-admin/src/`. Neither file exists today; the import line is a compile error. Authorable in Phase 1 once primitives + app shell scaffold exist.
- **T3** `Writable at: Phase 2` — Test asserts plan ORDER, which requires the planning-reader module to parse `master.md` and the sidebar to consume it. Authorable once the reader exports a stable interface in Phase 2.
- **T4** `Writable at: Phase 1` — Test imports the `Sidebar` primitive's archive-section sub-component. Doesn't exist today.
- **T5** `Writable at: Phase 1` — Test simulates a click on a sidebar item and asserts the URL/main-pane content updates. Requires the App component with routing, both authored in Phase 1.
- **T6** `Writable at: Phase 2` — Test imports the `PlanDetail` page which depends on the planning-reader's `Plan` shape. Both authored Phase 2.
- **T7** `Writable at: Phase 2` — Same as T6: requires the `Plan` type from planning-reader.
- **T8** `Writable at: Phase 2` — Same as T7: trajectory rows come through the planning-reader.
- **T9** `Writable at: Phase 1` — Test renders `<Badge variant="passing">` and asserts CSS class / color. Requires the Badge primitive, authored Phase 1.
- **T10** `Writable at: Phase 2` — Test imports the `Plan` shape (with falsification log) from planning-reader. Authored Phase 2.
- **T11** `Writable at: Phase 2` — Test imports scorecard parsing (added to planning-reader in Phase 2 for `.indusk/eval/results.log` access).
- **T12** `Writable at: Phase 1` — Test renders the App with no plans and asserts empty-state message. Requires the App shell, authored Phase 1.
- **T13** `Writable at: Phase 2` — Test imports planning-reader and feeds it a malformed-frontmatter fixture; asserts the `Plan` returned has a `malformed: true` flag. Requires the reader's interface, authored Phase 2.
- **T14** `Writable at: Phase 2` — Same as T13: requires the `Plan` shape with optional-document handling, authored Phase 2.

## Checklist

### Phase 1: Scaffold + UI primitives

- [x] Created `apps/indusk-admin/` with Next.js 16.2.4 + React 19.2.4 + Tailwind 4.2.2 + TypeScript strict via `pnpm dlx create-next-app@latest apps/indusk-admin --ts --tailwind --app --src-dir --biome --import-alias "@/*" --use-pnpm --yes`. Scaffolded with App Router, src/ layout, Biome (matches project convention — not ESLint).
- [x] Added `lucide-react` ^1.8.0 to dependencies.
- [x] Verified `pnpm-workspace.yaml` picks up the new app — `pnpm -r exec` lists `indusk-admin` alongside `indusk-docs` and `@infinitedusky/indusk-mcp`. No config changes needed; existing `apps/*` glob caught it.
- [x] Created `src/components/ui/` directory.
- [x] Implemented `Button.tsx` with variants (`primary`, `secondary`, `ghost`) + sizes (`sm`, `md`). Tailwind classes, `forwardRef` for accessibility, focus rings, disabled state.
- [ ] Implement `Badge.tsx` with variants for each trajectory state (`passing`, `blocked`, `skipped`, `planned`, `writable`, `written`, `unknown`). Color palette: `passing` green, `blocked` red, `skipped` muted, the rest gray-toned (per A9 visibility requirement).
- [ ] Implement `Table.tsx` with `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>` subcomponents. Responsive horizontal scroll.
- [ ] Implement `CollapsibleSection.tsx` — props: `title`, `defaultOpen`, `children`. Click toggles open/closed; chevron icon from lucide.
- [ ] Implement `Sidebar.tsx` — left rail container; props: `children`. Includes header slot and scrollable list area.
- [ ] Create the App shell at `src/app/layout.tsx` and `src/app/page.tsx` — sidebar + main pane structure, no data yet (placeholder content).
- [ ] Configure `vitest.config.ts` with `vitest-browser-mode` (Playwright provider). `passWithNoTests: true`.
- [ ] Add a basic component test for `Badge.tsx` confirming each variant renders with the expected color class. T9 passes.
- [ ] Add a basic test that renders the App shell with no plan data and asserts the empty-state copy is visible. T12 passes (preserved through later phases).
- [ ] Add structural tests for T2, T4, T5 — render App shell with mocked data, assert sidebar items + click-to-detail behavior. (Initially fail — pass at Phase 3 + 4.)

#### Phase 1 Verification
- [ ] T9 passes (Badge color coding) — `pnpm vitest run apps/indusk-admin`
- [ ] T12 passes (empty state)
- [ ] T2, T4, T5 (write red) — committed against the App shell, assert against expected post-Phase-3-or-4 behavior. They fail today; will pass at the listed Passes phase.

#### Phase 1 Context
- [ ] Add to CLAUDE.md Architecture: "**indusk-admin**: Next.js (App Router) + React + Tailwind standalone web app at `apps/indusk-admin/`. Custom UI primitives in `src/components/ui/` (no shadcn-ui, no Radix). Served via `indusk ui` CLI subcommand."

#### Phase 1 Document
- [ ] Create `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` — the load-bearing component-reuse discipline (where primitives live, how to add new ones, what the audit catches).

### Phase 2: Planning-reader (file-system + parser layer)

- [ ] Create `apps/indusk-admin/src/lib/planning-reader.ts` exporting:
  - `readActivePlans(projectRoot: string): Promise<Plan[]>` — reads `.indusk/planning/{name}/`, skips `archive/`
  - `readArchivedPlans(projectRoot: string): Promise<Plan[]>`
  - `readMasterPlanOrder(projectRoot: string): string[]` — parses `master.md` pipeline table, returns plan names in order
  - `readEvalScorecards(projectRoot: string, planDateRange: {from: Date, to: Date}): Promise<Scorecard[]>` — reads `.indusk/eval/results.log`, filters by date overlap
- [ ] Define the `Plan` interface: `{ name, status, brief?: BriefData, testPlan?: TestPlanData, adr?: ADRData, impl?: ImplData, falsification?: FalsificationData, retrospective?: RetroData, malformed?: boolean }`. All inner data optional so missing-document plans render gracefully (T14).
- [ ] Reuse parsers via workspace import (or relative path during dev):
  - `parseTrajectory` from `apps/indusk-mcp/src/lib/trajectory/parser.ts`
  - Falsification log read functions from `apps/indusk-mcp/src/lib/falsification/log.ts` — add `readFalsificationLog(planRoot)` export to that module if missing.
- [ ] Use `gray-matter` for frontmatter parsing. Catch parse errors, set `malformed: true` on the Plan.
- [ ] Add unit tests in `apps/indusk-admin/src/lib/__tests__/planning-reader.test.ts`:
  - Reads a fixture project with 3 plans; returns 3 Plan objects in correct order
  - Skips `archive/` for `readActivePlans`; returns archived for `readArchivedPlans`
  - Malformed frontmatter → Plan returned with `malformed: true` (T13 prep)
  - Missing optional documents (no ADR) → Plan returned with `adr: undefined` (T14 prep)
  - Empty planning directory → returns `[]`
- [ ] Create `apps/indusk-admin/test-fixtures/sample-project/.indusk/planning/` with 3-4 sample plans covering: well-formed, malformed frontmatter, missing ADR, archived.

#### Phase 2 Verification
- [ ] (no tests flip at this phase — reason: infra) — Phase 2 builds the data layer; trajectory tests for the data layer's behavior are unit tests on `planning-reader.ts` itself, which are independent of T1–T16. T3, T13, T14 become writable here but pass at Phase 3 / 5.
- [ ] `planning-reader.test.ts` unit tests pass (`pnpm vitest run apps/indusk-admin/src/lib/__tests__/`).

#### Phase 2 Context
- [ ] Add to CLAUDE.md Conventions: "**admin-ui reuses indusk-mcp parsers via workspace import** — never duplicate parsing logic. The trajectory and falsification parsers live in `apps/indusk-mcp/src/lib/`; admin-ui imports them. If a parser needs a new export to support admin-ui, add it to the original module rather than recreating it."

#### Phase 2 Document
- [ ] Update `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` with a "Data layer" section noting parsers are reused, not duplicated. (Folds into Phase 1's new doc.)

### Phase 3: Sidebar + plan list

- [ ] Wire `src/app/layout.tsx` to call `readActivePlans` + `readArchivedPlans` + `readMasterPlanOrder` (server component, async). Pass to Sidebar as props.
- [ ] In `src/components/PlanList.tsx`: render active plans in master.md order; archive section below as a `<CollapsibleSection title="Archived" defaultOpen={false}>`.
- [ ] Each plan list item: name + status badge + clickable link to `/plan/[name]`.
- [ ] Update tests T2, T3, T4 to flip from `(write red)` to `passing` — they should now actually render the sidebar.

#### Phase 3 Verification
- [ ] T2 passes (sidebar lists active plans)
- [ ] T3 passes (master.md ordering)
- [ ] T4 passes (archive section separate + collapsed)

#### Phase 3 Context
- [ ] Add to CLAUDE.md Conventions: "**admin-ui sidebar order is canonical from `master.md`** — to reorder plans in the UI, edit `.indusk/planning/master.md`'s pipeline table. The sidebar reflects whatever `readMasterPlanOrder` parses; plans not mentioned in master.md appear in an 'Unordered' group at the bottom."

#### Phase 3 Document
- [ ] (folded into Phase 6's overview page — no separate page needed for sidebar behavior)

### Phase 4: Plan detail (main pane)

- [ ] Create `src/app/plan/[name]/page.tsx` — server component; reads the named plan via `planning-reader`; renders detail.
- [ ] Plan detail layout:
  - Header: plan name + overall status
  - Brief section: Problem + Proposed Direction (markdown rendered)
  - Test plan section (if present): assertion table
  - ADR Goal section (if present): the Goal paragraph + Y-statement decision summary (collapsed)
  - Phases section: each phase as `<CollapsibleSection>` containing the trajectory `<Table>`. Each trajectory row's State cell uses `<Badge variant={state}>`.
- [ ] Markdown rendering: pick `marked` (lighter weight, no JSX trees needed for simple display) and render via sanitized wrapper, OR use `react-markdown` if it's already a project dependency. Decide based on bundle size at impl time.
- [ ] Update tests T5, T6, T7, T8 to flip from `(write red)` to `passing`.

#### Phase 4 Verification
- [ ] T5 passes (clicking plan shows content)
- [ ] T6 passes (brief Problem + Direction visible)
- [ ] T7 passes (impl phases as collapsible)
- [ ] T8 passes (trajectory table with all columns)
- [ ] T9 passes (color coding from Phase 1 now visible in real trajectory data)

#### Phase 4 Context
- [ ] Add to CLAUDE.md Known Gotchas (if relevant): "**admin-ui markdown rendering**: Phase 4 picked `{marked|react-markdown}` over the alternative because {bundle size / DX}. Sanitization handled by {approach}. To swap libraries, update `src/lib/markdown.ts`."

#### Phase 4 Document
- [ ] (folded into Phase 6's overview page)

### Phase 5: Falsification + scorecards + edge cases

- [ ] Add a Falsification section to plan detail: render the parsed log entries (hypothesis text + outcome badge: green for fix-in-scope, yellow for spawn-plan, gray for accept). Show "no falsification ritual run" when the log is missing.
- [ ] Add a Scorecards section to plan detail: read `.indusk/eval/results.log`, filter by date range overlap with the plan's brief.date → archive date (or now). List most-recent-first with: changeId (truncated), timestamp, clean/error indicator (green check or red X).
- [ ] Edge case handling: empty `.indusk/planning/` → empty-state copy in the sidebar; malformed-frontmatter plan → list with "⚠ malformed" indicator + click shows raw markdown; missing optional docs → corresponding sections simply don't render.
- [ ] Update tests T10, T11, T13, T14 to flip from `(write red)` to `passing`.

#### Phase 5 Verification
- [ ] T10 passes (falsification log displayed)
- [ ] T11 passes (scorecards listed)
- [ ] T12 confirmed still passing (empty state — Phase 1 covered this)
- [ ] T13 passes (malformed frontmatter)
- [ ] T14 passes (missing docs render gracefully)

#### Phase 5 Context
- [ ] Add to CLAUDE.md Known Gotchas: "**admin-ui scorecard-to-plan join is approximate (date-range overlap)**. v1 lists scorecards from `.indusk/eval/results.log` whose timestamp falls between a plan's brief.date and its archive date (or now). If a scorecard's commit doesn't actually relate to that plan, it'll still show under the plan's section — refine in v2 if it bites (e.g., add a `plan: {name}` field to scorecard schema)."

#### Phase 5 Document
- [ ] (folded into Phase 6's overview page)

### Phase 6: CLI subcommand + ship + smoke

- [ ] Create `apps/indusk-mcp/src/bin/commands/ui.ts`:
  ```typescript
  export async function ui(opts: { port: number; open: boolean }): Promise<void> {
    // resolve apps/indusk-admin from indusk-mcp's package install path
    // spawn `next dev --port {port}` in that directory
    // when stdout shows "ready", optionally open browser via `open` package
  }
  ```
  Hook up via commander in `apps/indusk-mcp/src/bin/cli.ts`: `cli.command("ui").option("--port <port>", "...", "3939").option("--no-open", "...").action(ui)`.
- [ ] Auto-pick unused port if specified port is taken (use `get-port` package, or simple `net.createServer().listen(0)` trick).
- [ ] Build the audit script for T16 at `apps/indusk-admin/src/__tests__/component-reuse-audit.test.ts`:
  - Walks `apps/indusk-admin/src/` for `.tsx` files
  - For each, parses for inline JSX patterns matching `<button className=`, `<table className=`, etc., where a corresponding primitive exists
  - Asserts zero matches (i.e., everyone uses the primitive, no inline duplicates)
- [ ] Write the manual smoke procedure for T15 (a checklist file at `apps/indusk-admin/test-fixtures/manual-smoke.md` or in the impl): "Show app to outsider, ask them to identify (1) the active plan, (2) the active phase, (3) one passing and one failing test row. Time it. Pass if <30s and all three correctly identified."
- [ ] Decide bundling strategy for the admin app in the published indusk-mcp package: ship the source tree (full dev mode on user's machine, larger package) vs ship a built static export (smaller, less flexible). Likely (a) for v1.
- [ ] Bump `apps/indusk-mcp/package.json` version → 1.25.0 (new feature: `indusk ui` command + new bundled app).
- [ ] Add changelog entry to `apps/indusk-docs/src/changelog.md`.
- [ ] Build + publish + upgrade global (user action).
- [ ] T1 (CLI works): run `indusk ui --no-open --port 0` from a fresh terminal in this repo root; assert stdout contains "ready" + a localhost URL within 60s.
- [ ] T15 (manual smoke on dusk): run `indusk ui` from this repo, walk an outsider through it (~5 min), confirm they can identify the three things in <30s.
- [ ] T15 (manual smoke on Numero, generalization): run `indusk ui` from `~/code/sandbox/numero`, confirm Numero's plans render correctly and the outsider check still works.
- [ ] T16: run `pnpm vitest run apps/indusk-admin/src/__tests__/component-reuse-audit.test.ts` — passes with zero violations.

#### Phase 6 Verification
- [ ] T1 passes (`indusk ui` opens browser; manual smoke + automated stdout check)
- [ ] T15 passes on dusk (outsider <30s identification)
- [ ] T15 passes on Numero (generalization)
- [ ] T16 passes (component-reuse audit zero violations)

#### Phase 6 Context
- [ ] Update CLAUDE.md "Current State" with one sentence: "indusk-admin-ui shipped (1.25.0) — `indusk ui` opens a browser to a sidebar of plans with color-coded trajectory states. First Arc 1 demo asset live."

#### Phase 6 Document
- [ ] Create `apps/indusk-docs/src/reference/admin-ui/overview.md` — what the admin UI is, how to run it (`indusk ui`), what each pane shows, screenshots of dusk's plans rendered, link to component-conventions.md (Phase 1).

## Files Affected

| File | Change |
|------|--------|
| `apps/indusk-admin/` (NEW) | Whole new app: package.json, tsconfig.json, next.config.js, tailwind.config.ts, postcss.config.js, src/app/, src/components/, src/lib/, vitest.config.ts |
| `apps/indusk-admin/src/components/ui/{Button,Badge,Table,CollapsibleSection,Sidebar}.tsx` | New primitives; single source of truth per primitive |
| `apps/indusk-admin/src/lib/planning-reader.ts` | New file-system + parser layer |
| `apps/indusk-admin/test-fixtures/sample-project/.indusk/planning/` | Fixture project for tests |
| `apps/indusk-admin/src/__tests__/component-reuse-audit.test.ts` | Structural audit for A16 / T16 |
| `apps/indusk-mcp/src/bin/commands/ui.ts` (NEW) | `indusk ui` subcommand |
| `apps/indusk-mcp/src/bin/cli.ts` | Wire `ui` subcommand into commander |
| `apps/indusk-mcp/src/lib/falsification/log.ts` | Add `readFalsificationLog(planRoot)` export if not present |
| `apps/indusk-mcp/package.json` | Version bump 1.24.5 → 1.25.0; add `indusk-admin` to `files` if needed for distribution |
| `apps/indusk-docs/src/changelog.md` | New 1.25.0 entry |
| `apps/indusk-docs/src/reference/admin-ui/overview.md` (NEW) | UI overview + screenshots |
| `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` (NEW) | Component-reuse discipline reference |
| `CLAUDE.md` | Architecture + Conventions + Known Gotchas + Current State updates across phases |
| Root `package.json` / `pnpm-workspace.yaml` | Add `apps/indusk-admin` to workspaces if not auto-detected |

## Dependencies

- Node 22 (Tailwind 4 native bindings requirement, per CLAUDE.md)
- pnpm workspace
- `claude` CLI on PATH (for the underlying agent — not consumed by the UI directly, but the user's setup needs it for the rest of InDusk)
- `next`, `react`, `react-dom`, `tailwindcss`, `lucide-react`, `gray-matter`, `marked` (or `react-markdown`)
- `vitest`, `@vitest/browser`, `playwright` (as the browser provider for vitest-browser-mode)

## Notes

- **Distribution strategy**: the indusk-mcp npm package needs to bundle `apps/indusk-admin/` so `indusk ui` can find it after global install. Two options: (a) build admin app to static at publish time and bundle the static output (smaller, but loses dev-mode hot reload — bad for local dev); (b) bundle the admin app's source and run `next dev` against it on the user's machine (larger package but full dev mode). Phase 6 task should pick. Likely (b) for simplicity in v1 — the package is already several MB; admin app source is ~100KB.
- **Markdown rendering**: defer the `marked` vs `react-markdown` decision to Phase 4 impl time. Both work; `marked` is smaller, `react-markdown` integrates better with React's vdom.
- **Date-range scorecard join (T11)**: use the plan's `brief.date` frontmatter as the start, archive date (or now if not archived) as the end. Filter scorecards by `timestamp` overlap. Refine if it gets messy.
- **Generalization smoke (T15 on Numero)**: same pattern as `eval-agent-mcp-access` — the proof that the fix isn't dusk-specific. Run AFTER global publish, before declaring v1 shipped.
- **Component reuse discipline (load-bearing)**: A16 audit script is intentionally simple at v1 — just greps for inline patterns. v2 could add AST-based detection. Keep simple until it bites.
