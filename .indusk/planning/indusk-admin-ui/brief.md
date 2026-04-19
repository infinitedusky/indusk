---
title: "InDusk Admin UI"
date: 2026-04-19
status: accepted
---

# InDusk Admin UI — Brief

## Problem

The Test Trajectory + falsification ritual + per-phase test discipline is what makes InDusk *unique*. It's also currently invisible — the only way to see it is to read markdown files (`.indusk/planning/{name}/impl.md`) and parse the trajectory table mentally. For demos, that means walking someone through a markdown file in VS Code; for our own use, it means scrolling impl.md to figure out what's passing.

We need a visual surface that shows, at a glance: *what plans are open, what phase each is in, what tests were supposed to flip at each phase, and what actually passed.* The trajectory's whole point is that intermediate-phase test states are a tripwire signal — but you can't see a tripwire firing if you have to read text to find it.

There's no admin or operator interface for InDusk today. Every other comparable tool (Linear for issues, GitHub Projects for boards, Jira for everything) has one. The lack of a UI is the single biggest gap when explaining InDusk to anyone who didn't already build it.

## Proposed Direction

Build **`indusk-admin-ui`** — a standalone Next.js + React web app served via a new `indusk ui` CLI command. v1 is a **read-only viewer** over `.indusk/planning/` and adjacent files, designed for both real operator use (browse plan state during `/work`) and as the sales-demo asset (show prospects what InDusk's discipline looks like, visually).

**v1 behavior**:
- `indusk ui` opens browser at `localhost:3939`
- Sidebar lists open plans, ordered by `master.md` pipeline; archived plans collapsed in a less-prominent section
- Click a plan → main pane shows phases (collapsible), each phase shows trajectory rows with State color-coded (passing green, blocked red, planned gray, etc.)
- Per phase, show what was supposed to flip vs what actually passed — the visual confirmation of the trajectory discipline
- Falsification log surfaces alongside (hypotheses tested + outcomes)
- Eval scorecards from `results.log` listed per plan when commits map to a plan

**v1 deliberately does NOT do**:
- Mutate any planning files (writes belong to the working agent, not the UI)
- Show graph/Graphiti data (Arc 1 discipline — defer until Arc 2's `graph-knowledge-architecture` settles the schema)
- Show test-run history timelines (depends on `test-run-history` plan #2)
- Show runtime telemetry / "what just happened" panel (depends on `local-telemetry` plan #3)

**Tech stack**:
- Next.js (App Router) + React + Tailwind
- Custom components (no shadcn-ui, no Radix) + `lucide-react` for icons
- TypeScript strict
- New app at `apps/indusk-admin/`
- New CLI subcommand at `apps/indusk-mcp/src/bin/commands/ui.ts`

**Component reuse discipline (load-bearing)**: every reusable visual primitive lives in ONE place. No inline JSX duplicating what should be a primitive. No hand-authored SVGs (use `lucide-react`). No one-off `<button className="...">` if `<Button variant="...">` already exists. The cleanup-debt cost of duplicated components is the explicit reason for the rule.

## Context

This is the first concrete instance of the broader InDusk-Interface vision (`.indusk/research/indusk-interface.md` — non-code-forward interface, project management tool where AI agents do the work). v1 starts simple (read-only viewer over markdown) so we ship the demo asset fast without entangling with VS Code APIs, daemon design, auth, or other distractions. Future paths (VS Code extension wrapping the same web app, Electron desktop, hosted dashboard) all remain open.

This is also the **first feature plan post-1.22.0** to dogfood the new test-plan flow. The behavioral assertions for a UI ("user opens app, sees plans" not "Sidebar component renders") will be a discipline test for the test-plan format itself.

See `research.md` for the full data inventory, parser reuse strategy, failure modes to anticipate, and tech-stack rationale.

## Scope

### In Scope
- New app at `apps/indusk-admin/` — Next.js (App Router) + React + Tailwind + custom components + lucide-react
- New CLI subcommand `indusk ui` at `apps/indusk-mcp/src/bin/commands/ui.ts` — spawns `next dev` against the admin app, opens browser
- Read-only file-system access to `.indusk/planning/{*,archive/*}/`, `.indusk/eval/results.log`, `.indusk/eval/findings.json`
- Reuse of existing parsers: `apps/indusk-mcp/src/lib/trajectory/parser.ts` (trajectory table) and `apps/indusk-mcp/src/lib/falsification/log.ts` (falsification log)
- Sidebar nav with plans ordered by `master.md`; archive in a separate section
- Per-plan view: brief summary, test plan assertions, ADR goal/decision, phase list with collapsible trajectory tables, falsification log, eval scorecards (when present)
- Color-coded trajectory state visualization
- Empty-state and malformed-input handling (no blank screens on edge cases)
- Component primitives in `apps/indusk-admin/src/components/ui/` — Sidebar, CollapsibleSection, Table, Badge, Button (built once, reused everywhere)

### Out of Scope
- Any write/mutate operations (those belong to the working agent + skills)
- Graph/Graphiti data display (Arc 1 discipline)
- Test-run history timeline (waits for plan #2)
- Runtime telemetry debug panel (waits for plan #3)
- Live file-watching / hot-reload of planning state (static read-on-load is enough for v1)
- Auth / multi-user / hosted deployment
- Build-once-static export mode (v2+ if needed)
- VS Code extension wrapping (v2+)
- Markdown WYSIWYG editor or ANY editing surface
- Dashboard with multi-panel layout (Linear-clean single-pane is enough for v1)

## Success Criteria

- Running `indusk ui` from this repo opens a browser to a sidebar of all active plans, ordered by master.md
- Clicking a plan shows its phases; expanding a phase shows the trajectory table with state-color-coded rows
- Falsification log appears for any plan that has one, with hypotheses + outcomes legible at a glance
- Eval scorecards for the project's commits appear (when `results.log` has entries matching a plan's date range)
- Edge cases (empty planning dir, malformed frontmatter, missing optional docs) render gracefully — no blank screens, no JS errors in console
- Demo flow: in under 30 seconds, an outsider can be shown a plan, an open phase, a passing test, and a failing test (and understand what each means)
- Component reuse audit: zero inline duplication of primitives anywhere in the app

## Depends On

None — this plan is independent of the Arc 2 evaluator-improvement chain. The data sources it reads (`.indusk/planning/`, `.indusk/eval/*`) are stable.

## Blocks

- **`test-run-history` (master.md #2)** — admin-ui v2 timeline view consumes its data
- **`local-telemetry` (master.md #3)** — admin-ui v2 debug panel consumes its data
- **`indusk-admin-ui` v2 (master.md #12)** — the knowledge-graph viewer extension; requires Arc 2's `graph-knowledge-architecture` to settle the schema first
