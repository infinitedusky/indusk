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
| T2 | When the URL opens, the user sees a sidebar listing every active plan in this project. | Phase 1 | Phase 3 | passing |
| T3 | The sidebar's plan list appears in the order defined by `master.md`'s pipeline. | Phase 2 | Phase 3 | passing |
| T4 | Plans in `.indusk/planning/archive/` appear in a separate "Archived" section, visually distinct, collapsed by default. | Phase 1 | Phase 3 | passing |
| T5 | Clicking a plan in the sidebar shows that plan's content in the main pane. | Phase 1 | Phase 4 | passing |
| T6 | The main pane shows the plan's brief — Problem and Proposed Direction at minimum. | Phase 2 | Phase 4 | passing |
| T7 | The main pane lists the plan's impl phases as collapsible sections. | Phase 2 | Phase 4 | passing |
| T8 | Expanding a phase shows its trajectory rows in a table with columns: ID, Asserts, Writable at, Passes at, State. | Phase 2 | Phase 4 | passing |
| T9 | Each trajectory row's State is visually color-coded (passing green, blocked red, planned/written gray, etc.) so pass/fail status is at-a-glance. | Phase 1 | Phase 4 | written |
| T10 | When a plan has a falsification log, the main pane shows it as a section with one entry per hypothesis (text + outcome). | Phase 2 | Phase 5 | planned |
| T11 | When the active plan has eval scorecards from `results.log` in its date range, those scorecards appear listed in the main pane (most recent first). | Phase 2 | Phase 5 | planned |
| T12 | When the planning directory is empty, the user sees an empty-state message rather than a blank screen or JS error. | Phase 1 | Phase 5 | passing |
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
- [x] Implemented `Badge.tsx` with variants per trajectory state (`passing` green, `blocked` red, `skipped` yellow, `planned`/`writable`/`written` gray/blue-toned, `unknown`/`neutral` gray). Each uses ring-inset Tailwind classes for clean visual differentiation per A9.
- [x] Implemented `Table.tsx` exporting `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead` (header cell), `TableCell` (body cell). Wrapped in horizontal-overflow container for responsiveness; hover rows; sticky header style.
- [x] Implemented `CollapsibleSection.tsx` — props: `title`, `defaultOpen`, `children`, optional `headerRight` slot. Click header toggles; chevron icon from lucide-react (`ChevronDown`/`ChevronRight`); `aria-expanded` for accessibility.
- [x] Implemented `Sidebar.tsx` — fixed-width (`w-72`) left rail with header slot + scrollable content area. Full-height (`h-screen`).
- [x] App shell at `src/app/layout.tsx` (HTML + Geist fonts + flex container with `<Sidebar>` + `<main>`) and `src/app/page.tsx` (default "select a plan" empty-state when no plan is selected). Sidebar's plan-list slot is currently `<EmptyPlansSidebarSlot />` placeholder satisfying T12 (will be replaced in Phase 3 with server-component data render).
- [x] Configured `vitest.config.ts` with vitest 4.1.4 + `@vitest/browser-playwright` provider (factory pattern, new in vitest 4.x — `provider: playwright()` not `provider: "playwright"`). Headless Chromium installed via `playwright install chromium`. `passWithNoTests: true`. `test` script wired in package.json.
- [x] Added `Badge.test.tsx` with 9 tests: each of 8 variants renders with its expected color token (green/red/yellow/gray/blue), plus a passing-vs-blocked distinctness check. **T9 passes** (verified `pnpm test` — 9/9 green).
- [x] Extracted `EmptyPlansSidebarSlot` from inline layout.tsx into its own component (per component-reuse discipline). Added `EmptyPlansSidebarSlot.test.tsx` with 3 tests (renders, "No plans yet" copy, /planner reference). **T12 passes** (12 tests total green).
- [x] Added `PlanList.test.tsx` with 3 `it.skip()` placeholders for T2/T4/T5 — each names the unlock phase in the comment + the assertion intent. Rationale for `.skip()` over fail-red: importing `PlanList` (doesn't exist until Phase 3) would break test-file compilation rather than producing a clean failure. `.skip()` keeps the test enumerable and ready to flip when its dependencies land.

#### Phase 1 Verification
- [x] T9 passes (Badge color coding) — confirmed via `pnpm test` from `apps/indusk-admin/` — 9 Badge tests green
- [x] T12 passes (empty state) — 3 EmptyPlansSidebarSlot tests green
- [x] T2, T4, T5 written (skipped with unlock-phase comments) — Phase 3 will replace `.skip()` with real assertions and unblock the trajectory rows. Total test status: 12 passed, 3 skipped, 0 failed.

#### Phase 1 Context
- [x] Added the `indusk-admin` app to CLAUDE.md Architecture's Apps list, naming the tech stack, the custom-primitives policy (no shadcn/Radix), the test framework choice (vitest-browser-mode + @vitest/browser-playwright), and the parser-reuse rule.

#### Phase 1 Document
- [x] Created `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` — table of primitives + variants, ❌/✅ inline-vs-primitive examples, how to add a new primitive, how to refactor duplication, what the audit catches, and the rationale for not using shadcn/Radix.

### Phase 2: Planning-reader (file-system + parser layer)

- [x] Create `apps/indusk-admin/src/lib/planning-reader.ts` exporting:
  - `readActivePlans(projectRoot: string): Promise<Plan[]>` — reads `.indusk/planning/{name}/`, skips `archive/`
  - `readArchivedPlans(projectRoot: string): Promise<Plan[]>`
  - `readMasterPlanOrder(projectRoot: string): string[]` — parses `master.md` pipeline table, returns plan names in order
  - `readEvalScorecards(projectRoot: string, planDateRange: {from: Date, to: Date}): Promise<Scorecard[]>` — reads `.indusk/eval/results.log`, filters by date overlap
- [x] Define the `Plan` interface: `{ name, status, archived, brief?, testPlan?, adr?, impl?, falsification?, retrospective?, malformed? }`. All inner data optional so missing-document plans render gracefully (T14).
- [x] Reuse parsers via workspace import — added subpath exports `@infinitedusky/indusk-mcp/trajectory/parser` and `@infinitedusky/indusk-mcp/falsification/log` to indusk-mcp's package.json. Admin app declares `"@infinitedusky/indusk-mcp": "workspace:*"` in deps. `parseTrajectory`, `readFalsificationLog`, `isFalsificationComplete` all imported and used in planning-reader.
- [x] Use `gray-matter` for frontmatter parsing. Catch parse errors AND detect silent-error mode (gray-matter swallows js-yaml errors in vitest's module-resolution path), set `malformed: true` on the Plan via "frontmatter block exists structurally but yielded empty data" detection.
- [x] Add unit tests in `apps/indusk-admin/src/lib/__tests__/planning-reader.test.ts` — 18 tests covering active plans (8), archived (3), master order (3), eval scorecards (4), fixture sanity (1).
- [x] Create `apps/indusk-admin/test-fixtures/sample-project/.indusk/planning/` with 5 sample plans: well-formed (alpha-feature), brief-only (beta-bugfix), missing-ADR (gamma-missing-adr), malformed (delta-malformed), archived (zeta-archived) + master.md + eval/results.log.

#### Phase 2 Verification
- [x] (no tests flip at this phase — reason: infra) — Phase 2 builds the data layer; trajectory tests for the data layer's behavior are unit tests on `planning-reader.ts` itself, which are independent of T1–T16. T3, T13, T14 become writable here but pass at Phase 3 / 5.
- [x] `planning-reader.test.ts` unit tests pass — 32 tests pass (18 new planning-reader + 14 existing component tests), 3 skipped (T2/T4/T5 placeholders awaiting Phase 3).

#### Phase 2 Context
- [x] Added to CLAUDE.md Conventions: "**admin-ui reuses indusk-mcp parsers via workspace import** — never duplicate parsing logic..." + the subpath-export mechanism + the additive-non-breaking note.

#### Phase 2 Document
- [x] Updated `apps/indusk-docs/src/reference/admin-ui/component-conventions.md` with a new "Data layer — reuse, don't duplicate" section: parser-reuse table, the subpath-export config snippet, "why direct filesystem reads, not an MCP tool" rationale, and the malformed-frontmatter rail-integrity property.

### Phase 3: Sidebar + plan list

- [x] Wire `src/app/layout.tsx` to call `readActivePlans` + `readArchivedPlans` + `readMasterPlanOrder` (server component, async). Pass to Sidebar as props.
- [x] In `src/components/PlanList.tsx`: render active plans in master.md order; archive section below as a `<CollapsibleSection title="Archived" defaultOpen={false}>`.
- [x] Each plan list item: name + status badge + clickable link to `/plan/[name]`.
- [x] Update tests T2, T3, T4 to flip from `(write red)` to `passing` — they should now actually render the sidebar.

#### Phase 3 Verification
- [x] T2 passes (sidebar lists active plans) — 2 PlanList tests under T2 group, both green
- [x] T3 passes (master.md ordering) — 2 PlanList tests under T3 group covering master-ordered and Unordered fallback, both green
- [x] T4 passes (archive section separate + collapsed) — 2 PlanList tests under T4 group, both green

#### Phase 3 Context
- [x] Add to CLAUDE.md Conventions: "**admin-ui sidebar order is canonical from `master.md`** — to reorder plans in the UI, edit `.indusk/planning/master.md`'s pipeline table. The sidebar reflects whatever `readMasterPlanOrder` parses; plans not mentioned in master.md appear in an 'Unordered' group at the bottom."

#### Phase 3 Document
- [x] (folded into Phase 6's overview page — no separate page needed for sidebar behavior)

### Phase 4: Plan detail (main pane)

- [x] Create `src/app/plan/[name]/page.tsx` — server component; reads the named plan via `planning-reader`; renders detail.
- [x] Plan detail layout:
  - Header: plan name + overall status — `<PlanHeader>` (in `PlanDetail.tsx`)
  - Brief section: Problem + Proposed Direction (markdown rendered) — `<BriefSection>` via `<Markdown>`
  - Test plan section (if present): assertion table — collapsible Markdown render of test-plan.md content
  - ADR Goal section (if present): the Goal paragraph + Y-statement decision summary (collapsed) — collapsible Markdown render of adr.md content
  - Phases section: each phase as `<CollapsibleSection>` containing the trajectory `<Table>`. Each trajectory row's State cell uses `<Badge variant={state}>` — `<PhasesSection>` + `extractPhases` util in `src/lib/phases.ts`.
- [x] Markdown rendering: picked `react-markdown` ^10.1.0 over `marked`. Rationale: returns a React element tree (no `dangerouslySetInnerHTML`, intrinsically XSS-safe), idiomatic for Next.js server components, bundle-size delta irrelevant for the admin UI's surface. Wrapped in `src/components/Markdown.tsx` so the import surface is `import { Markdown }` everywhere — switching libraries later only touches that one file.
- [x] Update tests T5, T6, T7, T8 to flip from `(write red)` to `passing` — authored `src/components/PlanDetail.test.tsx` with 9 tests covering T5/T6/T7/T8 + missing-document graceful-render + malformed banner. Removed legacy `it.skip` for T5 in `PlanList.test.tsx` (now covered by PlanDetail.test.tsx).

#### Phase 4 Verification
- [x] T5 passes (clicking plan shows content) — covered by PlanDetail rendering test + the PlanList link href test from Phase 3
- [x] T6 passes (brief Problem + Direction visible) — PlanDetail.test.tsx asserts Markdown-rendered Problem + Proposed Direction headings
- [x] T7 passes (impl phases as collapsible) — PlanDetail.test.tsx asserts every phase has aria-expanded, default closed
- [x] T8 passes (trajectory table with all columns) — PlanDetail.test.tsx asserts header cells = ID, Asserts, Writable at, Passes at, State + matched-by-passesAt rows + filter correctness
- [x] T9 passes (color coding from Phase 1 now visible in real trajectory data) — Phase 1 already proved the Badge variants render correct colors; PhasesSection wires `<Badge variant={state}>` so the real trajectory data inherits the same colors

#### Phase 4 Context
- [x] Add to CLAUDE.md Known Gotchas (if relevant): "**admin-ui markdown rendering**: Phase 4 picked `react-markdown` over `marked` because react-markdown returns a React element tree (no dangerouslySetInnerHTML, no separate sanitization step), more idiomatic for Next.js server components, and the bundle-size delta is irrelevant for an admin UI. Sanitization is intrinsic to react-markdown's design — no string injection. To swap libraries, change only `apps/indusk-admin/src/components/Markdown.tsx`; every call site uses `<Markdown>` not `<ReactMarkdown>`."

#### Phase 4 Document
- [x] (folded into Phase 6's overview page)

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
