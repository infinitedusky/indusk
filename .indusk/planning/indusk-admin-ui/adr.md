---
title: "InDusk Admin UI"
date: 2026-04-19
status: accepted
---

# InDusk Admin UI

## Goal

**Ship a standalone Next.js web app — served via `indusk ui` — that turns the InDusk planning discipline from "read these markdown files" into a visual surface that an outsider can grasp in under 30 seconds.**

The trajectory + falsification + per-phase test-state discipline is what makes InDusk unique, but today the only way to see it is to scroll `.indusk/planning/{name}/impl.md` and parse the trajectory table mentally. That's a non-starter for demos and a daily friction for operators. After this ADR's decisions ship: `indusk ui` opens a browser, plans appear in master.md order, clicking a plan shows its phases with color-coded test states, and the discipline becomes legible at a glance — without entangling the work with VS Code APIs, daemon design, auth, or any other architecture that would slow v1's path to a working demo.

## Y-Statement

**In the context of:**
A user (operator or sales prospect) who needs to see the current state of the InDusk planning discipline — what plans are open, what phase each is in, what tests were supposed to flip at each phase, and what actually passed — without reading raw markdown files in a code editor.

**Facing:**
The trajectory + falsification + test-state data is the unique InDusk story but is currently invisible. Existing surfaces (VS Code with markdown rendering, the docs site) don't expose it as a navigable, color-coded, demoable artifact. Building inside VS Code (extension or fork) entangles UI iteration with VS Code's API surface and locks the work to that host. Building anything fancier than v1 (Kanban, timeline, knowledge-graph viewer) requires data sources that don't yet exist (test-run history, local telemetry, typed Graphiti schema).

**We decided for:**
A standalone Next.js (App Router) + React + Tailwind web application served on localhost via a new `indusk ui` CLI subcommand. v1 is read-only: it reads `.indusk/planning/{*,archive/*}/`, `.indusk/eval/results.log`, and `.indusk/eval/findings.json` directly from the filesystem and renders a sidebar-and-pane layout. UI primitives are custom-built in Tailwind (no shadcn-ui, no Radix); icons via `lucide-react`. Tests use `vitest-browser-mode` (vitest API + real browser) so visual rendering is genuinely verified. A new app at `apps/indusk-admin/` sits alongside the existing `apps/indusk-mcp/` and `apps/indusk-docs/`. A load-bearing component-reuse discipline ensures every visual primitive lives in exactly one place — no inline JSX duplicates of buttons, badges, or tables anywhere in the app.

**And against:**
A VS Code extension (locks UI iteration to VS Code's API surface; users without VS Code can't use it; harder to demo to non-developers); a VS Code fork like Cursor (massive maintenance burden for v1 scope); Electron (adds a desktop runtime layer for what's fundamentally a localhost web view); shadcn-ui (the opinionated form controls — number-stepper inputs especially — have been a recurring frustration); Radix (200KB+ bundle for the ~5 primitives v1 actually needs); a hosted SaaS dashboard (introduces auth, deployment, and shared-state complexity for what's currently a single-user local tool); any write/mutate operations in v1 (would create a second writer alongside the working agent, conflict potential, and design complexity that delays the demo asset); displaying graph/Graphiti data in v1 (would lock the display layer to a schema that Arc 2 will rewrite); test-run timelines and runtime telemetry panels in v1 (depend on plans 2 and 3 — defer to admin-ui v2 once those data sources exist).

**To achieve:**
A working demo asset within days, not weeks; a real operator surface for browsing plan state during `/work` rather than scrolling impl.md; an architecturally clean foundation that v2+ can extend (Kanban, timeline, knowledge-graph viewer) once the data sources land; and the first test-plan-flow dogfood at feature scope, exercising the 1.22.0 discipline on a non-trivial plan to surface any rough edges in the planner skill itself.

**Accepting:**
A new app to maintain (`apps/indusk-admin/`) plus a new CLI subcommand (`indusk ui`); duplicate effort if any v1 component primitives later need refactor when shadcn-ui-or-equivalent is reconsidered (cost: ~200-400 LOC of custom components); v1 scope intentionally excludes features that demos might want (search, full-text, fancy timelines) to ship the core viewer fast; a slight tooling sprawl with three apps in the monorepo (`indusk-mcp`, `indusk-docs`, `indusk-admin`); the ongoing discipline cost of enforcing component reuse (every PR in this app needs an audit pass, eventually automated by the A16 vitest custom audit).

**Because:**
The trajectory discipline is InDusk's unique value proposition and it has no current visible surface. The cost of NOT having a visual surface — every demo requires walking someone through a markdown file, every operator interaction requires text-scrolling — is paid every day. A standalone web app is the lightest path to fixing that without making decisions (VS Code lock-in, daemon architecture, auth model) that would constrain future iterations. The v1 scope is deliberately small so it ships fast and proves the data-display patterns; v2+ extensions then have a working substrate to build on.

## Context

The plan sits at position #1 in master.md's Arc 1 ("working-agent observability + UI"), the demo-asset arc that runs in parallel with Arc 2 (the eval-rebuild work). Cross-arc discipline (master.md): no surface in Arc 1 displays evaluator-written graph data until Arc 2's `graph-knowledge-architecture` settles the typed-knowledge schema. v1 of admin-ui complies by reading only stable file shapes (markdown, JSONL scorecards, JSON findings) — none of which are at risk of rewrite when Arc 2 lands.

This is also the first **feature** plan since the test-plan document type was added in 1.22.0. The plan deliberately exercises that flow at scope (16 behavioral assertions in test-plan.md) to validate the discipline before Numero's larger refactor work depends on it.

See `research.md` for the full data inventory, parser-reuse strategy, and tech-stack rationale. See `brief.md` for the problem framing and scope boundaries. See `test-plan.md` for the 16 behavioral assertions and 2 deferred items.

## Decision

1. **Architecture: standalone Next.js (App Router) web app at `apps/indusk-admin/`.** Sibling to the existing `apps/indusk-mcp/` and `apps/indusk-docs/`. Reads from `process.cwd()` to find `.indusk/planning/` via the standard `findProjectRoot` walk-up pattern other CLI commands use.
2. **Serving: new `indusk ui` CLI subcommand at `apps/indusk-mcp/src/bin/commands/ui.ts`.** Spawns `next dev` against the admin app, opens browser at `localhost:3939` (auto-picks unused port if taken). Default `--no-open` flag for headless invocations.
3. **Tech stack: Next.js App Router + React + Tailwind + custom components + `lucide-react`.** TypeScript strict mode. No shadcn-ui, no Radix.
4. **Data access: direct filesystem reads.** No HTTP API, no MCP server intermediary. Reuse existing parsers from `apps/indusk-mcp/src/lib/trajectory/parser.ts` and `apps/indusk-mcp/src/lib/falsification/log.ts` — do not duplicate parsing logic.
5. **Test framework: `vitest-browser-mode`** (real browser via Playwright under the hood, vitest API). Fall back to `vitest + jsdom + react-testing-library` only if browser-mode bites during impl. Standalone Playwright reserved for cases needing multi-page navigation or network interception (none in v1).
6. **Read-only.** No mutations of any planning files. Writes belong to the working agent + skills. Mutating actions deferred to dusk-v2 or a future plan.
7. **Component reuse discipline (load-bearing).** Every reusable visual primitive (Sidebar, CollapsibleSection, Table, Badge, Button) lives at exactly one path: `apps/indusk-admin/src/components/ui/`. The discipline is structurally enforced via test assertion A16 (vitest custom audit greps source files for inline JSX patterns that should be primitives).

## Alternatives Considered

### VS Code extension
Reach is high (every VS Code user gets it), but UI iteration locks to VS Code's API surface (custom panels, theming, extension lifecycle). Demos to non-VS-Code-users (sales prospects, project managers) require explaining "you'd need to install VS Code first." Starts to look right *after* admin-ui v1 proves the data-display patterns; could become a future "VS Code extension that wraps the admin-ui's web view" — best of both worlds, but only viable as a v2+ followup.

### VS Code fork (Cursor model)
Maximum control, maximum maintenance cost. Justified for a long-term product strategy ("InDusk is a code editor"), not for the v1 demo-asset goal. Defer to dusk-v2 if/when InDusk-as-IDE becomes the strategy.

### Electron desktop app
Adds a desktop runtime layer for what's fundamentally a localhost web view. The web app already runs locally; Electron's value-add is "double-clickable .app file" which is real but small. If demand for that materializes, can be added as a thin Electron wrapper around the existing web app — no architectural rework needed.

### Hosted SaaS dashboard
Multi-user collaboration, shared dashboards, "see your team's plans." Requires auth, persistent storage of derived state, deployment infrastructure. All defer until single-user value is proven and demand for sharing emerges.

### shadcn-ui as the component library
The default for Next.js + Tailwind apps. But the user has experienced specific frustrations (the number-stepper input mangling decimals; the "polished by default" aesthetic that doesn't fit a utility UI). For ~5 primitives at 200-400 LOC, custom Tailwind is faster than configuring shadcn primitives to behave the way we want.

### Radix UI primitives directly
Full power, full primitives. But 200KB+ bundle for what we need — overkill at v1 scope. Custom Tailwind is simpler.

### vitest + jsdom + react-testing-library (standard)
The conventional choice. Faster than browser-mode, well-trodden. But jsdom doesn't render real CSS/layout, and the v1 UI's color-coded states (A9) genuinely need real-browser verification. vitest-browser-mode wins because it's vitest API + real browser. Fall back to jsdom-RTL is acceptable if browser-mode has rough edges.

### Playwright (standalone, separate config)
Full e2e tool, the right answer if we needed multi-page navigation, network interception, or real browser-only behaviors. v1 doesn't. vitest-browser-mode covers everything v1 needs with a single tool.

## Consequences

### Positive
- A working demoable visual surface for the trajectory discipline within days of impl start
- Operator surface for browsing plan state during `/work` (no more scrolling impl.md)
- Validates the test-plan flow (1.22.0) at feature scope — surfaces any rough edges in the discipline before Numero's larger refactor depends on it
- Architectural foundation for v2+ (Kanban, timeline, knowledge-graph viewer) without locking into VS Code or Electron
- Component-reuse discipline named structurally — A16 audit prevents debt accumulation from day one
- Independent of Arc 2 (eval rebuild) — can ship without entangling with that arc's longer-running plans
- Generalizable: works on any project with `.indusk/planning/` (Numero, chitin-sportsbook, etc.) once shipped to global indusk-mcp

### Negative
- A new app to maintain (`apps/indusk-admin/`) — small, but real (own dependencies, own build, own tests)
- A new CLI subcommand surface (`indusk ui`) that has its own failure modes (port collisions, browser detection, dev-server lifecycle)
- Component-reuse discipline costs ongoing audit attention — A16 mitigates but the discipline still requires PR-time enforcement
- Custom Tailwind primitives mean re-implementing wheels that shadcn/Radix already polish (cost paid in initial impl, recouped in lack of bundle bloat and library-API thrash)
- Three apps in the monorepo — slight tooling sprawl

### Risks
- **vitest-browser-mode immaturity**: it's relatively new (~2 years stable). Mitigation: fall back to jsdom-RTL during impl if it bites. Same test code mostly works.
- **Visual polish for the demo bar**: "good enough for ourselves" might not be "good enough for prospects." Mitigation: A15 (manual user test with an outsider in <30s) catches this in Phase 4 smoke. If polish is insufficient, iterate then.
- **File-format drift**: if planning file shapes change (e.g., new frontmatter fields, restructured trajectory tables), the UI silently misrenders. Mitigation: test fixtures cover several shapes (A2, A8, A13). Adding new shape variants to fixtures is the canonical path when the underlying format evolves.
- **Component reuse discipline drift over time**: the audit (A16) catches structural duplication but not subtle drift (two components both called Button with slightly different APIs). Mitigation: human PR review is still load-bearing. The audit is structural insurance, not full coverage.

## Documentation Plan

### Pages
- **New: `apps/indusk-docs/src/reference/admin-ui/overview.md`** — what the admin UI is, how to run it (`indusk ui`), what each pane shows, screenshots
- **New: `apps/indusk-docs/src/reference/admin-ui/component-conventions.md`** — the load-bearing component-reuse discipline, the audit (A16), how to add new primitives correctly
- **Update: `apps/indusk-docs/src/guide/getting-started.md`** — mention `indusk ui` as part of the operator surface

### Diagrams
- Architecture diagram (Mermaid) in `reference/admin-ui/overview.md` showing: `indusk ui` CLI → spawns Next.js dev server → browser opens → app reads `.indusk/planning/` files via existing parsers → renders sidebar + main pane
- Component hierarchy sketch (Excalidraw, optional) showing the primitive composition pattern: Sidebar contains PlanList, PlanList items use Badge for state, etc.

### Changelog
- Entry: "Added `indusk ui` CLI subcommand and standalone admin web app at `apps/indusk-admin/`. Read-only viewer over `.indusk/planning/`, served on localhost via Next.js. v1 reflects the Test Trajectory + falsification discipline visually for the first time."

### ADR in Docs
- Yes — publish to `apps/indusk-docs/src/decisions/indusk-admin-ui.md` as part of Phase 4 (retrospective handoff). The decision shape (standalone web app over VS Code/Electron/hosted) is durable knowledge worth surfacing.

## References

- `.indusk/planning/indusk-admin-ui/research.md` — broader vision context + data inventory + tech-stack rationale
- `.indusk/planning/indusk-admin-ui/brief.md` — problem framing + v1 scope boundaries
- `.indusk/planning/indusk-admin-ui/test-plan.md` — 16 behavioral assertions + 2 deferred items
- `.indusk/research/indusk-interface.md` — original seed research on InDusk-as-project-management-tool
- `.indusk/research/visual-planning.md` — orthogonal but related: diagrams as source of truth
- `.indusk/planning/master.md` — pipeline ordering, Arc 1/2/3 framing, cross-arc discipline rule
- `apps/indusk-mcp/src/lib/trajectory/parser.ts` — existing trajectory table parser (to be reused)
- `apps/indusk-mcp/src/lib/falsification/log.ts` — existing falsification log reader (to be reused)
