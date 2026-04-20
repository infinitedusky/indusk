---
title: "InDusk Admin UI — Research"
date: 2026-04-19
status: complete
---

# InDusk Admin UI — Research

This plan is the first concrete instance of the broader InDusk-Interface vision (originally captured at `.indusk/research/indusk-interface.md`). The research below was seeded from that doc, then narrowed to the v1 admin UI scope — a Linear-clean, read-only viewer over `.indusk/planning/` that doubles as the sales-demo asset for the Dusk system.

## Question

What should v1 of an InDusk admin UI look like, what data does it surface, what stack ships fastest without compounding architectural risk, and what does it intentionally NOT do (so v2+ can land cleanly when more data sources exist)?

## Findings

### 1. Why a UI at all (motivation)

Two converging pressures:

- **Demo / sales asset.** The trajectory + falsification + per-phase-test-states story is what's *unique* to InDusk. Local telemetry is table stakes (Honeycomb/Dash0 do it); typed structured graphs are the long-term Arc 2 vision but won't ship for weeks. The trajectory is the differentiator that could ship as a visual artifact today, off the existing planning files. A UI that shows "watch test T37 stay red through Phases 1-8, flip green at Phase 9 — that's the tripwire firing" would do for demos what the changelog can't.

- **Non-code-forward interface (longer-term).** Much of what InDusk does isn't code — planning, reviewing plans, tracking progress, browsing eval results, searching past sessions. These belong in a UI, not a chat-panel-next-to-code-editor. v1 of the admin UI starts the path toward "InDusk as project management tool where AI agents do the work and code is one of several outputs."

### 2. What's already in `.indusk/planning/` (data inventory)

| Source | Shape | What v1 surfaces |
|--------|-------|------------------|
| `.indusk/planning/{name}/brief.md` | Markdown + frontmatter (`status`, `date`, `title`) | Title, status, problem statement, proposed direction |
| `.indusk/planning/{name}/test-plan.md` | Markdown + frontmatter, behavioral assertions table | Assertion list with mechanisms (where present) |
| `.indusk/planning/{name}/adr.md` | Markdown + Y-statement + Decision section | Goal, decision summary |
| `.indusk/planning/{name}/impl.md` | Markdown + frontmatter (`workflow`, `trajectory: required`, `gate_policy`) + Test Trajectory table + phased checklist | **THE KEY DATA**: phases, trajectory rows with State, per-phase Verification/Document/Context items, checklist progress |
| `.indusk/planning/{name}/falsification.md` | Append-only log of hypotheses tested | Hypotheses + outcomes (fix-in-scope / spawn-plan / accept) + terminator entry |
| `.indusk/planning/{name}/retrospective.md` | Markdown reflection | Lessons, what-we-learned, what-we'd-do-differently |
| `.indusk/planning/master.md` | Pipeline table + arcs | The CANONICAL ordering of plans — UI sidebar uses this |
| `.indusk/planning/archive/{name}/` | Same shape as active plans | Listed in a separate, less-prominent "Archived" section |

Crucially: every existing parser already lives in `apps/indusk-mcp/src/lib/`:

- Trajectory table parser: `apps/indusk-mcp/src/lib/trajectory/parser.ts` (`parseTrajectory(body)` returns `{ rows, deferred, present }`)
- Falsification log reader: `apps/indusk-mcp/src/lib/falsification/log.ts` (read functions exist alongside `appendHypothesis`)
- Frontmatter parsing: standard `gray-matter` pattern across the codebase

The UI doesn't need to invent any parsers. It can call the same library functions the validator hooks call.

### 3. What v1 explicitly does NOT show

Per Arc 1 discipline (master.md cross-arc rule): **no surface in Arc 1 displays evaluator-written graph data** until Arc 2 (`graph-knowledge-architecture`) settles the typed-knowledge schema. v1 shows plan files (markdown) and trajectory states (parsed from impl.md) — both stable shapes that won't be rewritten when Arc 2 changes the graph.

Specifically out of scope for v1:
- Graphiti episodes (Arc 2 #4 changes the schema — would need rewrite)
- Knowledge-graph viewer (defer to admin-ui v2 once schema settles, master.md plan #12)
- Test-run history timeline (defer until `test-run-history` plan #2 captures the data)
- Local telemetry / "what just happened" debug panel (defer until `local-telemetry` plan #3 captures the data)

What v1 CAN show without violating the discipline:
- Eval scorecards from `.indusk/eval/results.log` — these are JSONL, schema is stable, not graph data
- Eval findings from `.indusk/eval/findings.json` — stable schema

### 4. Spectrum of interface options (from the seed research)

| Option | Effort | Reach | Control |
|--------|--------|-------|---------|
| VS Code extension pack | Low | High (VS Code users) | Low (limited to VS Code APIs) |
| VS Code fork (like Cursor) | High | High | High (full control) |
| **Standalone web app + Claude Code CLI** | **Medium** | **Medium** | **High** |
| Electron app wrapping Claude Code | Medium | Medium | Medium |
| VS Code extension with custom webview panels | Medium | High | Medium |

For v1: **standalone web app** is the right pick. Reasoning:
- Doesn't entangle UI work with VS Code's API surface (which would slow iteration and lock-in to VS Code as the only host)
- Independent dev velocity — UI can ship without touching the MCP server, hooks, or skills
- Demoable on its own (`indusk ui` → browser opens) — sales asset shape
- Future paths (VS Code extension wrapping the same web app, Electron desktop app) all remain open

### 5. Tech stack decisions

- **Framework**: Next.js (App Router). User preference for consistency with Numero and other React apps. App Router is the current default for new Next.js apps.
- **UI primitives**: Tailwind + custom components. NOT shadcn-ui (user pain with its opinionated form controls — the number-stepper input is a common irritant). NOT Radix (200KB+ bundle for what amounts to ~5 primitives we need). Custom Tailwind components for v1: Sidebar, Collapsible Section, Table, Badge, Button. ~200-400 LOC total.
- **Component reuse discipline (load-bearing)**: every reusable visual primitive (Button, Badge, Table, Collapsible, Sidebar) lives in ONE place — `apps/indusk-admin/src/components/ui/`. NEVER inline duplicate JSX for something that should be a primitive. NEVER hand-author SVG icons (use `lucide-react`). NEVER write `<button className="px-4 py-2 bg-blue-500 ...">` inline if `<Button variant="primary">` already exists. The cleanup-debt cost of duplicated components is the explicit reason for the discipline. Impl phases include component-extraction items where needed.
- **Icons**: `lucide-react` — small, no controversy, ubiquitous.
- **TypeScript**: strict mode (matches the rest of the indusk-mcp codebase).
- **Markdown rendering**: TBD between `react-markdown` (popular, renders fine) and `marked` (lighter weight). Decision deferred to impl since both are off-the-shelf.
- **No state management library**: page-level `useState` + URL state (`searchParams`) is enough for read-only browsing.

### 6. Serving model — `indusk ui` CLI

A new subcommand on the `indusk` CLI (lives at `apps/indusk-mcp/src/bin/commands/ui.ts`):

```
indusk ui              # starts dev server on port 3939, opens browser
indusk ui --port 4000  # custom port
indusk ui --no-open    # don't auto-open browser
```

Internally: spawns `next dev` against the admin app's directory. Auto-picks an unused port if 3939 is taken. Logs the URL.

The admin UI itself lives at `apps/indusk-admin/` (sibling to `apps/indusk-mcp/` and `apps/indusk-docs/`). It reads from `process.cwd()` to find `.indusk/planning/` (resolved via the same `findProjectRoot` walk-up pattern other CLI commands use).

For v2+: a `--build` mode that produces a static export consumable from any web server, useful for hosted demos / shared dashboards.

### 7. Test-plan dogfood notes

This is the first **feature** plan since 1.22.0 introduced the `test-plan.md` document type. Test-plan flow:
- Behavioral assertions only ("user sees X" not "function returns Y")
- Mechanism column names HOW each gets tested (vitest unit, e2e, manual, etc.)
- Test plan acceptance gates ADR start
- Impl trajectory rows derive 1:1 from test plan assertions

For a UI, behavioral assertions are particularly important — the surface IS what the user sees. Should ground discipline well; but worth watching whether assertions drift toward implementation detail (e.g., "Sidebar component renders" — that's functional. "When you open the app, you see a list of plans" — that's behavioral).

### 8. Failure modes to anticipate (for the test plan)

What could go wrong with a read-only viewer over markdown files?

- Plans with malformed frontmatter (parser throws → blank screen)
- Plans missing one of the standard docs (test-plan exists, ADR doesn't — UI has to render gracefully)
- Trajectory tables in non-standard formats (column reorder, missing optional columns)
- Plans with very long checklists (perf — but unlikely at current scale)
- Empty `.indusk/planning/` (no plans yet — UI shouldn't blank-screen)
- File watch lag (user edits impl.md, UI doesn't refresh — only matters if we add live-watch)

These should become test plan assertions: "When the planning directory is empty, the UI shows an empty-state message, not a crash." "When a plan's brief.md has malformed frontmatter, the UI shows the plan in the sidebar with a 'malformed' indicator and lets you click in to see the raw text."

## Open Questions

- **Markdown rendering library** — `react-markdown` vs `marked` vs minimal custom. Decide in impl.
- **Live file watch vs static read-on-load** — v1 could be either. Static is simpler; watch makes the demo feel more dynamic. Probably static for v1, defer watch to v2 if it matters.
- **How to display trajectory rows visually** — table is the obvious shape (matches impl.md). Could add per-state color coding (`passing` green, `blocked` red, `planned` gray, etc.). Probably yes by default — that's the visual punch for demos.
- **Master.md ordering** — UI sidebar reads master.md to order plans. What if a plan is in `.indusk/planning/` but NOT mentioned in master.md? Show it in an "Unordered" group at the bottom.

## Sources

- `.indusk/research/indusk-interface.md` — broader vision, seed for this research
- `.indusk/research/visual-planning.md` — orthogonal but related (diagrams as source of truth)
- `.indusk/planning/master.md` — current pipeline + the Arc 1/2/3 framing
- `apps/indusk-mcp/src/lib/trajectory/parser.ts` — existing trajectory parser
- `apps/indusk-mcp/src/lib/falsification/log.ts` — existing falsification log reader

## Related Plans

- **`test-run-history` (master.md #2)** — captures vitest results into JSONL; powers admin-ui v2's timeline view. v1 of admin-ui ships before this; v2 adds the timeline panel after.
- **`local-telemetry` (master.md #3)** — captures runtime spans; powers admin-ui v2's "what just happened" debug panel.
- **`graph-knowledge-architecture` (master.md #4)** — when the typed knowledge graph schema lands, admin-ui v2 can finally include a knowledge-graph viewer. v1 explicitly does NOT show graph data to avoid rewrite.
- **`hermes-inspired-improvements` (master.md #8)** — transcript search via FTS5. Could become a UI surface in v2+ ("search past sessions for X").
- **`falsify-spawn-pattern` (master.md #10)** — orthogonal but the admin UI could surface falsification logs side-by-side with trajectories, making the goal-flip ritual more visible.
- **`complementary-personas` (master.md #11)** — far future. UI would gain a "review by skeptic" button.
- **`dusk-v2`** — the v2 rewrite. v1 admin-ui informs the architectural direction.
